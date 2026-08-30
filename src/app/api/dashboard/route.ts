import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import {
  buscarOSDoPeriodo,
  calcularComposicaoCusto,
  calcularKPIs,
  calcularMargemPorTipo,
  calcularOcupacaoCentros,
  calcularSerieMensal,
  getContextoCalculo,
  resumirPeriodo,
} from '@/lib/calculos';
import { calcularAlertas } from '@/lib/alertas';
import { periodoAtual } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';

/** GET — pacote completo de dados do dashboard. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();

    const ctx = await getContextoCalculo();
    const [kpis, serie, ocupacao, alertas, ordens] = await Promise.all([
      calcularKPIs(periodo, ctx),
      calcularSerieMensal(periodo, 6, ctx),
      calcularOcupacaoCentros(periodo, ctx),
      calcularAlertas(periodo, ctx),
      buscarOSDoPeriodo(periodo),
    ]);

    const resumo = resumirPeriodo(periodo, ordens, ctx.parametros, ctx.derivados);

    return ok({
      kpis,
      serie,
      ocupacao,
      alertas,
      margemPorTipo: calcularMargemPorTipo(ordens, ctx.parametros),
      composicaoCusto: calcularComposicaoCusto(resumo),
    });
  });
}
