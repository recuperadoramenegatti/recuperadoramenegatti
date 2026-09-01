import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { FormularioRecuperar } from '@/app/(auth)/recuperar/formulario-recuperar';
import { estadoDoBanco } from '@/lib/estado-banco';

export const metadata: Metadata = { title: 'Recuperar acesso' };

/** Sempre renderizada na hora: depende do estado atual da configuração. */
export const dynamic = 'force-dynamic';

export default async function PaginaRecuperar(): Promise<React.JSX.Element> {
  // Sem banco não há senha para trocar — a tela de configuração é quem
  // explica o que falta.
  const estado = await estadoDoBanco();
  if (!estado.pronto) redirect('/configurar');

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-8 shadow-[var(--sombra-cartao)]">
        <h1 className="text-xl font-semibold text-foreground">Recuperar acesso</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Informe o código de recuperação e escolha uma senha nova. O código foi mostrado na
          instalação do sistema — e, se ele tiver se perdido, quem administra a hospedagem pode
          definir um pela variável <code className="font-mono text-xs">CODIGO_RECUPERACAO</code>.
        </p>

        <div className="mt-6">
          <FormularioRecuperar />
        </div>

        <div className="mt-6 border-t border-[var(--borda-1)] pt-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para a tela de entrada
          </Link>
        </div>
      </div>
    </main>
  );
}
