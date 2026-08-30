'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { ICONES_KPI, type NomeIconeKPI } from '@/components/dashboard/icones-kpi';
import { MoedaAnimada, NumeroAnimado, PercentualAnimado } from '@/components/comum/numero-animado';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatarVariacao } from '@/lib/formatacao';

export type FormatoKPI = 'moeda' | 'percentual' | 'numero';
export type TomKPI = 'ambar' | 'azul' | 'verde' | 'vermelho' | 'roxo' | 'neutro';

const GRADIENTES: Record<TomKPI, string> = {
  ambar: 'gradient-text-hero',
  azul: 'bg-gradient-azul bg-clip-text text-transparent',
  verde: 'gradient-text-sucesso',
  vermelho: 'gradient-text-alerta',
  roxo: 'gradient-text-ia',
  neutro: 'text-foreground',
};

const BRILHOS: Record<TomKPI, string> = {
  ambar: 'rgba(245,158,11,0.14)',
  azul: 'rgba(59,130,246,0.14)',
  verde: 'rgba(16,185,129,0.14)',
  vermelho: 'rgba(239,68,68,0.14)',
  roxo: 'rgba(139,92,246,0.14)',
  neutro: 'rgba(255,255,255,0.05)',
};

const BARRAS: Record<TomKPI, string> = {
  ambar: 'bg-gradient-hero',
  azul: 'bg-gradient-azul',
  verde: 'bg-gradient-sucesso',
  vermelho: 'bg-gradient-alerta',
  roxo: 'bg-gradient-ia',
  neutro: 'bg-white/30',
};

export interface KPICardProps {
  rotulo: string;
  valor: number;
  formato: FormatoKPI;
  /**
   * Nome do ícone, não o componente: props atravessam a fronteira
   * Server → Client serializadas, e um componente React não é serializável.
   */
  icone: NomeIconeKPI;
  tom: TomKPI;
  /** Variação percentual contra o mês anterior. `null` quando não há base. */
  variacaoPct?: number | null;
  /** Se verdade, uma variação negativa é boa (ex.: ociosidade). */
  inverterVariacao?: boolean;
  legenda?: string;
  /** Barra de progresso opcional (0–100). */
  progresso?: number;
  progressoRotulo?: string;
  classificacao?: string;
  href?: string;
  dica?: string;
}

export function KPICard({
  rotulo,
  valor,
  formato,
  icone,
  tom,
  variacaoPct,
  inverterVariacao = false,
  legenda,
  progresso,
  progressoRotulo,
  classificacao,
  href,
  dica,
}: KPICardProps): React.JSX.Element {
  const Icone = ICONES_KPI[icone];
  const positiva = variacaoPct !== null && variacaoPct !== undefined && variacaoPct > 0;
  const negativa = variacaoPct !== null && variacaoPct !== undefined && variacaoPct < 0;
  const boa = inverterVariacao ? negativa : positiva;
  const ruim = inverterVariacao ? positiva : negativa;

  const conteudo = (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(320px circle at 88% -10%, ${BRILHOS[tom]}, transparent 62%)`,
        }}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="label-caps leading-tight">{rotulo}</span>
          <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        {/*
          O corpo do número escala com a largura da janela em vez de saltar
          entre breakpoints. Com cinco colunas, o card fica estreito: em
          1280px "−R$ 365.047" em text-3xl não cabe, e em 1920px text-2xl
          ficaria pequeno demais. O clamp resolve os dois extremos e todos
          os pontos entre eles.
        */}
        <div
          className={cn(
            'mt-3 whitespace-nowrap text-[clamp(1.15rem,1.5vw,1.875rem)] font-bold leading-tight tracking-tight tabular-nums',
            GRADIENTES[tom],
          )}
        >
          {formato === 'moeda' ? (
            // Acima de cem mil os centavos não informam nada e estouram a
            // largura do card. `Math.abs` porque um EBITDA de −R$ 365 mil
            // é tão grande quanto um de +R$ 365 mil.
            <MoedaAnimada valor={valor} casas={Math.abs(valor) >= 100000 ? 0 : 2} />
          ) : formato === 'percentual' ? (
            <PercentualAnimado valor={valor} />
          ) : (
            <NumeroAnimado valor={valor} />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {variacaoPct !== undefined ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium tabular-nums',
                boa && 'text-emerald-400',
                ruim && 'text-red-400',
                !boa && !ruim && 'text-muted-foreground',
              )}
            >
              {positiva ? (
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              ) : negativa ? (
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              )}
              {formatarVariacao(variacaoPct ?? null)}
            </span>
          ) : null}

          {classificacao ? (
            <span className="text-muted-foreground">{classificacao}</span>
          ) : legenda ? (
            <span className="text-muted-foreground">{legenda}</span>
          ) : null}
        </div>

        {progresso !== undefined ? (
          <div className="mt-auto pt-4">
            <Progress value={progresso} corBarra={BARRAS[tom]} className="h-1.5" />
            {progressoRotulo ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">{progressoRotulo}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const comLink = href ? (
    <Link href={href} className="block h-full focus-visible:rounded-2xl">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );

  if (!dica) return comLink;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-full cursor-help">{comLink}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{dica}</TooltipContent>
    </Tooltip>
  );
}
