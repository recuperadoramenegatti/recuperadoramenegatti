'use client';

import * as React from 'react';
import { CheckCircle2, TrendingUp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarPercentual } from '@/lib/formatacao';
import type { ClassificacaoMargem, ParametrosBase } from '@/types';

interface SemaforoMargemProps {
  margem: number;
  classificacao: ClassificacaoMargem;
  parametros: ParametrosBase;
  className?: string;
}

interface Faixa {
  chave: 'critica' | 'aceitavel' | 'ideal';
  rotulo: string;
  emoji: string;
  descricao: string;
  cor: string;
  fundo: string;
  borda: string;
  icone: typeof XCircle;
}

/**
 * Semáforo de margem.
 *
 * Usa a margem de CONTRIBUIÇÃO (líquida de impostos), não a bruta: é ela
 * que diz quanto sobra de fato para cobrir a estrutura fixa da fábrica.
 */
export function SemaforoMargem({
  margem,
  classificacao,
  parametros,
  className,
}: SemaforoMargemProps): React.JSX.Element {
  const meio = (parametros.margemMinima + parametros.margemIdeal) / 2;

  const faixas: Faixa[] = [
    {
      chave: 'critica',
      rotulo: `Abaixo do mínimo`,
      emoji: '🔴',
      descricao: `< ${formatarPercentual(parametros.margemMinima, 0)}`,
      cor: 'text-red-400',
      fundo: 'bg-red-500/10',
      borda: 'border-red-500/40',
      icone: XCircle,
    },
    {
      chave: 'aceitavel',
      rotulo: 'Margem aceitável',
      emoji: '🟡',
      descricao: `${formatarPercentual(parametros.margemMinima, 0)} – ${formatarPercentual(parametros.margemIdeal, 0)}`,
      cor: 'text-amber-400',
      fundo: 'bg-amber-500/10',
      borda: 'border-amber-500/40',
      icone: TrendingUp,
    },
    {
      chave: 'ideal',
      rotulo: 'Margem ideal',
      emoji: '🟢',
      descricao: `> ${formatarPercentual(parametros.margemIdeal, 0)}`,
      cor: 'text-emerald-400',
      fundo: 'bg-emerald-500/10',
      borda: 'border-emerald-500/40',
      icone: CheckCircle2,
    },
  ];

  const ativa: Faixa['chave'] =
    classificacao === 'critica' ? 'critica' : classificacao === 'excelente' ? 'ideal' : 'aceitavel';

  const faixaAtiva = faixas.find((f) => f.chave === ativa) ?? faixas[1]!;
  const Icone = faixaAtiva.icone;

  const mensagem =
    ativa === 'critica'
      ? margem < 0
        ? 'Este preço dá prejuízo. Não feche assim.'
        : 'Abaixo do mínimo aceitável — não recomendado.'
      : ativa === 'ideal'
        ? 'Margem saudável. Pode negociar com folga.'
        : classificacao === 'baixa'
          ? 'Aceitável, mas perto do limite. Pouco espaço para desconto.'
          : 'Boa margem, próxima do alvo da empresa.';

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors duration-300',
        faixaAtiva.fundo,
        faixaAtiva.borda,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <Icone className={cn('h-6 w-6 shrink-0', faixaAtiva.cor)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-xl font-bold tabular-nums', faixaAtiva.cor)}>
              {formatarPercentual(margem)}
            </span>
            <span className={cn('text-sm font-medium', faixaAtiva.cor)}>{faixaAtiva.rotulo}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{mensagem}</p>
        </div>
      </div>

      {/* Régua das três faixas */}
      <div className="mt-4 space-y-2">
        <div className="flex h-1.5 overflow-hidden rounded-full">
          <div
            className={cn('bg-red-500/60', ativa === 'critica' && 'bg-red-500')}
            style={{ width: `${Math.max(10, parametros.margemMinima)}%` }}
          />
          <div
            className={cn('bg-amber-500/60', ativa === 'aceitavel' && 'bg-amber-500')}
            style={{ width: `${Math.max(10, parametros.margemIdeal - parametros.margemMinima)}%` }}
          />
          <div className={cn('flex-1 bg-emerald-500/60', ativa === 'ideal' && 'bg-emerald-500')} />
        </div>

        <div className="flex justify-between text-[10px] text-muted-foreground">
          {faixas.map((faixa) => (
            <span
              key={faixa.chave}
              className={cn(
                'transition-colors',
                faixa.chave === ativa ? cn('font-semibold', faixa.cor) : '',
              )}
            >
              {faixa.emoji} {faixa.descricao}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Margem de contribuição sobre a receita líquida — já descontados{' '}
        {formatarPercentual(parametros.aliquotaImpostos, 1)} de impostos. É a mesma base do DRE, então
        este número é comparável ao resultado do mês. Ponto médio da faixa aceitável:{' '}
        {formatarPercentual(meio, 0)}.
      </p>
    </div>
  );
}
