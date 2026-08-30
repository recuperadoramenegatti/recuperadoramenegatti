/**
 * Painel de indicadores gerenciais.
 * Agrega, sobre a camada de cálculo, os cinco grupos de KPIs avançados:
 * lucratividade, produtividade, precificação, financeiros e risco.
 */

import { prisma } from '@/lib/prisma';
import { arredondar, dividir } from '@/lib/utils';
import { deslocarPeriodo, diasNoPeriodo, formatarPeriodoCurto } from '@/lib/formatacao';
import {
  buscarOSDoPeriodo,
  calcularBreakEven,
  calcularMargemPorTipo,
  calcularNCG,
  calcularOcupacaoCentros,
  getContextoCalculo,
  horasEfetivas,
  margemContribuicaoOS,
  precoPraticado,
  resumirPeriodo,
  type OSAgregavel,
} from '@/lib/calculos';
import { calcularDRE, calcularFluxoCaixa } from '@/lib/dre';
import type {
  ContextoCalculo,
  FaixaHistograma,
  GrupoIndicadores,
  Indicador,
  MargemPorTipo,
  OcupacaoCentro,
} from '@/types';

export interface PainelIndicadores {
  periodo: string;
  grupos: GrupoIndicadores[];
  histogramaMargens: FaixaHistograma[];
  margemPorTipo: MargemPorTipo[];
  ocupacaoCentros: OcupacaoCentro[];
  evolucao: Array<{
    periodo: string;
    label: string;
    faturamento: number;
    margemPct: number;
    ebitdaPct: number;
    ticketMedio: number;
    ocupacaoPct: number;
    faturamentoPorHora: number;
  }>;
}

function ind(
  chave: string,
  label: string,
  valor: number,
  formato: Indicador['formato'],
  descricao: string,
  extras: Partial<Indicador> = {},
): Indicador {
  return {
    chave,
    label,
    valor: arredondar(valor, 2),
    formato,
    descricao,
    melhorQuando: 'maior',
    ...extras,
  };
}

