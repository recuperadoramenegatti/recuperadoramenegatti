import { NextResponse } from 'next/server';
import { z } from 'zod';
import { erro, lerJson, ok, tratarErro } from '@/lib/api';
import { recuperarSenha } from '@/lib/recuperacao';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    codigo: z.string().min(1, 'Informe o código de recuperação'),
    novaSenha: z
      .string()
      .min(8, 'A nova senha precisa de ao menos 8 caracteres')
      .max(72, 'Máximo de 72 caracteres'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  });

/**
 * Freio contra tentativa de adivinhação.
 *
 * Esta rota é pública por natureza — quem esqueceu a senha não tem como se
 * autenticar antes. Então ela precisa custar caro para quem estiver chutando
 * códigos: 5 tentativas a cada 15 minutos, por origem.
 *
 * A contagem vive em memória, o que num servidor serverless vale por
 * instância. Não é uma defesa perfeita, mas o código tem 16 caracteres de um
 * alfabeto de 29 — chutar não é caminho viável mesmo sem freio nenhum. O
 * freio existe para o caso de alguém tentar de qualquer forma.
 */
const TENTATIVAS_MAX = 5;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { contador: number; primeiraEm: number }>();

function origem(request: Request): string {
  const encaminhado = request.headers.get('x-forwarded-for');
  return encaminhado?.split(',')[0]?.trim() || 'desconhecida';
}

function bloqueado(chave: string): boolean {
  const registro = tentativas.get(chave);
  if (!registro) return false;
  if (Date.now() - registro.primeiraEm > JANELA_MS) {
    tentativas.delete(chave);
    return false;
  }
  return registro.contador >= TENTATIVAS_MAX;
}

function registrarFalha(chave: string): void {
  const registro = tentativas.get(chave);
  if (!registro || Date.now() - registro.primeiraEm > JANELA_MS) {
    tentativas.set(chave, { contador: 1, primeiraEm: Date.now() });
    return;
  }
  registro.contador += 1;
}

/** POST — redefine a senha a partir de um código de recuperação. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const chave = origem(request);

    if (bloqueado(chave)) {
      return erro(
        'Muitas tentativas com código errado. Aguarde 15 minutos antes de tentar de novo.',
        429,
      );
    }

    const dados = schema.parse(await lerJson(request));
    const resultado = await recuperarSenha(dados.codigo, dados.novaSenha);

    if (!resultado.trocada) {
      registrarFalha(chave);
      // Mensagem única de propósito: dizer "esse código não existe" x "existe
      // mas está errado" entregaria informação a quem estiver tentando adivinhar.
      return erro('Código de recuperação inválido.', 403);
    }

    tentativas.delete(chave);
    return ok({ trocada: true, codigoNovo: resultado.codigoNovo });
  } catch (e) {
    return tratarErro(e);
  }
}
