'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn, numero } from '@/lib/utils';

interface CampoNumericoProps {
  id: string;
  rotulo: string;
  valor: number;
  onChange: (valor: number) => void;
  min?: number;
  max?: number;
  passo?: number;
  prefixo?: string;
  sufixo?: string;
  /** Texto auxiliar sob o campo (ex.: o custo calculado). */
  auxiliar?: React.ReactNode;
  comSlider?: boolean;
  corTrilha?: string;
  className?: string;
  placeholder?: string;
}

/**
 * Campo numérico com slider opcional sincronizado.
 *
 * O estado do texto é local enquanto o usuário digita, para que apagar o
 * campo não force um "0" imediato — mas o valor numérico propagado já é o
 * final, então o cálculo acompanha em tempo real.
 */
export function CampoNumerico({
  id,
  rotulo,
  valor,
  onChange,
  min = 0,
  max = 100,
  passo = 0.5,
  prefixo,
  sufixo,
  auxiliar,
  comSlider = false,
  corTrilha,
  className,
  placeholder,
}: CampoNumericoProps): React.JSX.Element {
  const [texto, setTexto] = React.useState(String(valor));
  const [editando, setEditando] = React.useState(false);

  React.useEffect(() => {
    if (!editando) setTexto(valor === 0 ? '' : String(valor));
  }, [valor, editando]);

  const aoDigitar = (bruto: string): void => {
    setTexto(bruto);
    const limpo = bruto.replace(',', '.');
    if (limpo === '' || limpo === '.') {
      onChange(0);
      return;
    }
    const n = Number(limpo);
    if (Number.isFinite(n)) onChange(Math.max(min, n));
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{rotulo}</Label>
        {auxiliar ? <span className="text-[11px] text-muted-foreground">{auxiliar}</span> : null}
      </div>

      <div className="flex items-center gap-3">
        {comSlider ? (
          <Slider
            value={[Math.min(max, Math.max(min, numero(valor)))]}
            min={min}
            max={max}
            step={passo}
            onValueChange={([v]) => onChange(v ?? min)}
            corTrilha={corTrilha}
            className="flex-1"
            aria-label={rotulo}
          />
        ) : null}

        <div className={cn('relative', comSlider ? 'w-28 shrink-0' : 'w-full')}>
          {prefixo ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {prefixo}
            </span>
          ) : null}
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            value={texto}
            placeholder={placeholder ?? '0'}
            onFocus={() => setEditando(true)}
            onBlur={() => {
              setEditando(false);
              setTexto(valor === 0 ? '' : String(valor));
            }}
            onChange={(e) => aoDigitar(e.target.value)}
            className={cn(
              'tabular-nums',
              prefixo && 'pl-9',
              sufixo && 'pr-8',
              comSlider && 'text-right',
            )}
          />
          {sufixo ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {sufixo}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
