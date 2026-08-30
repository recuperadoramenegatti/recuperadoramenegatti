'use client';

import * as React from 'react';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatarHoras, formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/formatacao';
import type { GrupoIndicadores, Indicador } from '@/types';

function formatar(indicador: Indicador): string {
  switch (indicador.formato) {
    case 'moeda':
      return formatarMoeda(indicador.valor);
    case 'percentual':
      return formatarPercentual(indicador.valor);
    case 'horas':
      return formatarHoras(indicador.valor);
    case 'dias':
      return `${formatarNumero(indicador.valor, 0)} dias`;
    default:
      return formatarNumero(indicador.valor, 2);
  }
}

/**
 * Painel de indicadores agrupados.
 *
 * Quando há referência configurada, o indicador mostra se está acima ou
 * abaixo dela — e `melhorQuando` decide se isso é bom ou ruim, porque para
 * PMR, NCG e desvio de horas, menor é melhor.
 */
export function PainelGrupos({ grupos }: { grupos: GrupoIndicadores[] }): React.JSX.Element {
  return (
    <div className="space-y-6">
      {grupos.map((grupo) => (
        <section
          key={grupo.grupo}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm"
        >
          <header className="mb-4">
            <h2 className="text-sm font-semibold tracking-tight">{grupo.grupo}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{grupo.descricao}</p>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {grupo.indicadores.map((indicador) => (
              <CartaoIndicador key={indicador.chave} indicador={indicador} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CartaoIndicador({ indicador }: { indicador: Indicador }): React.JSX.Element {
  const temReferencia = indicador.referencia !== undefined;
  const acimaDaReferencia = temReferencia && indicador.valor >= (indicador.referencia ?? 0);
  const melhorMaior = indicador.melhorQuando !== 'menor';
  const bom = temReferencia ? (melhorMaior ? acimaDaReferencia : !acimaDaReferencia) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'cursor-help rounded-xl border p-3.5 transition-colors duration-200',
            bom === true && 'border-emerald-500/25 bg-emerald-500/[0.05]',
            bom === false && 'border-amber-500/25 bg-amber-500/[0.05]',
            bom === null && 'border-white/10 bg-white/[0.03]',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="label-caps leading-tight">{indicador.label}</span>
            <Info className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden />
          </div>

          <p className="mt-2 text-xl font-semibold tabular-nums">{formatar(indicador)}</p>

          {temReferencia ? (
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-[11px]',
                bom ? 'text-emerald-400' : 'text-amber-400',
              )}
            >
              {acimaDaReferencia ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              referência:{' '}
              {formatar({ ...indicador, valor: indicador.referencia ?? 0 })}
            </p>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {indicador.descricao}
        {indicador.melhorQuando === 'menor' ? (
          <span className="mt-1 block text-muted-foreground">Quanto menor, melhor.</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
