'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, variacaoPercentual } from '@/lib/utils';
import { formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import type { LinhaDRE, ResultadoDRE } from '@/types';

/**
 * DRE em tabela, com comparativo opcional contra o mês anterior e o mesmo
 * mês do ano anterior.
 *
 * A depreciação aparece no bloco de custos fixos por fidelidade ao layout
 * gerencial pedido, mas está marcada como não-caixa e fica FORA do subtotal
 * do EBITDA — ela é subtraída uma única vez, do EBITDA para o EBIT. Sem
 * isso, seria deduzida duas vezes.
 */
export function TabelaDRE({
  dre,
  anterior,
  anoAnterior,
}: {
  dre: ResultadoDRE;
  anterior?: ResultadoDRE | null;
  anoAnterior?: ResultadoDRE | null;
}): React.JSX.Element {
  const porId = (fonte: ResultadoDRE | null | undefined, id: string): number | null => {
    if (!fonte) return null;
    return fonte.linhas.find((l) => l.id === id)?.valor ?? null;
  };

  const comComparativo = Boolean(anterior);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] shadow-card backdrop-blur-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--borda-1)]">
            <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conta
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {dre.label}
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              % RB
            </th>
            {anterior ? (
              <>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {anterior.label}
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Δ
                </th>
              </>
            ) : null}
            {anoAnterior ? (
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {anoAnterior.label}
              </th>
            ) : null}
          </tr>
        </thead>

        <tbody>
          {dre.linhas.map((linha) => (
            <LinhaTabela
              key={linha.id}
              linha={linha}
              valorAnterior={porId(anterior, linha.id)}
              valorAnoAnterior={porId(anoAnterior, linha.id)}
              comComparativo={comComparativo}
              mostrarAnoAnterior={Boolean(anoAnterior)}
            />
          ))}
        </tbody>
      </table>

      <footer className="border-t border-[var(--borda-1)] px-5 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A capacidade ociosa é a parcela da folha produtiva que nenhuma OS absorveu no período —
          aparece em linha própria para que o custo de ficar parado não desapareça dentro da
          margem. A depreciação está marcada como não-caixa e é deduzida uma única vez, do EBITDA
          para o EBIT.
        </p>
      </footer>
    </div>
  );
}

function LinhaTabela({
  linha,
  valorAnterior,
  valorAnoAnterior,
  comComparativo,
  mostrarAnoAnterior,
}: {
  linha: LinhaDRE;
  valorAnterior: number | null;
  valorAnoAnterior: number | null;
  comComparativo: boolean;
  mostrarAnoAnterior: boolean;
}): React.JSX.Element {
  const ehSubtotal = linha.tipo === 'subtotal' || linha.tipo === 'resultado';
  const variacao = valorAnterior !== null ? variacaoPercentual(linha.valor, valorAnterior) : null;

  // Em linhas de custo, dedução e despesa (valores negativos), crescer é ruim.
  const ehCusto = linha.tipo === 'custo' || linha.tipo === 'despesa' || linha.tipo === 'deducao';
  const boa = variacao !== null && (ehCusto ? variacao < 0 : variacao > 0);
  const ruim = variacao !== null && (ehCusto ? variacao > 0 : variacao < 0);

  return (
    <tr
      className={cn(
        'border-b border-[var(--borda-0)] transition-colors hover:bg-[var(--superficie-2)]',
        ehSubtotal && 'bg-[var(--superficie-2)]',
        linha.destaque && 'font-semibold',
      )}
    >
      <td
        className={cn(
          'px-5 py-2.5',
          linha.nivel === 1 && 'pl-10 text-muted-foreground',
          linha.nivel === 2 && 'pl-14 text-muted-foreground',
          ehSubtotal && 'uppercase tracking-wide',
        )}
      >
        <span className="flex items-center gap-1.5">
          {linha.label}
          {linha.naoCaixa ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
              </TooltipTrigger>
              <TooltipContent>
                Linha não-caixa: exibida aqui por fidelidade ao layout gerencial, mas fora do
                subtotal do EBITDA. É deduzida uma única vez, do EBITDA para o EBIT.
              </TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      </td>

      <td
        className={cn(
          'px-4 py-2.5 text-right tabular-nums',
          linha.valor < 0 && 'text-red-400',
          ehSubtotal && linha.valor >= 0 && 'text-emerald-400',
          linha.destaque && 'text-base',
        )}
      >
        {formatarMoeda(linha.valor)}
      </td>

      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
        {formatarPercentual(Math.abs(linha.percentualReceita))}
      </td>

      {comComparativo ? (
        <>
          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
            {valorAnterior !== null ? formatarMoeda(valorAnterior) : '—'}
          </td>
          <td
            className={cn(
              'px-3 py-2.5 text-right text-xs tabular-nums',
              boa && 'text-emerald-400',
              ruim && 'text-red-400',
              !boa && !ruim && 'text-muted-foreground',
            )}
          >
            {variacao !== null ? `${variacao > 0 ? '+' : ''}${variacao.toFixed(0)}%` : '—'}
          </td>
        </>
      ) : null}

      {mostrarAnoAnterior ? (
        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
          {valorAnoAnterior !== null ? formatarMoeda(valorAnoAnterior) : '—'}
        </td>
      ) : null}
    </tr>
  );
}
