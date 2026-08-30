import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { comSessao, lerJson, ok } from '@/lib/api';
import { schemaFiltrosOS, schemaOrdemServico } from '@/lib/validacoes';
import { criarOS } from '@/lib/ordens';
import { getParametros, margemContribuicaoOS, precoPraticado } from '@/lib/calculos';
import { agendarBackupIncremental } from '@/lib/backup';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/** GET — lista de OS com filtros avançados e paginação. */
export async function GET(request: Request): Promise<NextResponse> {
  return comSessao(async () => {
    const url = new URL(request.url);
    const filtros = schemaFiltrosOS.parse(Object.fromEntries(url.searchParams));
    const parametros = await getParametros();

    const where: Prisma.OrdemServicoWhereInput = {};

    if (filtros.busca) {
      where.OR = [
        { numero: { contains: filtros.busca } },
        { descricao: { contains: filtros.busca } },
        { cliente: { nome: { contains: filtros.busca } } },
      ];
    }
    if (filtros.status) where.status = { in: filtros.status.split(',') };
    if (filtros.tipo) where.tipo = { in: filtros.tipo.split(',') };
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    if (filtros.centroId) where.itens = { some: { centroId: filtros.centroId } };

    if (filtros.dataInicio || filtros.dataFim) {
      where.dataOrcamento = {};
      if (filtros.dataInicio) where.dataOrcamento.gte = new Date(filtros.dataInicio);
      if (filtros.dataFim) {
        const fim = new Date(filtros.dataFim);
        fim.setHours(23, 59, 59, 999);
        where.dataOrcamento.lte = fim;
      }
    }

    const [total, registros] = await Promise.all([
      prisma.ordemServico.count({ where }),
      prisma.ordemServico.findMany({
        where,
        orderBy: { dataOrcamento: 'desc' },
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
        include: {
          cliente: { select: { id: true, nome: true } },
          itens: { select: { centroId: true, horasEstimadas: true, horasRealizadas: true } },
        },
      }),
    ]);

    // Margem e valor são derivados — filtrados após o cálculo.
    let ordens = registros.map((os) => ({
      ...os,
      precoPraticado: precoPraticado(os),
      margem: margemContribuicaoOS(
        { ...os, descricao: os.descricao },
        parametros.aliquotaImpostos,
      ),
    }));

    if (filtros.margemMin !== undefined) ordens = ordens.filter((o) => o.margem >= filtros.margemMin!);
    if (filtros.margemMax !== undefined) ordens = ordens.filter((o) => o.margem <= filtros.margemMax!);
    if (filtros.valorMin !== undefined) ordens = ordens.filter((o) => o.precoPraticado >= filtros.valorMin!);
    if (filtros.valorMax !== undefined) ordens = ordens.filter((o) => o.precoPraticado <= filtros.valorMax!);

    return ok({
      ordens,
      total,
      pagina: filtros.pagina,
      porPagina: filtros.porPagina,
      totalPaginas: Math.max(1, Math.ceil(total / filtros.porPagina)),
    });
  });
}

/** POST — cria uma OS/orçamento já precificada. */
export async function POST(request: Request): Promise<NextResponse> {
  return comSessao(async (usuario) => {
    const dados = schemaOrdemServico.parse(await lerJson(request));
    const criada = await criarOS(dados, usuario.email);

    // Backup incremental a cada OS salva — não bloqueia a resposta.
    void agendarBackupIncremental();

    revalidatePath('/ordens');
    revalidatePath('/dashboard');
    return ok(criada, 201);
  });
}
