import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { calcularPainelIndicadores } from '@/lib/indicadores';
import { periodoAtual } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET — painel completo de indicadores do período. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();
    const painel = await calcularPainelIndicadores(periodo);
    return ok(painel);
  });
}
