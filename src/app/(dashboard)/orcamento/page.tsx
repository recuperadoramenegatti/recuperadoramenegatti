import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Calculator } from 'lucide-react';
import { FormularioOS } from '@/components/orcamento/formulario-os';
import { PageHeader } from '@/components/comum/page-header';
import { EmptyState } from '@/components/comum/empty-state';
import { SkeletonKPI } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/prisma';
import { getContextoCalculo } from '@/lib/calculos';
import { proximoNumeroOS } from '@/lib/ordens';
import { formatarMoeda } from '@/lib/formatacao';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Orçamento' };
export const dynamic = 'force-dynamic';

export default function PaginaOrcamento(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Simulador de Orçamento"
        descricao="O preço recalcula a cada alteração. É o mesmo cálculo que vai para o banco ao salvar."
      />
      <Suspense fallback={<EsqueletoOrcamento />}>
        <CarregarOrcamento />
      </Suspense>
    </div>
  );
}

async function CarregarOrcamento(): Promise<React.JSX.Element> {
  const [contexto, clientes, numero] = await Promise.all([
    getContextoCalculo(),
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, documento: true, cidade: true },
    }),
    proximoNumeroOS(),
  ]);

  if (contexto.centros.length === 0) {
    return (
      <EmptyState
        icone={Calculator}
        titulo="Nenhum centro de custo ativo"
        descricao="Cadastre ao menos um centro de custo (torno, fresa, solda…) para conseguir orçar um serviço."
        acao={
          <Button asChild>
            <Link href="/configuracoes">Configurar centros de custo</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <ResumoTaxas contexto={contexto} />
      <FormularioOS contexto={contexto} clientesIniciais={clientes} numeroSugerido={numero} />
    </>
  );
}

function ResumoTaxas({
  contexto,
}: {
  contexto: Awaited<ReturnType<typeof getContextoCalculo>>;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] px-4 py-2.5 text-xs">
      <span className="label-caps">Taxas vigentes</span>
      <Badge variant="secondary">THH {formatarMoeda(contexto.derivados.thh)}/h</Badge>
      <Badge variant="secondary">CFR {formatarMoeda(contexto.derivados.cfr)}/h</Badge>
      {contexto.centros.map((centro) => (
        <Badge key={centro.id} variant="outline">
          {centro.nome} {formatarMoeda(centro.custoHora)}/h
        </Badge>
      ))}
      <Link
        href="/configuracoes"
        className="ml-auto text-primary transition-colors hover:brightness-125"
      >
        Ajustar parâmetros
      </Link>
    </div>
  );
}

function EsqueletoOrcamento(): React.JSX.Element {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5">
            <div className="skeleton h-4 w-40" />
            <div className="mt-4 space-y-3">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
    </div>
  );
}
