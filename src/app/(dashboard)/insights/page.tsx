import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CentroInsights, type InsightCarregado } from '@/components/insights/centro-insights';
import { PageHeader } from '@/components/comum/page-header';
import { SkeletonGrafico } from '@/components/ui/skeleton';
import { buscarInsight, iaConfigurada } from '@/lib/ia';
import { calcularAlertas } from '@/lib/alertas';
import { formatarPeriodoExtenso, periodoAtual } from '@/lib/formatacao';

export const metadata: Metadata = { title: 'Insights' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PaginaInsights({ searchParams }: Props): React.JSX.Element {
  const bruto = searchParams.periodo;
  const periodo = (Array.isArray(bruto) ? bruto[0] : bruto) ?? periodoAtual();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Centro de Inteligência"
        descricao={`Parecer gerencial de ${formatarPeriodoExtenso(periodo)}, construído sobre os números reais da fábrica.`}
      />
      <Suspense key={periodo} fallback={<SkeletonGrafico altura={520} />}>
        <ConteudoInsights periodo={periodo} />
      </Suspense>
    </div>
  );
}

async function ConteudoInsights({ periodo }: { periodo: string }): Promise<React.JSX.Element> {
  const [insight, alertas, configurada] = await Promise.all([
    buscarInsight(periodo),
    calcularAlertas(periodo),
    iaConfigurada(),
  ]);

  const carregado: InsightCarregado | null = insight
    ? {
        id: insight.id,
        periodo: insight.periodo,
        analise: insight.analise,
        acoesConcluidas: insight.acoesConcluidas,
        modeloUsado: insight.modeloUsado,
        criadoEm: insight.criadoEm.toISOString(),
      }
    : null;

  return (
    <CentroInsights
      periodo={periodo}
      insight={carregado}
      alertas={alertas}
      iaConfigurada={configurada}
    />
  );
}
