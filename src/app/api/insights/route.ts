import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { buscarInsight, iaConfigurada, listarPeriodosComInsight } from '@/lib/ia';
import { calcularAlertas } from '@/lib/alertas';
import { periodoAtual } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';

/** GET — insight de um período + alertas determinísticos (sempre presentes). */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();

    const [insight, periodos, configurada, alertas] = await Promise.all([
      buscarInsight(periodo),
      listarPeriodosComInsight(),
      iaConfigurada(),
      calcularAlertas(periodo),
    ]);

    return ok({ insight, periodos, iaConfigurada: configurada, alertas, periodo });
  });
}
