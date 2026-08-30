'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CaixaTooltip,
  CORES_SERIE,
  fmt,
  GraficoVazio,
  MolduraGrafico,
  SUPERFICIE,
} from '@/components/charts/base';
import { formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import { dividir } from '@/lib/utils';
import type { ComposicaoCusto } from '@/types';

interface Fatia {
  nome: string;
  valor: number;
  cor: string;
  descricao: string;
}

/**
 * Composição do custo do período.
 *
 * As fatias são ordenadas para que verde e azul nunca fiquem adjacentes — o
 * par tem ΔE tritan na faixa de piso. Além disso, legenda e valores diretos
 * garantem que a identidade nunca dependa só da cor.
 */
export function ComposicaoChart({
  composicao,
}: {
  composicao: ComposicaoCusto;
}): React.JSX.Element {
  const fatias = React.useMemo<Fatia[]>(
    () =>
      [
        {
          nome: 'Mão de obra',
          valor: composicao.maoDeObra,
          cor: CORES_SERIE[0],
          descricao: 'Horas aplicadas × THH',
        },
        {
          nome: 'Insumos',
          valor: composicao.insumos,
          cor: CORES_SERIE[1],
          descricao: 'Materiais, consumíveis e ferramentas',
        },
        {
          nome: 'Overhead',
          valor: composicao.overhead,
          cor: CORES_SERIE[3],
          descricao: 'Custo fixo rateado (CFR)',
        },
        {
          nome: 'Máquina',
          valor: composicao.maquina,
          cor: CORES_SERIE[2],
          descricao: 'Depreciação e uso de equipamento (THM)',
        },
      ].filter((f) => f.valor > 0),
    [composicao],
  );

  const total = fatias.reduce((acc, f) => acc + f.valor, 0);

  return (
    <MolduraGrafico
      titulo="Composição do custo"
      descricao="Para onde vai cada real de custo no período"
      altura={280}
    >
      {total <= 0 ? (
        <GraficoVazio mensagem="Sem custos apurados no período." />
      ) : (
        <div className="flex h-full items-center gap-4">
          <div className="relative h-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fatias}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {fatias.map((fatia) => (
                    <Cell key={fatia.nome} fill={fatia.cor} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const fatia = payload[0]?.payload as Fatia | undefined;
                    if (!fatia) return null;
                    return (
                      <CaixaTooltip
                        titulo={fatia.nome}
                        itens={[{ nome: 'Custo', valor: fatia.valor, cor: fatia.cor }]}
                        rodape={`${formatarPercentual(dividir(fatia.valor, total) * 100)} do total · ${fatia.descricao}`}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Número-herói no centro da rosca */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="label-caps text-[10px]">Custo total</span>
              <span className="text-lg font-bold tabular-nums">{fmt.moedaCompacta(total)}</span>
            </div>
          </div>

          {/* Legenda com valor direto — identidade nunca só por cor */}
          <ul className="w-40 shrink-0 space-y-2.5">
            {fatias.map((fatia) => (
              <li key={fatia.nome}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: fatia.cor }}
                    aria-hidden
                  />
                  <span className="truncate text-xs text-muted-foreground">{fatia.nome}</span>
                </div>
                <div className="ml-3.5 text-xs font-medium tabular-nums">
                  {formatarMoeda(fatia.valor)}
                  <span className="ml-1 text-muted-foreground">
                    {formatarPercentual(dividir(fatia.valor, total) * 100, 0)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </MolduraGrafico>
  );
}
