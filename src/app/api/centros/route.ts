import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaCentroCusto } from '@/lib/validacoes';
import { calcularDerivados, getParametros } from '@/lib/calculos';
import { slugify } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';

/** GET — centros de custo com o custo/hora resolvido. */
export async function GET(): Promise<NextResponse> {
  return comSessao(async () => {
    const [centros, parametros] = await Promise.all([
      prisma.centroCusto.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] }),
      getParametros(),
    ]);
    const derivados = calcularDerivados(parametros);

    return ok(
      centros.map((c) => ({
        ...c,
        thh: derivados.thh,
        cfr: derivados.cfr,
        custoHora: derivados.thh + c.thmEstimado + derivados.cfr,
      })),
    );
  });
}

/** POST — cria um centro de custo. */
export async function POST(request: Request): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaCentroCusto.parse(await lerJson(request));

    const centro = await prisma.centroCusto.create({
      data: { ...dados, slug: slugify(dados.nome) },
    });

    await prisma.logAlteracao.create({
      data: {
        entidade: 'centro',
        entidadeId: centro.id,
        acao: 'criacao',
        descricao: `Centro de custo "${centro.nome}" criado com THM de R$ ${centro.thmEstimado.toFixed(2)}/h.`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/configuracoes');
    revalidatePath('/orcamento');
    return ok(centro, 201);
  });
}
