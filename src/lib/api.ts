/**
 * Utilidades das rotas de API: resposta padronizada, verificação de sessão
 * e tratamento uniforme de erro.
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ErroNaoAutorizado, exigirSessao } from '@/lib/auth';
import { erroLegivel } from '@/lib/validacoes';
import { extrairMensagemErro } from '@/lib/utils';
import type { RespostaAPI } from '@/types';

export function ok<T>(dados: T, status = 200): NextResponse<RespostaAPI<T>> {
  return NextResponse.json({ ok: true, dados }, { status });
}

export function erro(mensagem: string, status = 400, detalhes?: unknown): NextResponse<RespostaAPI<never>> {
  return NextResponse.json({ ok: false, erro: mensagem, detalhes }, { status });
}

/**
 * Envolve o handler de uma rota: garante sessão válida e converte qualquer
 * exceção numa resposta JSON coerente, sem vazar detalhes internos.
 */
export async function comSessao<T>(
  handler: (usuario: { id: string; email: string; name: string }) => Promise<NextResponse<RespostaAPI<T>>>,
): Promise<NextResponse<RespostaAPI<T>> | NextResponse<RespostaAPI<never>>> {
  try {
    const usuario = await exigirSessao();
    return await handler(usuario);
  } catch (e) {
    return tratarErro(e);
  }
}

export function tratarErro(e: unknown): NextResponse<RespostaAPI<never>> {
  if (e instanceof ErroNaoAutorizado) {
    return erro(e.message, 401);
  }

  if (e instanceof ZodError) {
    return erro('Dados inválidos. Revise os campos destacados.', 422, erroLegivel(e));
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const campos = Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(', ') : 'registro';
      return erro(`Já existe um registro com este valor (${campos}).`, 409);
    }
    if (e.code === 'P2025') {
      return erro('Registro não encontrado.', 404);
    }
    if (e.code === 'P2003') {
      return erro('Existem registros vinculados que impedem esta operação.', 409);
    }
    console.error('[api] Erro Prisma:', e.code, e.message);
    return erro('Falha ao acessar o banco de dados.', 500);
  }

  console.error('[api] Erro não tratado:', e);
  return erro(extrairMensagemErro(e), 500);
}

/** Lê e faz o parse do corpo JSON, com erro claro quando o corpo é inválido. */
export async function lerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error('Corpo da requisição inválido: esperado JSON.');
  }
}
