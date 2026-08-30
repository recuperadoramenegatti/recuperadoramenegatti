'use client';

/**
 * Fundação comum dos gráficos.
 *
 * A paleta de séries foi validada pelos seis testes de cor (banda de
 * luminosidade, piso de croma, separação para daltonismo, piso de visão
 * normal e contraste) contra as duas superfícies do app — #111827 no escuro
 * e branco no claro. Passa em ambas.
 *
 * Os tons de âmbar e verde aqui são os passos escuros da marca (#D97706 e
 * #059669), não os claros usados nos KPIs: preenchimento de gráfico precisa
 * assentar sobre a superfície, não brilhar sobre ela.
 *
 * Uma ressalva registrada: verde × azul têm ΔE tritan de 5,7 — dentro da
 * faixa de piso, que só é aceitável com codificação secundária. Por isso
 * todo gráfico que use os dois traz legenda E rótulo direto; nenhum deles
 * distingue séries apenas por cor.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatarMoeda, formatarMoedaCompacta, formatarPercentual } from '@/lib/formatacao';

/** Ordem fixa das cores categóricas. Nunca ciclada, nunca por ranking. */
export const CORES_SERIE = ['#D97706', '#3B82F6', '#059669', '#8B5CF6', '#EF4444'] as const;

/** Rampa sequencial de hue única, para magnitude (ex.: ocupação). */
export const RAMPA_SEQUENCIAL = ['#78350F', '#92400E', '#B45309', '#D97706', '#F59E0B'] as const;

/** Paleta de estado — reservada, nunca reaproveitada como "série 4". */
export const CORES_ESTADO = {
  bom: '#059669',
  atencao: '#D97706',
  grave: '#EA580C',
  critico: '#EF4444',
  neutro: '#6B7280',
} as const;

export const EIXO = {
  stroke: 'rgba(255,255,255,0.08)',
  tick: { fill: '#9CA3AF', fontSize: 11 },
} as const;

export const GRADE = {
  stroke: 'rgba(255,255,255,0.06)',
  strokeDasharray: '3 3',
} as const;

/** Cor da superfície — usada nos anéis de 2px que separam marcas sobrepostas. */
export const SUPERFICIE = '#111827';

export type Formatador = (valor: number) => string;

export const fmt = {
  moeda: (v: number) => formatarMoeda(v),
  moedaCompacta: (v: number) => formatarMoedaCompacta(v),
  percentual: (v: number) => formatarPercentual(v),
  horas: (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`,
  inteiro: (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
} satisfies Record<string, Formatador>;

/** Moldura padrão de um gráfico: título, descrição e área de plotagem. */
export function MolduraGrafico({
  titulo,
  descricao,
  acessorio,
  altura = 280,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  acessorio?: React.ReactNode;
  altura?: number;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm',
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{titulo}</h3>
          {descricao ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
          ) : null}
        </div>
        {acessorio}
      </header>
      <div style={{ height: altura }}>{children}</div>
    </section>
  );
}

interface ItemTooltip {
  nome: string;
  valor: number;
  cor: string;
  formatador?: Formatador;
}

/**
 * Tooltip compartilhado. Os valores usam tokens de texto; a cor da série
 * aparece só no marcador ao lado, nunca no número.
 */
export function CaixaTooltip({
  titulo,
  itens,
  rodape,
}: {
  titulo: string;
  itens: ItemTooltip[];
  rodape?: string;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/12 bg-popover/95 px-3 py-2 shadow-card backdrop-blur-xl">
      <p className="text-xs font-medium">{titulo}</p>
      <ul className="mt-1.5 space-y-1">
        {itens.map((item) => (
          <li key={item.nome} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.cor }}
                aria-hidden
              />
              {item.nome}
            </span>
            <span className="font-medium tabular-nums">
              {(item.formatador ?? fmt.moeda)(item.valor)}
            </span>
          </li>
        ))}
      </ul>
      {rodape ? (
        <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[11px] text-muted-foreground">
          {rodape}
        </p>
      ) : null}
    </div>
  );
}

/** Legenda horizontal. Presente sempre que houver 2 ou mais séries. */
export function Legenda({
  itens,
  className,
}: {
  itens: Array<{ nome: string; cor: string; tracejado?: boolean }>;
  className?: string;
}): React.JSX.Element {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {itens.map((item) => (
        <li key={item.nome} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.tracejado ? (
            <span
              className="h-0.5 w-4 shrink-0 rounded-full"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, ${item.cor} 0 4px, transparent 4px 7px)`,
              }}
              aria-hidden
            />
          ) : (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.cor }}
              aria-hidden
            />
          )}
          {item.nome}
        </li>
      ))}
    </ul>
  );
}

/** Estado vazio dentro da área de um gráfico. */
export function GraficoVazio({ mensagem }: { mensagem: string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10">
      <p className="max-w-xs px-6 text-center text-sm text-muted-foreground">{mensagem}</p>
    </div>
  );
}
