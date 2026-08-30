'use client';

import * as React from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CaixaTooltip,
  CORES_ESTADO,
  EIXO,
  fmt,
  GraficoVazio,
  MolduraGrafico,
} from '@/components/charts/base';
import type { FaixaHistograma, ParametrosBase } from '@/types';

/**
 * Distribuição das OS por faixa de margem.
 * A cor codifica estado (abaixo do mínimo, aceitável, ideal) e a contagem
 * vem rotulada em cada barra.
 */
export function HistogramaMargens({
  faixas,
  parametros,
}: {
  faixas: FaixaHistograma[];
  parametros: ParametrosBase;
}): React.JSX.Element {
  const total = faixas.reduce((acc, f) => acc + f.quantidade, 0);

  const corDa = (faixa: FaixaHistograma): string => {
    if (faixa.max <= parametros.margemMinima) return CORES_ESTADO.critico;
    if (faixa.min >= parametros.margemIdeal) return CORES_ESTADO.bom;
    return CORES_ESTADO.atencao;
  };

  return (
    <MolduraGrafico
      titulo="Distribuição de margens"
      descricao={`${total} OS no período, agrupadas por faixa de margem de contribuição`}
      altura={260}
    >
      {total === 0 ? (
        <GraficoVazio mensagem="Nenhuma OS finalizada no período." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={faixas} margin={{ top: 20, right: 8, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="faixa"
              tickLine={false}
              axisLine={{ stroke: EIXO.stroke }}
              tick={EIXO.tick}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={EIXO.tick}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const faixa = payload[0]?.payload as FaixaHistograma | undefined;
                if (!faixa) return null;
                return (
                  <CaixaTooltip
                    titulo={`Margem ${faixa.faixa}`}
                    itens={[
                      {
                        nome: 'Ordens de serviço',
                        valor: faixa.quantidade,
                        cor: corDa(faixa),
                        formatador: fmt.inteiro,
                      },
                      { nome: 'Receita somada', valor: faixa.receita, cor: 'transparent' },
                    ]}
                    rodape={`${((faixa.quantidade / total) * 100).toFixed(0)}% das OS do período`}
                  />
                );
              }}
            />
            <Bar dataKey="quantidade" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={56}>
              {faixas.map((faixa) => (
                <Cell key={faixa.faixa} fill={corDa(faixa)} />
              ))}
              <LabelList
                dataKey="quantidade"
                position="top"
                offset={6}
                formatter={(v: number) => (v > 0 ? String(v) : '')}
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MolduraGrafico>
  );
}
