'use client';

import * as React from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CURSOR_AREA,
  CaixaTooltip,
  CORES_ESTADO,
  EIXO,
  fmt,
  LARGURA_EIXO_VALOR,
  GraficoVazio,
  MolduraGrafico,
  SUPERFICIE,
} from '@/components/charts/base';
import { Legenda } from '@/components/charts/base';
import type { PassoWaterfall } from '@/lib/dre';

const COR_TOTAL = '#3B82F6';

/**
 * Waterfall da receita bruta até o lucro líquido.
 *
 * A cor codifica direção (entra, sai, subtotal) — paleta de estado, não
 * categórica. Cada barra traz o valor rotulado, então a leitura não depende
 * da cor.
 *
 * A barra flutuante é feita com um segmento de base transparente: Recharts
 * empilha `base` (invisível) sob `valor` (visível).
 */
export function WaterfallDRE({ passos }: { passos: PassoWaterfall[] }): React.JSX.Element {
  const dados = React.useMemo(
    () =>
      passos.map((passo) => ({
        ...passo,
        // Totais partem do zero; os demais flutuam sobre a base acumulada.
        baseVisivel: passo.tipo === 'inicio' || passo.tipo === 'total' ? 0 : passo.base,
      })),
    [passos],
  );

  const corDe = (tipo: PassoWaterfall['tipo']): string => {
    if (tipo === 'negativo') return CORES_ESTADO.critico;
    if (tipo === 'positivo') return CORES_ESTADO.bom;
    return COR_TOTAL;
  };

  const temDados = dados.some((d) => d.valor !== 0);

  return (
    <MolduraGrafico
      titulo="Da receita ao lucro"
      descricao="Cada barra mostra o que entra ou sai entre um subtotal e o próximo"
      altura={320}
      acessorio={
        <Legenda
          itens={[
            { nome: 'Subtotal', cor: COR_TOTAL },
            { nome: 'Saída', cor: CORES_ESTADO.critico },
            { nome: 'Entrada', cor: CORES_ESTADO.bom },
          ]}
        />
      }
    >
      {!temDados ? (
        <GraficoVazio mensagem="Sem movimentação no período. O waterfall aparece quando houver receita ou despesa lançada." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 40, left: 4 }}>
            <XAxis
              dataKey="nome"
              tickLine={false}
              axisLine={{ stroke: EIXO.stroke }}
              tick={{ ...EIXO.tick, fontSize: 10 }}
              angle={-28}
              textAnchor="end"
              height={58}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={EIXO.tick}
              tickFormatter={fmt.moedaCompacta}
              width={LARGURA_EIXO_VALOR}
            />

            <Tooltip
              cursor={CURSOR_AREA}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const passo = payload[0]?.payload as PassoWaterfall | undefined;
                if (!passo) return null;
                const rotulo =
                  passo.tipo === 'negativo'
                    ? 'Saída'
                    : passo.tipo === 'positivo'
                      ? 'Entrada'
                      : 'Subtotal';
                return (
                  <CaixaTooltip
                    titulo={passo.nome}
                    itens={[{ nome: rotulo, valor: passo.valor, cor: corDe(passo.tipo) }]}
                  />
                );
              }}
            />

            {/* Base invisível que faz a barra "flutuar" */}
            <Bar dataKey="baseVisivel" stackId="cascata" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="valor" stackId="cascata" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {dados.map((passo, indice) => (
                <Cell
                  key={`${passo.nome}-${indice}`}
                  fill={corDe(passo.tipo)}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </MolduraGrafico>
  );
}
