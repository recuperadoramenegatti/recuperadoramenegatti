import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ListaClientes } from '@/components/clientes/lista-clientes';
import { PageHeader } from '@/components/comum/page-header';
import { Button } from '@/components/ui/button';
import { SkeletonTabela } from '@/components/ui/skeleton';
import { listarClientesComMetricas } from '@/lib/clientes';
import { getParametros } from '@/lib/calculos';
import { FileDown } from 'lucide-react';

export const metadata: Metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

export default function PaginaClientes(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Clientes"
        descricao="Carteira com volume, ticket médio e margem de cada cliente."
        acoes={
          <Button asChild variant="secondary">
            <a href="/api/relatorios/clientes" download>
              <FileDown className="h-4 w-4" />
              Exportar Excel
            </a>
          </Button>
        }
      />
      <Suspense fallback={<SkeletonTabela linhas={8} colunas={7} />}>
        <ConteudoClientes />
      </Suspense>
    </div>
  );
}

async function ConteudoClientes(): Promise<React.JSX.Element> {
  const [clientes, parametros] = await Promise.all([
    listarClientesComMetricas(true),
    getParametros(),
  ]);

  return <ListaClientes clientes={clientes} parametros={parametros} />;
}
