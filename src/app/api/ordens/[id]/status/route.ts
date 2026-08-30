import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaAtualizarStatus } from '@/lib/validacoes';
import { mudarStatusOS } from '@/lib/ordens';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** PUT — move a OS de status (usado pelo Kanban). */
export async function PUT(request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const { status } = schemaAtualizarStatus.parse(await lerJson(request));
    const atualizada = await mudarStatusOS(params.id, status, usuario.email);

    revalidatePath('/ordens');
    revalidatePath(`/ordens/${params.id}`);
    revalidatePath('/dashboard');
    revalidatePath('/financeiro/dre');
    return ok(atualizada);
  });
}
