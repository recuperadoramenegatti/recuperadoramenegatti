import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { erro, tratarErro } from '@/lib/api';
import { lerBackupSalvo } from '@/lib/backup';

export const dynamic = 'force-dynamic';

interface Contexto {
  params: { id: string };
}

/** GET — baixa um backup do histórico. */
export async function GET(_request: Request, { params }: Contexto): Promise<NextResponse | Response> {
  try {
    await exigirSessao();

    const backup = await lerBackupSalvo(params.id);
    if (!backup) {
      return erro('Backup não encontrado ou arquivo removido do disco.', 404);
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
  } catch (e) {
    return tratarErro(e);
  }
}
