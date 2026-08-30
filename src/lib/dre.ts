/**
 * DRE Gerencial e Fluxo de Caixa.
 *
 * Extensão de `lib/calculos.ts` — toda a matemática continua centralizada na
 * camada lib; nenhum componente calcula nada por conta própria.
 *
 * ── Duas notas de método ───────────────────────────────────────────────────
 *
 * 1. MÃO DE OBRA ABSORVIDA vs. CAPACIDADE OCIOSA.
 *    A folha produtiva é fixa no curto prazo (R$ 317.900/mês com encargos),
 *    mas só a parcela efetivamente aplicada nas OS é custo variável. O que
 *    sobra é capacidade ociosa e aparece como linha própria nos custos fixos
 *    de produção. Isso evita inflar a margem de contribuição e deixa o custo
 *    da ociosidade visível — que é justamente o ponto de atenção da empresa.
 *
 * 2. DEPRECIAÇÃO.
 *    Aparece no bloco de custos fixos de produção por fidelidade ao layout
 *    pedido, mas é marcada como `naoCaixa` e EXCLUÍDA do subtotal do EBITDA —
 *    caso contrário seria deduzida duas vezes (o EBITDA, por definição, é
 *    antes de depreciação). Ela é subtraída uma única vez, do EBITDA ao EBIT.
 */

