import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KPICard } from '@/components/dashboard/kpi-card';
import { AlertsFeed } from '@/components/dashboard/alerts-feed';
import { OSRecentesTable, type LinhaOSRecente } from '@/components/dashboard/os-recentes-table';
import { FaturamentoChart } from '@/components/charts/faturamento-chart';
import { MargemChart } from '@/components/charts/margem-chart';
import { ComposicaoChart } from '@/components/charts/composicao-chart';
import { OcupacaoChart } from '@/components/charts/ocupacao-chart';
import { PageHeader } from '@/components/comum/page-header';
import { ErrorBoundary } from '@/components/comum/error-boundary';
import { SkeletonKPI, SkeletonGrafico } from '@/components/ui/skeleton';
import { prisma } from '@/lib/prisma';
import {
  buscarOSDoPeriodo,
  calcularComposicaoCusto,
  calcularKPIs,
  calcularMargemPorTipo,
  calcularOcupacaoCentros,
  calcularSerieMensal,
  getContextoCalculo,
  margemContribuicaoOS,
  precoPraticado,
  resumirPeriodo,
} from '@/lib/calculos';
import { calcularAlertas } from '@/lib/alertas';
import {
  capitalizarPrimeira,
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  formatarPeriodoExtenso,
  periodoAtual,
} from '@/lib/formatacao';
import type { ClassificacaoMargem, KPIsDashboard } from '@/types';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default function PaginaDashboard(): React.JSX.Element {
  const periodo = periodoAtual();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dashboard executivo"
        descricao={`Visão consolidada de ${formatarPeriodoExtenso(periodo)}`}
      />
      <Suspense fallback={<EsqueletoDashboard />}>
        <ConteudoDashboard periodo={periodo} />
      </Suspense>
    </div>
  );
}

async function ConteudoDashboard({ periodo }: { periodo: string }): Promise<React.JSX.Element> {
  const ctx = await getContextoCalculo();

  const [kpis, serie, ocupacao, alertas, ordensPeriodo, recentes] = await Promise.all([
    calcularKPIs(periodo, ctx),
    calcularSerieMensal(periodo, 6, ctx),
    calcularOcupacaoCentros(periodo, ctx),
    calcularAlertas(periodo, ctx),
    buscarOSDoPeriodo(periodo),
    prisma.ordemServico.findMany({
      orderBy: { dataOrcamento: 'desc' },
      take: 10,
      include: { cliente: { select: { nome: true } } },
    }),
  ]);

  const resumo = resumirPeriodo(periodo, ordensPeriodo, ctx.parametros, ctx.derivados);

  const linhasRecentes: LinhaOSRecente[] = recentes.map((os) => ({
    id: os.id,
    numero: os.numero,
    clienteNome: os.cliente.nome,
    tipo: os.tipo,
    status: os.status,
    horas: os.horasRealizadas ?? os.horasEstimadas,
    custo: os.custoTotalCalc,
    preco: precoPraticado(os),
    margem: margemContribuicaoOS(
      { ...os, descricao: os.descricao },
      ctx.parametros.aliquotaImpostos,
    ),
    data: os.dataOrcamento,
  }));

  return (
    <div className="space-y-6">
      <LinhaKPIs kpis={kpis} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ErrorBoundary titulo="Não foi possível montar o gráfico de faturamento">
            <FaturamentoChart serie={serie} />
          </ErrorBoundary>

          <div className="grid gap-6 lg:grid-cols-2">
            <ErrorBoundary titulo="Não foi possível montar o gráfico de margens">
              <MargemChart
                dados={calcularMargemPorTipo(ordensPeriodo, ctx.parametros)}
                parametros={ctx.parametros}
              />
            </ErrorBoundary>

            <ErrorBoundary titulo="Não foi possível montar a composição de custo">
              <ComposicaoChart composicao={calcularComposicaoCusto(resumo)} />
            </ErrorBoundary>
          </div>

          <ErrorBoundary titulo="Não foi possível montar a ocupação dos centros">
            <OcupacaoChart centros={ocupacao} ociosidadeAlvo={ctx.parametros.ociosidadePct} />
          </ErrorBoundary>
        </div>

        <ErrorBoundary titulo="Não foi possível carregar os alertas">
          <AlertsFeed alertas={alertas} />
        </ErrorBoundary>
      </div>

      <OSRecentesTable ordens={linhasRecentes} parametros={ctx.parametros} />
    </div>
  );
}

