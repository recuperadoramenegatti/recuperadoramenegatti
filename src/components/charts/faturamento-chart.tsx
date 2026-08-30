'use client';

import * as React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CURSOR_LINHA,
  CaixaTooltip,
  CORES_SERIE,
  EIXO,
  fmt,
  GRADE,
  GraficoVazio,
  Legenda,
  MolduraGrafico,
  SUPERFICIE,
} from '@/components/charts/base';
import { formatarPeriodoCurto } from '@/lib/formatacao';
import type { SerieMensal } from '@/types';

const COR_FATURAMENTO = CORES_SERIE[0];
const COR_META = CORES_SERIE[1];

interface Ponto {
  label: string;
  faturamento: number | null;
  projecao: number | null;
  meta: number;
  projetado: boolean;
}

/**
 * Faturamento realizado × meta, com a projeção do mês corrente.
 *
 * A projeção NÃO ganha cor própria: é a mesma série de faturamento em traço
 * tracejado. Cor sinaliza identidade, e projeção não é outra entidade — é o
 * mesmo faturamento com menos certeza.
 */
export function FaturamentoChart({ serie }: { serie: SerieMensal[] }): React.JSX.Element {
  const dados = React.useMemo<Ponto[]>(() => {
    const indiceProjecao = serie.findIndex((p) => p.projetado);
    return serie.map((ponto, i) => {
      const ehProjecao = Boolean(ponto.projetado);
      // O ponto anterior à projeção entra nas duas séries para o traço não quebrar.
      const conecta = indiceProjecao > 0 && i === indiceProjecao - 1;
      return {
        label: ponto.projetado ? 'Projeção' : formatarPeriodoCurto(ponto.periodo),
        faturamento: ehProjecao ? null : ponto.faturamento,
        projecao: ehProjecao || conecta ? ponto.faturamento : null,
        meta: ponto.meta,
        projetado: ehProjecao,
      };
    });
  }, [serie]);

  const temDados = dados.some((d) => (d.faturamento ?? 0) > 0 || (d.projecao ?? 0) > 0);
  const meta = dados[0]?.meta ?? 0;

  return (
    <MolduraGrafico
      titulo="Faturamento × meta"
      descricao="Últimos meses e projeção do mês corrente"
      altura={280}
      acessorio={
        <Legenda
          itens={[
            { nome: 'Faturamento', cor: COR_FATURAMENTO },
            { nome: 'Projeção', cor: COR_FATURAMENTO, tracejado: true },
            { nome: 'Meta', cor: COR_META, tracejado: true },
          ]}
        />
      }
    >
      {!temDados ? (
        <GraficoVazio mensagem="Nenhuma OS faturada nos últimos meses. Os valores aparecem aqui conforme as OS forem finalizadas." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="preenchimento-faturamento" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_FATURAMENTO} stopOpacity={0.28} />
                <stop offset="100%" stopColor={COR_FATURAMENTO} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid {...GRADE} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: EIXO.stroke }}
              tick={EIXO.tick}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={EIXO.tick}
              tickFormatter={fmt.moedaCompacta}
              width={62}
            />

            <Tooltip
              cursor={CURSOR_LINHA}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const ponto = payload[0]?.payload as Ponto | undefined;
                if (!ponto) return null;
                const valor = ponto.faturamento ?? ponto.projecao ?? 0;
                const atingido = ponto.meta > 0 ? (valor / ponto.meta) * 100 : 0;
                return (
                  <CaixaTooltip
                    titulo={String(label)}
                    itens={[
                      {
                        nome: ponto.projetado ? 'Projeção' : 'Faturamento',
                        valor,
                        cor: COR_FATURAMENTO,
                      },
                      { nome: 'Meta', valor: ponto.meta, cor: COR_META },
                    ]}
                    rodape={`${atingido.toFixed(0)}% da meta`}
                  />
                );
              }}
            />

            <ReferenceLine
              y={meta}
              stroke={COR_META}
              strokeDasharray="5 4"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />

            <Area
              type="monotone"
              dataKey="faturamento"
              stroke="none"
              fill="url(#preenchimento-faturamento)"
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="faturamento"
              stroke={COR_FATURAMENTO}
              strokeWidth={2}
              dot={{ r: 4, fill: COR_FATURAMENTO, stroke: SUPERFICIE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COR_FATURAMENTO, stroke: SUPERFICIE, strokeWidth: 2 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="projecao"
              stroke={COR_FATURAMENTO}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 4, fill: SUPERFICIE, stroke: COR_FATURAMENTO, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COR_FATURAMENTO, stroke: SUPERFICIE, strokeWidth: 2 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </MolduraGrafico>
  );
}
