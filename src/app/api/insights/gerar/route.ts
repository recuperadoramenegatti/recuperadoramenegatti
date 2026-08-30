import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { comSessao, erro, lerJson, ok } from '@/lib/api';
import { schemaGerarInsight } from '@/lib/validacoes';
import { ErroIANaoConfigurada, gerarEsalvarInsight } from '@/lib/ia';
import { periodoAtual } from '@/lib/formatacao';
import { extrairMensagemErro } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST — gera o parecer gerencial do período com a IA. */
export async function POST(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const corpo = await lerJson(request).catch(() => ({}));
    const { periodo } = schemaGerarInsight.parse(corpo ?? {});
    const alvo = periodo ?? periodoAtual();

    try {
      const resultado = await gerarEsalvarInsight(alvo, 'manual');
      revalidatePath('/insights');
      return ok(resultado, 201);
    } catch (e) {
      // A ausência de chave não é um erro do sistema: é configuração
      // pendente, e a interface trata de forma específica.
      if (e instanceof ErroIANaoConfigurada) {
        return erro(e.message, 428, { codigo: 'ia_nao_configurada' });
      }
      return erro(extrairMensagemErro(e), 502, { codigo: 'falha_ia' });
    }
  });
}
