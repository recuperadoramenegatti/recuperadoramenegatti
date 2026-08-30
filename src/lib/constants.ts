/**
 * Valores default do sistema — usados APENAS pelo seed e como fallback quando
 * uma chave ainda não existe no banco. A fonte de verdade em runtime é sempre
 * a tabela `Configuracao` (ver src/lib/calculos.ts → getParametros).
 *
 * Números calibrados no diagnóstico financeiro da Recuperadora Menegatti.
 */

import type { ParametrosBase } from '@/types';

export const APP_VERSAO = '1.0.0';
export const APP_NOME = 'Recuperadora Menegatti';

export interface DefinicaoConfig {
  chave: keyof ParametrosBase | string;
  valor: string;
  tipo: 'number' | 'string' | 'boolean' | 'secret';
  grupo: 'empresa' | 'financeiro' | 'ia' | 'aparencia';
  descricao: string;
}

/** Parâmetros financeiros default (calibrados). */
export const PARAMETROS_DEFAULT: ParametrosBase = {
  // Mão de obra direta
  folhaBrutaMensal: 170000,
  multiplicadorEncargos: 1.87,
  qtdOperadores: 14,
  horasPorDia: 8.8,
  diasUteisMes: 21,
  ociosidadePct: 20,

  // Overhead / custos fixos indiretos
  despesasAdministrativas: 50000,
  energiaEletrica: 600,
  manutencaoPreventiva: 0,
  depreciacaoMensal: 0,
  salariosAdministrativos: 0,
  prolabore: 0,
  aluguel: 0,
  outrasDespesasFixas: 0,

  // Precificação
  aliquotaImpostos: 14.5,
  margemMinima: 15,
  margemIdeal: 30,
  margemPadrao: 30,
  metaFaturamentoMensal: 500000,

  // Capital de giro
  pmrDias: 30,
  pmpDias: 30,

  // Defaults de orçamento
  markupMateriaisPadrao: 20,
  descontoToleradoPecaNova: 40,
  validadeOrcamentoPadrao: 30,
  setupPadraoHoras: 0.5,

  // Limiares de alerta
  concentracaoClienteMaxPct: 30,
  limiarProximidadePecaNova: 75,
};

export const DESCRICOES_PARAMETROS: Record<keyof ParametrosBase, string> = {
  folhaBrutaMensal: 'Folha bruta mensal da equipe produtiva (R$)',
  multiplicadorEncargos: 'Multiplicador de encargos sobre a folha (Simples Nacional)',
  qtdOperadores: 'Quantidade de operadores produtivos',
  horasPorDia: 'Horas trabalhadas por dia (jornada)',
  diasUteisMes: 'Dias úteis por mês',
  ociosidadePct: 'Ociosidade estimada da equipe (%)',
  despesasAdministrativas: 'Despesas administrativas mensais (R$)',
  energiaEletrica: 'Energia elétrica mensal (R$)',
  manutencaoPreventiva: 'Provisão mensal para manutenção preventiva (R$)',
  depreciacaoMensal: 'Depreciação mensal de máquinas (R$)',
  salariosAdministrativos: 'Salários + encargos do administrativo (R$)',
  prolabore: 'Pró-labore dos sócios (R$)',
  aluguel: 'Aluguel / infraestrutura (R$)',
  outrasDespesasFixas: 'Outras despesas fixas mensais (R$)',
  aliquotaImpostos: 'Alíquota efetiva do Simples Nacional (%)',
  margemMinima: 'Margem de contribuição mínima aceitável (%)',
  margemIdeal: 'Margem de contribuição ideal (%)',
  margemPadrao: 'Margem sugerida como default no orçamento (%)',
  metaFaturamentoMensal: 'Meta de faturamento mensal (R$)',
  pmrDias: 'PMR — prazo médio de recebimento (dias)',
  pmpDias: 'PMP — prazo médio de pagamento a fornecedores (dias)',
  markupMateriaisPadrao: 'Markup padrão sobre materiais (%)',
  descontoToleradoPecaNova: 'Desconto máximo tolerável vs peça nova (%)',
  validadeOrcamentoPadrao: 'Validade padrão do orçamento (dias)',
  setupPadraoHoras: 'Horas de setup/preparação padrão',
  concentracaoClienteMaxPct: 'Concentração máxima aceitável de um cliente no faturamento (%)',
  limiarProximidadePecaNova:
    'Limiar de alerta: preço da recuperação como % do valor da peça nova',
};

