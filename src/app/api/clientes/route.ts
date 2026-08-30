import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaCliente } from '@/lib/validacoes';
import { listarClientesComMetricas, proximoCodigoCliente } from '@/lib/clientes';

export const dynamic = 'force-dynamic';

/** GET — lista de clientes com métricas de rentabilidade. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const incluirInativos = url.searchParams.get('inativos') === 'true';
    const clientes = await listarClientesComMetricas(incluirInativos);
    return ok(clientes);
  });
}

/** POST — cadastra um cliente. */
export async function POST(request: Request): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaCliente.parse(await lerJson(request));
    const codigo = await proximoCodigoCliente();

    const cliente = await prisma.cliente.create({
      data: { ...dados, codigo },
    });

    await prisma.logAlteracao.create({
      data: {
        entidade: 'cliente',
        entidadeId: cliente.id,
        acao: 'criacao',
        descricao: `Cliente "${cliente.nome}" cadastrado.`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/clientes');
    revalidatePath('/orcamento');
    return ok(cliente, 201);
  });
}
