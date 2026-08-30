/**
 * Motor de insights gerenciais com a API da Anthropic.
 *
 * Princípio de projeto: a IA é um complemento, nunca uma dependência.
 * Sem chave configurada, a página de insights continua funcionando —
 * mostra os alertas determinísticos e um caminho claro para configurar.
 * Nenhum caminho de código quebra a aplicação por falta de IA.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { decifrar } from '@/lib/cripto';
import { arredondar, dividir, extrairMensagemErro, variacaoPercentual } from '@/lib/utils';
import {
  deslocarPeriodo,
  diasNoPeriodo,
  formatarMoeda,
  formatarPeriodoExtenso,
} from '@/lib/formatacao';
import {
  buscarOSDoPeriodo,
  calcularBreakEven,
  calcularNCG,
  getContextoCalculo,
  margemContribuicaoOS,
  precoPraticado,
  resumirPeriodo,
} from '@/lib/calculos';
import { calcularDRE } from '@/lib/dre';
import { calcularAlertas } from '@/lib/alertas';
import type { AnaliseIA, SnapshotFinanceiro } from '@/types';

const MODELO_PADRAO = 'claude-sonnet-4-5';

export class ErroIANaoConfigurada extends Error {
  constructor() {
    super(
      'A chave da API da Anthropic não está configurada. ' +
        'Cadastre-a em Configurações → Integração de IA para gerar os insights.',
    );
    this.name = 'ErroIANaoConfigurada';
  }
}

/**
 * Chave da API. A cadastrada na interface (cifrada no banco) tem
 * precedência sobre a variável de ambiente.
 */
export async function getChaveAnthropic(): Promise<string | null> {
  try {
    const registro = await prisma.configuracao.findUnique({ where: { chave: 'anthropicApiKey' } });
    const doBanco = registro?.valor ? decifrar(registro.valor).trim() : '';
    if (doBanco) return doBanco;
  } catch (erro) {
    console.error('[ia] Falha ao ler a chave da API:', extrairMensagemErro(erro));
  }
  const doAmbiente = process.env.ANTHROPIC_API_KEY?.trim();
  return doAmbiente ? doAmbiente : null;
}

export async function getModelo(): Promise<string> {
  try {
    const registro = await prisma.configuracao.findUnique({ where: { chave: 'anthropicModelo' } });
    if (registro?.valor?.trim()) return registro.valor.trim();
  } catch {
    // segue com o padrão
  }
  return process.env.ANTHROPIC_MODEL?.trim() || MODELO_PADRAO;
}

export async function iaConfigurada(): Promise<boolean> {
  return (await getChaveAnthropic()) !== null;
}

