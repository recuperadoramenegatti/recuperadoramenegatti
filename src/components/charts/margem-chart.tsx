'use client';

import * as React from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CURSOR_AREA,
  CaixaTooltip,
  CORES_ESTADO,
  EIXO,
  fmt,
  GraficoVazio,
  MolduraGrafico,
} from '@/components/charts/base';
import type { MargemPorTipo, ParametrosBase } from '@/types';

/**
 * Margem por tipo de serviço, em barras horizontais.
 *
 * A cor aqui carrega ESTADO (acima/abaixo do mínimo), não identidade — por
 * isso usa a paleta de estado, e cada barra traz o valor rotulado ao lado,
 * de modo que a leitura não depende da cor.
 */
export function MargemChart({
  dados,
  parametros,
}: {
  dados: MargemPorTipo[];
  parametros: ParametrosBase;
}): React.JSX.Element {
  const ordenados = React.useMemo(
    () => [...dados].sort((a, b) => b.margemPct - a.margemPct),
    [dados],
  );

  const corDa = (margem: number): string => {
    if (margem < parametros.margemMinima) return CORES_ESTADO.critico;
    if (margem < parametros.margemIdeal) return CORES_ESTADO.atencao;
    return CORES_ESTADO.bom;
  };

  return (
    <MolduraGrafico
      titulo="Margem por tipo de serviço"
      descricao={`Margem de contribuição · mínimo de ${parametros.margemMinima}%`}
      altura={Math.max(180, ordenados.length * 56 + 40)}
    >
      {ordenados.length === 0 ? (
        <GraficoVazio mensagem="Nenhuma OS finalizada no período para comparar tipos de serviço." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ordenados}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
            barCategoryGap={10}
          >
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={EIXO.tick}
              width={132}
            />
            <Tooltip
              cursor={CURSOR_AREA}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as MargemPorTipo | undefined;
                if (!item) return null;
                return (
                  <CaixaTooltip
                    titulo={item.label}
                    itens={[
                      {
                        nome: 'Margem',
                        valor: item.margemPct,
                        cor: corDa(item.margemPct),
                        formatador: fmt.percentual,
                      },
                      { nome: 'Receita', valor: item.receita, cor: 'transparent' },
                      { nome: 'Ticket médio', valor: item.ticketMedio, cor: 'transparent' },
                    ]}
                    rodape={`${item.quantidade} OS no período`}
                  />
                );
              }}
            />
            <Bar dataKey="margemPct" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
              {ordenados.map((item) => (
                <Cell key={item.tipo} fill={corDa(item.margemPct)} />
              ))}
              <LabelList
                dataKey="margemPct"
                position="right"
                offset={8}
                formatter={(v: number) => fmt.percentual(v)}
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
