import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
  className?: string;
}

export function PageHeader({ titulo, descricao, acoes, className }: PageHeaderProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-muted-foreground">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
