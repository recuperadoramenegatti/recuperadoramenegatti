/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  O CORAÇÃO DO SISTEMA — toda a matemática financeira da Menegatti.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Regras invioláveis deste arquivo:
 *
 *  1. Nenhum parâmetro financeiro é hardcoded. Tudo vem da tabela
 *     `Configuracao` (defaults do seed em src/lib/constants.ts). Mudou um
 *     parâmetro nas Configurações → tudo recalcula sozinho.
 *  2. Nenhum cálculo financeiro deve existir fora da camada `lib`.
 *     Componentes e rotas apenas consomem estas funções.
 *  3. A matemática pura (THH, CFR, custo de OS, precificação, ponto de
 *     equilíbrio, NCG) vive em `src/lib/precificacao.ts`, sem dependência
 *     de banco, e é reexportada aqui. Assim a tela de orçamento roda
 *     exatamente o mesmo cálculo no navegador que o servidor roda ao salvar.
 *
 * Aqui ficam as funções que precisam do banco: leitura de parâmetros,
 * agregações sobre as OS, KPIs, séries e ocupação dos centros.
 */

import { prisma } from '@/lib/prisma';
import { PARAMETROS_DEFAULT } from '@/lib/constants';
import { arredondar, dividir, limitar, numero, variacaoPercentual } from '@/lib/utils';
import { intervaloPeriodo, deslocarPeriodo, diasNoPeriodo, periodoDe } from '@/lib/formatacao';
import {
  calcularBreakEven,
  calcularCFR,
  calcularCustosFixosMensais,
  calcularDerivados,
  calcularTHH,
  calcularTotalHorasProdutivas,
  classificarMargem,
} from '@/lib/precificacao';

// A matemática pura vive em `precificacao.ts` (sem dependência de banco) e é
// reexportada aqui para que o código de servidor importe de um lugar só.
export * from '@/lib/precificacao';
import type {
  BreakEvenResult,
  CentroCustoCalculado,
  ClassificacaoMargem,
  ComparativoPecaNova,
  ComposicaoCusto,
  ContextoCalculo,
  CustoDetalhado,
  EntradaCalculoOS,
  KPIsDashboard,
  LinhaCustoCentro,
  MargemPorTipo,
  NCGResult,
  OcupacaoCentro,
  ParametrosBase,
  ParametrosDerivados,
  ResultadoPrecificacao,
  SerieMensal,
  StatusComparativo,
  TipoOS,
} from '@/types';
import { LABEL_TIPO_OS, TIPOS_OS } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
//  1. LEITURA DOS PARÂMETROS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lê todos os parâmetros financeiros do banco. Chaves ausentes caem no
 * default calibrado, de modo que o sistema nunca quebra por configuração
 * faltante (ex.: após um upgrade que introduziu um parâmetro novo).
 */
export async function getParametros(): Promise<ParametrosBase> {
  try {
    const registros = await prisma.configuracao.findMany({ where: { grupo: 'financeiro' } });
    const mapa = new Map(registros.map((r) => [r.chave, r.valor]));

    const parametros = { ...PARAMETROS_DEFAULT };
    for (const chave of Object.keys(PARAMETROS_DEFAULT) as Array<keyof ParametrosBase>) {
      const bruto = mapa.get(chave);
      if (bruto !== undefined && bruto !== '') {
        parametros[chave] = numero(bruto, PARAMETROS_DEFAULT[chave]);
      }
    }
    return parametros;
  } catch (erro) {
    console.error('[calculos] Falha ao ler parâmetros, usando defaults:', erro);
    return { ...PARAMETROS_DEFAULT };
  }
}

/** Lê uma configuração avulsa (empresa, IA, aparência). */
export async function getConfig(chave: string, fallback = ''): Promise<string> {
  try {
    const registro = await prisma.configuracao.findUnique({ where: { chave } });
    return registro?.valor ?? fallback;
  } catch (erro) {
    console.error(`[calculos] Falha ao ler configuração "${chave}":`, erro);
    return fallback;
  }
}

/** Lê várias configurações de uma vez, como um objeto chave → valor. */
export async function getConfigs(chaves: string[]): Promise<Record<string, string>> {
  try {
    const registros = await prisma.configuracao.findMany({ where: { chave: { in: chaves } } });
    const saida: Record<string, string> = {};
    for (const chave of chaves) saida[chave] = '';
    for (const r of registros) saida[r.chave] = r.valor;
    return saida;
  } catch (erro) {
    console.error('[calculos] Falha ao ler configurações:', erro);
    return Object.fromEntries(chaves.map((c) => [c, '']));
  }
}

