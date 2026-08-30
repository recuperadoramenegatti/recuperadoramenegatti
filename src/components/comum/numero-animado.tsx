'use client';

import * as React from 'react';
import CountUp from 'react-countup';

interface NumeroAnimadoProps {
  valor: number;
  prefixo?: string;
  sufixo?: string;
  casas?: number;
  duracao?: number;
  className?: string;
}

/**
 * Número com contagem animada no load, formatado em pt-BR.
 * Usa `react-countup` com separadores brasileiros.
 */
export function NumeroAnimado({
  valor,
  prefixo = '',
  sufixo = '',
  casas = 0,
  duracao = 1.1,
  className,
}: NumeroAnimadoProps): React.JSX.Element {
  const seguro = Number.isFinite(valor) ? valor : 0;
  return (
    <span className={className}>
      <CountUp
        end={seguro}
        duration={duracao}
        decimals={casas}
        decimal=","
        separator="."
        prefix={prefixo}
        suffix={sufixo}
        preserveValue
      />
    </span>
  );
}

/** Atalho para valores em reais. */
export function MoedaAnimada({
  valor,
  className,
  casas = 2,
}: {
  valor: number;
  className?: string;
  casas?: number;
}): React.JSX.Element {
  return <NumeroAnimado valor={valor} prefixo="R$ " casas={casas} className={className} />;
}

/** Atalho para percentuais. */
export function PercentualAnimado({
  valor,
  className,
  casas = 1,
}: {
  valor: number;
  className?: string;
  casas?: number;
}): React.JSX.Element {
  return <NumeroAnimado valor={valor} sufixo="%" casas={casas} className={className} />;
}