import { prisma } from '@/lib/prisma';
import { arredondar, dividir } from '@/lib/utils';
import {
  intervaloPeriodo,
  deslocarPeriodo,
  diasNoPeriodo,
  formatarPeriodoExtenso,
  periodoDe,
} from '@/lib/formatacao';
import {
  buscarOSDoPeriodo,
  calcularNCG,
  getContextoCalculo,
  precoPraticado,
  resumirPeriodo,
  type ResumoPeriodo,
} from '@/lib/calculos';
import type {
  ContextoCalculo,
  DiaFluxoCaixa,
  LinhaDRE,
  ParametrosBase,
  ParametrosDerivados,
  Regime,
  ResultadoDRE,
  ResultadoFluxoCaixa,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
//  DRE
// ═══════════════════════════════════════════════════════════════════════════

interface LancamentoAgregado {
  categoria: string;
  tipo: string;
  valor: number;
}

/** Soma lançamentos manuais do período, por categoria. */
async function lancamentosDoPeriodo(
  periodo: string,
  regime: Regime,
): Promise<Map<string, number>> {
  const { inicio, fim } = intervaloPeriodo(periodo);
  const mapa = new Map<string, number>();
  try {
    const lancamentos: LancamentoAgregado[] = await prisma.lancamentoFinanceiro.findMany({
      where:
        regime === 'caixa'
          ? { pago: true, dataPagamento: { gte: inicio, lte: fim } }
          : { data: { gte: inicio, lte: fim } },
      select: { categoria: true, tipo: true, valor: true },
    });
    for (const l of lancamentos) {
      const sinal = l.tipo === 'receita' ? 1 : 1; // o sinal é dado pelo bloco do DRE
      mapa.set(l.categoria, (mapa.get(l.categoria) ?? 0) + l.valor * sinal);
    }
  } catch (erro) {
    console.error('[dre] Falha ao ler lançamentos:', erro);
  }
  return mapa;
}

function linha(
  id: string,
  label: string,
  valor: number,
  tipo: LinhaDRE['tipo'],
  nivel: 0 | 1 | 2,
  receitaBruta: number,
  extras: Partial<LinhaDRE> = {},
): LinhaDRE {
  return {
    id,
    label,
    valor: arredondar(valor),
    tipo,
    nivel,
    percentualReceita: arredondar(dividir(valor, receitaBruta) * 100, 1),
    ...extras,
  };
}

/** Monta o DRE completo de um período. */
export async function calcularDRE(
  periodo: string,
  regime: Regime = 'competencia',
  ctx?: ContextoCalculo,
): Promise<ResultadoDRE> {
  const contexto = ctx ?? (await getContextoCalculo());
  const { parametros: p, derivados } = contexto;

  const ordens = await buscarOSDoPeriodo(periodo, regime);
  const resumo = resumirPeriodo(periodo, ordens, p, derivados);
  const manuais = await lancamentosDoPeriodo(periodo, regime);

  return montarDRE(periodo, regime, resumo, manuais, p, derivados);
}

export function montarDRE(
  periodo: string,
  regime: Regime,
  resumo: ResumoPeriodo,
  manuais: Map<string, number>,
  p: ParametrosBase,
  derivados: ParametrosDerivados,
): ResultadoDRE {
  const receitaServicos = resumo.faturamento;
  const receitaManual = manuais.get('receita_outros') ?? 0;
  const receitaBruta = receitaServicos + receitaManual;

  const deducoes = resumo.impostos;
  const receitaLiquida = receitaBruta - deducoes;

  // ── Custos variáveis ──────────────────────────────────────────────────
  const insumos = resumo.custoMateriais + (manuais.get('insumos') ?? 0);
  const consumiveis = resumo.custoConsumiveis + (manuais.get('consumiveis') ?? 0);
  const ferramentas = resumo.custoFerramentas + (manuais.get('ferramentas') ?? 0);
  const modAbsorvida = resumo.custoMaoDeObraAbsorvida + resumo.custoMaquinaAbsorvido;

  const custosVariaveis = insumos + consumiveis + ferramentas + modAbsorvida;
  const margemContribuicao = receitaLiquida - custosVariaveis;

  // ── Custos fixos de produção ──────────────────────────────────────────
  const capacidadeOciosa = Math.max(
    0,
    derivados.folhaComEncargos - resumo.custoMaoDeObraAbsorvida,
  );
  const depreciacao = p.depreciacaoMensal + (manuais.get('depreciacao') ?? 0);
  const energia = p.energiaEletrica + (manuais.get('energia') ?? 0);
  const manutencao = p.manutencaoPreventiva + (manuais.get('manutencao') ?? 0);

  // Depreciação fica fora do subtotal (é não-caixa, entra só depois do EBITDA).
  const custosFixosProducao = capacidadeOciosa + energia + manutencao;

  // ── Despesas operacionais fixas ───────────────────────────────────────
  const salariosAdmin = p.salariosAdministrativos + (manuais.get('folha') ?? 0);
  const prolabore = p.prolabore + (manuais.get('prolabore') ?? 0);
  const aluguel = p.aluguel + (manuais.get('aluguel') ?? 0);
  const administrativas =
    p.despesasAdministrativas + p.outrasDespesasFixas + (manuais.get('admin') ?? 0);

  const despesasFixas = salariosAdmin + prolabore + aluguel + administrativas;

  const ebitda = margemContribuicao - custosFixosProducao - despesasFixas;
  const ebit = ebitda - depreciacao;
  const resultadoFinanceiro = manuais.get('financeiro') ?? 0;
  const lair = ebit + resultadoFinanceiro;
  // No Simples Nacional o IR/CSLL já está embutido na alíquota das deduções.
  const irCsll = 0;
  const lucroLiquido = lair - irCsll;

  const L = (
    id: string,
    label: string,
    valor: number,
    tipo: LinhaDRE['tipo'],
    nivel: 0 | 1 | 2,
    extras: Partial<LinhaDRE> = {},
  ): LinhaDRE => linha(id, label, valor, tipo, nivel, receitaBruta, extras);

  const linhas: LinhaDRE[] = [
    L('receita_bruta', 'RECEITA BRUTA DE SERVIÇOS', receitaBruta, 'receita', 0, { destaque: true }),
    L('receita_servicos', 'Serviços faturados (OS)', receitaServicos, 'receita', 1),
    ...(receitaManual !== 0 ? [L('receita_outros', 'Outras receitas', receitaManual, 'receita', 1)] : []),
    L('deducoes', 'Deduções — Simples Nacional', -deducoes, 'deducao', 0),
    L('deducoes_detalhe', `ISS / PIS / COFINS embutidos (${p.aliquotaImpostos}%)`, -deducoes, 'deducao', 1),
    L('receita_liquida', 'RECEITA LÍQUIDA', receitaLiquida, 'subtotal', 0, { destaque: true }),

    L('custos_variaveis', 'CUSTOS VARIÁVEIS', -custosVariaveis, 'custo', 0),
    L('cv_insumos', 'Insumos e materiais diretos', -insumos, 'custo', 1),
    L('cv_consumiveis', 'Consumíveis de solda/usinagem', -consumiveis, 'custo', 1),
    L('cv_ferramentas', 'Desgaste de ferramentas', -ferramentas, 'custo', 1),
    L('cv_mod', 'Mão de obra direta aplicada (absorvida)', -modAbsorvida, 'custo', 1),

    L('margem_contribuicao', 'MARGEM DE CONTRIBUIÇÃO', margemContribuicao, 'subtotal', 0, {
      destaque: true,
    }),

    L('custos_fixos_producao', 'CUSTOS FIXOS DE PRODUÇÃO', -custosFixosProducao, 'custo', 0),
    L('cf_ociosa', 'Capacidade ociosa (MO não absorvida)', -capacidadeOciosa, 'custo', 1),
    L('cf_energia', 'Energia elétrica', -energia, 'custo', 1),
    L('cf_manutencao', 'Manutenção preventiva', -manutencao, 'custo', 1),
    L('cf_depreciacao', 'Depreciação de máquinas (não-caixa)', -depreciacao, 'custo', 1, {
      naoCaixa: true,
    }),

    L('despesas_fixas', 'DESPESAS OPERACIONAIS FIXAS', -despesasFixas, 'despesa', 0),
    L('df_salarios', 'Salários + encargos (administrativo)', -salariosAdmin, 'despesa', 1),
    L('df_prolabore', 'Pró-labore dos sócios', -prolabore, 'despesa', 1),
    L('df_aluguel', 'Aluguel / infraestrutura', -aluguel, 'despesa', 1),
    L('df_admin', 'Despesas administrativas diversas', -administrativas, 'despesa', 1),

    L('ebitda', 'EBITDA GERENCIAL', ebitda, 'resultado', 0, { destaque: true }),
    L('depreciacao_pos', 'Depreciação (não-caixa)', -depreciacao, 'custo', 1, { naoCaixa: true }),
    L('ebit', 'EBIT', ebit, 'resultado', 0),
    L('resultado_financeiro', 'Resultado financeiro', resultadoFinanceiro, 'receita', 1),
    L('lair', 'LAIR', lair, 'resultado', 0),
    L('ir_csll', 'IR/CSLL (embutido no Simples)', -irCsll, 'deducao', 1),
    L('lucro_liquido', 'LUCRO LÍQUIDO', lucroLiquido, 'resultado', 0, { destaque: true }),
  ];

  return {
    periodo,
    label: formatarPeriodoExtenso(periodo),
    regime,
    linhas,
    receitaBruta: arredondar(receitaBruta),
    deducoes: arredondar(deducoes),
    receitaLiquida: arredondar(receitaLiquida),
    custosVariaveis: arredondar(custosVariaveis),
    margemContribuicao: arredondar(margemContribuicao),
    // Sobre a receita LÍQUIDA — mesma base usada na precificação de cada OS,
    // para que a margem do orçamento e a do resultado do mês sejam o mesmo
    // número medido do mesmo jeito.
    margemContribuicaoPct: arredondar(dividir(margemContribuicao, receitaLiquida) * 100, 1),
    custosFixosProducao: arredondar(custosFixosProducao),
    despesasFixas: arredondar(despesasFixas),
    ebitda: arredondar(ebitda),
    ebitdaPct: arredondar(dividir(ebitda, receitaBruta) * 100, 1),
    depreciacao: arredondar(depreciacao),
    ebit: arredondar(ebit),
    resultadoFinanceiro: arredondar(resultadoFinanceiro),
    lair: arredondar(lair),
    irCsll: arredondar(irCsll),
    lucroLiquido: arredondar(lucroLiquido),
    lucratividade: arredondar(dividir(lucroLiquido, receitaBruta) * 100, 1),
  };
}

/** DRE do período + do mês anterior, para exibição lado a lado. */
export async function calcularDREComparativo(
  periodo: string,
  regime: Regime = 'competencia',
): Promise<{ atual: ResultadoDRE; anterior: ResultadoDRE; anoAnterior: ResultadoDRE }> {
  const ctx = await getContextoCalculo();
  const [atual, anterior, anoAnterior] = await Promise.all([
    calcularDRE(periodo, regime, ctx),
    calcularDRE(deslocarPeriodo(periodo, -1), regime, ctx),
    calcularDRE(deslocarPeriodo(periodo, -12), regime, ctx),
  ]);
  return { atual, anterior, anoAnterior };
}

/** Dados do gráfico waterfall: da receita bruta ao lucro líquido. */
export interface PassoWaterfall {
  nome: string;
  valor: number;
  base: number;
  tipo: 'inicio' | 'positivo' | 'negativo' | 'total';
}

export function calcularWaterfall(dre: ResultadoDRE): PassoWaterfall[] {
  const passos: Array<{ nome: string; delta: number; tipo: PassoWaterfall['tipo'] }> = [
    { nome: 'Receita bruta', delta: dre.receitaBruta, tipo: 'inicio' },
    { nome: 'Impostos', delta: -dre.deducoes, tipo: 'negativo' },
    { nome: 'Custos variáveis', delta: -dre.custosVariaveis, tipo: 'negativo' },
    { nome: 'Custos fixos prod.', delta: -dre.custosFixosProducao, tipo: 'negativo' },
    { nome: 'Despesas fixas', delta: -dre.despesasFixas, tipo: 'negativo' },
    { nome: 'EBITDA', delta: 0, tipo: 'total' },
    { nome: 'Depreciação', delta: -dre.depreciacao, tipo: 'negativo' },
    { nome: 'Result. financeiro', delta: dre.resultadoFinanceiro, tipo: dre.resultadoFinanceiro >= 0 ? 'positivo' : 'negativo' },
    { nome: 'Lucro líquido', delta: 0, tipo: 'total' },
  ];

  const saida: PassoWaterfall[] = [];
  let acumulado = 0;

  for (const passo of passos) {
    if (passo.tipo === 'inicio') {
      acumulado = passo.delta;
      saida.push({ nome: passo.nome, valor: arredondar(passo.delta), base: 0, tipo: 'inicio' });
    } else if (passo.tipo === 'total') {
      saida.push({ nome: passo.nome, valor: arredondar(acumulado), base: 0, tipo: 'total' });
    } else {
      // Aresta inferior da barra flutuante. Não pode ser truncada em zero:
      // quando o acumulado fica negativo — o que acontece sempre que os
      // custos superam a receita — truncar empilharia a barra a partir do
      // zero e a cascata deixaria de fechar.
      const base = passo.delta >= 0 ? acumulado : acumulado + passo.delta;
      saida.push({
        nome: passo.nome,
        valor: arredondar(Math.abs(passo.delta)),
        base: arredondar(base),
        tipo: passo.tipo,
      });
      acumulado += passo.delta;
    }
  }

  return saida;
}

// ═══════════════════════════════════════════════════════════════════════════
//  FLUXO DE CAIXA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Projeta o caixa dia a dia do período.
 *
 * Entradas:
 *  • OS já recebidas → na data de recebimento (realizado)
 *  • OS faturadas e não recebidas → data de faturamento + PMR (previsto)
 *  • OS finalizadas e não faturadas → data de finalização + PMR (previsto)
 *  • OS orçadas/em execução → data prevista de entrega + PMR (previsto)
 *  • Lançamentos manuais de receita
 *
 * Saídas:
 *  • Custos fixos mensais rateados por dia útil
 *  • Insumos das OS do período, com PMP
 *  • Lançamentos manuais de despesa
 */
export async function calcularFluxoCaixa(
  periodo: string,
  saldoInicial = 0,
  ctx?: ContextoCalculo,
): Promise<ResultadoFluxoCaixa> {
  const contexto = ctx ?? (await getContextoCalculo());
  const { parametros: p, derivados } = contexto;
  const { inicio, fim } = intervaloPeriodo(periodo);
  const totalDias = diasNoPeriodo(periodo);

  const entradas = new Array<number>(totalDias + 1).fill(0);
  const saidas = new Array<number>(totalDias + 1).fill(0);

  const dentroDoMes = (data: Date): number | null => {
    if (data < inicio || data > fim) return null;
    return data.getDate();
  };

  const adiarDias = (data: Date, dias: number): Date => {
    const nova = new Date(data);
    nova.setDate(nova.getDate() + dias);
    return nova;
  };

  let entradasPrevistas = 0;
  let entradasRealizadas = 0;

  try {
    // ── Entradas provenientes de OS ────────────────────────────────────
    const janelaInicio = new Date(inicio);
    janelaInicio.setMonth(janelaInicio.getMonth() - 3);

    const ordens = await prisma.ordemServico.findMany({
      where: {
        status: { not: 'cancelado' },
        OR: [
          { dataRecebimento: { gte: inicio, lte: fim } },
          { dataFaturamento: { gte: janelaInicio } },
          { dataFinalizacao: { gte: janelaInicio } },
          { dataPrevisaoEntrega: { gte: janelaInicio } },
          { dataOrcamento: { gte: janelaInicio } },
        ],
      },
      select: {
        status: true,
        precoFinal: true,
        precoSugerido: true,
        custoMateriais: true,
        markupMateriais: true,
        custoConsumiveis: true,
        custoFerramentas: true,
        dataOrcamento: true,
        dataPrevisaoEntrega: true,
        dataFinalizacao: true,
        dataFaturamento: true,
        dataRecebimento: true,
      },
    });

    for (const os of ordens) {
      const valor = precoPraticado(os);

      // Data prevista (ou efetiva) de entrada no caixa
      let dataEntrada: Date | null = null;
      let realizada = false;

      if (os.dataRecebimento) {
        dataEntrada = os.dataRecebimento;
        realizada = true;
      } else if (os.dataFaturamento) {
        dataEntrada = adiarDias(os.dataFaturamento, p.pmrDias);
      } else if (os.dataFinalizacao) {
        dataEntrada = adiarDias(os.dataFinalizacao, p.pmrDias);
      } else if (os.dataPrevisaoEntrega && os.status !== 'orcado') {
        dataEntrada = adiarDias(os.dataPrevisaoEntrega, p.pmrDias);
      }

      if (dataEntrada) {
        const dia = dentroDoMes(dataEntrada);
        if (dia !== null) {
          entradas[dia] = (entradas[dia] ?? 0) + valor;
          if (realizada) entradasRealizadas += valor;
          else entradasPrevistas += valor;
        }
      }

      // Saída de insumos: paga PMP dias após o início da execução
      const custoInsumos =
        os.custoMateriais * (1 + os.markupMateriais / 100) +
        os.custoConsumiveis +
        os.custoFerramentas;
      if (custoInsumos > 0 && os.status !== 'orcado') {
        const dataCompra = os.dataFinalizacao ?? os.dataPrevisaoEntrega ?? os.dataOrcamento;
        const diaSaida = dentroDoMes(adiarDias(dataCompra, p.pmpDias));
        if (diaSaida !== null) saidas[diaSaida] = (saidas[diaSaida] ?? 0) + custoInsumos;
      }
    }

    // ── Lançamentos manuais ────────────────────────────────────────────
    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        OR: [
          { dataPagamento: { gte: inicio, lte: fim } },
          { dataPagamento: null, data: { gte: inicio, lte: fim } },
        ],
      },
      select: { tipo: true, valor: true, data: true, dataPagamento: true },
    });

    for (const l of lancamentos) {
      const dia = dentroDoMes(l.dataPagamento ?? l.data);
      if (dia === null) continue;
      if (l.tipo === 'receita') {
        entradas[dia] = (entradas[dia] ?? 0) + l.valor;
        entradasPrevistas += l.valor;
      } else {
        saidas[dia] = (saidas[dia] ?? 0) + l.valor;
      }
    }
  } catch (erro) {
    console.error('[fluxo-caixa] Falha ao montar projeção:', erro);
  }

  // ── Saídas fixas: folha no dia 5, demais rateadas nos dias úteis ──────
  const diaFolha = Math.min(5, totalDias);
  saidas[diaFolha] = (saidas[diaFolha] ?? 0) + derivados.folhaComEncargos;

  const outrosFixos =
    p.despesasAdministrativas +
    p.energiaEletrica +
    p.manutencaoPreventiva +
    p.salariosAdministrativos +
    p.prolabore +
    p.aluguel +
    p.outrasDespesasFixas;
  const diaFixos = Math.min(10, totalDias);
  saidas[diaFixos] = (saidas[diaFixos] ?? 0) + outrosFixos;

  // ── Consolidação dia a dia ───────────────────────────────────────────
  const dias: DiaFluxoCaixa[] = [];
  let acumulado = saldoInicial;
  let totalEntradas = 0;
  let totalSaidas = 0;
  let diasNegativos = 0;

  for (let d = 1; d <= totalDias; d += 1) {
    const entradaDia = arredondar(entradas[d] ?? 0);
    const saidaDia = arredondar(saidas[d] ?? 0);
    const saldoDia = arredondar(entradaDia - saidaDia);
    acumulado = arredondar(acumulado + saldoDia);
    totalEntradas += entradaDia;
    totalSaidas += saidaDia;
    if (acumulado < 0) diasNegativos += 1;

    const [ano, mes] = periodo.split('-');
    dias.push({
      data: `${ano}-${mes}-${String(d).padStart(2, '0')}`,
      dia: d,
      entradas: entradaDia,
      saidas: saidaDia,
      saldoDia,
      saldoAcumulado: acumulado,
      negativo: acumulado < 0,
    });
  }

  const faturamentoDiarioMedio = dividir(totalEntradas, totalDias);
  const saidaDiariaMedia = dividir(totalSaidas, totalDias);
  const ncg = calcularNCG(
    p.pmrDias,
    p.pmpDias,
    faturamentoDiarioMedio,
    Math.max(0, acumulado),
    saidaDiariaMedia,
  );

  return {
    periodo,
    saldoInicial: arredondar(saldoInicial),
    totalEntradas: arredondar(totalEntradas),
    totalSaidas: arredondar(totalSaidas),
    saldoFinal: acumulado,
    dias,
    diasNegativos,
    ncg,
    entradasPrevistas: arredondar(entradasPrevistas),
    entradasRealizadas: arredondar(entradasRealizadas),
  };
}

/** Série anual projetado × realizado, para o relatório de fluxo. */
export async function calcularFluxoAnual(
  ano: number,
): Promise<Array<{ periodo: string; label: string; entradas: number; saidas: number; saldo: number }>> {
  const ctx = await getContextoCalculo();
  const saida: Array<{
    periodo: string;
    label: string;
    entradas: number;
    saidas: number;
    saldo: number;
  }> = [];

  for (let mes = 1; mes <= 12; mes += 1) {
    const periodo = `${ano}-${String(mes).padStart(2, '0')}`;
    const fluxo = await calcularFluxoCaixa(periodo, 0, ctx);
    saida.push({
      periodo,
      label: periodo,
      entradas: fluxo.totalEntradas,
      saidas: fluxo.totalSaidas,
      saldo: arredondar(fluxo.totalEntradas - fluxo.totalSaidas),
    });
  }

  return saida;
}

/** Período corrente, atalho usado pelas rotas. */
export function periodoPadrao(): string {
  return periodoDe(new Date());
}
