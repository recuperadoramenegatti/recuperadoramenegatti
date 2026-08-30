'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Clock, Loader2, Percent, Target, TrendingUp, Wallet } from 'lucide-react';
import { SemaforoMargem } from '@/components/orcamento/semaforo-margem';
import { ComparativoPecaNova } from '@/components/orcamento/comparativo-peca-nova';
import { MoedaAnimada } from '@/components/comum/numero-animado';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, dividir } from '@/lib/utils';
import { formatarHoras, formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import type { ParametrosBase, ResultadoPrecificacao } from '@/types';

interface Props {
  resultado: ResultadoPrecificacao;
  parametros: ParametrosBase;
  calculando: boolean;
  descontoMaximo: number;
  className?: string;
}

interface FatiaCusto {
  rotulo: string;
  valor: number;
  cor: string;
  descricao: string;
}

/**
 * Painel de resultado do orçamento — atualiza a cada alteração no formulário
 * (com 300 ms de debounce).
 */
export function ResultadoTempoReal({
  resultado,
  parametros,
  calculando,
  descontoMaximo,
  className,
}: Props): React.JSX.Element {
  const { custo } = resultado;

  const fatias: FatiaCusto[] = [
    {
      rotulo: 'Mão de obra + máquina',
      valor: custo.custoMaoDeObraMaquina,
      cor: 'bg-gradient-hero',
      descricao: 'Horas × (THH + THM do centro), incluindo o setup.',
    },
    {
      rotulo: 'Insumos e materiais',
      valor: custo.custoInsumosTotal,
      cor: 'bg-gradient-azul',
      descricao: 'Materiais com markup, consumíveis, ferramentas e itens extras.',
    },
    {
      rotulo: 'Overhead (CFR)',
      valor: custo.custoOverhead,
      cor: 'bg-gradient-ia',
      descricao: 'Custo fixo indireto rateado sobre todas as horas da OS.',
    },
  ];

  const corPreco =
    resultado.classificacao === 'critica'
      ? 'gradient-text-alerta'
      : resultado.classificacao === 'baixa'
        ? 'gradient-text-hero'
        : 'gradient-text-sucesso';

  const semDados = custo.horasTotais <= 0 && custo.custoInsumosTotal <= 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Preço sugerido ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-6 shadow-card backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(400px circle at 80% 0%, rgba(245,158,11,0.16), transparent 65%)',
          }}
        />

        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="label-caps">Preço sugerido ao cliente</span>
            {calculando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Recalculando" />
            ) : null}
          </div>

          <motion.div
            key={resultado.precoFinal}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-2"
          >
            <span className={cn('text-4xl font-bold tracking-tight tabular-nums', corPreco)}>
              <MoedaAnimada valor={resultado.precoFinal} />
            </span>
          </motion.div>

          {descontoMaximo > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Piso de negociação com {formatarPercentual(descontoMaximo, 0)} de desconto:{' '}
              <span className="font-medium text-foreground">
                {formatarMoeda(resultado.precoComDescontoMaximo)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Composição do custo ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
        <h3 className="label-caps mb-4">Composição do custo</h3>

        {semDados ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Informe as horas de trabalho e os insumos para ver a composição do custo.
          </p>
        ) : (
          <div className="space-y-3">
            {fatias.map((fatia) => {
              const percentual = dividir(fatia.valor, custo.custoTotal) * 100;
              return (
                <Tooltip key={fatia.rotulo}>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{fatia.rotulo}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="font-medium">{formatarMoeda(fatia.valor)}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {formatarPercentual(percentual, 0)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--superficie-4)]">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', fatia.cor)}
                          style={{ width: `${Math.min(100, Math.max(0, percentual))}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">{fatia.descricao}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        <Separator className="my-4" />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Custo total da OS</dt>
            <dd className="font-semibold tabular-nums">{formatarMoeda(custo.custoTotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              Margem desejada ({formatarPercentual(resultado.margemDesejada, 0)})
            </dt>
            <dd className="tabular-nums">
              {formatarMoeda(resultado.precoMinimo - custo.custoTotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Preço mínimo (antes de impostos)</dt>
            <dd className="tabular-nums">{formatarMoeda(resultado.precoMinimo)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              Impostos ({formatarPercentual(resultado.aliquota, 1)})
            </dt>
            <dd className="tabular-nums text-red-400">
              {formatarMoeda(resultado.valorImpostos)}
            </dd>
          </div>

          <Separator className="my-2" />

          <div className="flex justify-between gap-3 text-base">
            <dt className="font-semibold">Preço final ao cliente</dt>
            <dd className="font-bold tabular-nums text-primary">
              {formatarMoeda(resultado.precoFinal)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Semáforo ───────────────────────────────────────────────────── */}
      <SemaforoMargem
        margem={resultado.margemContribuicao}
        classificacao={resultado.classificacao}
        parametros={parametros}
      />

      {/* ── Métricas secundárias ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <MetricaSecundaria
          icone={Wallet}
          rotulo="Lucro estimado"
          valor={formatarMoeda(resultado.lucroEstimado)}
          destaque={resultado.lucroEstimado > 0 ? 'positivo' : 'negativo'}
          dica="Preço final menos custo total e impostos."
        />
        <MetricaSecundaria
          icone={Percent}
          rotulo="Margem bruta"
          valor={formatarPercentual(resultado.margemReal)}
          dica="(Preço − custo) ÷ preço, antes dos impostos. Sempre maior que a margem de contribuição."
        />
        <MetricaSecundaria
          icone={Clock}
          rotulo="Total de horas"
          valor={formatarHoras(custo.horasTotais)}
          dica={`${formatarHoras(custo.horasProducao)} de produção + ${formatarHoras(custo.horasSetup)} de setup.`}
        />
        <MetricaSecundaria
          icone={Target}
          rotulo="Equilíbrio desta OS"
          valor={formatarHoras(resultado.horasEquilibrio)}
          dica="Horas em que a receita líquida desta OS cobre exatamente o próprio custo."
        />
      </div>

      {/* ── Comparativo com peça nova ──────────────────────────────────── */}
      <ComparativoPecaNova comparativo={resultado.comparativoPecaNova} />

      {/* ── Detalhe por centro ─────────────────────────────────────────── */}
      {custo.linhasCentro.length > 0 ? (
        <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
          <h3 className="label-caps mb-3 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            Custo por centro
          </h3>
          <ul className="space-y-2 text-sm">
            {custo.linhasCentro.map((linha) => (
              <li key={linha.centroId} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  {linha.nome}
                  <span className="ml-1.5 text-xs">
                    {formatarHoras(linha.horas)} × {formatarMoeda(linha.custoHora)}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatarMoeda(linha.custo)}
                </span>
              </li>
            ))}
            {custo.horasSetup > 0 ? (
              <li className="flex items-baseline justify-between gap-3 border-t border-[var(--borda-1)] pt-2">
                <span className="text-muted-foreground">
                  Setup / preparação
                  <span className="ml-1.5 text-xs">{formatarHoras(custo.horasSetup)}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatarMoeda(custo.custoSetup)}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MetricaSecundaria({
  icone: Icone,
  rotulo,
  valor,
  dica,
  destaque,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  dica: string;
  destaque?: 'positivo' | 'negativo';
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Icone className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">{rotulo}</span>
          </div>
          <div
            className={cn(
              'mt-1 text-lg font-semibold tabular-nums',
              destaque === 'positivo' && 'text-emerald-400',
              destaque === 'negativo' && 'text-red-400',
            )}
          >
            {valor}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">{dica}</TooltipContent>
    </Tooltip>
  );
}
