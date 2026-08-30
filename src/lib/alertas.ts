/**
 * Motor de alertas determinísticos.
 *
 * São instantâneos e não dependem de IA: regras fechadas sobre os dados do
 * banco. Alimentam o feed do dashboard e também são enviados como
 * "diagnóstico automático" no prompt dos insights gerenciais.
 *
 * As 10 regras do documento de calibração estão implementadas em
 * `avaliarRegras`, na mesma ordem, e todas quantificam o impacto em R$
 * sempre que isso é possível.
 */

import { prisma } from '@/lib/prisma';
import { arredondar, dividir, variacaoPercentual } from '@/lib/utils';
import {
  formatarMoeda,
  formatarPercentual,
  intervaloPeriodo,
  deslocarPeriodo,
  diasNoPeriodo,
  periodoDe,
} from '@/lib/formatacao';
import {
  buscarOSDoPeriodo,
  calcularBreakEven,
  calcularCustosFixosMensais,
  getContextoCalculo,
  horasEfetivas,
  margemContribuicaoOS,
  precoPraticado,
  resumirPeriodo,
  type OSAgregavel,
} from '@/lib/calculos';
import type { Alerta, ContextoCalculo, NivelAlerta } from '@/types';

interface EntradaAlerta {
  regra: string;
  nivel: NivelAlerta;
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  impactoFinanceiro?: number | null;
  link?: string;
}

function alerta(e: EntradaAlerta): Alerta {
  return {
    id: `${e.regra}-${Math.abs(hashTexto(e.titulo))}`,
    regra: e.regra,
    nivel: e.nivel,
    titulo: e.titulo,
    descricao: e.descricao,
    acaoSugerida: e.acaoSugerida,
    impactoFinanceiro: e.impactoFinanceiro ?? null,
    link: e.link,
    criadoEm: new Date().toISOString(),
  };
}

function hashTexto(texto: string): number {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) {
    h = (h << 5) - h + texto.charCodeAt(i);
    h |= 0;
  }
  return h;
}

const PESO_NIVEL: Record<NivelAlerta, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };

/**
 * Avalia todas as regras e devolve os alertas ativos, ordenados por
 * urgência e depois por impacto financeiro.
 */
export async function calcularAlertas(
  periodo = periodoDe(new Date()),
  ctx?: ContextoCalculo,
): Promise<Alerta[]> {
  try {
    const contexto = ctx ?? (await getContextoCalculo());
    const alertas = await avaliarRegras(periodo, contexto);
    return alertas.sort((a, b) => {
      const porNivel = PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel];
      if (porNivel !== 0) return porNivel;
      return (b.impactoFinanceiro ?? 0) - (a.impactoFinanceiro ?? 0);
    });
  } catch (erro) {
    console.error('[alertas] Falha ao calcular alertas:', erro);
    return [];
  }
}

