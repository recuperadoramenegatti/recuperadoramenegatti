import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaLancamento } from '@/lib/validacoes';
import { intervaloPeriodo, periodoAtual } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';

/** GET — lançamentos manuais do período. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();
    const { inicio, fim } = intervaloPeriodo(periodo);

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { data: { gte: inicio, lte: fim } },
      orderBy: { data: 'desc' },
    });

    return ok(lancamentos);
  });
}

/** POST — cria um lançamento manual (receita ou despesa extra). */
export async function POST(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const dados = schemaLancamento.parse(await lerJson(request));

    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        tipo: dados.tipo,
        categoria: dados.categoria,
        descricao: dados.descricao,
        valor: dados.valor,
        data: dados.data,
        regime: dados.regime,
        pago: dados.pago,
        dataPagamento: dados.dataPagamento,
        osId: dados.osId,
        observacoes: dados.observacoes,
      },
    });

    revalidatePath('/financeiro/dre');
    revalidatePath('/financeiro/fluxo-caixa');
    return ok(lancamento, 201);
  });
}

/** DELETE — remove um lançamento manual. */
export async function DELETE(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return ok({ removido: false });

    await prisma.lancamentoFinanceiro.delete({ where: { id } });
    revalidatePath('/financeiro/dre');
    revalidatePath('/financeiro/fluxo-caixa');
    return ok({ removido: true });
  });
}
