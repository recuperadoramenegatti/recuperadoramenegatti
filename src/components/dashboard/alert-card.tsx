'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ChevronRight,
  Info,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatarMoeda } from '@/lib/formatacao';
import type { Alerta, NivelAlerta } from '@/types';

const ESTILO: Record<
  NivelAlerta,
  { icone: LucideIcon; cor: string; borda: string; fundo: string; rotulo: string; badge: 'destructive' | 'warning' | 'info' | 'secondary' }
> = {
  critico: {
    icone: AlertOctagon,
    cor: 'text-red-400',
    borda: 'border-red-500/30',
    fundo: 'bg-red-500/[0.07]',
    rotulo: 'Crítico',
    badge: 'destructive',
  },
  alto: {
    icone: AlertTriangle,
    cor: 'text-amber-400',
    borda: 'border-amber-500/30',
    fundo: 'bg-amber-500/[0.07]',
    rotulo: 'Alta',
    badge: 'warning',
  },
  medio: {
    icone: Info,
    cor: 'text-blue-400',
    borda: 'border-blue-500/25',
    fundo: 'bg-blue-500/[0.05]',
    rotulo: 'Média',
    badge: 'info',
  },
  baixo: {
    icone: Lightbulb,
    cor: 'text-muted-foreground',
    borda: 'border-[var(--borda-1)]',
    fundo: 'bg-[var(--superficie-2)]',
    rotulo: 'Baixa',
    badge: 'secondary',
  },
};

export function AlertCard({ alerta }: { alerta: Alerta }): React.JSX.Element {
  const [expandido, setExpandido] = React.useState(false);
  const estilo = ESTILO[alerta.nivel];
  const Icone = estilo.icone;

  return (
    <article
      className={cn(
        'rounded-xl border p-3.5 transition-colors duration-200',
        estilo.borda,
        estilo.fundo,
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icone className={cn('mt-0.5 h-4 w-4 shrink-0', estilo.cor)} aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={estilo.badge}
              pulsante={alerta.nivel === 'critico'}
              className="text-[10px]"
            >
              {estilo.rotulo}
            </Badge>
            {alerta.impactoFinanceiro !== null && alerta.impactoFinanceiro > 0 ? (
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {formatarMoeda(alerta.impactoFinanceiro)}
              </span>
            ) : null}
          </div>

          <h4 className="mt-1.5 text-sm font-medium leading-snug">{alerta.titulo}</h4>

          <p
            className={cn(
              'mt-1 text-xs leading-relaxed text-muted-foreground',
              !expandido && 'line-clamp-2',
            )}
          >
            {alerta.descricao}
          </p>

          {expandido ? (
            <div className="mt-2.5 rounded-lg border border-[var(--borda-1)] bg-black/20 p-2.5">
              <span className="label-caps text-[10px]">O que fazer</span>
              <p className="mt-1 text-xs leading-relaxed">{alerta.acaoSugerida}</p>
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              className="text-[11px] font-medium text-primary transition-colors hover:brightness-125"
              aria-expanded={expandido}
            >
              {expandido ? 'Recolher' : 'Ver detalhes'}
            </button>

            {alerta.link ? (
              <Link
                href={alerta.link}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Abrir
                <ChevronRight className="h-3 w-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