/**
 * Monta o contexto completo de cálculo (parâmetros + derivados + centros com
 * taxas resolvidas). É o que as telas recebem para calcular em tempo real.
 */
export async function getContextoCalculo(): Promise<ContextoCalculo> {
  const parametros = await getParametros();
  const derivados = calcularDerivados(parametros);

  let centrosDb: Array<{
    id: string;
    nome: string;
    slug: string;
    qtdMaquinas: number;
    qtdOperadores: number;
    thmEstimado: number;
    ordem: number;
  }> = [];
  try {
    centrosDb = await prisma.centroCusto.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        slug: true,
        qtdMaquinas: true,
        qtdOperadores: true,
        thmEstimado: true,
        ordem: true,
      },
    });
  } catch (erro) {
    console.error('[calculos] Falha ao ler centros de custo:', erro);
  }

  const centros: CentroCustoCalculado[] = centrosDb.map((c) => ({
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    qtdMaquinas: c.qtdMaquinas,
    qtdOperadores: c.qtdOperadores,
    thm: c.thmEstimado,
    thh: derivados.thh,
    cfr: derivados.cfr,
    custoHora: derivados.thh + c.thmEstimado + derivados.cfr,
    ordem: c.ordem,
  }));

  return { parametros, derivados, centros };
}

// ═══════════════════════════════════════════════════════════════════════════
//  6. AGREGAÇÕES SOBRE AS ORDENS DE SERVIÇO
// ═══════════════════════════════════════════════════════════════════════════

/** Status a partir dos quais a OS conta como receita realizada. */
export const STATUS_RECEITA = ['finalizado', 'faturado', 'pago'] as const;

/** Status que representam trabalho já comprometido (para ocupação). */
export const STATUS_EXECUCAO = [
  'em_execucao',
  'aguardando_pecas',
  'finalizado',
  'faturado',
  'pago',
] as const;

export interface OSAgregavel {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  descricao: string;
  clienteId: string;
  custoTotalCalc: number;
  precoSugerido: number;
  precoFinal: number | null;
  margemReal: number | null;
  horasEstimadas: number;
  horasRealizadas: number | null;
  custoMateriais: number;
  markupMateriais: number;
  custoConsumiveis: number;
  custoFerramentas: number;
  aliquotaUsada: number;
  precoPecaNova: number | null;
  dataOrcamento: Date;
  dataFinalizacao: Date | null;
  dataFaturamento: Date | null;
  dataRecebimento: Date | null;
}

/** Preço efetivamente praticado: o final quando existe, senão o sugerido. */
export function precoPraticado(os: {
  precoFinal: number | null;
  precoSugerido: number;
}): number {
  return os.precoFinal && os.precoFinal > 0 ? os.precoFinal : os.precoSugerido;
}

/** Horas efetivas: as realizadas quando registradas, senão as estimadas. */
export function horasEfetivas(os: {
  horasRealizadas: number | null;
  horasEstimadas: number;
}): number {
  return os.horasRealizadas !== null && os.horasRealizadas > 0
    ? os.horasRealizadas
    : os.horasEstimadas;
}

/**
 * Margem de contribuição de uma OS.
 *
 * Base: RECEITA LÍQUIDA (preço menos impostos), a mesma de
 * `calcularPrecoSugerido` e da linha de margem de contribuição do DRE.
 * Manter a base única é o que permite comparar a margem de uma OS com o
 * mínimo configurado e com o resultado consolidado do mês.
 */
export function margemContribuicaoOS(os: OSAgregavel, aliquotaFallback: number): number {
  const preco = precoPraticado(os);
  if (preco <= 0) return 0;
  const aliquota = os.aliquotaUsada > 0 ? os.aliquotaUsada : aliquotaFallback;
  const impostos = preco * (aliquota / 100);
  const receitaLiquida = preco - impostos;
  return arredondar(dividir(preco - os.custoTotalCalc - impostos, receitaLiquida) * 100, 2);
}

/** Data que ancora a OS num período, conforme o regime contábil. */
export function dataDeCompetencia(os: OSAgregavel): Date {
  return os.dataFaturamento ?? os.dataFinalizacao ?? os.dataOrcamento;
}

