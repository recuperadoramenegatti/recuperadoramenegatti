import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ClassificacaoMargem } from '@/types';

export const CORES_CLASSIFICACAO: Record<
  ClassificacaoMargem,
  { texto: string; fundo: string; borda: string; barra: string; rotulo: string; emoji: string }
> = {
  critica: {
    texto: 'text-red-400',
    fundo: 'bg-red-500/10',
    borda: 'border-red-500/30',
    barra: 'bg-gradient-alerta',
    rotulo: 'Crítica',
    emoji: '🔴',
  },
  baixa: {
    texto: 'text-amber-400',
    fundo: 'bg-amber-500/10',
    borda: 'border-amber-500/30',
    barra: 'bg-gradient-hero',
    rotulo: 'Baixa',
    emoji: '🟡',
  },
  boa: {
    texto: 'text-emerald-400',
    fundo: 'bg-emerald-500/10',
    borda: 'border-emerald-500/30',
    barra: 'bg-gradient-sucesso',
    rotulo: 'Boa',
    emoji: '🟢',
  },
  excelente: {
    texto: 'text-emerald-300',
    fundo: 'bg-emerald-500/15',
    borda: 'border-emerald-400/40',
    barra: 'bg-gradient-sucesso',
    rotulo: 'Excelente',
    emoji: '🟢',
  },
};

interface PontoSemaforoProps {
  classificacao: ClassificacaoMargem;
  className?: string;
}

export function PontoSemaforo({ classificacao, className }: PontoSemaforoProps): React.JSX.Element {
  const cor = CORES_CLASSIFICACAO[classificacao];
  return (
    <span
      className={cn('inline-flex h-2.5 w-2.5 rounded-full', cor.barra, className)}
      aria-label={`Margem ${cor.rotulo.toLowerCase()}`}
    />
  );
}