export async function calcularPainelIndicadores(
  periodo: string,
  ctx?: ContextoCalculo,
): Promise<PainelIndicadores> {
  const contexto = ctx ?? (await getContextoCalculo());
  const { parametros: p, derivados } = contexto;

  const ordens = await buscarOSDoPeriodo(periodo);
  const resumo = resumirPeriodo(periodo, ordens, p, derivados);
  const dre = await calcularDRE(periodo, 'competencia', contexto);
  const ocupacaoCentros = await calcularOcupacaoCentros(periodo, contexto);

  // ── Produtividade ──────────────────────────────────────────────────────
  const faturamentoPorHora = dividir(resumo.faturamento, resumo.horasRealizadas);
  const faturamentoPorOperador = dividir(resumo.faturamento, p.qtdOperadores);
  const ocupacaoGlobal = arredondar(
    dividir(resumo.horasRealizadas, derivados.totalHorasProdutivas) * 100,
    1,
  );

  const comparaveis = ordens.filter(
    (o) => o.horasRealizadas !== null && o.horasRealizadas > 0 && o.horasEstimadas > 0,
  );
  const eficiencia = arredondar(
    dividir(
      comparaveis.reduce((acc, o) => acc + o.horasEstimadas, 0),
      comparaveis.reduce((acc, o) => acc + (o.horasRealizadas ?? 0), 0),
    ) * 100,
    1,
  );
  const desvioMedio = arredondar(
    dividir(
      comparaveis.reduce(
        (acc, o) => acc + dividir((o.horasRealizadas ?? 0) - o.horasEstimadas, o.horasEstimadas) * 100,
        0,
      ),
      comparaveis.length,
    ),
    1,
  );

  // ── Precificação ───────────────────────────────────────────────────────
  const margemPorTipo = calcularMargemPorTipo(ordens, p);
  const histogramaMargens = montarHistograma(ordens, p.aliquotaImpostos);
  const pctAbaixoMinimo = arredondar(dividir(resumo.osAbaixoMinimo, ordens.length) * 100, 1);

  // ── Financeiros ────────────────────────────────────────────────────────
  const breakEven = calcularBreakEven(p, resumo.margemVariavelPct, resumo.faturamento);
  const faturamentoDiario = dividir(resumo.faturamento, diasNoPeriodo(periodo));

  // Dias de caixa: quanto tempo a operação se sustenta com o saldo projetado
  // ao ritmo de saída atual. Usa o fluxo do período, não uma estimativa.
  const fluxo = await calcularFluxoCaixa(periodo, 0, contexto);
  const saidaDiariaMedia = dividir(fluxo.totalSaidas, diasNoPeriodo(periodo));
  const ncg = calcularNCG(
    p.pmrDias,
    p.pmpDias,
    faturamentoDiario,
    Math.max(0, fluxo.saldoFinal),
    saidaDiariaMedia,
  );

  // ── Risco ──────────────────────────────────────────────────────────────
  const risco = await calcularIndicadoresRisco(periodo, ordens, resumo.faturamento);

  const grupos: GrupoIndicadores[] = [
    {
      grupo: 'Lucratividade',
      descricao: 'Quanto sobra de cada real faturado.',
      indicadores: [
        ind(
          'margem_bruta',
          'Margem bruta',
          arredondar(dividir(dre.receitaLiquida - resumo.custoTotal, dre.receitaBruta) * 100, 1),
          'percentual',
          'Receita líquida menos o custo direto das OS, sobre a receita bruta.',
        ),
        ind(
          'margem_contribuicao',
          'Margem de contribuição',
          dre.margemContribuicaoPct,
          'percentual',
          'O que sobra depois de impostos e custos variáveis para cobrir a estrutura fixa.',
          { referencia: p.margemIdeal },
        ),
        ind('ebitda_pct', 'EBITDA', dre.ebitdaPct, 'percentual', 'Resultado operacional antes de depreciação.'),
        ind('lucro_liquido_pct', 'Lucro líquido', dre.lucratividade, 'percentual', 'Lucratividade final do período.'),
        ind(
          'roi_operacional',
          'ROI operacional',
          arredondar(dividir(dre.ebitda, breakEven.custosFixosMensais) * 100, 1),
          'percentual',
          'EBITDA gerado por real de estrutura fixa mantida.',
        ),
      ],
    },
    {
      grupo: 'Produtividade',
      descricao: 'Quanto a fábrica produz com a capacidade que tem.',
      indicadores: [
        ind('fat_por_hora', 'Faturamento por hora', faturamentoPorHora, 'moeda', 'Receita gerada por hora produtiva aplicada.'),
        ind('fat_por_operador', 'Faturamento por operador', faturamentoPorOperador, 'moeda', `Receita dividida pelos ${p.qtdOperadores} operadores.`),
        ind('ocupacao', 'Taxa de ocupação', ocupacaoGlobal, 'percentual', 'Horas aplicadas sobre a capacidade produtiva do mês.', { referencia: 100 - p.ociosidadePct }),
        ind('eficiencia', 'Eficiência (estimado ÷ realizado)', eficiencia, 'percentual', 'Acima de 100% significa que a equipe entregou em menos tempo que o orçado.'),
        ind('desvio_medio', 'Desvio médio orçado × realizado', desvioMedio, 'percentual', 'Positivo indica que as OS consomem mais horas do que o previsto.', { melhorQuando: 'menor' }),
        ind('horas_aplicadas', 'Horas aplicadas', resumo.horasRealizadas, 'horas', `De ${derivados.totalHorasProdutivas.toFixed(0)}h produtivas disponíveis.`),
      ],
    },
    {
      grupo: 'Precificação',
      descricao: 'Se os preços praticados sustentam o negócio.',
      indicadores: [
        ind('ticket_medio', 'Ticket médio', resumo.ticketMedio, 'moeda', 'Receita média por ordem de serviço.'),
        ind('os_abaixo_minimo', 'OS abaixo da margem mínima', resumo.osAbaixoMinimo, 'numero', `De ${ordens.length} OS no período.`, { melhorQuando: 'menor' }),
        ind('pct_abaixo_minimo', '% de OS abaixo do mínimo', pctAbaixoMinimo, 'percentual', `Margem mínima configurada: ${p.margemMinima}%.`, { melhorQuando: 'menor' }),
        ind('maior_ticket', 'Maior ticket', Math.max(0, ...ordens.map(precoPraticado)), 'moeda', 'Maior OS do período.'),
        ind('menor_ticket', 'Menor ticket', ordens.length ? Math.min(...ordens.map(precoPraticado)) : 0, 'moeda', 'Menor OS do período.'),
      ],
    },
    {
      grupo: 'Financeiros',
      descricao: 'Estrutura de custo, equilíbrio e capital de giro.',
      indicadores: [
        ind('ponto_equilibrio', 'Ponto de equilíbrio', breakEven.pontoEquilibrioReceita, 'moeda', 'Faturamento mensal que zera o resultado.', { melhorQuando: 'menor' }),
        ind('pe_horas', 'Ponto de equilíbrio em horas', breakEven.pontoEquilibrioHoras, 'horas', 'Horas produtivas necessárias para cobrir a estrutura.', { melhorQuando: 'menor' }),
        ind('indice_cobertura', 'Índice de cobertura do PE', breakEven.indiceCobertura, 'numero', 'Faturamento dividido pelo ponto de equilíbrio. Abaixo de 1,0 o mês fecha no prejuízo.', { referencia: 1.1 }),
        ind('margem_seguranca', 'Margem de segurança', breakEven.margemSeguranca, 'percentual', 'Quanto o faturamento pode cair antes de atingir o ponto de equilíbrio.'),
        ind('pmr', 'PMR', p.pmrDias, 'dias', 'Prazo médio de recebimento.', { melhorQuando: 'menor' }),
        ind('pmp', 'PMP', p.pmpDias, 'dias', 'Prazo médio de pagamento a fornecedores.'),
        ind('ncg', 'Necessidade de capital de giro', ncg.ncg, 'moeda', 'Capital imobilizado no ciclo financeiro.', { melhorQuando: 'menor' }),
        ind('ciclo_financeiro', 'Ciclo financeiro', ncg.cicloFinanceiro, 'dias', 'PMR menos PMP.', { melhorQuando: 'menor' }),
        ind(
          'dias_de_caixa',
          'Dias de caixa disponível',
          ncg.diasDeCaixa,
          'dias',
          'Por quantos dias o saldo projetado sustenta a operação no ritmo de saída atual.',
          { referencia: 30 },
        ),
      ],
    },
    {
      grupo: 'Risco',
      descricao: 'Dependências e perdas que ameaçam o resultado.',
      indicadores: risco,
    },
  ];

  const evolucao = await calcularEvolucao12Meses(periodo, contexto);

  return {
    periodo,
    grupos,
    histogramaMargens,
    margemPorTipo,
    ocupacaoCentros,
    evolucao,
  };
}

