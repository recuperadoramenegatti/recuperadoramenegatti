'use client';

import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CaixaTooltip,
  CORES_SERIE,
  EIXO,
  fmt,
  GRADE,
  GraficoVazio,
  MolduraGrafico,
  SUPERFICIE,
} from '@/components/charts/base';
import { cn } from '@/lib/utils';
import type { PainelIndicadores } from '@/lib/indicadores';

type Metrica = 'faturamento' | 'margemPct' | 'ebitdaPct' | 'ticketMedio' | 'ocupacaoPct' | 'faturamentoPorHora';

const METRICAS: Array<{ chave: Metrica; rotulo: string; formatador: (v: number) => string }> = [
  { chave: 'faturamento', rotulo: 'Faturamento', formatador: fmt.moedaCompacta },
  { chave: 'margemPct', rotulo: 'Margem', formatador: fmt.percentual },
  { chave: 'ebitdaPct', rotulo: 'EBITDA', formatador: fmt.percentual },
  { chave: 'ticketMedio', rotulo: 'Ticket médio', formatador: fmt.moedaCompacta },
  { chave: 'ocupacaoPct', rotulo: 'Ocupação', formatador: fmt.percentual },
  { chave: 'faturamentoPorHora', rotulo: 'R$/hora', formatador: fmt.moedaCompacta },
];

/**
 * Evolução de 12 meses com linha de tendência.
 *
 * Uma métrica por vez, escolhida pelo usuário — nunca duas escalas no mesmo
 * gráfico. A tendência é a regressão linear simples da série, em tom
 * recessivo para não competir com o dado real.
 */
export function EvolucaoChart({
  evolucao,
}: {
  evolucao: PainelIndicadores['evolucao'];
}): React.JSX.Element {
  const [metrica, setMetrica] = React.useState<Metrica>('faturamento');
  const configuracao = METRICAS.find((m) => m.chave === metrica) ?? METRICAS[0]!;

  const dados = React.useMemo(() => {
    const valores = evolucao.map((p) => p[metrica]);
    const n = valores.length;

    // Regressão linear: y = a + b·x
    const somaX = valores.reduce((acc, _, i) => acc + i, 0);
    const somaY = valores.reduce((acc, v) => acc + v, 0);
    const somaXY = valores.reduce((acc, v, i) => acc + i * v, 0);
    const somaX2 = valores.reduce((acc, _, i) => acc + i * i, 0);
    const denominador = n * somaX2 - somaX * somaX;
    const b = denominador !== 0 ? (n * somaXY - somaX * somaY) / denominador : 0;
    const a = n !== 0 ? (somaY - b * somaX) / n : 0;

    return evolucao.map((ponto, i) => ({
      label: ponto.label,
      valor: ponto[metrica],
      tendencia: Number((a + b * i).toFixed(2)),
    }));
  }, [evolucao, metrica]);

  const temDados = dados.some((d) => d.valor !== 0);

  return (
    <MolduraGrafico
      titulo="Evolução de 12 meses"
      descricao="Série histórica com linha de tendência"
      altura={300}
      acessorio={
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {METRICAS.map((opcao) => (
            <button
              key={opcao.chave}
              type="button"
              onClick={() => setMetrica(opcao.chave)}
              aria-pressed={metrica === opcao.chave}
              className={cn(
                'rounded-lg px-2.5 py-1 text-[11px] transition-colors',
                metrica === opcao.chave
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      }
    >
      {!temDados ? (
        <GraficoVazio mensagem="Ainda não há histórico suficiente. A série se preenche conforme os meses fecham." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
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
              tickFormatter={configuracao.formatador}
              width={68}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const ponto = payload[0]?.payload as { valor: number; tendencia: number } | undefined;
                if (!ponto) return null;
                return (
                  <CaixaTooltip
                    titulo={String(label)}
                    itens={[
                      {
                        nome: configuracao.rotulo,
                        valor: ponto.valor,
                        cor: CORES_SERIE[0],
                        formatador: configuracao.formatador,
                      },
                      {
                        nome: 'Tendência',
                        valor: ponto.tendencia,
                        cor: 'rgba(255,255,255,0.3)',
                        formatador: configuracao.formatador,
                      },
                    ]}
                  />
                );
              }}
            />

            <Line
              type="monotone"
              dataKey="tendencia"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={CORES_SERIE[0]}
              strokeWidth={2}
              dot={{ r: 3.5, fill: CORES_SERIE[0], stroke: SUPERFICIE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: CORES_SERIE[0], stroke: SUPERFICIE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </MolduraGrafico>
  );
}
