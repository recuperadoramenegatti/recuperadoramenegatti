import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { comSessao, ok } from '@/lib/api';
import { duplicarOS } from '@/lib/ordens';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** POST — cria uma cópia da OS como novo orçamento. */
export async function POST(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const nova = await duplicarOS(params.id, usuario.email);
    revalidatePath('/ordens');
    return ok(nova, 201);
  });
}
