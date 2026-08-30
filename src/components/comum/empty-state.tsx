import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
  className?: string;
  compacto?: boolean;
}

export function EmptyState({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
  compacto = false,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--borda-1)] text-center',
        compacto ? 'gap-2 px-6 py-8' : 'gap-3 px-8 py-14',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-3)]',
          compacto ? 'h-10 w-10' : 'h-14 w-14',
        )}
      >
        <Icone className={cn('text-muted-foreground', compacto ? 'h-5 w-5' : 'h-7 w-7')} aria-hidden />
      </div>
      <h3 className={cn('font-semibold', compacto ? 'text-sm' : 'text-base')}>{titulo}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>
      {acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  );
}
