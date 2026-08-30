import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaAcoesInsight } from '@/lib/validacoes';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** PUT — marca/desmarca as ações concluídas do plano. */
export async function PUT(request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async () => {
    const { acoesConcluidas } = schemaAcoesInsight.parse(await lerJson(request));

    const atualizado = await prisma.insightIA.update({
      where: { id: params.id },
      data: { acoesConcluidas: JSON.stringify(acoesConcluidas) },
      select: { id: true, acoesConcluidas: true },
    });

    revalidatePath('/insights');
    return ok(atualizado);
  });
}

/** DELETE — remove um insight do histórico. */
export async function DELETE(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async () => {
    await prisma.insightIA.delete({ where: { id: params.id } });
    revalidatePath('/insights');
    return ok({ removido: true });
  });
}
