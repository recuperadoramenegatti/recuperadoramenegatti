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
  CORES_ESTADO,
  CORES_SERIE,
  EIXO,
  fmt,
  GRADE,
  LARGURA_EIXO_VALOR,
  GraficoVazio,
  Legenda,
  MolduraGrafico,
} from '@/components/charts/base';
import type { DiaFluxoCaixa } from '@/types';

const COR_SALDO = CORES_SERIE[1];

/**
 * Saldo de caixa dia a dia: o que já aconteceu e o que está projetado.
 *
 * Duas leituras diferentes, então duas linhas — mas na mesma cor, porque é o
 * mesmo saldo: o realizado em traço cheio até hoje, a projeção tracejada
 * daí em diante. Cor sinaliza identidade, e projeção não é outra entidade.
 *
 * O preenchimento troca de cor abaixo de zero através de um gradiente com
 * parada calculada no ponto do zero — assim o trecho negativo é vermelho sem
 * precisar de uma série extra.
 */
export function FluxoChart({ dias }: { dias: DiaFluxoCaixa[] }): React.JSX.Element {
  const temDados = dias.some((d) => d.entradas > 0 || d.saidas > 0);
  const temRealizado = dias.some((d) => d.saldoRealizado !== null && d.passado);

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
      titulo="Saldo de caixa dia a dia"
      descricao="Traço cheio é o que já aconteceu; tracejado é projeção. A cor indica o sinal do saldo."
      altura={300}
      acessorio={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {temRealizado ? (
            <Legenda
              rotulo="traço"
              itens={[
                { nome: 'realizado', cor: 'currentColor', linha: true },
                { nome: 'projetado', cor: 'currentColor', tracejado: true },
              ]}
            />
          ) : null}
          <Legenda
            rotulo="cor"
            itens={[
              { nome: 'saldo positivo', cor: COR_SALDO, linha: true },
              { nome: 'saldo negativo', cor: CORES_ESTADO.critico, linha: true },
            ]}
          />
        </div>
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
              width={LARGURA_EIXO_VALOR}
              domain={[Math.min(0, minimo * 1.1), Math.max(0, maximo * 1.1)]}
            />

            <Tooltip
              cursor={CURSOR_LINHA}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const dia = payload[0]?.payload as DiaFluxoCaixa | undefined;
                if (!dia) return null;
                const rodape = [
                  dia.negativo ? 'Saldo negativo neste dia' : '',
                  dia.passado ? 'já realizado' : 'projeção',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <CaixaTooltip
                    titulo={`Dia ${dia.dia}`}
                    itens={[
                      { nome: 'Entradas', valor: dia.entradas, cor: CORES_ESTADO.bom },
                      { nome: 'Saídas', valor: dia.saidas, cor: CORES_ESTADO.critico },
                      {
                        nome: 'Saldo projetado',
                        valor: dia.saldoAcumulado,
                        cor: dia.negativo ? CORES_ESTADO.critico : COR_SALDO,
                      },
                      ...(dia.saldoRealizado !== null
                        ? [
                            {
                              nome: 'Saldo realizado',
                              valor: dia.saldoRealizado,
                              cor: COR_SALDO,
                            },
                          ]
                        : []),
                    ]}
                    rodape={rodape}
                  />
                );
              }}
            />

            <ReferenceLine y={0} stroke="var(--borda-2)" strokeWidth={1} />

            {/*
              Projeção: área preenchida, traço tracejado, cobrindo o mês
              inteiro. Fica mais fina e translúcida porque, no passado, ela
              praticamente coincide com o realizado — e onde as duas se
              sobrepõem quem deve ser lido é o que aconteceu, não o plano.
            */}
            <Area
              type="monotone"
              dataKey="saldoAcumulado"
              stroke="url(#traco-saldo)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              strokeOpacity={0.55}
              fill="url(#area-saldo)"
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--superficie-grafico)' }}
            />

            {/* Realizado: traço cheio e mais grosso, termina no dia de hoje. */}
            {temRealizado ? (
              <Line
                type="monotone"
                dataKey="saldoRealizado"
                stroke="url(#traco-saldo)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--superficie-grafico)' }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </MolduraGrafico>
  );
}