const ROTULO_CLASSIFICACAO: Record<ClassificacaoMargem, string> = {
  critica: 'Crítica',
  baixa: 'Baixa',
  boa: 'Boa',
  excelente: 'Excelente',
};

function LinhaKPIs({ kpis }: { kpis: KPIsDashboard }): React.JSX.Element {
  const { breakEven } = kpis;

  const rotuloEquilibrio =
    breakEven.status === 'coberto'
      ? 'Coberto'
      : breakEven.status === 'em_risco'
        ? 'Em risco'
        : 'Não coberto';

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KPICard
        rotulo="Faturamento do mês"
        valor={kpis.faturamento.atual}
        formato="moeda"
        icone="faturamento"
        tom="ambar"
        variacaoPct={kpis.faturamento.variacaoPct}
        progresso={kpis.percentualMeta}
        progressoRotulo={`${formatarPercentual(kpis.percentualMeta, 0)} da meta de ${formatarMoeda(kpis.metaFaturamento)}`}
        href="/financeiro/dre"
        dica="Receita das OS finalizadas ou faturadas no mês, comparada ao mês anterior."
      />

      <KPICard
        rotulo="Margem de contribuição"
        valor={kpis.margemContribuicao.atual}
        formato="percentual"
        icone="margem"
        tom={
          kpis.classificacaoMargem === 'critica'
            ? 'vermelho'
            : kpis.classificacaoMargem === 'baixa'
              ? 'ambar'
              : 'verde'
        }
        variacaoPct={kpis.margemContribuicao.variacaoPct}
        classificacao={ROTULO_CLASSIFICACAO[kpis.classificacaoMargem]}
        href="/indicadores"
        dica="Sobre a receita líquida, já descontados os impostos — mesma base do DRE e do orçamento."
      />

      <KPICard
        rotulo="EBITDA estimado"
        valor={kpis.ebitda.atual}
        formato="moeda"
        icone="ebitda"
        tom={kpis.ebitda.atual >= 0 ? 'azul' : 'vermelho'}
        variacaoPct={kpis.ebitda.variacaoPct}
        legenda={`${formatarPercentual(kpis.ebitdaPct)} da receita`}
        href="/financeiro/dre"
        dica="Resultado operacional antes de depreciação, incluindo o custo da capacidade ociosa."
      />

      <KPICard
        rotulo="OS finalizadas"
        valor={kpis.osFinalizadas.atual}
        formato="numero"
        icone="ordens"
        tom="roxo"
        variacaoPct={kpis.osFinalizadas.variacaoPct}
        legenda={`média histórica: ${formatarNumero(kpis.mediaHistoricaOS, 1)}`}
        href="/ordens"
        dica="Ordens finalizadas, faturadas ou pagas no mês, contra a média dos 12 meses anteriores."
      />

      <KPICard
        rotulo="Ponto de equilíbrio"
        valor={breakEven.pontoEquilibrioReceita}
        formato="moeda"
        icone="equilibrio"
        tom={
          breakEven.status === 'coberto'
            ? 'verde'
            : breakEven.status === 'em_risco'
              ? 'ambar'
              : 'vermelho'
        }
        classificacao={rotuloEquilibrio}
        progresso={Math.min(100, breakEven.indiceCobertura * 100)}
        progressoRotulo={`cobertura de ${formatarPercentual(breakEven.indiceCobertura * 100, 0)}`}
        href="/indicadores"
        dica="Faturamento bruto necessário para zerar o EBITDA, dados os custos fixos e o consumo de insumos."
      />
    </div>
  );
}

function EsqueletoDashboard(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SkeletonGrafico altura={340} />
          <div className="grid gap-6 lg:grid-cols-2">
            <SkeletonGrafico altura={300} />
            <SkeletonGrafico altura={300} />
          </div>
        </div>
        <SkeletonGrafico altura={520} />
      </div>
      <SkeletonGrafico altura={420} />
    </div>
  );
}
