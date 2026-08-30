/**
 * Tipos globais do sistema Menegatti.
 * Nenhum `any` — quando o formato é aberto usamos `unknown` + type guards.
 */

// ─────────────────────────── Enums de domínio ───────────────────────────

export const TIPOS_OS = ['recuperacao', 'fabricacao', 'manutencao', 'outro'] as const;
export type TipoOS = (typeof TIPOS_OS)[number];

export const STATUS_OS = [
  'orcado',
  'em_execucao',
  'aguardando_pecas',
  'finalizado',
  'faturado',
  'pago',
  'cancelado',
] as const;
export type StatusOS = (typeof STATUS_OS)[number];

export const PRIORIDADES = ['normal', 'urgente', 'muito_urgente'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

export const REGIMES = ['competencia', 'caixa'] as const;
export type Regime = (typeof REGIMES)[number];

export const NIVEIS_ALERTA = ['critico', 'alto', 'medio', 'baixo'] as const;
export type NivelAlerta = (typeof NIVEIS_ALERTA)[number];

export const CLASSIFICACOES_MARGEM = ['critica', 'baixa', 'boa', 'excelente'] as const;
export type ClassificacaoMargem = (typeof CLASSIFICACOES_MARGEM)[number];

export const LABEL_TIPO_OS: Record<TipoOS, string> = {
  recuperacao: 'Recuperação de peça',
  fabricacao: 'Fabricação de peça nova',
  manutencao: 'Manutenção / Reparo',
  outro: 'Outro',
};

export const LABEL_STATUS_OS: Record<StatusOS, string> = {
  orcado: 'Orçado',
  em_execucao: 'Em execução',
  aguardando_pecas: 'Aguardando peças',
  finalizado: 'Finalizado',
  faturado: 'Faturado',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

export const LABEL_PRIORIDADE: Record<Prioridade, string> = {
  normal: 'Normal',
  urgente: 'Urgente',
  muito_urgente: 'Muito urgente',
};

/** Colunas do Kanban, em ordem. `cancelado` fica fora do fluxo principal. */
export const FLUXO_KANBAN: StatusOS[] = [
  'orcado',
  'em_execucao',
  'aguardando_pecas',
  'finalizado',
  'faturado',
  'pago',
];

// ───────────────────────── Parâmetros financeiros ─────────────────────────

/** Parâmetros brutos lidos da tabela `Configuracao`. */
export interface ParametrosBase {
  folhaBrutaMensal: number;
  multiplicadorEncargos: number;
  qtdOperadores: number;
  horasPorDia: number;
  diasUteisMes: number;
  ociosidadePct: number;

  despesasAdministrativas: number;
  energiaEletrica: number;
  manutencaoPreventiva: number;
  depreciacaoMensal: number;
  salariosAdministrativos: number;
  prolabore: number;
  aluguel: number;
  outrasDespesasFixas: number;

  aliquotaImpostos: number;
  margemMinima: number;
  margemIdeal: number;
  margemPadrao: number;
  metaFaturamentoMensal: number;

  pmrDias: number;
  pmpDias: number;

  markupMateriaisPadrao: number;
  descontoToleradoPecaNova: number;
  validadeOrcamentoPadrao: number;
  setupPadraoHoras: number;

  concentracaoClienteMaxPct: number;
  limiarProximidadePecaNova: number;
}

/** Centro de custo com a taxa horária já resolvida. */
export interface CentroCustoCalculado {
  id: string;
  nome: string;
  slug: string;
  qtdMaquinas: number;
  qtdOperadores: number;
  thm: number;
  thh: number;
  cfr: number;
  /** THH + THM + CFR */
  custoHora: number;
  ordem: number;
}

/** Todos os derivados calculados a partir de `ParametrosBase`. */
export interface ParametrosDerivados {
  folhaComEncargos: number;
  horasDisponiveisPorOperador: number;
  horasProdutivasPorOperador: number;
  totalHorasProdutivas: number;
  totalHorasDisponiveis: number;
  thh: number;
  overheadIndiretoMensal: number;
  cfr: number;
  /** Custo por hora de setup: THH + CFR (sem máquina associada). */
  custoHoraSetup: number;
  custosFixosTotaisMensais: number;
}

export interface ContextoCalculo {
  parametros: ParametrosBase;
  derivados: ParametrosDerivados;
  centros: CentroCustoCalculado[];
}

// ─────────────────────────── Cálculo de uma OS ───────────────────────────

export interface InsumoExtra {
  nome: string;
  valor: number;
}

export interface TempoCentroInput {
  centroId: string;
  horas: number;
}

export interface EntradaCalculoOS {
  tipo: TipoOS;
  horasSetup: number;
  tempos: TempoCentroInput[];
  custoMateriais: number;
  markupMateriais: number;
  custoConsumiveis: number;
  custoFerramentas: number;
  insumosExtras: InsumoExtra[];
  margemDesejada: number;
  precoPecaNova?: number | null;
  descontoTolerado?: number | null;
  /** Preço fechado manualmente pelo usuário; quando ausente usa o sugerido. */
  precoFinal?: number | null;
}

export interface LinhaCustoCentro {
  centroId: string;
  nome: string;
  horas: number;
  custoHora: number;
  thh: number;
  thm: number;
  cfr: number;
  custo: number;
}

export interface CustoDetalhado {
  linhasCentro: LinhaCustoCentro[];
  custoSetup: number;
  /** Mão de obra (THH) de todos os centros + setup. */
  custoMaoDeObra: number;
  /** Depreciação/uso de máquina (THM) de todos os centros. */
  custoMaquina: number;
  /** Overhead rateado (CFR) sobre todas as horas, inclusive setup. */
  custoOverhead: number;
  /** custoMaoDeObra + custoMaquina — o que aparece como "MO + Máquina". */
  custoMaoDeObraMaquina: number;
  custoMateriaisBase: number;
  valorMarkupMateriais: number;
  custoConsumiveis: number;
  custoFerramentas: number;
  custoExtras: number;
  /** Materiais com markup + consumíveis + ferramentas + extras. */
  custoInsumosTotal: number;
  custoTotal: number;
  horasProducao: number;
  horasSetup: number;
  horasTotais: number;
}

export interface ResultadoPrecificacao {
  custo: CustoDetalhado;
  margemDesejada: number;
  aliquota: number;
  precoMinimo: number;
  precoSugerido: number;
  precoFinal: number;
  /** Fórmula do masterprompt: (preço − custo) ÷ preço. Bruta, antes de impostos. */
  margemReal: number;
  /** Margem de contribuição efetiva: (preço − custo − impostos) ÷ preço. */
  margemContribuicao: number;
  valorImpostos: number;
  lucroEstimado: number;
  classificacao: ClassificacaoMargem;
  /** Horas mínimas para cobrir o custo fixo desta OS ao preço praticado. */
  horasEquilibrio: number;
  precoComDescontoMaximo: number;
  comparativoPecaNova: ComparativoPecaNova | null;
}

export const STATUS_COMPARATIVO = ['adequado', 'proximo', 'inviavel', 'sem_referencia'] as const;
export type StatusComparativo = (typeof STATUS_COMPARATIVO)[number];

export interface ComparativoPecaNova {
  precoPecaNova: number;
  precoRecuperacao: number;
  economiaCliente: number;
  economiaPct: number;
  percentualDaPecaNova: number;
  descontoTolerado: number;
  status: StatusComparativo;
  mensagem: string;
}

export interface BreakEvenResult {
  custosFixosMensais: number;
  /** % da receita líquida que sobra após os custos variáveis (insumos). */
  margemVariavelPct: number;
  pontoEquilibrioReceita: number;
  pontoEquilibrioHoras: number;
  faturamentoAtual: number;
  indiceCobertura: number;
  margemSeguranca: number;
  status: 'coberto' | 'em_risco' | 'nao_coberto';
}

// ─────────────────────────────── KPIs ───────────────────────────────

export interface VariacaoPeriodo {
  atual: number;
  anterior: number;
  variacaoPct: number | null;
}

export interface KPIsDashboard {
  periodo: string;
  faturamento: VariacaoPeriodo;
  metaFaturamento: number;
  percentualMeta: number;
  margemContribuicao: VariacaoPeriodo;
  classificacaoMargem: ClassificacaoMargem;
  ebitda: VariacaoPeriodo;
  ebitdaPct: number;
  osFinalizadas: VariacaoPeriodo;
  mediaHistoricaOS: number;
  breakEven: BreakEvenResult;
  ticketMedio: VariacaoPeriodo;
  horasRealizadas: number;
  horasDisponiveis: number;
  ocupacaoPct: number;
  ociosidadePct: number;
  totalOS: number;
  osAbaixoMinimo: number;
}

export interface OcupacaoCentro {
  centroId: string;
  nome: string;
  horasRealizadas: number;
  horasDisponiveis: number;
  ocupacaoPct: number;
  receitaGerada: number;
}

export interface ComposicaoCusto {
  maoDeObra: number;
  insumos: number;
  overhead: number;
  maquina: number;
}

export interface MargemPorTipo {
  tipo: TipoOS;
  label: string;
  receita: number;
  custo: number;
  margemPct: number;
  quantidade: number;
  ticketMedio: number;
}

export interface SerieMensal {
  periodo: string;
  label: string;
  faturamento: number;
  meta: number;
  margemPct: number;
  ebitda: number;
  osFinalizadas: number;
  projetado?: boolean;
}

// ─────────────────────────────── Alertas ───────────────────────────────

export interface Alerta {
  id: string;
  regra: string;
  nivel: NivelAlerta;
  titulo: string;
  descricao: string;
  acaoSugerida: string;
  impactoFinanceiro: number | null;
  link?: string;
  criadoEm: string;
}

// ─────────────────────────────── DRE ───────────────────────────────

export interface LinhaDRE {
  id: string;
  label: string;
  valor: number;
  tipo: 'receita' | 'deducao' | 'custo' | 'despesa' | 'subtotal' | 'resultado';
  nivel: 0 | 1 | 2;
  percentualReceita: number;
  /** Linha não-caixa (depreciação): exibida mas fora do EBITDA. */
  naoCaixa?: boolean;
  destaque?: boolean;
  valorAnterior?: number;
}

export interface ResultadoDRE {
  periodo: string;
  label: string;
  regime: Regime;
  linhas: LinhaDRE[];
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custosVariaveis: number;
  margemContribuicao: number;
  margemContribuicaoPct: number;
  custosFixosProducao: number;
  despesasFixas: number;
  ebitda: number;
  ebitdaPct: number;
  depreciacao: number;
  ebit: number;
  resultadoFinanceiro: number;
  lair: number;
  irCsll: number;
  lucroLiquido: number;
  lucratividade: number;
}

// ───────────────────────────── Fluxo de caixa ─────────────────────────────

export interface DiaFluxoCaixa {
  data: string;
  dia: number;
  entradas: number;
  saidas: number;
  /** Parcela das entradas já efetivamente recebida. */
  entradasRealizadas: number;
  /** Parcela das saídas já efetivamente paga. */
  saidasRealizadas: number;
  saldoDia: number;
  saldoAcumulado: number;
  /**
   * Saldo considerando apenas o que já aconteceu. Só existe até hoje;
   * `null` nos dias futuros, para que a linha do realizado termine na data
   * de hoje em vez de despencar a zero.
   */
  saldoRealizado: number | null;
  negativo: boolean;
  passado: boolean;
}

export interface ResultadoFluxoCaixa {
  periodo: string;
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  dias: DiaFluxoCaixa[];
  diasNegativos: number;
  ncg: NCGResult;
  entradasPrevistas: number;
  entradasRealizadas: number;
}

export interface NCGResult {
  pmr: number;
  pmp: number;
  faturamentoDiarioMedio: number;
  ncg: number;
  cicloFinanceiro: number;
  diasDeCaixa: number;
}

// ───────────────────────────── Indicadores ─────────────────────────────

export interface Indicador {
  chave: string;
  label: string;
  valor: number;
  formato: 'moeda' | 'percentual' | 'numero' | 'horas' | 'dias';
  descricao: string;
  referencia?: number;
  melhorQuando?: 'maior' | 'menor';
}

export interface GrupoIndicadores {
  grupo: string;
  descricao: string;
  indicadores: Indicador[];
}

export interface FaixaHistograma {
  faixa: string;
  min: number;
  max: number;
  quantidade: number;
  receita: number;
}

// ───────────────────────────── Insights IA ─────────────────────────────

export interface AcaoInsight {
  titulo: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  impactoEstimado?: string;
}

export interface ItemInsight {
  titulo: string;
  descricao: string;
  impacto: string;
}

export interface AnaliseIA {
  resumo_executivo: string;
  pontos_criticos: ItemInsight[];
  oportunidades: ItemInsight[];
  acoes_imediatas: AcaoInsight[];
  acoes_estrategicas: AcaoInsight[];
  analise_precificacao: string;
  analise_produtividade: string;
  analise_mix_servicos: string;
  projecao: string;
  frase_do_mes: string;
}

export interface SnapshotFinanceiro {
  periodo: string;
  faturamento: number;
  metaFaturamento: number;
  osFinalizadas: number;
  mediaHistoricaOS: number;
  ticketMedio: number;
  margemContribuicaoPct: number;
  ebitda: number;
  ebitdaPct: number;
  lucroLiquido: number;
  lucroLiquidoPct: number;
  horasRealizadas: number;
  horasDisponiveis: number;
  ocupacaoPct: number;
  ociosidadeRealPct: number;
  osAbaixoMinimo: number;
  totalOS: number;
  topMargem: Array<{ descricao: string; margem: number }>;
  topVolume: Array<{ descricao: string; quantidade: number; receita: number }>;
  pmr: number;
  ncg: number;
  variacaoFaturamentoPct: number | null;
  variacaoMargemPct: number | null;
  alertas: Array<{ nivel: string; titulo: string; descricao: string }>;
  pontoEquilibrio: number;
}

// ───────────────────────────── Clientes ─────────────────────────────

export const CLASSIFICACOES_CLIENTE = ['premium', 'regular', 'esporadico'] as const;
export type ClassificacaoCliente = (typeof CLASSIFICACOES_CLIENTE)[number];

export interface ClienteComMetricas {
  id: string;
  codigo: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  ativo: boolean;
  totalOS: number;
  volumeFaturado: number;
  ticketMedio: number;
  margemMedia: number;
  ultimaOS: string | null;
  classificacao: ClassificacaoCliente;
  faturamentoMensalMedio: number;
}

// ───────────────────────────── Backup ─────────────────────────────

export interface MetadadosBackup {
  versaoApp: string;
  geradoEm: string;
  tipo: string;
  totais: Record<string, number>;
  arquivos: Array<{ nome: string; checksum: string; tamanho: number }>;
  checksumGeral: string;
}

export interface PreviewBackup {
  valido: boolean;
  erros: string[];
  metadados: MetadadosBackup | null;
  totais: Record<string, number>;
}

// ───────────────────────────── Utilitários ─────────────────────────────

export interface RespostaAPI<T> {
  ok: boolean;
  dados?: T;
  erro?: string;
  detalhes?: unknown;
}

export function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function parseInsumosExtras(valor: unknown): InsumoExtra[] {
  let bruto: unknown = valor;
  if (typeof valor === 'string') {
    try {
      bruto = JSON.parse(valor);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(bruto)) return [];
  const saida: InsumoExtra[] = [];
  for (const item of bruto) {
    if (!isRecord(item)) continue;
    const nome = typeof item.nome === 'string' ? item.nome : '';
    const valorItem = typeof item.valor === 'number' ? item.valor : Number(item.valor);
    if (!nome || !Number.isFinite(valorItem)) continue;
    saida.push({ nome, valor: valorItem });
  }
  return saida;
}