async function avaliarRegras(periodo: string, ctx: ContextoCalculo): Promise<Alerta[]> {
  const { parametros: p, derivados } = ctx;
  const saida: Alerta[] = [];

  const periodoAnterior = deslocarPeriodo(periodo, -1);
  const periodo2Anterior = deslocarPeriodo(periodo, -2);

  const [ordens, ordensAnterior, ordens2Anterior] = await Promise.all([
    buscarOSDoPeriodo(periodo),
    buscarOSDoPeriodo(periodoAnterior),
    buscarOSDoPeriodo(periodo2Anterior),
  ]);

  const resumo = resumirPeriodo(periodo, ordens, p, derivados);
  const resumoAnterior = resumirPeriodo(periodoAnterior, ordensAnterior, p, derivados);
  const resumo2Anterior = resumirPeriodo(periodo2Anterior, ordens2Anterior, p, derivados);

  // ── Regra 1 — Ociosidade alta ────────────────────────────────────────────
  const ocupacaoPct = arredondar(dividir(resumo.horasRealizadas, derivados.totalHorasProdutivas) * 100, 1);
  const ociosidadeReal = arredondar(Math.max(0, 100 - ocupacaoPct), 1);
  const LIMIAR_OCIOSIDADE = 15;
  if (ociosidadeReal > LIMIAR_OCIOSIDADE && resumo.horasRealizadas > 0) {
    const pontosExcedentes = ociosidadeReal - LIMIAR_OCIOSIDADE;
    const horasDesperdicadas = derivados.totalHorasProdutivas * (pontosExcedentes / 100);
    const impacto = arredondar(horasDesperdicadas * (derivados.thh + derivados.cfr));
    saida.push(
      alerta({
        regra: 'ociosidade_alta',
        nivel: 'alto',
        titulo: `Ociosidade em ${formatarPercentual(ociosidadeReal)}`,
        descricao:
          `A fábrica realizou ${resumo.horasRealizadas.toFixed(0)}h de ` +
          `${derivados.totalHorasProdutivas.toFixed(0)}h produtivas disponíveis. ` +
          `Cada ponto acima de ${LIMIAR_OCIOSIDADE}% custa ` +
          `${formatarMoeda(derivados.totalHorasProdutivas * 0.01 * (derivados.thh + derivados.cfr))}/mês ` +
          'em capacidade desperdiçada.',
        acaoSugerida:
          'Puxe orçamentos represados para execução ou prospecte serviços de menor ticket ' +
          'para preencher as janelas dos centros menos ocupados.',
        impactoFinanceiro: impacto,
        link: '/indicadores',
      }),
    );
  }

  // ── Regra 2 — OS com margem insuficiente ─────────────────────────────────
  const abaixoMinimo = ordens
    .map((os) => ({ os, margem: margemContribuicaoOS(os, p.aliquotaImpostos) }))
    .filter((x) => x.margem < p.margemMinima)
    .sort((a, b) => a.margem - b.margem);

  for (const { os, margem } of abaixoMinimo.slice(0, 5)) {
    const preco = precoPraticado(os);
    const precoIdeal = dividir(os.custoTotalCalc, 1 - p.margemMinima / 100) /
      (1 - p.aliquotaImpostos / 100);
    const perda = arredondar(Math.max(0, precoIdeal - preco));
    saida.push(
      alerta({
        regra: 'margem_insuficiente',
        nivel: 'critico',
        titulo: `OS ${os.numero} com margem de ${formatarPercentual(margem)}`,
        descricao:
          `Abaixo do mínimo de ${formatarPercentual(p.margemMinima)}. ` +
          `Preço praticado ${formatarMoeda(preco)} contra um custo de ` +
          `${formatarMoeda(os.custoTotalCalc)}.` +
          (margem < 0 ? ' Esta OS está dando prejuízo.' : ''),
        acaoSugerida:
          `Para atingir a margem mínima o preço precisaria ser ${formatarMoeda(precoIdeal)} ` +
          `(${formatarMoeda(perda)} a mais). Reavalie escopo, tempos ou insumos.`,
        impactoFinanceiro: perda,
        link: `/ordens/${os.id}`,
      }),
    );
  }

  // ── Regra 3 — Concentração de clientes ───────────────────────────────────
  if (resumo.faturamento > 0) {
    const porCliente = new Map<string, number>();
    for (const os of ordens) {
      porCliente.set(os.clienteId, (porCliente.get(os.clienteId) ?? 0) + precoPraticado(os));
    }
    const ranking = [...porCliente.entries()].sort((a, b) => b[1] - a[1]);
    const topo = ranking[0];
    if (topo) {
      const pct = arredondar(dividir(topo[1], resumo.faturamento) * 100, 1);
      if (pct > p.concentracaoClienteMaxPct) {
        const cliente = await prisma.cliente
          .findUnique({ where: { id: topo[0] }, select: { nome: true } })
          .catch(() => null);
        saida.push(
          alerta({
            regra: 'concentracao_clientes',
            nivel: 'alto',
            titulo: `${cliente?.nome ?? 'Cliente principal'} concentra ${formatarPercentual(pct)} do faturamento`,
            descricao:
              `${formatarMoeda(topo[1])} de ${formatarMoeda(resumo.faturamento)} vieram de um ` +
              `único cliente, acima do limite de ${formatarPercentual(p.concentracaoClienteMaxPct)}. ` +
              'A perda desse cliente comprometeria o ponto de equilíbrio.',
            acaoSugerida:
              'Prospecte contas novas no mesmo segmento para diluir a dependência e ' +
              'negocie contrato de recorrência com o cliente atual.',
            impactoFinanceiro: arredondar(topo[1]),
            link: '/clientes',
          }),
        );
      }
    }
  }

  // ── Regra 4 — Meta mensal em risco ───────────────────────────────────────
  const hoje = new Date();
  const ehMesCorrente = periodoDe(hoje) === periodo;
  if (ehMesCorrente) {
    const diasTotais = diasNoPeriodo(periodo);
    const diasPassados = hoje.getDate();
    const diasRestantes = Math.max(0, diasTotais - diasPassados);
    const projecao = arredondar(resumo.faturamento * dividir(diasTotais, Math.max(1, diasPassados), 1));
    const limiar = p.metaFaturamentoMensal * 0.8;

    if (diasPassados > 15 && projecao < limiar) {
      const faltam = Math.max(0, p.metaFaturamentoMensal - projecao);
      const ticket = resumo.ticketMedio > 0 ? resumo.ticketMedio : 1900;
      const osNecessarias = Math.ceil(dividir(faltam, ticket));
      saida.push(
        alerta({
          regra: 'meta_em_risco',
          nivel: 'alto',
          titulo: `Meta do mês em risco — projeção de ${formatarMoeda(projecao)}`,
          descricao:
            `Faturado ${formatarMoeda(resumo.faturamento)} em ${diasPassados} dias. ` +
            `No ritmo atual o mês fecha em ${formatarMoeda(projecao)}, contra a meta de ` +
            `${formatarMoeda(p.metaFaturamentoMensal)}. Restam ${diasRestantes} dias.`,
          acaoSugerida:
            `Fechar aproximadamente ${osNecessarias} OS adicionais no ticket médio de ` +
            `${formatarMoeda(ticket)} para alcançar a meta.`,
          impactoFinanceiro: arredondar(faltam),
          link: '/ordens',
        }),
      );
    }
  }

  // ── Regra 5 — Desvio orçado vs realizado ─────────────────────────────────
  const LIMIAR_DESVIO = 15;
  const comDesvio = ordens
    .filter((os) => os.horasRealizadas !== null && os.horasRealizadas > 0 && os.horasEstimadas > 0)
    .map((os) => ({
      os,
      desvio: arredondar(
        dividir((os.horasRealizadas ?? 0) - os.horasEstimadas, os.horasEstimadas) * 100,
        1,
      ),
    }))
    .filter((x) => x.desvio > LIMIAR_DESVIO)
    .sort((a, b) => b.desvio - a.desvio);

  for (const { os, desvio } of comDesvio.slice(0, 3)) {
    const horasExtras = (os.horasRealizadas ?? 0) - os.horasEstimadas;
    const impacto = arredondar(horasExtras * (derivados.thh + derivados.cfr));
    saida.push(
      alerta({
        regra: 'desvio_orcado_realizado',
        nivel: 'medio',
        titulo: `OS ${os.numero} consumiu ${formatarPercentual(desvio)} mais horas que o orçado`,
        descricao:
          `Estimadas ${os.horasEstimadas.toFixed(1)}h, realizadas ` +
          `${(os.horasRealizadas ?? 0).toFixed(1)}h. São ${horasExtras.toFixed(1)}h não previstas ` +
          'que saíram direto da margem.',
        acaoSugerida:
          'Revise o tempo padrão desse tipo de serviço no orçamento para não repetir o erro ' +
          'nas próximas OS semelhantes.',
        impactoFinanceiro: impacto,
        link: `/ordens/${os.id}`,
      }),
    );
  }

  // ── Regra 6 — Ponto de equilíbrio em risco ───────────────────────────────
  const breakEven = calcularBreakEven(p, resumo.margemVariavelPct, resumo.faturamento);
  if (resumo.faturamento > 0 && resumo.faturamento < breakEven.pontoEquilibrioReceita * 1.1) {
    const distancia = arredondar(breakEven.pontoEquilibrioReceita - resumo.faturamento);
    saida.push(
      alerta({
        regra: 'ponto_equilibrio_risco',
        nivel: 'critico',
        titulo:
          distancia > 0
            ? 'Faturamento abaixo do ponto de equilíbrio'
            : 'Faturamento colado no ponto de equilíbrio',
        descricao:
          `Ponto de equilíbrio em ${formatarMoeda(breakEven.pontoEquilibrioReceita)} e faturamento ` +
          `em ${formatarMoeda(resumo.faturamento)}. Margem de segurança de apenas ` +
          `${formatarPercentual(breakEven.margemSeguranca)}.`,
        acaoSugerida:
          distancia > 0
            ? `Faltam ${formatarMoeda(distancia)} para cobrir a estrutura. Priorize o fechamento ` +
              'dos orçamentos em aberto com melhor margem.'
            : 'Qualquer queda de volume leva o mês ao prejuízo. Reforce o funil de orçamentos.',
        impactoFinanceiro: Math.abs(distancia),
        link: '/financeiro/dre',
      }),
    );
  }

  // ── Regra 7 — Ausência de provisão para manutenção ───────────────────────
  if (p.manutencaoPreventiva <= 0) {
    saida.push(
      alerta({
        regra: 'sem_provisao_manutencao',
        nivel: 'medio',
        titulo: 'Sem provisão para manutenção preventiva',
        descricao:
          'Não há valor mensal provisionado para manutenção. Uma falha não planejada em ' +
          'torno ou fresa pode impactar de R$ 5.000 a R$ 20.000 no caixa, além da parada ' +
          'de produção.',
        acaoSugerida:
          'Defina uma provisão mensal em Configurações → Parâmetros Financeiros. ' +
          'O valor entra automaticamente no CFR e passa a ser cobrado em cada OS.',
        impactoFinanceiro: 20000,
        link: '/configuracoes',
      }),
    );
  }

  // ── Regra 8 — PMR elevado ────────────────────────────────────────────────
  if (p.pmrDias > 30) {
    const faturamentoDiario = dividir(
      resumo.faturamento > 0 ? resumo.faturamento : p.metaFaturamentoMensal,
      diasNoPeriodo(periodo),
    );
    const ncg = arredondar((p.pmrDias - p.pmpDias) * faturamentoDiario);
    saida.push(
      alerta({
        regra: 'pmr_elevado',
        nivel: 'medio',
        titulo: `PMR de ${p.pmrDias} dias`,
        descricao:
          `O prazo médio de recebimento de ${p.pmrDias} dias contra ${p.pmpDias} dias de ` +
          `pagamento gera uma necessidade de capital de giro de ${formatarMoeda(ncg)}. ` +
          'É dinheiro parado financiando o cliente.',
        acaoSugerida:
          'Ofereça desconto para pagamento à vista, antecipe recebíveis ou renegocie prazo ' +
          'com fornecedores para encurtar o ciclo financeiro.',
        impactoFinanceiro: ncg,
        link: '/financeiro/fluxo-caixa',
      }),
    );
  }

  // ── Regra 9 — Recuperação com preço próximo à peça nova ──────────────────
  const recuperacoesArriscadas = ordens.filter((os) => {
    if (os.tipo !== 'recuperacao' || !os.precoPecaNova || os.precoPecaNova <= 0) return false;
    return precoPraticado(os) > os.precoPecaNova * (p.limiarProximidadePecaNova / 100);
  });

  for (const os of recuperacoesArriscadas.slice(0, 3)) {
    const preco = precoPraticado(os);
    const pct = arredondar(dividir(preco, os.precoPecaNova ?? 1) * 100, 1);
    saida.push(
      alerta({
        regra: 'recuperacao_proxima_peca_nova',
        nivel: 'alto',
        titulo: `OS ${os.numero}: recuperação a ${formatarPercentual(pct)} do valor da peça nova`,
        descricao:
          `A recuperação sai por ${formatarMoeda(preco)} contra ${formatarMoeda(os.precoPecaNova ?? 0)} ` +
          'da peça nova. Nessa faixa o cliente tende a preferir o produto novo, com garantia de fábrica.',
        acaoSugerida:
          `Reduza o preço para no máximo ${formatarPercentual(p.limiarProximidadePecaNova)} do valor ` +
          'da peça nova, ou reposicione a proposta pelo argumento de prazo de entrega.',
        impactoFinanceiro: arredondar(preco),
        link: `/ordens/${os.id}`,
      }),
    );
  }

  // ── Regra 10 — Queda de faturamento por 2 meses consecutivos ─────────────
  if (
    resumo2Anterior.faturamento > 0 &&
    resumoAnterior.faturamento < resumo2Anterior.faturamento * 0.95 &&
    resumo.faturamento < resumoAnterior.faturamento * 0.95
  ) {
    const quedaAcumulada = variacaoPercentual(resumo.faturamento, resumo2Anterior.faturamento) ?? 0;
    saida.push(
      alerta({
        regra: 'queda_faturamento_consecutiva',
        nivel: 'critico',
        titulo: 'Faturamento em queda há 2 meses consecutivos',
        descricao:
          `${formatarMoeda(resumo2Anterior.faturamento)} → ` +
          `${formatarMoeda(resumoAnterior.faturamento)} → ${formatarMoeda(resumo.faturamento)}. ` +
          `Queda acumulada de ${formatarPercentual(Math.abs(quedaAcumulada))}.`,
        acaoSugerida:
          'Reative clientes inativos dos últimos 90 dias e revise a taxa de conversão dos ' +
          'orçamentos: a queda pode estar no funil, não na demanda.',
        impactoFinanceiro: arredondar(resumo2Anterior.faturamento - resumo.faturamento),
        link: '/indicadores',
      }),
    );
  }

  // ── Extra — orçamentos vencendo ──────────────────────────────────────────
  const orcamentosVencendo = await contarOrcamentosVencendo();
  if (orcamentosVencendo.total > 0) {
    saida.push(
      alerta({
        regra: 'orcamentos_vencendo',
        nivel: 'baixo',
        titulo: `${orcamentosVencendo.total} orçamento(s) vencendo em até 7 dias`,
        descricao:
          `Somam ${formatarMoeda(orcamentosVencendo.valor)} em propostas que perdem validade ` +
          'e precisam de retorno do cliente.',
        acaoSugerida: 'Faça o follow-up antes do vencimento para não recomeçar a negociação.',
        impactoFinanceiro: orcamentosVencendo.valor,
        link: '/ordens',
      }),
    );
  }

  return saida;
}

