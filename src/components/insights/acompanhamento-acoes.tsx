'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  capitalizarPrimeira,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarPeriodoExtenso,
  formatarVariacao,
} from '@/lib/formatacao';
import type { AcompanhamentoAcoes } from '@/lib/ia';

/**
 * Fecha o ciclo do plano de ação: mostra se os indicadores melhoraram no mês
 * seguinte àquele em que as ações foram marcadas como concluídas.
 *
 * Não afirma causalidade — um mês bom pode vir de um cliente novo, não do
 * plano. O texto diz o que os números mostram e deixa a leitura com o gestor.
 */
export function AcompanhamentoAcoesCard({
  acompanhamento,
}: {
  acompanhamento: AcompanhamentoAcoes;
}): React.JSX.Element {
  const formatar = (valor: number, formato: 'moeda' | 'percentual' | 'numero'): string => {
    if (formato === 'moeda') return formatarMoeda(valor);
    if (formato === 'percentual') return formatarPercentual(valor);
    return formatarNumero(valor, 0);
  };

  const melhoraram = acompanhamento.evolucao.filter((e) => e.melhorou).length;

  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Target className="h-4 w-4 text-primary" aria-hidden />
          O plano de {capitalizarPrimeira(formatarPeriodoExtenso(acompanhamento.periodoAnterior))} deu resultado?
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Comparação entre o mês em que as ações foram concluídas e o mês seguinte.
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {acompanhamento.evolucao.map((item) => (
          <div
            key={item.indicador}
            className={cn(
              'rounded-xl border p-3.5',
              item.melhorou
                ? 'border-emerald-500/25 bg-emerald-500/[0.05]'
                : 'border-amber-500/25 bg-amber-500/[0.05]',
            )}
          >
            <span className="label-caps leading-tight">{item.indicador}</span>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-sm tabular-nums text-muted-foreground line-through decoration-muted-foreground/40">
                {formatar(item.anterior, item.formato)}
              </span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm font-semibold tabular-nums">
                {formatar(item.atual, item.formato)}
              </span>
            </div>

            <span
              className={cn(
                'mt-1 flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
                item.melhorou ? 'text-emerald-400' : 'text-amber-400',
              )}
            >
              {item.variacaoPct !== null && item.variacaoPct > 0 ? (
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              ) : item.variacaoPct !== null && item.variacaoPct < 0 ? (
                <ArrowDownRight className="h-3 w-3" aria-hidden />
              ) : (
                <ArrowRight className="h-3 w-3" aria-hidden />
              )}
              {formatarVariacao(item.variacaoPct)}
            </span>
          </div>
        ))}
      </div>

      <p
        className={cn(
          'mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed',
          melhoraram >= 4
            ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
            : melhoraram >= 2
              ? 'border-amber-500/25 bg-amber-500/[0.06]'
              : 'border-red-500/25 bg-red-500/[0.06]',
        )}
      >
        {acompanhamento.veredito}
      </p>

      <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
        A comparação mostra o que mudou, não o que causou a mudança. Um mês melhor pode vir de um
        cliente novo, e não do plano — leia junto com o que aconteceu na oficina.
      </p>
    </section>
  );
}
