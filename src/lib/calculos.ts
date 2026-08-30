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
 *  2. Nenhum cálculo financeiro deve existir fora daqui. Componentes e rotas
 *     apenas consomem estas funções.
 *  3. As funções puras (`calcularTHH`, `calcularCustoOS`, …) não tocam o
 *     banco: recebem o contexto pronto. Isso permite recalcular no cliente,
 *     em tempo real, sem round-trip.
 *
 * ── Nota sobre o CFR (evitando dupla contagem) ─────────────────────────────
 * A fórmula mestre do documento de calibração é:
 *     CUSTO_OS = SETUP + Σ(Tempo_i × Custo_hora_i) + INSUMOS + CFR_HORAS
 * Como o `Custo_hora_i` de cada centro JÁ é (THH + THM_i + CFR), somar um
 * "CFR_HORAS" adicional contaria o overhead duas vezes. A leitura correta é:
 * o CFR incide sobre TODAS as horas da OS, inclusive as de setup — que não
 * pertencem a nenhum centro. Portanto:
 *     custo hora de setup   = THH + CFR          (sem máquina associada)
 *     custo hora do centro  = THH + THM_i + CFR
 * O overhead é assim cobrado exatamente uma vez por hora trabalhada.
 */

import { prisma } from '@/lib/prisma';
import { PARAMETROS_DEFAULT } from '@/lib/constants';
import { arredondar, dividir, limitar, numero, variacaoPercentual } from '@/lib/utils';
import { intervaloPeriodo, deslocarPeriodo, diasNoPeriodo, periodoDe } from '@/lib/formatacao';
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

// ═══════════════════════════════════════════════════════════════════════════
//  2. TAXAS DERIVADAS — THH, CFR, custo/hora por centro
// ═══════════════════════════════════════════════════════════════════════════

/**
 * THH — Taxa Hora-Homem.
 *   (folha bruta × multiplicador de encargos) ÷ nº operadores ÷ horas produtivas
 *
 * Calibração: (170.000 × 1,87) ÷ 14 ÷ 147,8 = R$ 153,59/h
 */
export function calcularTHH(p: ParametrosBase): number {
  const folhaComEncargos = p.folhaBrutaMensal * p.multiplicadorEncargos;
  const horasProdutivas = calcularHorasProdutivasPorOperador(p);
  return dividir(folhaComEncargos, p.qtdOperadores * horasProdutivas);
}

/** Horas disponíveis por operador no mês: jornada × dias úteis. */
export function calcularHorasDisponiveisPorOperador(p: ParametrosBase): number {
  return p.horasPorDia * p.diasUteisMes;
}

/** Horas efetivamente produtivas por operador, descontada a ociosidade. */
export function calcularHorasProdutivasPorOperador(p: ParametrosBase): number {
  const disponiveis = calcularHorasDisponiveisPorOperador(p);
  const fatorOcupacao = 1 - limitar(p.ociosidadePct, 0, 99) / 100;
  return disponiveis * fatorOcupacao;
}

/** Capacidade produtiva total da fábrica em horas/mês. */
export function calcularTotalHorasProdutivas(p: ParametrosBase): number {
  return calcularHorasProdutivasPorOperador(p) * p.qtdOperadores;
}

/**
 * CFR — Custo Fixo Rateado (overhead indireto por hora produtiva).
 *   (despesas administrativas + energia + manutenção) ÷ total de horas produtivas
 *
 * Calibração: 50.600 ÷ 2.070 = R$ 24,45/h
 */
export function calcularCFR(p: ParametrosBase): number {
  const overhead = calcularOverheadIndireto(p);
  return dividir(overhead, calcularTotalHorasProdutivas(p));
}

/** Base do rateio do CFR. Não inclui a folha produtiva (que está na THH). */
export function calcularOverheadIndireto(p: ParametrosBase): number {
  return p.despesasAdministrativas + p.energiaEletrica + p.manutencaoPreventiva;
}

/**
 * Custo fixo total mensal usado no ponto de equilíbrio e no DRE.
 * Inclui a folha produtiva com encargos — que é fixa no curto prazo — mais
 * o overhead indireto e as demais despesas fixas cadastradas.
 */
export function calcularCustosFixosMensais(p: ParametrosBase): number {
  return (
    p.folhaBrutaMensal * p.multiplicadorEncargos +
    calcularOverheadIndireto(p) +
    p.depreciacaoMensal +
    p.salariosAdministrativos +
    p.prolabore +
    p.aluguel +
    p.outrasDespesasFixas
  );
}

