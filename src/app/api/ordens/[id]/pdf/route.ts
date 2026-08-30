import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { erro, tratarErro } from '@/lib/api';
import { pdfDeOS } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Contexto {
  params: { id: string };
}

/** GET — PDF de uma OS salva. */
export async function GET(_request: Request, { params }: Contexto): Promise<NextResponse | Response> {
  try {
    await exigirSessao();

    const pdf = await pdfDeOS(params.id);
    if (!pdf) return erro('Ordem de serviço não encontrada.', 404);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="orcamento_${params.id}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return tratarErro(e);
  }
}
