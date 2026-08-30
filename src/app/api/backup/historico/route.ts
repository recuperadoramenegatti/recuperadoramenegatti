import { NextResponse } from 'next/server';
import { comSessao, ok } from '@/lib/api';
import { listarBackups, ultimoBackup } from '@/lib/backup';

export const dynamic = 'force-dynamic';

/** GET — histórico dos últimos backups e status do último completo. */
export async function GET(): Promise<NextResponse> {
  return comSessao(async () => {
    const [backups, ultimo] = await Promise.all([listarBackups(30), ultimoBackup()]);

    const horasDesdeUltimo = ultimo
      ? Math.floor((Date.now() - ultimo.getTime()) / (60 * 60 * 1000))
      : null;

    return ok({
      backups,
      ultimoBackup: ultimo,
      horasDesdeUltimo,
      alerta: horasDesdeUltimo === null || horasDesdeUltimo > 24 * 7,
    });
  });
}
