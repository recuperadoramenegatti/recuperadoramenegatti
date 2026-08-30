import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Info } from 'lucide-react';
import { TabelaDRE } from '@/components/dre/tabela-dre';
import { ControlesDRE } from '@/components/dre/controles-dre';
import { WaterfallDRE } from '@/components/charts/waterfall-dre';
import { PageHeader } from '@/components/comum/page-header';
import { ErrorBoundary } from '@/components/comum/error-boundary';
import { SkeletonGrafico, SkeletonTabela } from '@/components/ui/skeleton';
import { calcularDRE, calcularDREComparativo, calcularWaterfall } from '@/lib/dre';
import { formatarMoeda, formatarPercentual, periodoAtual } from '@/lib/formatacao';
import type { Regime, ResultadoDRE } from '@/types';

export const metadata: Metadata = { title: 'DRE Gerencial' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function texto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default function PaginaDRE({ searchParams }: Props): React.JSX.Element {
  const periodo = texto(searchParams.periodo) ?? periodoAtual();
  const regime: Regime = texto(searchParams.regime) === 'caixa' ? 'caixa' : 'competencia';
  const comparativo = texto(searchParams.comparativo) === 'true';

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="DRE Gerencial"
        descricao={
          regime === 'caixa'
            ? 'Regime de caixa: a receita entra na data em que o dinheiro foi recebido.'
            : 'Regime de competência: a receita entra no mês em que o serviço foi faturado.'
        }
      />

      <ControlesDRE periodo={periodo} regime={regime} comparativo={comparativo} />

      <Suspense key={`${periodo}-${regime}-${comparativo}`} fallback={<EsqueletoDRE />}>
        <ConteudoDRE periodo={periodo} regime={regime} comparativo={comparativo} />
      </Suspense>
    </div>
  );
}

async function ConteudoDRE({
  periodo,
  regime,
  comparativo,
}: {
  periodo: string;
  regime: Regime;
  comparativo: boolean;
}): Promise<React.JSX.Element> {
  let dre: ResultadoDRE;
  let anterior: ResultadoDRE | null = null;
  let anoAnterior: ResultadoDRE | null = null;

  if (comparativo) {
    const dados = await calcularDREComparativo(periodo, regime);
    dre = dados.atual;
    anterior = dados.anterior;
    anoAnterior = dados.anoAnterior;
  } else {
    dre = await calcularDRE(periodo, regime);
  }

  const semMovimento = dre.receitaBruta === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard
          rotulo="Receita bruta"
          valor={formatarMoeda(dre.receitaBruta)}
          detalhe={`${formatarMoeda(dre.receitaLiquida)} líquidos`}
          tom="ambar"
        />
        <ResumoCard
          rotulo="Margem de contribuição"
          valor={formatarMoeda(dre.margemContribuicao)}
          detalhe={`${formatarPercentual(dre.margemContribuicaoPct)} da receita líquida`}
          tom={dre.margemContribuicao >= 0 ? 'verde' : 'vermelho'}
        />
        <ResumoCard
          rotulo="EBITDA"
          valor={formatarMoeda(dre.ebitda)}
          detalhe={`${formatarPercentual(dre.ebitdaPct)} da receita bruta`}
          tom={dre.ebitda >= 0 ? 'azul' : 'vermelho'}
        />
        <ResumoCard
          rotulo="Lucro líquido"
          valor={formatarMoeda(dre.lucroLiquido)}
          detalhe={`lucratividade de ${formatarPercentual(dre.lucratividade)}`}
          tom={dre.lucroLiquido >= 0 ? 'verde' : 'vermelho'}
        />
      </div>

      {semMovimento ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Nenhuma receita reconhecida neste período</p>
            <p className="mt-0.5 text-muted-foreground">
              {regime === 'caixa'
                ? 'No regime de caixa, a OS só entra quando o recebimento é registrado — mude o status para "Pago" nas OS já recebidas.'
                : 'No regime de competência, a OS entra quando é finalizada ou faturada. Os custos fixos aparecem mesmo assim, porque incorrem de qualquer forma.'}
            </p>
          </div>
        </div>
      ) : null}

      <ErrorBoundary titulo="Não foi possível montar o waterfall">
        <WaterfallDRE passos={calcularWaterfall(dre)} />
      </ErrorBoundary>

      <TabelaDRE dre={dre} anterior={anterior} anoAnterior={anoAnterior} />
    </div>
  );
}

function ResumoCard({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  tom: 'ambar' | 'azul' | 'verde' | 'vermelho';
}): React.JSX.Element {
  const gradientes = {
    ambar: 'gradient-text-hero',
    azul: 'bg-gradient-azul bg-clip-text text-transparent',
    verde: 'gradient-text-sucesso',
    vermelho: 'gradient-text-alerta',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
      <span className="label-caps">{rotulo}</span>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${gradientes[tom]}`}>
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}

function EsqueletoDRE(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-8 w-32" />
            <div className="skeleton mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <SkeletonGrafico altura={360} />
      <SkeletonTabela linhas={12} colunas={4} />
    </div>
  );
}
