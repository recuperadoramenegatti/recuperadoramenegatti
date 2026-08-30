import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, erro, lerJson, ok } from '@/lib/api';
import { schemaCentroCusto } from '@/lib/validacoes';
import { slugify } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** PUT — atualiza um centro de custo. */
export async function PUT(request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaCentroCusto.parse(await lerJson(request));

    const centro = await prisma.centroCusto.update({
      where: { id: params.id },
      data: { ...dados, slug: slugify(dados.nome) },
    });

    await prisma.logAlteracao.create({
      data: {
        entidade: 'centro',
        entidadeId: centro.id,
        acao: 'atualizacao',
        descricao: `Centro "${centro.nome}" atualizado (THM R$ ${centro.thmEstimado.toFixed(2)}/h).`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/configuracoes');
    revalidatePath('/orcamento');
    return ok(centro);
  });
}

/**
 * DELETE — remove o centro.
 * Se houver OS que o utilizaram, o centro é apenas inativado: excluí-lo
 * quebraria o histórico de custo dessas ordens.
 */
export async function DELETE(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const emUso = await prisma.oSItemCentro.count({ where: { centroId: params.id } });

    if (emUso > 0) {
      const centro = await prisma.centroCusto.update({
        where: { id: params.id },
        data: { ativo: false },
      });
      revalidatePath('/configuracoes');
      revalidatePath('/orcamento');
      return ok({
        removido: false,
        inativado: true,
        mensagem:
          `Centro "${centro.nome}" inativado: é usado por ${emUso} item(ns) de OS. ` +
          'Ele deixa de aparecer em novos orçamentos, mas o histórico é preservado.',
      });
    }

    const centro = await prisma.centroCusto.delete({ where: { id: params.id } });
    await prisma.logAlteracao.create({
      data: {
        entidade: 'centro',
        entidadeId: params.id,
        acao: 'exclusao',
        descricao: `Centro de custo "${centro.nome}" excluído.`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/configuracoes');
    revalidatePath('/orcamento');
    return ok({ removido: true, inativado: false, mensagem: 'Centro de custo excluído.' });
  });
}
