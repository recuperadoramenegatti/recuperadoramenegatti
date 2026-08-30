import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { calcularFluxoCaixa } from '@/lib/dre';
import { periodoAtual } from '@/lib/formatacao';
import { numero } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** GET — projeção de caixa dia a dia do período. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();
    const saldoInicial = numero(url.searchParams.get('saldoInicial'), 0);

    const fluxo = await calcularFluxoCaixa(periodo, saldoInicial);
    return ok(fluxo);
  });
}
