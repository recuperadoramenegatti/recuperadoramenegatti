import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatarPercentual } from '@/lib/formatacao';
import {
  LABEL_PRIORIDADE,
  LABEL_STATUS_OS,
  LABEL_TIPO_OS,
  type ClassificacaoMargem,
  type ParametrosBase,
  type Prioridade,
  type StatusOS,
  type TipoOS,
} from '@/types';

const VARIANTE_STATUS: Record<StatusOS, React.ComponentProps<typeof Badge>['variant']> = {
  orcado: 'info',
  em_execucao: 'warning',
  aguardando_pecas: 'ia',
  finalizado: 'success',
  faturado: 'success',
  pago: 'success',
  cancelado: 'secondary',
};

export function BadgeStatus({ status }: { status: string }): React.JSX.Element {
  const chave = status as StatusOS;
  return (
    <Badge variant={VARIANTE_STATUS[chave] ?? 'secondary'}>
      {LABEL_STATUS_OS[chave] ?? status}
    </Badge>
  );
}

const VARIANTE_TIPO: Record<TipoOS, React.ComponentProps<typeof Badge>['variant']> = {
  recuperacao: 'default',
  fabricacao: 'info',
  manutencao: 'ia',
  outro: 'secondary',
};

export function BadgeTipo({ tipo }: { tipo: string }): React.JSX.Element {
  const chave = tipo as TipoOS;
  return (
    <Badge variant={VARIANTE_TIPO[chave] ?? 'secondary'}>{LABEL_TIPO_OS[chave] ?? tipo}</Badge>
  );
}

export function BadgePrioridade({ prioridade }: { prioridade: string }): React.JSX.Element | null {
  if (prioridade === 'normal') return null;
  const chave = prioridade as Prioridade;
  return (
    <Badge variant={chave === 'muito_urgente' ? 'destructive' : 'warning'} pulsante={chave === 'muito_urgente'}>
      {LABEL_PRIORIDADE[chave] ?? prioridade}
    </Badge>
  );
}

export function classificarMargemCliente(
  margem: number,
  parametros: Pick<ParametrosBase, 'margemMinima' | 'margemIdeal'>,
): ClassificacaoMargem {
  if (!Number.isFinite(margem) || margem < parametros.margemMinima) return 'critica';
  const meio = (parametros.margemMinima + parametros.margemIdeal) / 2;
  if (margem < meio) return 'baixa';
  if (margem < parametros.margemIdeal) return 'boa';
  return 'excelente';
}

const COR_MARGEM: Record<ClassificacaoMargem, string> = {
  critica: 'text-red-400',
  baixa: 'text-amber-400',
  boa: 'text-emerald-400',
  excelente: 'text-emerald-300',
};

const BARRA_MARGEM: Record<ClassificacaoMargem, string> = {
  critica: 'bg-gradient-alerta',
  baixa: 'bg-gradient-hero',
  boa: 'bg-gradient-sucesso',
  excelente: 'bg-gradient-sucesso',
};

/** Margem com cor semântica e barra proporcional. */
export function IndicadorMargem({
  margem,
  parametros,
  comBarra = false,
  className,
}: {
  margem: number;
  parametros: Pick<ParametrosBase, 'margemMinima' | 'margemIdeal'>;
  comBarra?: boolean;
  className?: string;
}): React.JSX.Element {
  const classificacao = classificarMargemCliente(margem, parametros);
  const largura = Math.min(100, Math.max(0, (margem / Math.max(1, parametros.margemIdeal)) * 100));

  return (
    <div className={cn('min-w-16', className)}>
      <span className={cn('text-sm font-medium tabular-nums', COR_MARGEM[classificacao])}>
        {formatarPercentual(margem)}
      </span>
      {comBarra ? (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn('h-full rounded-full transition-all duration-500', BARRA_MARGEM[classificacao])}
            style={{ width: `${largura}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
