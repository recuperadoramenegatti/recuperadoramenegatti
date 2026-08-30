import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, erro, lerJson, ok } from '@/lib/api';
import { schemaOrdemServico } from '@/lib/validacoes';
import { atualizarOS } from '@/lib/ordens';
import { agendarBackupIncremental } from '@/lib/backup';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** GET — OS completa, com itens, cliente e histórico. */
export async function GET(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async () => {
    const os = await prisma.ordemServico.findUnique({
      where: { id: params.id },
      include: {
        cliente: true,
        itens: { include: { centro: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!os) return erro('Ordem de serviço não encontrada.', 404);
    return ok(os);
  });
}

/** PUT — atualiza e recalcula a OS. */
export async function PUT(request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaOrdemServico.parse(await lerJson(request));
    const atualizada = await atualizarOS(params.id, dados, usuario.email);

    void agendarBackupIncremental();

    revalidatePath('/ordens');
    revalidatePath(`/ordens/${params.id}`);
    revalidatePath('/dashboard');
    return ok(atualizada);
  });
}

/** DELETE — remove a OS e seus itens (cascade). */
export async function DELETE(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const os = await prisma.ordemServico.findUnique({
      where: { id: params.id },
      select: { numero: true, status: true },
    });
    if (!os) return erro('Ordem de serviço não encontrada.', 404);

    if (['faturado', 'pago'].includes(os.status)) {
      return erro(
        `A OS ${os.numero} já foi faturada e não pode ser excluída — isso apagaria receita ` +
          'reconhecida no DRE. Altere o status para "cancelado" se precisar retirá-la dos relatórios.',
        409,
      );
    }

    await prisma.ordemServico.delete({ where: { id: params.id } });

    await prisma.logAlteracao.create({
      data: {
        entidade: 'ordem',
        entidadeId: os.numero,
        acao: 'exclusao',
        descricao: `OS ${os.numero} excluída.`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/ordens');
    revalidatePath('/dashboard');
    return ok({ removida: true, numero: os.numero });
  });
}