async function contarOrcamentosVencendo(): Promise<{ total: number; valor: number }> {
  try {
    const orcamentos = await prisma.ordemServico.findMany({
      where: { status: 'orcado' },
      select: {
        dataOrcamento: true,
        validadeOrcamento: true,
        precoFinal: true,
        precoSugerido: true,
      },
    });
    const agora = Date.now();
    let total = 0;
    let valor = 0;
    for (const o of orcamentos) {
      const vencimento =
        o.dataOrcamento.getTime() + o.validadeOrcamento * 24 * 60 * 60 * 1000;
      const diasRestantes = (vencimento - agora) / (24 * 60 * 60 * 1000);
      if (diasRestantes >= 0 && diasRestantes <= 7) {
        total += 1;
        valor += o.precoFinal && o.precoFinal > 0 ? o.precoFinal : o.precoSugerido;
      }
    }
    return { total, valor: arredondar(valor) };
  } catch (erro) {
    console.error('[alertas] Falha ao contar orçamentos vencendo:', erro);
    return { total: 0, valor: 0 };
  }
}

/** Alertas de uma OS específica, para exibir na tela de detalhe. */
export function alertasDaOS(
  os: OSAgregavel,
  ctx: ContextoCalculo,
): Alerta[] {
  const { parametros: p, derivados } = ctx;
  const saida: Alerta[] = [];
  const margem = margemContribuicaoOS(os, p.aliquotaImpostos);

  if (margem < p.margemMinima) {
    saida.push(
      alerta({
        regra: 'margem_insuficiente',
        nivel: 'critico',
        titulo: `Margem de ${formatarPercentual(margem)} abaixo do mínimo`,
        descricao: `O mínimo aceitável é ${formatarPercentual(p.margemMinima)}.`,
        acaoSugerida: 'Reveja preço, tempos ou custo de insumos antes de fechar.',
        impactoFinanceiro: null,
      }),
    );
  }

  if (os.horasRealizadas !== null && os.horasEstimadas > 0) {
    const desvio = dividir(os.horasRealizadas - os.horasEstimadas, os.horasEstimadas) * 100;
    if (desvio > 15) {
      saida.push(
        alerta({
          regra: 'desvio_orcado_realizado',
          nivel: 'medio',
          titulo: `Desvio de ${formatarPercentual(desvio)} nas horas`,
          descricao: `Estimado ${os.horasEstimadas.toFixed(1)}h, realizado ${os.horasRealizadas.toFixed(1)}h.`,
          acaoSugerida: 'Ajuste o tempo padrão deste serviço nos próximos orçamentos.',
          impactoFinanceiro: arredondar(
            (os.horasRealizadas - os.horasEstimadas) * (derivados.thh + derivados.cfr),
          ),
        }),
      );
    }
  }

  if (os.tipo === 'recuperacao' && os.precoPecaNova && os.precoPecaNova > 0) {
    const pct = dividir(precoPraticado(os), os.precoPecaNova) * 100;
    if (pct > p.limiarProximidadePecaNova) {
      saida.push(
        alerta({
          regra: 'recuperacao_proxima_peca_nova',
          nivel: 'alto',
          titulo: `Preço equivale a ${formatarPercentual(pct)} da peça nova`,
          descricao: 'O cliente pode preferir comprar a peça nova, com garantia de fábrica.',
          acaoSugerida: `Reposicione abaixo de ${formatarPercentual(p.limiarProximidadePecaNova)}.`,
          impactoFinanceiro: null,
        }),
      );
    }
  }

  return saida;
}

/** Contagem por nível, para badges. */
export function contarPorNivel(alertas: Alerta[]): Record<NivelAlerta, number> {
  const contagem: Record<NivelAlerta, number> = { critico: 0, alto: 0, medio: 0, baixo: 0 };
  for (const a of alertas) contagem[a.nivel] += 1;
  return contagem;
}
