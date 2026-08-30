import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { comSessao, erro, ok } from '@/lib/api';
import { restaurarBackup, validarBackup } from '@/lib/backup';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TAMANHO_MAXIMO = 200 * 1024 * 1024; // 200 MB

/**
 * POST — valida (e opcionalmente restaura) um backup enviado.
 *
 * `acao=validar`   → só devolve o preview, sem tocar nos dados
 * `acao=restaurar` → executa a restauração no modo escolhido
 */
export async function POST(request: Request): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    let formulario: FormData;
    try {
      formulario = await request.formData();
    } catch {
      return erro('Envie o arquivo como multipart/form-data.', 400);
    }

    const arquivo = formulario.get('arquivo');
    if (!(arquivo instanceof File)) {
      return erro('Nenhum arquivo recebido. Selecione o ZIP do backup.', 400);
    }
    if (arquivo.size === 0) {
      return erro('O arquivo enviado está vazio.', 400);
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      return erro('Arquivo maior que o limite de 200 MB.', 413);
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const acao = String(formulario.get('acao') ?? 'validar');

    const preview = await validarBackup(buffer);

    if (acao === 'validar') {
      return ok({ preview, restaurado: false });
    }

    if (!preview.valido) {
      return erro(
        `Não é possível restaurar: ${preview.erros.join(' ')}`,
        422,
        { preview },
      );
    }

    const modoBruto = String(formulario.get('modo') ?? 'mesclar');
    const modo = modoBruto === 'substituir' ? 'substituir' : 'mesclar';

    const resultado = await restaurarBackup(buffer, modo);

    await prisma.logAlteracao
      .create({
        data: {
          entidade: 'configuracao',
          entidadeId: 'backup',
          acao: 'atualizacao',
          descricao:
            `Backup restaurado no modo "${modo}". ` +
            `Importados: ${Object.entries(resultado.importados)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')}.`,
          usuario: usuario.email,
        },
      })
      .catch(() => undefined);

    for (const rota of [
      '/dashboard',
      '/ordens',
      '/clientes',
      '/financeiro/dre',
      '/financeiro/fluxo-caixa',
      '/indicadores',
      '/insights',
      '/configuracoes',
    ]) {
      revalidatePath(rota);
    }

    return ok({ preview, restaurado: true, resultado });
  });
}