/** Todos os derivados de uma vez. */
export function calcularDerivados(p: ParametrosBase): ParametrosDerivados {
  const thh = calcularTHH(p);
  const cfr = calcularCFR(p);
  return {
    folhaComEncargos: p.folhaBrutaMensal * p.multiplicadorEncargos,
    horasDisponiveisPorOperador: calcularHorasDisponiveisPorOperador(p),
    horasProdutivasPorOperador: calcularHorasProdutivasPorOperador(p),
    totalHorasProdutivas: calcularTotalHorasProdutivas(p),
    totalHorasDisponiveis: calcularHorasDisponiveisPorOperador(p) * p.qtdOperadores,
    thh,
    overheadIndiretoMensal: calcularOverheadIndireto(p),
    cfr,
    custoHoraSetup: thh + cfr,
    custosFixosTotaisMensais: calcularCustosFixosMensais(p),
  };
}

/** Custo total por hora de um centro: THH + THM do centro + CFR. */
export function calcularCustoHoraCentro(thmCentro: number, p: ParametrosBase): number {
  return calcularTHH(p) + thmCentro + calcularCFR(p);
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
//  3. CUSTO DE UMA OS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decompõe o custo de uma OS em mão de obra, máquina, overhead e insumos.
 * Função pura — roda igual no servidor e no navegador.
 */
export function calcularCustoOS(entrada: EntradaCalculoOS, ctx: ContextoCalculo): CustoDetalhado {
  const { derivados, centros } = ctx;
  const porId = new Map(centros.map((c) => [c.id, c]));

  const linhasCentro: LinhaCustoCentro[] = [];
  let horasProducao = 0;

  for (const tempo of entrada.tempos) {
    const centro = porId.get(tempo.centroId);
    if (!centro) continue;
    const horas = Math.max(0, numero(tempo.horas));
    if (horas <= 0) continue;

    horasProducao += horas;
    linhasCentro.push({
      centroId: centro.id,
      nome: centro.nome,
      horas,
      custoHora: centro.custoHora,
      thh: centro.thh,
      thm: centro.thm,
      cfr: centro.cfr,
      custo: arredondar(horas * centro.custoHora),
    });
  }

  const horasSetup = Math.max(0, numero(entrada.horasSetup));
  const horasTotais = horasProducao + horasSetup;

  // Setup consome mão de obra e overhead, mas nenhuma máquina específica.
  const custoSetup = arredondar(horasSetup * derivados.custoHoraSetup);

  // Decomposição por natureza (a soma bate exatamente com o custo das linhas).
  const custoMaoDeObra = arredondar(horasTotais * derivados.thh);
  const custoMaquina = arredondar(
    linhasCentro.reduce((acc, l) => acc + l.horas * l.thm, 0),
  );
  const custoOverhead = arredondar(horasTotais * derivados.cfr);

  // Insumos
  const custoMateriaisBase = Math.max(0, numero(entrada.custoMateriais));
  const markup = Math.max(0, numero(entrada.markupMateriais));
  const valorMarkupMateriais = arredondar(custoMateriaisBase * (markup / 100));
  const custoConsumiveis = Math.max(0, numero(entrada.custoConsumiveis));
  const custoFerramentas = Math.max(0, numero(entrada.custoFerramentas));
  const custoExtras = arredondar(
    entrada.insumosExtras.reduce((acc, i) => acc + Math.max(0, numero(i.valor)), 0),
  );

  const custoInsumosTotal = arredondar(
    custoMateriaisBase + valorMarkupMateriais + custoConsumiveis + custoFerramentas + custoExtras,
  );

  const custoMaoDeObraMaquina = arredondar(custoMaoDeObra + custoMaquina);
  const custoTotal = arredondar(custoMaoDeObraMaquina + custoOverhead + custoInsumosTotal);

  return {
    linhasCentro,
    custoSetup,
    custoMaoDeObra,
    custoMaquina,
    custoOverhead,
    custoMaoDeObraMaquina,
    custoMateriaisBase,
    valorMarkupMateriais,
    custoConsumiveis,
    custoFerramentas,
    custoExtras,
    custoInsumosTotal,
    custoTotal,
    horasProducao: arredondar(horasProducao, 2),
    horasSetup: arredondar(horasSetup, 2),
    horasTotais: arredondar(horasTotais, 2),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  4. PRECIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aplica a fórmula mestre:
 *   PRECO_MINIMO  = CUSTO ÷ (1 − margem)
 *   PRECO_CLIENTE = PRECO_MINIMO ÷ (1 − alíquota)
 *
 * Duas margens são devolvidas, e a diferença importa:
 *   • `margemReal`          = (preço − custo) ÷ preço — a fórmula do documento
 *                             de calibração, bruta, ANTES dos impostos.
 *   • `margemContribuicao`  = (preço − custo − impostos) ÷ preço — a margem
 *                             que de fato sobra. É ela que dirige o semáforo,
 *                             porque é o número com significado econômico.
 */
export function calcularPrecoSugerido(
  custo: CustoDetalhado,
  margemDesejada: number,
  aliquota: number,
  p: ParametrosBase,
  precoFinalManual?: number | null,
  descontoMaximo = 0,
): Omit<ResultadoPrecificacao, 'comparativoPecaNova'> {
  const margem = limitar(numero(margemDesejada), 0, 95);
  const aliq = limitar(numero(aliquota), 0, 95);

  const precoMinimo = arredondar(dividir(custo.custoTotal, 1 - margem / 100, custo.custoTotal));
  const precoSugerido = arredondar(dividir(precoMinimo, 1 - aliq / 100, precoMinimo));

  const precoFinal =
    precoFinalManual !== null && precoFinalManual !== undefined && precoFinalManual > 0
      ? arredondar(precoFinalManual)
      : precoSugerido;

  const valorImpostos = arredondar(precoFinal * (aliq / 100));
  const lucroEstimado = arredondar(precoFinal - custo.custoTotal - valorImpostos);

  const margemReal = arredondar(dividir(precoFinal - custo.custoTotal, precoFinal) * 100, 2);
  const margemContribuicao = arredondar(dividir(lucroEstimado, precoFinal) * 100, 2);

  // Horas mínimas para que a receita cubra o custo total desta OS.
  const receitaPorHora = dividir(precoFinal - valorImpostos, custo.horasTotais);
  const horasEquilibrio = arredondar(dividir(custo.custoTotal, receitaPorHora), 2);

  return {
    custo,
    margemDesejada: margem,
    aliquota: aliq,
    precoMinimo,
    precoSugerido,
    precoFinal,
    margemReal,
    margemContribuicao,
    valorImpostos,
    lucroEstimado,
    classificacao: classificarMargem(margemContribuicao, p),
    horasEquilibrio,
    precoComDescontoMaximo: arredondar(precoFinal * (1 - limitar(descontoMaximo, 0, 100) / 100)),
  };
}

/**
 * Semáforo de margem.
 *   🔴 abaixo da mínima  🟡 entre mínima e ideal  🟢 acima da ideal
 * Os limiares são configuráveis (default 15% / 30%). "Excelente" é reservado
 * para margens bem acima da ideal.
 */
export function classificarMargem(margem: number, p: ParametrosBase): ClassificacaoMargem {
  if (!Number.isFinite(margem) || margem < p.margemMinima) return 'critica';
  const meio = (p.margemMinima + p.margemIdeal) / 2;
  if (margem < meio) return 'baixa';
  if (margem < p.margemIdeal) return 'boa';
  return 'excelente';
}

/** Compara o preço da recuperação com o da peça nova de mercado. */
export function calcularComparativoPecaNova(
  precoRecuperacao: number,
  precoPecaNova: number | null | undefined,
  descontoTolerado: number,
  p: ParametrosBase,
): ComparativoPecaNova | null {
  if (!precoPecaNova || precoPecaNova <= 0) return null;

  const economiaCliente = arredondar(precoPecaNova - precoRecuperacao);
  const economiaPct = arredondar(dividir(economiaCliente, precoPecaNova) * 100, 1);
  const percentualDaPecaNova = arredondar(dividir(precoRecuperacao, precoPecaNova) * 100, 1);

  let status: StatusComparativo;
  let mensagem: string;

  if (percentualDaPecaNova >= 100) {
    status = 'inviavel';
    mensagem =
      'A recuperação custa o mesmo ou mais que a peça nova. Nenhum cliente aceita — ' +
      'recuse o serviço ou reveja radicalmente o escopo.';
  } else if (percentualDaPecaNova > p.limiarProximidadePecaNova) {
    status = 'proximo';
    mensagem =
      `A recuperação equivale a ${percentualDaPecaNova.toFixed(0)}% do valor da peça nova. ` +
      'Margem de persuasão estreita: o cliente tende a preferir o produto novo.';
  } else if (economiaPct >= descontoTolerado) {
    status = 'adequado';
    mensagem =
      `Economia de ${economiaPct.toFixed(0)}% para o cliente, acima do desconto-alvo de ` +
      `${descontoTolerado.toFixed(0)}%. Posicionamento competitivo e rentável.`;
  } else {
    status = 'proximo';
    mensagem =
      `Economia de ${economiaPct.toFixed(0)}% fica abaixo do desconto-alvo de ` +
      `${descontoTolerado.toFixed(0)}%. Avalie reduzir o preço ou reforçar o argumento de prazo.`;
  }

  return {
    precoPecaNova: arredondar(precoPecaNova),
    precoRecuperacao: arredondar(precoRecuperacao),
    economiaCliente,
    economiaPct,
    percentualDaPecaNova,
    descontoTolerado,
    status,
    mensagem,
  };
}

/**
 * Ponta a ponta: da entrada do formulário ao preço final, com comparativo.
 * É esta função que a tela de orçamento chama a cada keystroke (com debounce).
 */
export function precificarOS(
  entrada: EntradaCalculoOS,
  ctx: ContextoCalculo,
): ResultadoPrecificacao {
  const custo = calcularCustoOS(entrada, ctx);
  const base = calcularPrecoSugerido(
    custo,
    entrada.margemDesejada,
    ctx.parametros.aliquotaImpostos,
    ctx.parametros,
    entrada.precoFinal,
  );

  const comparativoPecaNova =
    entrada.tipo === 'recuperacao'
      ? calcularComparativoPecaNova(
          base.precoFinal,
          entrada.precoPecaNova,
          numero(entrada.descontoTolerado, ctx.parametros.descontoToleradoPecaNova),
          ctx.parametros,
        )
      : null;

  return { ...base, comparativoPecaNova };
}

// ═══════════════════════════════════════════════════════════════════════════
//  5. PONTO DE EQUILÍBRIO E CAPITAL DE GIRO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ponto de equilíbrio operacional.
 *   PE (R$)    = custos fixos ÷ (margem de contribuição %)
 *   PE (horas) = PE (R$) ÷ receita média por hora produtiva
 */
export function calcularBreakEven(
  p: ParametrosBase,
  margemContribuicaoPct: number,
  faturamentoAtual: number,
): BreakEvenResult {
  const custosFixos = calcularCustosFixosMensais(p);
  // Sem histórico de margem ainda, usa a margem ideal como estimativa.
  const mc = margemContribuicaoPct > 0 ? margemContribuicaoPct : p.margemIdeal;
  const pontoEquilibrioReceita = arredondar(dividir(custosFixos, mc / 100, custosFixos));

  const totalHoras = calcularTotalHorasProdutivas(p);
  const receitaPorHora = dividir(
    faturamentoAtual > 0 ? faturamentoAtual : p.metaFaturamentoMensal,
    totalHoras,
  );
  const pontoEquilibrioHoras = arredondar(dividir(pontoEquilibrioReceita, receitaPorHora), 1);

  const indiceCobertura = arredondar(dividir(faturamentoAtual, pontoEquilibrioReceita), 2);
  const margemSeguranca = arredondar(
    dividir(faturamentoAtual - pontoEquilibrioReceita, faturamentoAtual) * 100,
    1,
  );

  const status: BreakEvenResult['status'] =
    indiceCobertura >= 1.1 ? 'coberto' : indiceCobertura >= 1 ? 'em_risco' : 'nao_coberto';

  return {
    custosFixosMensais: arredondar(custosFixos),
    margemContribuicaoPct: arredondar(mc, 1),
    pontoEquilibrioReceita,
    pontoEquilibrioHoras,
    faturamentoAtual: arredondar(faturamentoAtual),
    indiceCobertura,
    margemSeguranca,
    status,
  };
}

/**
 * NCG — Necessidade de Capital de Giro.
 *   NCG = (PMR − PMP) × faturamento diário médio
 */
export function calcularNCG(
  pmr: number,
  pmp: number,
  faturamentoDiarioMedio: number,
  saldoCaixa = 0,
  saidaDiariaMedia = 0,
): NCGResult {
  const cicloFinanceiro = pmr - pmp;
  const ncg = arredondar(cicloFinanceiro * faturamentoDiarioMedio);
  return {
    pmr,
    pmp,
    faturamentoDiarioMedio: arredondar(faturamentoDiarioMedio),
    ncg,
    cicloFinanceiro,
    diasDeCaixa: arredondar(dividir(saldoCaixa, saidaDiariaMedia), 1),
  };
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

/** Margem de contribuição de uma OS, líquida de impostos. */
export function margemContribuicaoOS(os: OSAgregavel, aliquotaFallback: number): number {
  const preco = precoPraticado(os);
  if (preco <= 0) return 0;
  const aliquota = os.aliquotaUsada > 0 ? os.aliquotaUsada : aliquotaFallback;
  const impostos = preco * (aliquota / 100);
  return arredondar(dividir(preco - os.custoTotalCalc - impostos, preco) * 100, 2);
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
  margemContribuicaoPct: number;
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
    margemContribuicaoPct: arredondar(dividir(margemContribuicao, faturamento) * 100, 1),
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

  const breakEven = calcularBreakEven(p, atual.margemContribuicaoPct, atual.faturamento);

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
      margemPct: arredondar(dividir(receita - custo - impostos, receita) * 100, 1),
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
