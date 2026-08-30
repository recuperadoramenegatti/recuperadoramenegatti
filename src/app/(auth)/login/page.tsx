import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FormularioLogin } from '@/app/(auth)/login/formulario-login';
import { LogoCompleto } from '@/components/comum/logo';
import { getConfig } from '@/lib/calculos';

export const metadata: Metadata = { title: 'Entrar' };

export default async function PaginaLogin(): Promise<React.JSX.Element> {
  const logo = await getConfig('empresaLogo');
  const nomeEmpresa = await getConfig('empresaNome', 'Recuperadora Menegatti');

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Ambiente visual */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(700px circle at 20% 20%, rgba(245,158,11,0.14), transparent 60%),' +
            'radial-gradient(700px circle at 80% 80%, rgba(59,130,246,0.12), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px),' +
            'linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <LogoCompleto tamanho={56} src={logo || undefined} subtitulo="" className="flex-col items-center [&>div]:text-center" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Sistema de gestão financeira e precificação industrial
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-7 shadow-card backdrop-blur-md">
          <h1 className="text-lg font-semibold tracking-tight">Acesso ao sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe suas credenciais para continuar.
          </p>
          <Suspense fallback={<EsqueletoFormulario />}>
            <FormularioLogin className="mt-6" />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {nomeEmpresa} · Usinagem, Solda, Caldeiraria, Montagem e Acabamento
        </p>
      </div>
    </main>
  );
}

/** Placeholder enquanto o formulário (client component) hidrata. */
function EsqueletoFormulario(): React.JSX.Element {
  return (
    <div className="mt-6 space-y-4" aria-hidden>
      <div className="skeleton h-3 w-16" />
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-3 w-12" />
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-12 w-full" />
    </div>
  );
}
