import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { historicoUsoIA, testarConexao } from '@/lib/ia';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST — testa a conexão com a API da Anthropic. */
export async function POST(): Promise<NextResponse> {
  return comSessao(async () => {
    const resultado = await testarConexao();
    return ok(resultado);
  });
}

/** GET — histórico de uso da API. */
export async function GET(): Promise<NextResponse> {
  return comSessao(async () => {
    const [uso, teste] = await Promise.all([
      historicoUsoIA(),
      Promise.resolve(null),
    ]);
    return ok({ uso, teste });
  });
}
