'use client';

import * as React from 'react';
import { AlertTriangle, ArrowRight, Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import type { ComparativoPecaNova as Comparativo } from '@/types';

interface Props {
  comparativo: Comparativo | null;
  className?: string;
}

const ESTILO = {
  adequado: {
    icone: CheckCircle2,
    cor: 'text-emerald-400',
    fundo: 'bg-emerald-500/10',
    borda: 'border-emerald-500/30',
    rotulo: 'Posicionamento adequado',
  },
  proximo: {
    icone: AlertTriangle,
    cor: 'text-amber-400',
    fundo: 'bg-amber-500/10',
    borda: 'border-amber-500/30',
    rotulo: 'Próximo demais da peça nova',
  },
  inviavel: {
    icone: Ban,
    cor: 'text-red-400',
    fundo: 'bg-red-500/10',
    borda: 'border-red-500/30',
    rotulo: 'Inviável comercialmente',
  },
  sem_referencia: {
    icone: AlertTriangle,
    cor: 'text-muted-foreground',
    fundo: 'bg-[var(--superficie-3)]',
    borda: 'border-[var(--borda-1)]',
    rotulo: 'Sem referência de preço',
  },
} as const;

/**
 * Comparativo entre o preço da recuperação e o da peça nova.
 * A recuperação só se vende quando é sensivelmente mais barata — abaixo de
 * uma certa economia, o cliente compra novo com garantia de fábrica.
 */
export function ComparativoPecaNova({ comparativo, className }: Props): React.JSX.Element | null {
  if (!comparativo) return null;

  const estilo = ESTILO[comparativo.status];
  const Icone = estilo.icone;

  // Barra: quanto da peça nova o preço da recuperação representa.
  const largura = Math.min(100, Math.max(2, comparativo.percentualDaPecaNova));

  return (
    <div className={cn('rounded-2xl border p-4', estilo.fundo, estilo.borda, className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icone className={cn('h-4 w-4 shrink-0', estilo.cor)} aria-hidden />
        <h4 className={cn('text-sm font-semibold', estilo.cor)}>{estilo.rotulo}</h4>
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Peça nova no mercado</span>
          <span className="font-medium tabular-nums">
            {formatarMoeda(comparativo.precoPecaNova)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Sua recuperação</span>
          <span className="font-semibold tabular-nums text-primary">
            {formatarMoeda(comparativo.precoRecuperacao)}
          </span>
        </div>

        <div className="pt-1">
          <div className="relative h-2 overflow-hidden rounded-full bg-[var(--superficie-4)]">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                comparativo.status === 'adequado'
                  ? 'bg-gradient-sucesso'
                  : comparativo.status === 'proximo'
                    ? 'bg-gradient-hero'
                    : 'bg-gradient-alerta',
              )}
              style={{ width: `${largura}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatarPercentual(comparativo.percentualDaPecaNova, 0)} do valor da peça nova</span>
            <span>100%</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--borda-1)] pt-2.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            Economia para o cliente
          </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              comparativo.economiaCliente > 0 ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {formatarMoeda(comparativo.economiaCliente)} (
            {formatarPercentual(comparativo.economiaPct, 0)})
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{comparativo.mensagem}</p>
    </div>
  );
}
