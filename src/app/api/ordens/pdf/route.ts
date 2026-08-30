import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { tratarErro } from '@/lib/api';
import { schemaOrdemServico } from '@/lib/validacoes';
import { pdfDeFormulario } from '@/lib/pdf';
import { proximoNumeroOS } from '@/lib/ordens';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST — gera o PDF de um orçamento ainda não salvo. */
export async function POST(request: Request): Promise<NextResponse | Response> {
  try {
    await exigirSessao();

    const dados = schemaOrdemServico.parse(await request.json());
    const numero = dados.numero?.trim() || (await proximoNumeroOS());
    const pdf = await pdfDeFormulario(dados, numero);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="orcamento_${numero}.pdf"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (erro) {
    return tratarErro(erro);
  }
}
