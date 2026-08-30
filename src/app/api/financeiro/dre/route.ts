import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { calcularDRE, calcularDREComparativo, calcularWaterfall } from '@/lib/dre';
import { periodoAtual } from '@/lib/formatacao';
import type { Regime, ResultadoDRE } from '@/types';
import type { PassoWaterfall } from '@/lib/dre';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RespostaDRE {
  dre: ResultadoDRE;
  waterfall: PassoWaterfall[];
  anterior: ResultadoDRE | null;
  anoAnterior: ResultadoDRE | null;
}

/** GET — DRE do período, opcionalmente com os comparativos e o waterfall. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao<RespostaDRE>(async () => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();
    const regime: Regime = url.searchParams.get('regime') === 'caixa' ? 'caixa' : 'competencia';
    const comComparativo = url.searchParams.get('comparativo') === 'true';

    if (comComparativo) {
      const { atual, anterior, anoAnterior } = await calcularDREComparativo(periodo, regime);
      return ok<RespostaDRE>({
        dre: atual,
        waterfall: calcularWaterfall(atual),
        anterior,
        anoAnterior,
      });
    }

    const dre = await calcularDRE(periodo, regime);
    return ok<RespostaDRE>({
      dre,
      waterfall: calcularWaterfall(dre),
      anterior: null,
      anoAnterior: null,
    });
  });
}