/** Chaves que aparecem na aba "Parâmetros Financeiros", na ordem de exibição. */
export const GRUPOS_PARAMETROS: Array<{
  titulo: string;
  descricao: string;
  chaves: Array<keyof ParametrosBase>;
}> = [
  {
    titulo: 'Mão de obra direta',
    descricao: 'Base de cálculo da Taxa Hora-Homem (THH).',
    chaves: [
      'folhaBrutaMensal',
      'multiplicadorEncargos',
      'qtdOperadores',
      'horasPorDia',
      'diasUteisMes',
      'ociosidadePct',
    ],
  },
  {
    titulo: 'Custos fixos indiretos (base do CFR)',
    descricao: 'Overhead rateado por hora produtiva.',
    chaves: ['despesasAdministrativas', 'energiaEletrica', 'manutencaoPreventiva'],
  },
  {
    titulo: 'Demais custos fixos (DRE)',
    descricao: 'Entram no DRE e no ponto de equilíbrio, fora do rateio do CFR.',
    chaves: [
      'depreciacaoMensal',
      'salariosAdministrativos',
      'prolabore',
      'aluguel',
      'outrasDespesasFixas',
    ],
  },
  {
    titulo: 'Precificação e metas',
    descricao: 'Impostos, margens e meta mensal.',
    chaves: [
      'aliquotaImpostos',
      'margemMinima',
      'margemIdeal',
      'margemPadrao',
      'metaFaturamentoMensal',
    ],
  },
  {
    titulo: 'Capital de giro',
    descricao: 'Prazos usados no fluxo de caixa e na NCG.',
    chaves: ['pmrDias', 'pmpDias'],
  },
  {
    titulo: 'Defaults do orçamento',
    descricao: 'Valores pré-preenchidos ao abrir um novo orçamento.',
    chaves: [
      'markupMateriaisPadrao',
      'descontoToleradoPecaNova',
      'validadeOrcamentoPadrao',
      'setupPadraoHoras',
    ],
  },
  {
    titulo: 'Limiares de alerta',
    descricao: 'Gatilhos do motor de alertas determinísticos.',
    chaves: ['concentracaoClienteMaxPct', 'limiarProximidadePecaNova'],
  },
];

/** Centros de custo iniciais (nome, máquinas, operadores, THM). */
export const CENTROS_DEFAULT = [
  { nome: 'Torno', slug: 'torno', qtdMaquinas: 6, qtdOperadores: 6, thmEstimado: 18.5, ordem: 1 },
  { nome: 'Fresa', slug: 'fresa', qtdMaquinas: 2, qtdOperadores: 2, thmEstimado: 22.0, ordem: 2 },
  { nome: 'Solda', slug: 'solda', qtdMaquinas: 2, qtdOperadores: 2, thmEstimado: 12.0, ordem: 3 },
  {
    nome: 'Montagem/Acabamento',
    slug: 'montagem-acabamento',
    qtdMaquinas: 2,
    qtdOperadores: 2,
    thmEstimado: 6.0,
    ordem: 4,
  },
  { nome: 'Radial', slug: 'radial', qtdMaquinas: 2, qtdOperadores: 2, thmEstimado: 15.0, ordem: 5 },
] as const;

/** Configurações não-numéricas (empresa, IA, aparência). */
export const CONFIGS_TEXTO: DefinicaoConfig[] = [
  {
    chave: 'empresaNome',
    valor: 'Recuperadora Menegatti',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'Razão social / nome fantasia',
  },
  {
    chave: 'empresaCnpj',
    valor: '',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'CNPJ da empresa',
  },
  {
    chave: 'empresaEndereco',
    valor: '',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'Endereço completo',
  },
  {
    chave: 'empresaTelefone',
    valor: '',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'Telefone / WhatsApp',
  },
  {
    chave: 'empresaEmail',
    valor: '',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'E-mail de contato',
  },
  {
    chave: 'empresaLogo',
    valor: '',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'Logo em data URL (upload)',
  },
  {
    chave: 'empresaSetor',
    valor: 'Usinagem, Solda, Caldeiraria, Montagem e Acabamento',
    tipo: 'string',
    grupo: 'empresa',
    descricao: 'Setor de atuação',
  },
  {
    chave: 'anthropicApiKey',
    valor: '',
    tipo: 'secret',
    grupo: 'ia',
    descricao: 'Chave da API da Anthropic (armazenada cifrada)',
  },
  {
    chave: 'anthropicModelo',
    valor: 'claude-sonnet-4-5',
    tipo: 'string',
    grupo: 'ia',
    descricao: 'Modelo usado para gerar os insights',
  },
  {
    chave: 'iaGeracaoAutomatica',
    valor: 'true',
    tipo: 'boolean',
    grupo: 'ia',
    descricao: 'Gerar insights automaticamente uma vez por mês',
  },
  {
    chave: 'aparenciaDensidade',
    valor: 'normal',
    tipo: 'string',
    grupo: 'aparencia',
    descricao: 'Densidade da interface: compacto | normal | espacoso',
  },
  {
    chave: 'aparenciaTema',
    valor: 'dark',
    tipo: 'string',
    grupo: 'aparencia',
    descricao: 'Tema padrão: dark | light | system',
  },
  {
    chave: 'backupUltimoCompleto',
    valor: '',
    tipo: 'string',
    grupo: 'financeiro',
    descricao: 'Data/hora do último backup completo',
  },
];

export const CORES_STATUS: Record<string, string> = {
  orcado: '#3B82F6',
  em_execucao: '#F59E0B',
  aguardando_pecas: '#8B5CF6',
  finalizado: '#10B981',
  faturado: '#06B6D4',
  pago: '#059669',
  cancelado: '#6B7280',
};

export const CORES_TIPO: Record<string, string> = {
  recuperacao: '#F59E0B',
  fabricacao: '#3B82F6',
  manutencao: '#8B5CF6',
  outro: '#6B7280',
};

export const CORES_GRAFICO = [
  '#F59E0B',
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#EF4444',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
];

export const CREDENCIAL_INICIAL = {
  email: 'admin',
  senha: 'menegatti2024',
  nome: 'Administrador',
} as const;