function montarHistograma(ordens: OSAgregavel[], aliquota: number): FaixaHistograma[] {
  const faixas: Array<{ faixa: string; min: number; max: number }> = [
    { faixa: '< 0%', min: -Infinity, max: 0 },
    { faixa: '0–15%', min: 0, max: 15 },
    { faixa: '15–25%', min: 15, max: 25 },
    { faixa: '25–35%', min: 25, max: 35 },
    { faixa: '35–50%', min: 35, max: 50 },
    { faixa: '> 50%', min: 50, max: Infinity },
  ];

  return faixas.map((f) => {
    const dentro = ordens.filter((os) => {
      const m = margemContribuicaoOS(os, aliquota);
      return m >= f.min && m < f.max;
    });
    return {
      faixa: f.faixa,
      min: f.min === -Infinity ? -100 : f.min,
      max: f.max === Infinity ? 100 : f.max,
      quantidade: dentro.length,
      receita: arredondar(dentro.reduce((acc, os) => acc + precoPraticado(os), 0)),
    };
  });
}

async function calcularIndicadoresRisco(
  periodo: string,
  ordens: OSAgregavel[],
  faturamento: number,
): Promise<Indicador[]> {
  const porCliente = new Map<string, number>();
  for (const os of ordens) {
    porCliente.set(os.clienteId, (porCliente.get(os.clienteId) ?? 0) + precoPraticado(os));
  }
  const ranking = [...porCliente.values()].sort((a, b) => b - a);
  const top3 = ranking.slice(0, 3).reduce((a, b) => a + b, 0);
  const concentracaoTop3 = arredondar(dividir(top3, faturamento) * 100, 1);
  const concentracaoTop1 = arredondar(dividir(ranking[0] ?? 0, faturamento) * 100, 1);

  // Recorrência: clientes com OS em pelo menos 2 dos 3 meses anteriores.
  let recorrentePct = 0;
  let canceladas = 0;
  let naoFaturadas = 0;
  try {
    const periodosAnteriores = [1, 2, 3].map((i) => deslocarPeriodo(periodo, -i));
    const historicos = await Promise.all(periodosAnteriores.map((pp) => buscarOSDoPeriodo(pp)));
    const frequencia = new Map<string, number>();
    for (const lista of historicos) {
      const unicos = new Set(lista.map((o) => o.clienteId));
      for (const c of unicos) frequencia.set(c, (frequencia.get(c) ?? 0) + 1);
    }
    const receitaRecorrente = ordens
      .filter((o) => (frequencia.get(o.clienteId) ?? 0) >= 2)
      .reduce((acc, o) => acc + precoPraticado(o), 0);
    recorrentePct = arredondar(dividir(receitaRecorrente, faturamento) * 100, 1);

    const { inicio, fim } = intervaloDoPeriodo(periodo);
    canceladas = await prisma.ordemServico.count({
      where: { status: 'cancelado', dataOrcamento: { gte: inicio, lte: fim } },
    });
    naoFaturadas = await prisma.ordemServico.count({
      where: { status: 'finalizado', dataFinalizacao: { gte: inicio, lte: fim } },
    });
  } catch (erro) {
    console.error('[indicadores] Falha nos indicadores de risco:', erro);
  }

  return [
    ind('concentracao_top1', 'Concentração do maior cliente', concentracaoTop1, 'percentual', 'Participação do maior cliente no faturamento do mês.', { melhorQuando: 'menor' }),
    ind('concentracao_top3', 'Concentração dos top 3', concentracaoTop3, 'percentual', 'Participação dos três maiores clientes somados.', { melhorQuando: 'menor' }),
    ind('recorrencia', 'Faturamento recorrente', recorrentePct, 'percentual', 'Receita vinda de clientes que compraram em pelo menos 2 dos 3 meses anteriores.'),
    ind('os_canceladas', 'OS canceladas', canceladas, 'numero', 'Orçamentos cancelados no período.', { melhorQuando: 'menor' }),
    ind('os_nao_faturadas', 'OS finalizadas sem faturar', naoFaturadas, 'numero', 'Serviço entregue e ainda não faturado — receita parada.', { melhorQuando: 'menor' }),
  ];
}

