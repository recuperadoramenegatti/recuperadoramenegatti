import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { proximoNumeroOS } from '@/lib/ordens';

export const dynamic = 'force-dynamic';

/** GET — próximo número de OS disponível. */
export async function GET(): Promise<NextResponse> {
  return comSessao(async () => {
    const numero = await proximoNumeroOS();
    return ok({ numero });
  });
}
