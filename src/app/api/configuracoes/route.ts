import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, erro, lerJson, ok } from '@/lib/api';
import { schemaConfiguracoes } from '@/lib/validacoes';
import { calcularDerivados, getParametros } from '@/lib/calculos';
import { PARAMETROS_DEFAULT, DESCRICOES_PARAMETROS } from '@/lib/constants';
import { cifrar, decifrar, mascarar } from '@/lib/cripto';
import type { ParametrosBase } from '@/types';

export const dynamic = 'force-dynamic';

/** GET — todos os parâmetros, derivados e configurações gerais. */
export async function GET(): Promise<NextResponse> {
  return comSessao(async () => {
    const [parametros, registros, centros] = await Promise.all([
      getParametros(),
      prisma.configuracao.findMany({ orderBy: { chave: 'asc' } }),
      prisma.centroCusto.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
    ]);

    const derivados = calcularDerivados(parametros);

    // A chave da Anthropic nunca sai do servidor — apenas a informação
    // de que existe e os 4 últimos caracteres, para conferência visual.
    const gerais: Record<string, string> = {};
    for (const r of registros) {
      if (r.grupo === 'financeiro' && r.chave in PARAMETROS_DEFAULT) continue;
      if (r.tipo === 'secret') {
        const emClaro = decifrar(r.valor);
        gerais[r.chave] = emClaro ? mascarar(emClaro) : '';
        gerais[`${r.chave}Configurada`] = emClaro ? 'true' : 'false';
        continue;
      }
      gerais[r.chave] = r.valor;
    }

    return ok({
      parametros,
      derivados,
      gerais,
      centros: centros.map((c) => ({
        ...c,
        custoHora: derivados.thh + c.thmEstimado + derivados.cfr,
      })),
    });
  });
}

/** PUT — grava configurações e recalcula todos os derivados. */
export async function PUT(request: Request): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const corpo = await lerJson(request);
    const { valores } = schemaConfiguracoes.parse(corpo);

    const chavesParametro = new Set(Object.keys(PARAMETROS_DEFAULT));
    const entradas = Object.entries(valores);

    if (entradas.length === 0) return erro('Nenhuma configuração informada.', 400);

    await prisma.$transaction(async (tx) => {
      for (const [chave, valorBruto] of entradas) {
        const ehParametro = chavesParametro.has(chave);
        const valor = String(valorBruto);

        // Parâmetros financeiros precisam ser numéricos e não-negativos.
        if (ehParametro) {
          const n = Number(valor.replace(',', '.'));
          if (!Number.isFinite(n) || n < 0) {
            throw new Error(`Valor inválido para "${chave}": informe um número não negativo.`);
          }
        }

        // Uma chave secreta vazia significa "manter a atual"; e um valor
        // mascarado (vindo do próprio GET) não deve sobrescrever o real.
        const existente = await tx.configuracao.findUnique({ where: { chave } });
        const ehSegredo = existente?.tipo === 'secret';
        if (ehSegredo && (valor.trim() === '' || valor.startsWith('••••'))) continue;

        const valorGravado = ehSegredo ? cifrar(valor.trim()) : valor;

        await tx.configuracao.upsert({
          where: { chave },
          update: { valor: valorGravado },
          create: {
            chave,
            valor: valorGravado,
            tipo: ehParametro ? 'number' : 'string',
            grupo: ehParametro ? 'financeiro' : 'geral',
            descricao: ehParametro
              ? DESCRICOES_PARAMETROS[chave as keyof ParametrosBase]
              : undefined,
          },
        });
      }

      await tx.logAlteracao.create({
        data: {
          entidade: 'configuracao',
          entidadeId: 'lote',
          acao: 'atualizacao',
          descricao: `${entradas.length} configuração(ões) alterada(s): ${entradas
            .map(([c]) => c)
            .join(', ')}.`,
          usuario: usuario.email,
        },
      });
    });

    // Recalcula e devolve o novo quadro de taxas.
    const parametros = await getParametros();
    const derivados = calcularDerivados(parametros);
    const centros = await prisma.centroCusto.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    for (const rota of [
      '/dashboard',
      '/orcamento',
      '/ordens',
      '/financeiro/dre',
      '/financeiro/fluxo-caixa',
      '/indicadores',
      '/configuracoes',
    ]) {
      revalidatePath(rota);
    }

    return ok({
      parametros,
      derivados,
      centros: centros.map((c) => ({
        ...c,
        custoHora: derivados.thh + c.thmEstimado + derivados.cfr,
      })),
    });
  });
}
