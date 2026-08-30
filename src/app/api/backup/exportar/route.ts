import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { tratarErro } from '@/lib/api';
import { gerarBackupZip, salvarBackupLocal } from '@/lib/backup';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET — gera e baixa o backup completo em ZIP.
 * O arquivo também é guardado em disco, para constar no histórico.
 */
export async function GET(): Promise<NextResponse | Response> {
  try {
    await exigirSessao();

    const backup = await gerarBackupZip('manual');

    // Persistir localmente é desejável, mas nunca deve impedir o download.
    try {
      await salvarBackupLocal(backup, 'manual');
      await prisma.configuracao.upsert({
        where: { chave: 'backupUltimoCompleto' },
        update: { valor: new Date().toISOString() },
        create: {
          chave: 'backupUltimoCompleto',
          valor: new Date().toISOString(),
          tipo: 'string',
          grupo: 'financeiro',
          descricao: 'Data/hora do último backup completo',
        },
      });
    } catch (erro) {
      console.error('[backup] Falha ao gravar cópia local:', erro);
    }

    return new Response(new Uint8Array(backup.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${backup.filename}"`,
        'Content-Length': String(backup.buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}