export function dataDeCaixa(os: OSAgregavel): Date | null {
  return os.dataRecebimento;
}

/** Busca as OS que geraram receita num período, pelo regime escolhido. */
export async function buscarOSDoPeriodo(
  periodo: string,
  regime: 'competencia' | 'caixa' = 'competencia',
): Promise<OSAgregavel[]> {
  const { inicio, fim } = intervaloPeriodo(periodo);
  const selecao = {
    id: true,
    numero: true,
    tipo: true,
    status: true,
    descricao: true,
    clienteId: true,
    custoTotalCalc: true,
    precoSugerido: true,
    precoFinal: true,
    margemReal: true,
    horasEstimadas: true,
    horasRealizadas: true,
    custoMateriais: true,
    markupMateriais: true,
    custoConsumiveis: true,
    custoFerramentas: true,
    aliquotaUsada: true,
    precoPecaNova: true,
    dataOrcamento: true,
    dataFinalizacao: true,
    dataFaturamento: true,
    dataRecebimento: true,
  } as const;

  try {
    if (regime === 'caixa') {
      return await prisma.ordemServico.findMany({
        where: { dataRecebimento: { gte: inicio, lte: fim }, status: { not: 'cancelado' } },
        select: selecao,
      });
    }

    // Competência: a OS pertence ao mês em que foi faturada ou, na falta,
    // finalizada. OS ainda em aberto não geram receita reconhecida.
    const candidatas = await prisma.ordemServico.findMany({
      where: {
        status: { in: [...STATUS_RECEITA] },
        OR: [
          { dataFaturamento: { gte: inicio, lte: fim } },
          { dataFaturamento: null, dataFinalizacao: { gte: inicio, lte: fim } },
        ],
      },
      select: selecao,
    });
    return candidatas;
  } catch (erro) {
    console.error('[calculos] Falha ao buscar OS do período:', erro);
    return [];
  }
}

export interface ResumoPeriodo {
  periodo: string;
  faturamento: number;
  custoTotal: number;
  custoMateriais: number;
  custoConsumiveis: number;
  custoFerramentas: number;
  custoMaoDeObraAbsorvida: number;
  custoOverheadAbsorvido: number;
  custoMaquinaAbsorvido: number;
  impostos: number;
  margemContribuicao: number;
  /** Margem de contribuição sobre a receita líquida (após impostos e custo total da OS). */
  margemContribuicaoPct: number;
  /**
   * Percentual da receita líquida que sobra após APENAS os custos variáveis
   * (materiais, consumíveis, ferramentas). É esta — e não a de contribuição —
   * que alimenta o ponto de equilíbrio, porque neste modelo a mão de obra é
   * custo fixo e já está do outro lado da conta.
   */
  margemVariavelPct: number;
  quantidadeOS: number;
  ticketMedio: number;
  horasRealizadas: number;
  osAbaixoMinimo: number;
}

