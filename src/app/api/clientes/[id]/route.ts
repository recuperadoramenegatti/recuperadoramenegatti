import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, erro, lerJson, ok } from '@/lib/api';
import { schemaCliente } from '@/lib/validacoes';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** GET — cliente com histórico completo de OS. */
export async function GET(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async () => {
    const cliente = await prisma.cliente.findUnique({
      where: { id: params.id },
      include: {
        ordens: {
          orderBy: { dataOrcamento: 'desc' },
          select: {
            id: true,
            numero: true,
            tipo: true,
            status: true,
            descricao: true,
            precoSugerido: true,
            precoFinal: true,
            margemReal: true,
            horasEstimadas: true,
            dataOrcamento: true,
            dataFinalizacao: true,
          },
        },
      },
    });
    if (!cliente) return erro('Cliente não encontrado.', 404);
    return ok(cliente);
  });
}

/** PUT — atualiza um cliente. */
export async function PUT(request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaCliente.parse(await lerJson(request));

    const cliente = await prisma.cliente.update({
      where: { id: params.id },
      data: dados,
    });

    await prisma.logAlteracao.create({
      data: {
        entidade: 'cliente',
        entidadeId: cliente.id,
        acao: 'atualizacao',
        descricao: `Cliente "${cliente.nome}" atualizado.`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/clientes');
    return ok(cliente);
  });
}

/**
 * DELETE — remove o cliente.
 * Com OS vinculadas a exclusão apagaria histórico financeiro, então o
 * cliente é apenas inativado e a resposta diz o que aconteceu.
 */
export async function DELETE(_request: Request, { params }: Contexto): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const totalOS = await prisma.ordemServico.count({ where: { clienteId: params.id } });

    if (totalOS > 0) {
      const cliente = await prisma.cliente.update({
        where: { id: params.id },
        data: { ativo: false },
      });
      await prisma.logAlteracao.create({
        data: {
          entidade: 'cliente',
          entidadeId: cliente.id,
          acao: 'atualizacao',
          descricao: `Cliente "${cliente.nome}" inativado (possui ${totalOS} OS no histórico).`,
          usuario: usuario.email,
        },
      });
      revalidatePath('/clientes');
      return ok({
        removido: false,
        inativado: true,
        mensagem: `Cliente inativado: possui ${totalOS} ordem(ns) de serviço no histórico financeiro.`,
      });
    }

    const cliente = await prisma.cliente.delete({ where: { id: params.id } });
    await prisma.logAlteracao.create({
      data: {
        entidade: 'cliente',
        entidadeId: params.id,
        acao: 'exclusao',
        descricao: `Cliente "${cliente.nome}" excluído.`,
        usuario: usuario.email,
      },
    });

    revalidatePath('/clientes');
    return ok({ removido: true, inativado: false, mensagem: 'Cliente excluído.' });
  });
}
