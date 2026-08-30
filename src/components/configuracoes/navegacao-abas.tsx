'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Navegação por abas via URL, para que cada aba tenha endereço próprio —
 * links diretos como /configuracoes?aba=ia funcionam, e o botão voltar do
 * navegador se comporta como o usuário espera.
 */
export function NavegacaoAbas({
  abas,
  ativa,
}: {
  abas: ReadonlyArray<{ id: string; rotulo: string }>;
  ativa: string;
}): React.JSX.Element {
  return (
    <nav
      className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-1 scrollbar-none"
      aria-label="Seções das configurações"
    >
      {abas.map((aba) => (
        <Link
          key={aba.id}
          href={`/configuracoes?aba=${aba.id}`}
          scroll={false}
          aria-current={ativa === aba.id ? 'page' : undefined}
          className={cn(
            'shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
            ativa === aba.id
              ? 'bg-[var(--superficie-4)] text-foreground'
              : 'text-muted-foreground hover:bg-[var(--superficie-3)] hover:text-foreground',
          )}
        >
          {aba.rotulo}
        </Link>
      ))}
    </nav>
  );
}
