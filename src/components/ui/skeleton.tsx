import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('skeleton', className)} {...props} />;
}

/** Placeholder de um card de KPI. */
function SkeletonKPI(): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-9 w-36" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

/** Placeholder de tabela. */
function SkeletonTabela({ linhas = 5, colunas = 5 }: { linhas?: number; colunas?: number }): React.JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: colunas }).map((__, j) => (
            <Skeleton key={j} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder de gráfico. */
function SkeletonGrafico({ altura = 260 }: { altura?: number }): React.JSX.Element {
  return <Skeleton className="w-full rounded-2xl" style={{ height: altura }} />;
}

export { Skeleton, SkeletonKPI, SkeletonTabela, SkeletonGrafico };
