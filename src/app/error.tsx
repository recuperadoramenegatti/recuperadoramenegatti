'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    console.error('[app] Erro não tratado:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Algo deu errado</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || 'Ocorreu um erro inesperado ao carregar esta página.'}
      </p>
      <Button onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </main>
  );
}
