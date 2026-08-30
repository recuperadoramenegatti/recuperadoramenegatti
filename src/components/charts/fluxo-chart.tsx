'use client';

import * as React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CURSOR_LINHA,
  CaixaTooltip,
  CORES_ESTADO,
  CORES_SERIE,
  EIXO,
  fmt,
  GRADE,
  GraficoVazio,
  Legenda,
  MolduraGrafico,
} from '@/components/charts/base';
import type { DiaFluxoCaixa } from '@/types';

const COR_SALDO = CORES_SERIE[1];

/**
 * Saldo de caixa projetado dia a dia.
 *
 * O preenchimento troca de cor abaixo de zero através de um gradiente com
 * parada calculada no ponto do zero — assim o trecho negativo é vermelho sem
 * precisar de uma segunda série, que sugeriria duas entidades onde há uma.
 */
export function FluxoChart({ dias }: { dias: DiaFluxoCaixa[] }): React.JSX.Element {
  const temDados = dias.some((d) => d.entradas > 0 || d.saidas > 0);

  const { maximo, minimo, paradaZero } = React.useMemo(() => {
    const saldos = dias.map((d) => d.saldoAcumulado);
    const max = Math.max(0, ...saldos);
    const min = Math.min(0, ...saldos);
    const amplitude = max - min;
    return {
      maximo: max,
      minimo: min,
      // Posição do zero no gradiente, de cima para baixo.
      paradaZero: amplitude > 0 ? (max / amplitude) * 100 : 100,
    };
  }, [dias]);

  return (
    <MolduraGrafico
      titulo="Saldo projetado dia a dia"
      descricao="Entradas previstas menos saídas, acumuladas ao longo do mês"
      altura={300}
      acessorio={
        <Legenda
          itens={[
            { nome: 'Saldo positivo', cor: COR_SALDO },
            { nome: 'Saldo negativo', cor: CORES_ESTADO.critico },
          ]}
        />
      }
    >
      {!temDados ? (
        <GraficoVazio mensagem="Sem movimentação prevista no período. O fluxo aparece conforme as OS ganham datas de entrega e faturamento." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dias} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id="traco-saldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset={`${paradaZero}%`} stopColor={COR_SALDO} />
                <stop offset={`${paradaZero}%`} stopColor={CORES_ESTADO.critico} />
              </linearGradient>
              <linearGradient id="area-saldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_SALDO} stopOpacity={0.3} />
                <stop offset={`${paradaZero}%`} stopColor={COR_SALDO} stopOpacity={0.02} />
                <stop offset={`${paradaZero}%`} stopColor={CORES_ESTADO.critico} stopOpacity={0.05} />
                <stop offset="100%" stopColor={CORES_ESTADO.critico} stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <CartesianGrid {...GRADE} vertical={false} />
            <XAxis
              dataKey="dia"
              tickLine={false}
              axisLine={{ stroke: EIXO.stroke }}
              tick={EIXO.tick}
              interval="preserveStartEnd"
              minTickGap={20}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={EIXO.tick}
              tickFormatter={fmt.moedaCompacta}
              width={68}
              domain={[Math.min(0, minimo * 1.1), Math.max(0, maximo * 1.1)]}
            />

            <Tooltip
              cursor={CURSOR_LINHA}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const dia = payload[0]?.payload as DiaFluxoCaixa | undefined;
                if (!dia) return null;
                return (
                  <CaixaTooltip
                    titulo={`Dia ${dia.dia}`}
                    itens={[
                      { nome: 'Entradas', valor: dia.entradas, cor: CORES_ESTADO.bom },
                      { nome: 'Saídas', valor: dia.saidas, cor: CORES_ESTADO.critico },
                      {
                        nome: 'Saldo acumulado',
                        valor: dia.saldoAcumulado,
                        cor: dia.negativo ? CORES_ESTADO.critico : COR_SALDO,
                      },
                    ]}
                    rodape={dia.negativo ? 'Saldo negativo neste dia' : undefined}
                  />
                );
              }}
            />

            <ReferenceLine y={0} stroke="var(--borda-2)" strokeWidth={1} />

            <Area
              type="monotone"
              dataKey="saldoAcumulado"
              stroke="url(#traco-saldo)"
              strokeWidth={2}
              fill="url(#area-saldo)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--superficie-grafico)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </MolduraGrafico>
  );
}