/** Consolida um período a partir das OS + parâmetros vigentes. */
export function resumirPeriodo(
  periodo: string,
  ordens: OSAgregavel[],
  p: ParametrosBase,
  derivados: ParametrosDerivados,
): ResumoPeriodo {
  let faturamento = 0;
  let custoTotal = 0;
  let custoMateriais = 0;
  let custoConsumiveis = 0;
  let custoFerramentas = 0;
  let impostos = 0;
  let horasRealizadas = 0;
  let osAbaixoMinimo = 0;

  for (const os of ordens) {
    const preco = precoPraticado(os);
    const aliquota = os.aliquotaUsada > 0 ? os.aliquotaUsada : p.aliquotaImpostos;
    faturamento += preco;
    custoTotal += os.custoTotalCalc;
    custoMateriais += os.custoMateriais * (1 + os.markupMateriais / 100);
    custoConsumiveis += os.custoConsumiveis;
    custoFerramentas += os.custoFerramentas;
    impostos += preco * (aliquota / 100);
    horasRealizadas += horasEfetivas(os);
    if (margemContribuicaoOS(os, p.aliquotaImpostos) < p.margemMinima) osAbaixoMinimo += 1;
  }

  const custoMaoDeObraAbsorvida = horasRealizadas * derivados.thh;
  const custoOverheadAbsorvido = horasRealizadas * derivados.cfr;
  // O que sobra do custo total, depois de MO, overhead e insumos, é máquina.
  const custoMaquinaAbsorvido = Math.max(
    0,
    custoTotal -
      custoMaoDeObraAbsorvida -
      custoOverheadAbsorvido -
      custoMateriais -
      custoConsumiveis -
      custoFerramentas,
  );

  const margemContribuicao = faturamento - impostos - custoTotal;

  return {
    periodo,
    faturamento: arredondar(faturamento),
    custoTotal: arredondar(custoTotal),
    custoMateriais: arredondar(custoMateriais),
    custoConsumiveis: arredondar(custoConsumiveis),
    custoFerramentas: arredondar(custoFerramentas),
    custoMaoDeObraAbsorvida: arredondar(custoMaoDeObraAbsorvida),
    custoOverheadAbsorvido: arredondar(custoOverheadAbsorvido),
    custoMaquinaAbsorvido: arredondar(custoMaquinaAbsorvido),
    impostos: arredondar(impostos),
    margemContribuicao: arredondar(margemContribuicao),
    // Sobre a receita líquida — mesma base da margem de cada OS e do DRE.
    margemContribuicaoPct: arredondar(dividir(margemContribuicao, faturamento - impostos) * 100, 1),
    margemVariavelPct: arredondar(
      dividir(
        faturamento - impostos - custoMateriais - custoConsumiveis - custoFerramentas,
        faturamento - impostos,
      ) * 100,
      1,
    ),
    quantidadeOS: ordens.length,
    ticketMedio: arredondar(dividir(faturamento, ordens.length)),
    horasRealizadas: arredondar(horasRealizadas, 1),
    osAbaixoMinimo,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  7. KPIs DO DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula todos os KPIs do dashboard para um período, com comparativo
 * automático contra o mês anterior.
 */
export async function calcularKPIs(periodo: string, ctx?: ContextoCalculo): Promise<KPIsDashboard> {
  const contexto = ctx ?? (await getContextoCalculo());
  const { parametros: p, derivados } = contexto;

  const periodoAnterior = deslocarPeriodo(periodo, -1);
  const [ordensAtual, ordensAnterior] = await Promise.all([
    buscarOSDoPeriodo(periodo),
    buscarOSDoPeriodo(periodoAnterior),
  ]);

  const atual = resumirPeriodo(periodo, ordensAtual, p, derivados);
  const anterior = resumirPeriodo(periodoAnterior, ordensAnterior, p, derivados);

  // EBITDA = margem de contribuição − custos fixos (excluída a depreciação).
  const custosFixosSemDepreciacao =
    calcularCustosFixosMensais(p) - p.depreciacaoMensal - derivados.folhaComEncargos;
  const moNaoAbsorvida = Math.max(0, derivados.folhaComEncargos - atual.custoMaoDeObraAbsorvida);
  const moNaoAbsorvidaAnt = Math.max(0, derivados.folhaComEncargos - anterior.custoMaoDeObraAbsorvida);

  const ebitdaAtual = arredondar(
    atual.margemContribuicao - custosFixosSemDepreciacao - moNaoAbsorvida,
  );
  const ebitdaAnterior = arredondar(
    anterior.margemContribuicao - custosFixosSemDepreciacao - moNaoAbsorvidaAnt,
  );

  // Média histórica de OS finalizadas (12 meses anteriores).
  const mediaHistoricaOS = await calcularMediaHistoricaOS(periodo, 12);

  const breakEven = calcularBreakEven(p, atual.margemVariavelPct, atual.faturamento);

  const horasDisponiveis = derivados.totalHorasProdutivas;
  const ocupacaoPct = arredondar(dividir(atual.horasRealizadas, horasDisponiveis) * 100, 1);

  return {
    periodo,
    faturamento: {
      atual: atual.faturamento,
      anterior: anterior.faturamento,
      variacaoPct: variacaoPercentual(atual.faturamento, anterior.faturamento),
    },
    metaFaturamento: p.metaFaturamentoMensal,
    percentualMeta: arredondar(dividir(atual.faturamento, p.metaFaturamentoMensal) * 100, 1),
    margemContribuicao: {
      atual: atual.margemContribuicaoPct,
      anterior: anterior.margemContribuicaoPct,
      variacaoPct: variacaoPercentual(atual.margemContribuicaoPct, anterior.margemContribuicaoPct),
    },
    classificacaoMargem: classificarMargem(atual.margemContribuicaoPct, p),
    ebitda: {
      atual: ebitdaAtual,
      anterior: ebitdaAnterior,
      variacaoPct: variacaoPercentual(ebitdaAtual, ebitdaAnterior),
    },
    ebitdaPct: arredondar(dividir(ebitdaAtual, atual.faturamento) * 100, 1),
    osFinalizadas: {
      atual: atual.quantidadeOS,
      anterior: anterior.quantidadeOS,
      variacaoPct: variacaoPercentual(atual.quantidadeOS, anterior.quantidadeOS),
    },
    mediaHistoricaOS,
    breakEven,
    ticketMedio: {
      atual: atual.ticketMedio,
      anterior: anterior.ticketMedio,
      variacaoPct: variacaoPercentual(atual.ticketMedio, anterior.ticketMedio),
    },
    horasRealizadas: atual.horasRealizadas,
    horasDisponiveis: arredondar(horasDisponiveis, 1),
    ocupacaoPct,
    ociosidadePct: arredondar(Math.max(0, 100 - ocupacaoPct), 1),
    totalOS: atual.quantidadeOS,
    osAbaixoMinimo: atual.osAbaixoMinimo,
  };
}

async function calcularMediaHistoricaOS(periodo: string, meses: number): Promise<number> {
  const inicio = intervaloPeriodo(deslocarPeriodo(periodo, -meses)).inicio;
  const fim = intervaloPeriodo(deslocarPeriodo(periodo, -1)).fim;
  try {
    const total = await prisma.ordemServico.count({
      where: {
        status: { in: [...STATUS_RECEITA] },
        OR: [
          { dataFaturamento: { gte: inicio, lte: fim } },
          { dataFaturamento: null, dataFinalizacao: { gte: inicio, lte: fim } },
        ],
      },
    });
    return arredondar(dividir(total, meses), 1);
  } catch (erro) {
    console.error('[calculos] Falha ao calcular média histórica de OS:', erro);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  8. SÉRIES E DISTRIBUIÇÕES PARA GRÁFICOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Série mensal de faturamento/margem/EBITDA. O último ponto pode ser a
 * projeção linear do mês corrente (proporcional aos dias decorridos).
 */
export async function calcularSerieMensal(
  periodoFinal: string,
  meses: number,
  ctx?: ContextoCalculo,
  incluirProjecao = true,
): Promise<SerieMensal[]> {
  const contexto = ctx ?? (await getContextoCalculo());
  const { parametros: p, derivados } = contexto;
  const serie: SerieMensal[] = [];
  const hoje = new Date();
  const periodoCorrente = periodoDe(hoje);

  for (let i = meses - 1; i >= 0; i -= 1) {
    const periodo = deslocarPeriodo(periodoFinal, -i);
    const ordens = await buscarOSDoPeriodo(periodo);
    const resumo = resumirPeriodo(periodo, ordens, p, derivados);

    const custosFixosSemDepreciacao =
      calcularCustosFixosMensais(p) - p.depreciacaoMensal - derivados.folhaComEncargos;
    const moNaoAbsorvida = Math.max(0, derivados.folhaComEncargos - resumo.custoMaoDeObraAbsorvida);

    serie.push({
      periodo,
      label: periodo,
      faturamento: resumo.faturamento,
      meta: p.metaFaturamentoMensal,
      margemPct: resumo.margemContribuicaoPct,
      ebitda: arredondar(resumo.margemContribuicao - custosFixosSemDepreciacao - moNaoAbsorvida),
      osFinalizadas: resumo.quantidadeOS,
    });
  }

  if (incluirProjecao && periodoFinal === periodoCorrente) {
    const ultimo = serie[serie.length - 1];
    if (ultimo) {
      const diasTotais = diasNoPeriodo(periodoCorrente);
      const diaAtual = Math.max(1, hoje.getDate());
      const fator = dividir(diasTotais, diaAtual, 1);
      serie.push({
        periodo: `${periodoCorrente}-proj`,
        label: 'Projeção',
        faturamento: arredondar(ultimo.faturamento * fator),
        meta: p.metaFaturamentoMensal,
        margemPct: ultimo.margemPct,
        ebitda: arredondar(ultimo.ebitda * fator),
        osFinalizadas: Math.round(ultimo.osFinalizadas * fator),
        projetado: true,
      });
    }
  }

  return serie;
}

/** Projeção linear do faturamento do mês corrente. */
export function projetarFaturamentoMes(faturamentoAteAgora: number, referencia = new Date()): number {
  const periodo = periodoDe(referencia);
  const diasTotais = diasNoPeriodo(periodo);
  const diaAtual = Math.max(1, referencia.getDate());
  return arredondar(faturamentoAteAgora * dividir(diasTotais, diaAtual, 1));
}

/** Margem e ticket por tipo de serviço. */
export function calcularMargemPorTipo(ordens: OSAgregavel[], p: ParametrosBase): MargemPorTipo[] {
  return TIPOS_OS.map((tipo) => {
    const doTipo = ordens.filter((o) => o.tipo === tipo);
    let receita = 0;
    let custo = 0;
    let impostos = 0;
    for (const os of doTipo) {
      const preco = precoPraticado(os);
      const aliquota = os.aliquotaUsada > 0 ? os.aliquotaUsada : p.aliquotaImpostos;
      receita += preco;
      custo += os.custoTotalCalc;
      impostos += preco * (aliquota / 100);
    }
    return {
      tipo: tipo as TipoOS,
      label: LABEL_TIPO_OS[tipo as TipoOS],
      receita: arredondar(receita),
      custo: arredondar(custo),
      margemPct: arredondar(dividir(receita - custo - impostos, receita - impostos) * 100, 1),
      quantidade: doTipo.length,
      ticketMedio: arredondar(dividir(receita, doTipo.length)),
    };
  }).filter((m) => m.quantidade > 0);
}

/** Composição do custo agregado (para o gráfico de rosca). */
export function calcularComposicaoCusto(resumo: ResumoPeriodo): ComposicaoCusto {
  return {
    maoDeObra: resumo.custoMaoDeObraAbsorvida,
    maquina: resumo.custoMaquinaAbsorvido,
    insumos: arredondar(
      resumo.custoMateriais + resumo.custoConsumiveis + resumo.custoFerramentas,
    ),
    overhead: resumo.custoOverheadAbsorvido,
  };
}

/** Ocupação de cada centro de custo no período. */
export async function calcularOcupacaoCentros(
  periodo: string,
  ctx?: ContextoCalculo,
): Promise<OcupacaoCentro[]> {
  const contexto = ctx ?? (await getContextoCalculo());
  const { inicio, fim } = intervaloPeriodo(periodo);

  try {
    const itens = await prisma.oSItemCentro.findMany({
      where: {
        ordem: {
          status: { in: [...STATUS_EXECUCAO] },
          OR: [
            { dataFaturamento: { gte: inicio, lte: fim } },
            { dataFaturamento: null, dataFinalizacao: { gte: inicio, lte: fim } },
            { dataFinalizacao: null, dataOrcamento: { gte: inicio, lte: fim } },
          ],
        },
      },
      select: {
        centroId: true,
        horasEstimadas: true,
        horasRealizadas: true,
        custoCalculado: true,
        ordem: { select: { precoFinal: true, precoSugerido: true, horasEstimadas: true } },
      },
    });

    const horasPorOperador = contexto.derivados.horasProdutivasPorOperador;

    return contexto.centros.map((centro) => {
      const doCentro = itens.filter((i) => i.centroId === centro.id);
      const horasRealizadas = doCentro.reduce(
        (acc, i) => acc + (i.horasRealizadas ?? i.horasEstimadas),
        0,
      );
      // Receita atribuída ao centro na proporção das horas dentro de cada OS.
      const receitaGerada = doCentro.reduce((acc, i) => {
        const preco = i.ordem.precoFinal && i.ordem.precoFinal > 0
          ? i.ordem.precoFinal
          : i.ordem.precoSugerido;
        const participacao = dividir(i.horasRealizadas ?? i.horasEstimadas, i.ordem.horasEstimadas);
        return acc + preco * participacao;
      }, 0);

      const horasDisponiveis = horasPorOperador * centro.qtdOperadores;
      return {
        centroId: centro.id,
        nome: centro.nome,
        horasRealizadas: arredondar(horasRealizadas, 1),
        horasDisponiveis: arredondar(horasDisponiveis, 1),
        ocupacaoPct: arredondar(dividir(horasRealizadas, horasDisponiveis) * 100, 1),
        receitaGerada: arredondar(receitaGerada),
      };
    });
  } catch (erro) {
    console.error('[calculos] Falha ao calcular ocupação dos centros:', erro);
    return contexto.centros.map((c) => ({
      centroId: c.id,
      nome: c.nome,
      horasRealizadas: 0,
      horasDisponiveis: 0,
      ocupacaoPct: 0,
      receitaGerada: 0,
    }));
  }
}
