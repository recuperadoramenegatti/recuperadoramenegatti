'use client';

import * as React from 'react';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemInsight } from '@/types';

/** Card de ponto crítico ou oportunidade. */
export function InsightCard({
  item,
  tipo,
}: {
  item: ItemInsight;
  tipo: 'critico' | 'oportunidade';
}): React.JSX.Element {
  const critico = tipo === 'critico';
  const Icone = critico ? AlertTriangle : Lightbulb;

  return (
    <article
      className={cn(
        'rounded-xl border p-4 transition-colors duration-200',
        critico
          ? 'border-red-500/30 bg-red-500/[0.06] hover:bg-red-500/[0.09]'
          : 'border-emerald-500/30 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icone
          className={cn('mt-0.5 h-4 w-4 shrink-0', critico ? 'text-red-400' : 'text-emerald-400')}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold leading-snug">{item.titulo}</h4>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.descricao}</p>
          {item.impacto ? (
            <p
              className={cn(
                'mt-2 inline-block rounded-lg px-2 py-1 text-[11px] font-medium',
                critico ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300',
              )}
            >
              {critico ? 'Impacto' : 'Potencial'}: {item.impacto}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
