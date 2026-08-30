import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Kanban, type CartaoOS } from '@/components/ordens/kanban';
import { TabelaOrdens } from '@/components/ordens/tabela-ordens';
import { FiltrosOrdens } from '@/components/ordens/filtros-ordens';
import { PageHeader } from '@/components/comum/page-header';
import { Button } from '@/components/ui/button';
import { SkeletonTabela } from '@/components/ui/skeleton';
import { prisma } from '@/lib/prisma';
import { getContextoCalculo, margemContribuicaoOS, precoPraticado } from '@/lib/calculos';
import type { Prisma } from '@prisma/client';

export const metadata: Metadata = { title: 'Ordens de Serviço' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function texto(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor && valor !== 'todos' ? valor : undefined;
}

function numero(valor: string | string[] | undefined): number | undefined {
  const t = texto(valor);
  if (t === undefined) return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export default function PaginaOrdens({ searchParams }: Props): React.JSX.Element {
  const visao = texto(searchParams.visao) === 'tabela' ? 'tabela' : 'kanban';

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Ordens de Serviço"
        descricao="Arraste os cartões para mover a OS de etapa. Toda mudança fica registrada no histórico."
        acoes={
          <Button asChild>
            <Link href="/orcamento">
              <Plus className="h-4 w-4" />
              Novo orçamento
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<SkeletonTabela linhas={8} colunas={6} />}>
        <ConteudoOrdens searchParams={searchParams} visao={visao} />
      </Suspense>
    </div>
  );
}

async function ConteudoOrdens({
  searchParams,
  visao,
}: Props & { visao: 'kanban' | 'tabela' }): Promise<React.JSX.Element> {
  const ctx = await getContextoCalculo();

  const where: Prisma.OrdemServicoWhereInput = {};

  const busca = texto(searchParams.busca);
  if (busca) {
    where.OR = [
      { numero: { contains: busca } },
      { descricao: { contains: busca } },
      { cliente: { nome: { contains: busca } } },
    ];
  }

  const status = texto(searchParams.status);
  if (status) where.status = status;

  const tipo = texto(searchParams.tipo);
  if (tipo) where.tipo = tipo;

  const clienteId = texto(searchParams.clienteId);
  if (clienteId) where.clienteId = clienteId;

  const centroId = texto(searchParams.centroId);
  if (centroId) where.itens = { some: { centroId } };

  const dataInicio = texto(searchParams.dataInicio);
  const dataFim = texto(searchParams.dataFim);
  if (dataInicio || dataFim) {
    where.dataOrcamento = {};
    if (dataInicio) where.dataOrcamento.gte = new Date(dataInicio);
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      where.dataOrcamento.lte = fim;
    }
  }

  const [registros, clientes] = await Promise.all([
    prisma.ordemServico.findMany({
      where,
      orderBy: { dataOrcamento: 'desc' },
      take: 400,
      include: { cliente: { select: { nome: true } } },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Margem e valor são derivados — filtrados depois do cálculo.
  const margemMin = numero(searchParams.margemMin);
  const margemMax = numero(searchParams.margemMax);
  const valorMin = numero(searchParams.valorMin);
  const valorMax = numero(searchParams.valorMax);

  const ordens: CartaoOS[] = registros
    .map((os) => ({
      id: os.id,
      numero: os.numero,
      clienteNome: os.cliente.nome,
      tipo: os.tipo,
      status: os.status,
      prioridade: os.prioridade,
      preco: precoPraticado(os),
      margem: margemContribuicaoOS(
        { ...os, descricao: os.descricao },
        ctx.parametros.aliquotaImpostos,
      ),
      horasEstimadas: os.horasEstimadas,
      horasRealizadas: os.horasRealizadas,
      dataPrevisaoEntrega: os.dataPrevisaoEntrega?.toISOString() ?? null,
      atrasada:
        os.dataPrevisaoEntrega !== null &&
        os.dataPrevisaoEntrega < hoje &&
        !['finalizado', 'faturado', 'pago', 'cancelado'].includes(os.status),
    }))
    .filter((os) => {
      if (margemMin !== undefined && os.margem < margemMin) return false;
      if (margemMax !== undefined && os.margem > margemMax) return false;
      if (valorMin !== undefined && os.preco < valorMin) return false;
      if (valorMax !== undefined && os.preco > valorMax) return false;
      return true;
    });

  return (
    <div className="space-y-4">
      <FiltrosOrdens
        clientes={clientes}
        centros={ctx.centros.map((c) => ({ id: c.id, nome: c.nome }))}
        visao={visao}
        total={ordens.length}
      />

      {visao === 'kanban' ? (
        <Kanban ordens={ordens} parametros={ctx.parametros} />
      ) : (
        <TabelaOrdens ordens={ordens} parametros={ctx.parametros} />
      )}
    </div>
  );
}
