import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaHorasRealizadas } from '@/lib/validacoes';
import { registrarHorasRealizadas } from '@/lib/ordens';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** PUT — registra as horas efetivamente gastas por centro de custo. */
export async function PUT(request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaHorasRealizadas.parse(await lerJson(request));
    const resultado = await registrarHorasRealizadas(
      params.id,
      dados.itens,
      dados.horasSetupRealizadas,
      dados.observacoes,
      usuario.email,
    );

    revalidatePath(`/ordens/${params.id}`);
    revalidatePath('/ordens');
    revalidatePath('/indicadores');
    return ok(resultado);
  });
}
