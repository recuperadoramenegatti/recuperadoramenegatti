import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FileDown } from 'lucide-react';
import { PainelGrupos } from '@/components/indicadores/painel-grupos';
import { HistogramaMargens } from '@/components/indicadores/histograma-margens';
import { EvolucaoChart } from '@/components/indicadores/evolucao-chart';
import { MargemChart } from '@/components/charts/margem-chart';
import { OcupacaoChart } from '@/components/charts/ocupacao-chart';
import { PageHeader } from '@/components/comum/page-header';
import { ErrorBoundary } from '@/components/comum/error-boundary';
import { Button } from '@/components/ui/button';
import { SkeletonGrafico, SkeletonKPI } from '@/components/ui/skeleton';
import { calcularPainelIndicadores } from '@/lib/indicadores';
import { getParametros } from '@/lib/calculos';
import { formatarPeriodoExtenso, periodoAtual } from '@/lib/formatacao';

export const metadata: Metadata = { title: 'Indicadores' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PaginaIndicadores({ searchParams }: Props): React.JSX.Element {
  const bruto = searchParams.periodo;
  const periodo = (Array.isArray(bruto) ? bruto[0] : bruto) ?? periodoAtual();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Indicadores"
        descricao={`Painel completo de ${formatarPeriodoExtenso(periodo)} — lucratividade, produtividade, precificação, finanças e risco.`}
        acoes={
          <Button asChild variant="secondary">
            <a href={`/api/relatorios/rentabilidade?periodo=${periodo}`} download>
              <FileDown className="h-4 w-4" />
              Exportar Excel
            </a>
          </Button>
        }
      />

      <Suspense key={periodo} fallback={<EsqueletoIndicadores />}>
        <ConteudoIndicadores periodo={periodo} />
      </Suspense>
    </div>
  );
}

async function ConteudoIndicadores({ periodo }: { periodo: string }): Promise<React.JSX.Element> {
  const [painel, parametros] = await Promise.all([
    calcularPainelIndicadores(periodo),
    getParametros(),
  ]);

  return (
    <div className="space-y-6">
      <ErrorBoundary titulo="Não foi possível montar a evolução histórica">
        <EvolucaoChart evolucao={painel.evolucao} />
      </ErrorBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        <ErrorBoundary titulo="Não foi possível montar o histograma">
          <HistogramaMargens faixas={painel.histogramaMargens} parametros={parametros} />
        </ErrorBoundary>

        <ErrorBoundary titulo="Não foi possível montar a margem por tipo">
          <MargemChart dados={painel.margemPorTipo} parametros={parametros} />
        </ErrorBoundary>
      </div>

      <ErrorBoundary titulo="Não foi possível montar a ocupação">
        <OcupacaoChart centros={painel.ocupacaoCentros} ociosidadeAlvo={parametros.ociosidadePct} />
      </ErrorBoundary>

      <PainelGrupos grupos={painel.grupos} />
    </div>
  );
}

function EsqueletoIndicadores(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <SkeletonGrafico altura={340} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonGrafico altura={300} />
        <SkeletonGrafico altura={300} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <SkeletonKPI key={i} />
        ))}
      </div>
    </div>
  );
}
