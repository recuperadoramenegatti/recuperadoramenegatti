/**
 * Schemas Zod — validação única e compartilhada entre formulários (React
 * Hook Form) e rotas de API. Nada entra no banco sem passar por aqui.
 */
import { z } from 'zod';
import { PRIORIDADES, STATUS_OS, TIPOS_OS, REGIMES } from '@/types';

const numeroNaoNegativo = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v))
  .pipe(z.number().finite().min(0, 'Não pode ser negativo'));

const numeroOpcional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
    return Number.isFinite(n) ? n : null;
  })
  .pipe(z.number().finite().min(0).nullable());

const dataOpcional = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

/** Texto obrigatório, com trim e limite. */
function texto(min: number, max: number, mensagem: string) {
  return z.string().trim().min(min, mensagem).max(max, `Máximo de ${max} caracteres`);
}

/** Texto opcional que vira `null` quando vazio. */
function textoOpcional(max: number) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const t = typeof v === 'string' ? v.trim() : '';
      return t === '' ? null : t.slice(0, max);
    });
}

// ───────────────────────────── Cliente ─────────────────────────────

export const schemaCliente = z.object({
  nome: texto(2, 160, 'Informe o nome do cliente'),
  documento: textoOpcional(20),
  telefone: textoOpcional(24),
  email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: 'E-mail inválido',
    }),
  cidade: textoOpcional(80),
  estado: textoOpcional(2),
  observacoes: textoOpcional(1000),
  ativo: z.boolean().default(true),
});

export type EntradaCliente = z.input<typeof schemaCliente>;
export type SaidaCliente = z.output<typeof schemaCliente>;

// ────────────────────────── Centro de custo ──────────────────────────

export const schemaCentroCusto = z.object({
  nome: texto(2, 60, 'Informe o nome do centro'),
  qtdMaquinas: z.coerce.number().int().min(0).max(999),
  qtdOperadores: z.coerce.number().int().min(0).max(999),
  thmEstimado: numeroNaoNegativo,
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  ativo: z.boolean().default(true),
});

export type EntradaCentroCusto = z.input<typeof schemaCentroCusto>;

// ─────────────────────────── Ordem de serviço ───────────────────────────

export const schemaInsumoExtra = z.object({
  nome: texto(1, 80, 'Informe o nome do item'),
  valor: numeroNaoNegativo,
});

export const schemaTempoCentro = z.object({
  centroId: z.string().min(1),
  horas: numeroNaoNegativo,
});

export const schemaOrdemServico = z
  .object({
    numero: textoOpcional(30),
    clienteId: z.string().min(1, 'Selecione um cliente'),
    tipo: z.enum(TIPOS_OS),
    descricao: texto(3, 2000, 'Descreva o serviço'),
    prioridade: z.enum(PRIORIDADES).default('normal'),
    status: z.enum(STATUS_OS).default('orcado'),

    tempos: z.array(schemaTempoCentro).default([]),
    horasSetup: numeroNaoNegativo.default(0.5),

    custoMateriais: numeroNaoNegativo.default(0),
    markupMateriais: numeroNaoNegativo.default(20),
    custoConsumiveis: numeroNaoNegativo.default(0),
    custoFerramentas: numeroNaoNegativo.default(0),
    insumosExtras: z.array(schemaInsumoExtra).max(10, 'Máximo de 10 itens extras').default([]),

    margemDesejada: z.coerce
      .number()
      .min(0, 'Margem não pode ser negativa')
      .max(95, 'Margem máxima de 95%')
      .default(30),
    descontoMaximo: z.coerce.number().min(0).max(100).default(0),
    validadeOrcamento: z.coerce.number().int().min(1).max(365).default(30),

    precoFinal: numeroOpcional,
    precoPecaNova: numeroOpcional,
    fontePrecoPecaNova: textoOpcional(200),
    descontoTolerado: numeroOpcional,

    dataPrevisaoEntrega: dataOpcional,
    observacoes: textoOpcional(2000),
  })
  .refine(
    (dados) =>
      dados.tipo !== 'recuperacao' ||
      (dados.precoPecaNova !== null && dados.precoPecaNova > 0),
    {
      message: 'Para recuperação de peça, informe o preço da peça nova no mercado',
      path: ['precoPecaNova'],
    },
  )
  .refine(
    (dados) => dados.tempos.some((t) => t.horas > 0) || dados.horasSetup > 0,
    {
      message: 'Informe ao menos uma hora de trabalho em algum centro de custo',
      path: ['tempos'],
    },
  );

export type EntradaOrdemServico = z.input<typeof schemaOrdemServico>;
export type SaidaOrdemServico = z.output<typeof schemaOrdemServico>;

/** Atualização de status via Kanban. */
export const schemaAtualizarStatus = z.object({
  status: z.enum(STATUS_OS),
});

/** Registro das horas efetivamente realizadas. */
export const schemaHorasRealizadas = z.object({
  itens: z
    .array(
      z.object({
        centroId: z.string().min(1),
        horasRealizadas: numeroNaoNegativo,
      }),
    )
    .default([]),
  horasSetupRealizadas: numeroNaoNegativo.default(0),
  observacoes: textoOpcional(2000),
});

// ─────────────────────────── Configurações ───────────────────────────

export const schemaConfiguracoes = z.object({
  valores: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const schemaAlterarSenha = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z
      .string()
      .min(8, 'A nova senha precisa de ao menos 8 caracteres')
      .max(72, 'Máximo de 72 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  });

// ──────────────────────── Lançamento financeiro ────────────────────────

export const schemaLancamento = z.object({
  tipo: z.enum(['receita', 'despesa']),
  categoria: texto(1, 40, 'Informe a categoria'),
  descricao: texto(2, 200, 'Descreva o lançamento'),
  valor: numeroNaoNegativo,
  data: z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v : new Date(v))),
  regime: z.enum(REGIMES).default('competencia'),
  pago: z.boolean().default(false),
  dataPagamento: dataOpcional,
  osId: textoOpcional(40),
  observacoes: textoOpcional(1000),
});

// ─────────────────────────────── Insights ───────────────────────────────

export const schemaGerarInsight = z.object({
  periodo: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Período inválido (use AAAA-MM)')
    .optional(),
  forcar: z.boolean().default(false),
});

export const schemaAcoesInsight = z.object({
  acoesConcluidas: z.record(z.string(), z.boolean()),
});

// ─────────────────────────────── Backup ───────────────────────────────

export const schemaImportarBackup = z.object({
  modo: z.enum(['substituir', 'mesclar']).default('mesclar'),
});

// ─────────────────────────── Filtros de listagem ───────────────────────────

export const schemaFiltrosOS = z.object({
  busca: z.string().optional(),
  status: z.string().optional(),
  tipo: z.string().optional(),
  clienteId: z.string().optional(),
  centroId: z.string().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  margemMin: z.coerce.number().optional(),
  margemMax: z.coerce.number().optional(),
  valorMin: z.coerce.number().optional(),
  valorMax: z.coerce.number().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

export type FiltrosOS = z.output<typeof schemaFiltrosOS>;

/** Formata os erros do Zod num objeto campo → mensagem. */
export function erroLegivel(erro: z.ZodError): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const issue of erro.issues) {
    const campo = issue.path.join('.') || 'geral';
    if (!saida[campo]) saida[campo] = issue.message;
  }
  return saida;
}