function intervaloDoPeriodo(periodo: string): { inicio: Date; fim: Date } {
  const [ano, mes] = periodo.split('-').map(Number);
  return {
    inicio: new Date(ano, (mes ?? 1) - 1, 1, 0, 0, 0, 0),
    fim: new Date(ano, mes ?? 1, 0, 23, 59, 59, 999),
  };
}

async function calcularEvolucao12Meses(
  periodoFinal: string,
  ctx: ContextoCalculo,
): Promise<PainelIndicadores['evolucao']> {
  const { parametros: p, derivados } = ctx;
  const saida: PainelIndicadores['evolucao'] = [];

  for (let i = 11; i >= 0; i -= 1) {
    const periodo = deslocarPeriodo(periodoFinal, -i);
    const ordens = await buscarOSDoPeriodo(periodo);
    const resumo = resumirPeriodo(periodo, ordens, p, derivados);

    const custosFixosOperacionais =
      p.despesasAdministrativas +
      p.energiaEletrica +
      p.manutencaoPreventiva +
      p.salariosAdministrativos +
      p.prolabore +
      p.aluguel +
      p.outrasDespesasFixas;
    const moNaoAbsorvida = Math.max(0, derivados.folhaComEncargos - resumo.custoMaoDeObraAbsorvida);
    const ebitda = resumo.margemContribuicao - custosFixosOperacionais - moNaoAbsorvida;

    saida.push({
      periodo,
      label: formatarPeriodoCurto(periodo),
      faturamento: resumo.faturamento,
      margemPct: resumo.margemContribuicaoPct,
      ebitdaPct: arredondar(dividir(ebitda, resumo.faturamento) * 100, 1),
      ticketMedio: resumo.ticketMedio,
      ocupacaoPct: arredondar(dividir(resumo.horasRealizadas, derivados.totalHorasProdutivas) * 100, 1),
      faturamentoPorHora: arredondar(dividir(resumo.faturamento, resumo.horasRealizadas)),
    });
  }

  return saida;
}
