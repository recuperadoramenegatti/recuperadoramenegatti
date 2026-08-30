import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { FormularioOS } from '@/components/orcamento/formulario-os';
import { PageHeader } from '@/components/comum/page-header';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { getContextoCalculo } from '@/lib/calculos';
import { formatarDataInput } from '@/lib/formatacao';
import { idCurto } from '@/lib/utils';
import { parseInsumosExtras, type Prioridade, type TipoOS } from '@/types';
import type { EstadoOrcamento } from '@/hooks/use-orcamento';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const os = await prisma.ordemServico
    .findUnique({ where: { id: params.id }, select: { numero: true } })
    .catch(() => null);
  return { title: os ? `Editar ${os.numero}` : 'Editar orçamento' };
}

export default async function PaginaEditarOrcamento({ params }: Props): Promise<React.JSX.Element> {
  const [os, contexto, clientes] = await Promise.all([
    prisma.ordemServico.findUnique({
      where: { id: params.id },
      include: { itens: true },
    }),
    getContextoCalculo(),
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, documento: true, cidade: true },
    }),
  ]);

  if (!os) notFound();

  // Centros ausentes da OS entram zerados; centros inativos usados por ela
  // ainda aparecem, para não apagar horas já orçadas.
  const horasPorCentro: Record<string, number> = Object.fromEntries(
    contexto.centros.map((c) => [c.id, 0]),
  );
  for (const item of os.itens) {
    horasPorCentro[item.centroId] = item.horasEstimadas;
  }

  const estadoCarregado: EstadoOrcamento = {
    numero: os.numero,
    clienteId: os.clienteId,
    tipo: os.tipo as TipoOS,
    descricao: os.descricao,
    prioridade: os.prioridade as Prioridade,
    dataPrevisaoEntrega: formatarDataInput(os.dataPrevisaoEntrega),
    horasPorCentro,
    horasSetup: os.horasSetup,
    custoMateriais: os.custoMateriais,
    markupMateriais: os.markupMateriais,
    custoConsumiveis: os.custoConsumiveis,
    custoFerramentas: os.custoFerramentas,
    insumosExtras: parseInsumosExtras(os.insumosExtras).map((i) => ({ ...i, chave: idCurto() })),
    margemDesejada: os.margemDesejada,
    descontoMaximo: os.descontoMaximo,
    validadeOrcamento: os.validadeOrcamento,
    precoFinal: os.precoFinal,
    precoPecaNova: os.precoPecaNova,
    fontePrecoPecaNova: os.fontePrecoPecaNova ?? '',
    descontoTolerado: os.descontoTolerado ?? contexto.parametros.descontoToleradoPecaNova,
    observacoes: os.observacoes ?? '',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Editar ${os.numero}`}
        descricao="Ao salvar, o custo é recalculado com os parâmetros vigentes hoje."
        acoes={
          <Button asChild variant="secondary">
            <Link href={`/ordens/${os.id}`}>
              <ExternalLink className="h-4 w-4" />
              Ver detalhe da OS
            </Link>
          </Button>
        }
      />

      <FormularioOS
        contexto={contexto}
        clientesIniciais={clientes}
        numeroSugerido={os.numero}
        osId={os.id}
        estadoInicialCarregado={estadoCarregado}
      />
    </div>
  );
}