/** Testa a conexão com a API sem consumir tokens relevantes. */
export async function testarConexao(): Promise<{ ok: boolean; mensagem: string; modelo?: string }> {
  const chave = await getChaveAnthropic();
  if (!chave) {
    return { ok: false, mensagem: 'Nenhuma chave configurada.' };
  }

  const modelo = await getModelo();
  try {
    const cliente = new Anthropic({ apiKey: chave });
    await cliente.messages.create({
      model: modelo,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
    });
    return { ok: true, mensagem: 'Conexão estabelecida com sucesso.', modelo };
  } catch (erro) {
    const mensagem = extrairMensagemErro(erro);
    if (mensagem.includes('401') || mensagem.toLowerCase().includes('authentication')) {
      return { ok: false, mensagem: 'Chave rejeitada pela Anthropic. Confira o valor cadastrado.' };
    }
    if (mensagem.includes('404') || mensagem.toLowerCase().includes('not_found')) {
      return {
        ok: false,
        mensagem: `O modelo "${modelo}" não está disponível para esta chave. Escolha outro modelo.`,
      };
    }
    return { ok: false, mensagem: `Falha na conexão: ${mensagem}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SNAPSHOT FINANCEIRO
// ═══════════════════════════════════════════════════════════════════════════

/** Consolida tudo o que a IA precisa saber sobre o período. */
export async function montarSnapshot(periodo: string): Promise<SnapshotFinanceiro> {
  const ctx = await getContextoCalculo();
  const { parametros: p, derivados } = ctx;

  const periodoAnterior = deslocarPeriodo(periodo, -1);
  const [ordens, ordensAnterior, dre, alertas] = await Promise.all([
    buscarOSDoPeriodo(periodo),
    buscarOSDoPeriodo(periodoAnterior),
    calcularDRE(periodo, 'competencia', ctx),
    calcularAlertas(periodo, ctx),
  ]);

  const resumo = resumirPeriodo(periodo, ordens, p, derivados);
  const resumoAnterior = resumirPeriodo(periodoAnterior, ordensAnterior, p, derivados);

  // Média histórica de OS dos 12 meses anteriores.
  let mediaHistoricaOS = 0;
  try {
    const totais: number[] = [];
    for (let i = 1; i <= 12; i += 1) {
      const anteriores = await buscarOSDoPeriodo(deslocarPeriodo(periodo, -i));
      totais.push(anteriores.length);
    }
    mediaHistoricaOS = arredondar(dividir(totais.reduce((a, b) => a + b, 0), 12), 1);
  } catch (erro) {
    console.error('[ia] Falha ao calcular média histórica:', extrairMensagemErro(erro));
  }

  const comMargem = ordens.map((os) => ({
    descricao: os.descricao.slice(0, 80),
    margem: margemContribuicaoOS(os, p.aliquotaImpostos),
    receita: precoPraticado(os),
  }));

  const topMargem = [...comMargem]
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 3)
    .map((x) => ({ descricao: x.descricao, margem: x.margem }));

  const porDescricao = new Map<string, { quantidade: number; receita: number }>();
  for (const item of comMargem) {
    const chave = item.descricao.split(/[-–—,]/)[0]?.trim().slice(0, 50) || item.descricao;
    const atual = porDescricao.get(chave) ?? { quantidade: 0, receita: 0 };
    atual.quantidade += 1;
    atual.receita += item.receita;
    porDescricao.set(chave, atual);
  }
  const topVolume = [...porDescricao.entries()]
    .sort((a, b) => b[1].quantidade - a[1].quantidade)
    .slice(0, 3)
    .map(([descricao, v]) => ({
      descricao,
      quantidade: v.quantidade,
      receita: arredondar(v.receita),
    }));

  const ocupacaoPct = arredondar(dividir(resumo.horasRealizadas, derivados.totalHorasProdutivas) * 100, 1);
  const breakEven = calcularBreakEven(p, resumo.margemVariavelPct, resumo.faturamento);
  const ncg = calcularNCG(p.pmrDias, p.pmpDias, dividir(resumo.faturamento, diasNoPeriodo(periodo)));

  return {
    periodo,
    faturamento: resumo.faturamento,
    metaFaturamento: p.metaFaturamentoMensal,
    osFinalizadas: resumo.quantidadeOS,
    mediaHistoricaOS,
    ticketMedio: resumo.ticketMedio,
    margemContribuicaoPct: resumo.margemContribuicaoPct,
    ebitda: dre.ebitda,
    ebitdaPct: dre.ebitdaPct,
    lucroLiquido: dre.lucroLiquido,
    lucroLiquidoPct: dre.lucratividade,
    horasRealizadas: resumo.horasRealizadas,
    horasDisponiveis: arredondar(derivados.totalHorasProdutivas, 1),
    ocupacaoPct,
    ociosidadeRealPct: arredondar(Math.max(0, 100 - ocupacaoPct), 1),
    osAbaixoMinimo: resumo.osAbaixoMinimo,
    totalOS: resumo.quantidadeOS,
    topMargem,
    topVolume,
    pmr: p.pmrDias,
    ncg: ncg.ncg,
    variacaoFaturamentoPct: variacaoPercentual(resumo.faturamento, resumoAnterior.faturamento),
    variacaoMargemPct: variacaoPercentual(
      resumo.margemContribuicaoPct,
      resumoAnterior.margemContribuicaoPct,
    ),
    alertas: alertas.slice(0, 12).map((a) => ({
      nivel: a.nivel,
      titulo: a.titulo,
      descricao: a.descricao,
    })),
    pontoEquilibrio: breakEven.pontoEquilibrioReceita,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROMPT
// ═══════════════════════════════════════════════════════════════════════════

function pct(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return 'sem base de comparação';
  const sinal = valor >= 0 ? '+' : '−';
  return `${sinal}${Math.abs(valor).toFixed(1)}%`;
}

export function montarPrompt(snapshot: SnapshotFinanceiro, nomeEmpresa: string): string {
  const s = snapshot;
  const listaAlertas =
    s.alertas.length > 0
      ? s.alertas.map((a) => `- [${a.nivel.toUpperCase()}] ${a.titulo}: ${a.descricao}`).join('\n')
      : '- Nenhum alerta determinístico ativo no período.';

  const listaMargem =
    s.topMargem.length > 0
      ? s.topMargem.map((t) => `${t.descricao} (${t.margem.toFixed(1)}%)`).join('; ')
      : 'sem dados suficientes';

  const listaVolume =
    s.topVolume.length > 0
      ? s.topVolume
          .map((t) => `${t.descricao} (${t.quantidade} OS, ${formatarMoeda(t.receita)})`)
          .join('; ')
      : 'sem dados suficientes';

  return `Você é o CFO Sênior e Consultor de Gestão da ${nomeEmpresa}, empresa de usinagem,
solda, caldeiraria e recuperação de peças para transporte pesado (ônibus, caminhões, tratores e
máquinas industriais), com 14 colaboradores produtivos e regime tributário Simples Nacional.
Você conhece profundamente o setor metalmecânico e as dinâmicas de gestão de PMEs industriais
brasileiras.

DADOS DO PERÍODO ${formatarPeriodoExtenso(s.periodo).toUpperCase()}:
- Faturamento: ${formatarMoeda(s.faturamento)} (meta: ${formatarMoeda(s.metaFaturamento)})
- OS finalizadas: ${s.osFinalizadas} (média histórica: ${s.mediaHistoricaOS})
- Ticket médio: ${formatarMoeda(s.ticketMedio)}
- Margem de contribuição: ${s.margemContribuicaoPct.toFixed(1)}%
- EBITDA: ${formatarMoeda(s.ebitda)} (${s.ebitdaPct.toFixed(1)}%)
- Lucro líquido: ${formatarMoeda(s.lucroLiquido)} (${s.lucroLiquidoPct.toFixed(1)}%)
- Horas produtivas realizadas: ${s.horasRealizadas.toFixed(0)}h de ${s.horasDisponiveis.toFixed(0)}h disponíveis (ocupação: ${s.ocupacaoPct.toFixed(1)}%)
- Ociosidade real: ${s.ociosidadeRealPct.toFixed(1)}%
- OS abaixo da margem mínima (15%): ${s.osAbaixoMinimo} de ${s.totalOS}${
    s.totalOS > 0 ? ` (${((s.osAbaixoMinimo / s.totalOS) * 100).toFixed(0)}%)` : ''
  }
- Top 3 serviços por margem: ${listaMargem}
- Top 3 serviços por volume: ${listaVolume}
- PMR: ${s.pmr} dias | NCG: ${formatarMoeda(s.ncg)}
- Ponto de equilíbrio mensal: ${formatarMoeda(s.pontoEquilibrio)}
- Variação vs mês anterior: faturamento ${pct(s.variacaoFaturamentoPct)}, margem ${pct(s.variacaoMargemPct)}

DIAGNÓSTICO AUTOMÁTICO DO SISTEMA:
${listaAlertas}

Com base nesses dados reais, gere um parecer gerencial completo em português brasileiro.

Instruções de qualidade — o parecer só é útil se cumprir todas:
1. Quantifique em reais sempre que os dados permitirem. Nada de "melhorar a margem": diga
   quanto, sobre qual base, e o que isso vale por mês.
2. Fale como quem conhece o chão de fábrica — torno, fresa, solda, montagem, radial —, não em
   linguagem genérica de consultoria.
3. Se os dados forem escassos ou zerados, diga isso com franqueza em vez de inventar
   diagnóstico. Recomendar "registrar as horas realizadas" é mais útil que uma análise fictícia.
4. Cada ação precisa de responsável e prazo plausíveis para uma empresa de 14 pessoas.
5. Não repita os alertas do diagnóstico automático: interprete-os, conecte causas e priorize.

Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto antes ou depois, sem blocos de
código markdown, exatamente neste formato:
{
  "resumo_executivo": "3 a 4 frases sobre a saúde geral do negócio",
  "pontos_criticos": [{"titulo": "...", "descricao": "...", "impacto": "R$ X/mês ou descrição do impacto"}],
  "oportunidades": [{"titulo": "...", "descricao": "...", "impacto": "R$ X/mês de potencial"}],
  "acoes_imediatas": [{"titulo": "...", "descricao": "...", "responsavel": "...", "prazo": "...", "impactoEstimado": "..."}],
  "acoes_estrategicas": [{"titulo": "...", "descricao": "...", "responsavel": "...", "prazo": "...", "impactoEstimado": "..."}],
  "analise_precificacao": "análise específica sobre a adequação dos preços praticados",
  "analise_produtividade": "análise da ocupação das máquinas e da equipe, com sugestões",
  "analise_mix_servicos": "quais serviços priorizar e por quê",
  "projecao": "o que esperar nos próximos 60 a 90 dias mantido o ritmo atual",
  "frase_do_mes": "uma frase específica e motivadora para o gestor, ancorada nos dados acima"
}

Limites: até 4 pontos críticos, até 4 oportunidades, até 5 ações imediatas (30 dias) e
até 3 ações estratégicas (90 a 180 dias).`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  GERAÇÃO E PARSE
// ═══════════════════════════════════════════════════════════════════════════

function texto(valor: unknown, padrao = ''): string {
  return typeof valor === 'string' ? valor.trim() : padrao;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function comoItens(valor: unknown, limite: number): AnaliseIA['pontos_criticos'] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(ehObjeto)
    .slice(0, limite)
    .map((item) => ({
      titulo: texto(item.titulo, 'Sem título'),
      descricao: texto(item.descricao),
      impacto: texto(item.impacto),
    }))
    .filter((item) => item.descricao !== '');
}

function comoAcoes(valor: unknown, limite: number): AnaliseIA['acoes_imediatas'] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(ehObjeto)
    .slice(0, limite)
    .map((item) => ({
      titulo: texto(item.titulo, 'Ação'),
      descricao: texto(item.descricao),
      responsavel: texto(item.responsavel, 'Gestor'),
      prazo: texto(item.prazo, 'A definir'),
      impactoEstimado: texto(item.impactoEstimado),
    }))
    .filter((item) => item.descricao !== '');
}

/**
 * Converte a resposta do modelo na estrutura tipada.
 * Tolera o JSON vir embrulhado em cercas de markdown — acontece.
 */
export function interpretarResposta(bruto: string): AnaliseIA {
  let json = bruto.trim();

  const cerca = json.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cerca?.[1]) json = cerca[1].trim();

  const primeiro = json.indexOf('{');
  const ultimo = json.lastIndexOf('}');
  if (primeiro !== -1 && ultimo > primeiro) json = json.slice(primeiro, ultimo + 1);

  let dados: unknown;
  try {
    dados = JSON.parse(json);
  } catch {
    throw new Error(
      'A resposta da IA não veio em JSON válido. Tente gerar a análise novamente.',
    );
  }

  if (!ehObjeto(dados)) {
    throw new Error('A resposta da IA não tem o formato esperado.');
  }

  return {
    resumo_executivo: texto(dados.resumo_executivo, 'Resumo não disponível.'),
    pontos_criticos: comoItens(dados.pontos_criticos, 4),
    oportunidades: comoItens(dados.oportunidades, 4),
    acoes_imediatas: comoAcoes(dados.acoes_imediatas, 5),
    acoes_estrategicas: comoAcoes(dados.acoes_estrategicas, 3),
    analise_precificacao: texto(dados.analise_precificacao),
    analise_produtividade: texto(dados.analise_produtividade),
    analise_mix_servicos: texto(dados.analise_mix_servicos),
    projecao: texto(dados.projecao),
    frase_do_mes: texto(dados.frase_do_mes),
  };
}

export interface ResultadoGeracao {
  analise: AnaliseIA;
  snapshot: SnapshotFinanceiro;
  modelo: string;
  tokensUsados: number;
}

/** Gera o parecer gerencial do período. */
export async function gerarInsight(
  periodo: string,
  nomeEmpresa = 'Recuperadora Menegatti',
): Promise<ResultadoGeracao> {
  const chave = await getChaveAnthropic();
  if (!chave) throw new ErroIANaoConfigurada();

  const modelo = await getModelo();
  const snapshot = await montarSnapshot(periodo);
  const prompt = montarPrompt(snapshot, nomeEmpresa);

  const cliente = new Anthropic({ apiKey: chave });

  let resposta: Anthropic.Message;
  try {
    resposta = await cliente.messages.create({
      model: modelo,
      max_tokens: 4096,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (erro) {
    const mensagem = extrairMensagemErro(erro);
    if (mensagem.includes('401') || mensagem.toLowerCase().includes('authentication')) {
      throw new Error(
        'A chave da API foi rejeitada pela Anthropic. Revise o valor em Configurações → Integração de IA.',
      );
    }
    if (mensagem.includes('429') || mensagem.toLowerCase().includes('rate')) {
      throw new Error('Limite de requisições da API atingido. Tente novamente em alguns minutos.');
    }
    if (mensagem.includes('529') || mensagem.toLowerCase().includes('overloaded')) {
      throw new Error('A API da Anthropic está sobrecarregada no momento. Tente novamente em instantes.');
    }
    throw new Error(`Falha ao consultar a IA: ${mensagem}`);
  }

  const partes = resposta.content
    .filter((bloco): bloco is Anthropic.TextBlock => bloco.type === 'text')
    .map((bloco) => bloco.text);

  if (partes.length === 0) {
    throw new Error('A IA não retornou conteúdo textual.');
  }

  const analise = interpretarResposta(partes.join('\n'));
  const tokensUsados = resposta.usage.input_tokens + resposta.usage.output_tokens;

  return { analise, snapshot, modelo, tokensUsados };
}

/** Gera e persiste o insight do período. */
export async function gerarEsalvarInsight(
  periodo: string,
  origem: 'manual' | 'automatico' = 'manual',
): Promise<{ id: string; analise: AnaliseIA; tokensUsados: number }> {
  const empresa = await prisma.configuracao
    .findUnique({ where: { chave: 'empresaNome' } })
    .catch(() => null);

  const { analise, snapshot, modelo, tokensUsados } = await gerarInsight(
    periodo,
    empresa?.valor || 'Recuperadora Menegatti',
  );

  const registro = await prisma.insightIA.create({
    data: {
      periodo,
      dadosSnapshot: JSON.stringify(snapshot),
      analiseGerada: JSON.stringify(analise),
      modeloUsado: modelo,
      tokensUsados,
      origem,
    },
    select: { id: true },
  });

  return { id: registro.id, analise, tokensUsados };
}

/** Uso acumulado da API, para a aba de integração. */
export async function historicoUsoIA(): Promise<{
  totalGeracoes: number;
  totalTokens: number;
  ultimaGeracao: Date | null;
  porModelo: Array<{ modelo: string; geracoes: number; tokens: number }>;
}> {
  try {
    const insights = await prisma.insightIA.findMany({
      select: { modeloUsado: true, tokensUsados: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const porModelo = new Map<string, { geracoes: number; tokens: number }>();
    let totalTokens = 0;
    for (const i of insights) {
      const atual = porModelo.get(i.modeloUsado) ?? { geracoes: 0, tokens: 0 };
      atual.geracoes += 1;
      atual.tokens += i.tokensUsados ?? 0;
      totalTokens += i.tokensUsados ?? 0;
      porModelo.set(i.modeloUsado, atual);
    }

    return {
      totalGeracoes: insights.length,
      totalTokens,
      ultimaGeracao: insights[0]?.createdAt ?? null,
      porModelo: [...porModelo.entries()].map(([modelo, v]) => ({ modelo, ...v })),
    };
  } catch (erro) {
    console.error('[ia] Falha ao ler histórico de uso:', extrairMensagemErro(erro));
    return { totalGeracoes: 0, totalTokens: 0, ultimaGeracao: null, porModelo: [] };
  }
}

/** Insight persistido de um período, já desserializado. */
export async function buscarInsight(periodo: string): Promise<{
  id: string;
  periodo: string;
  analise: AnaliseIA;
  snapshot: SnapshotFinanceiro | null;
  acoesConcluidas: Record<string, boolean>;
  modeloUsado: string;
  criadoEm: Date;
} | null> {
  try {
    const registro = await prisma.insightIA.findFirst({
      where: { periodo },
      orderBy: { createdAt: 'desc' },
    });
    if (!registro) return null;

    const analise = JSON.parse(registro.analiseGerada) as AnaliseIA;
    let snapshot: SnapshotFinanceiro | null = null;
    try {
      snapshot = JSON.parse(registro.dadosSnapshot) as SnapshotFinanceiro;
    } catch {
      snapshot = null;
    }
    let acoesConcluidas: Record<string, boolean> = {};
    try {
      const parsed: unknown = JSON.parse(registro.acoesConcluidas);
      if (ehObjeto(parsed)) {
        acoesConcluidas = Object.fromEntries(
          Object.entries(parsed).map(([k, v]) => [k, Boolean(v)]),
        );
      }
    } catch {
      acoesConcluidas = {};
    }

    return {
      id: registro.id,
      periodo: registro.periodo,
      analise,
      snapshot,
      acoesConcluidas,
      modeloUsado: registro.modeloUsado,
      criadoEm: registro.createdAt,
    };
  } catch (erro) {
    console.error('[ia] Falha ao buscar insight:', extrairMensagemErro(erro));
    return null;
  }
}

/** Períodos com insight salvo, para o seletor de histórico. */
export async function listarPeriodosComInsight(): Promise<string[]> {
  try {
    const registros = await prisma.insightIA.findMany({
      select: { periodo: true },
      distinct: ['periodo'],
      orderBy: { periodo: 'desc' },
      take: 24,
    });
    return registros.map((r) => r.periodo);
  } catch {
    return [];
  }
}
