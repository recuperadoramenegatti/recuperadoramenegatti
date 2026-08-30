/** Camada de serviço dos clientes, com as métricas de rentabilidade. */

import { prisma } from '@/lib/prisma';
import { arredondar, dividir } from '@/lib/utils';
import { getParametros, margemContribuicaoOS, precoPraticado, STATUS_RECEITA } from '@/lib/calculos';
import type { ClassificacaoCliente, ClienteComMetricas } from '@/types';

const LIMITE_PREMIUM = 10000; // R$/mês
const LIMITE_REGULAR = 2000; // R$/mês

function classificar(faturamentoMensalMedio: number): ClassificacaoCliente {
  if (faturamentoMensalMedio >= LIMITE_PREMIUM) return 'premium';
  if (faturamentoMensalMedio >= LIMITE_REGULAR) return 'regular';
  return 'esporadico';
}

/** Lista os clientes com volume, ticket médio e margem média. */
export async function listarClientesComMetricas(
  incluirInativos = false,
): Promise<ClienteComMetricas[]> {
  const parametros = await getParametros();

  const clientes = await prisma.cliente.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: 'asc' },
    include: {
      ordens: {
        where: { status: { in: [...STATUS_RECEITA] } },
        select: {
          custoTotalCalc: true,
          precoSugerido: true,
          precoFinal: true,
          aliquotaUsada: true,
          dataFinalizacao: true,
          dataFaturamento: true,
          dataOrcamento: true,
        },
      },
    },
  });

  return clientes.map((cliente) => {
    const ordens = cliente.ordens;
    const volumeFaturado = ordens.reduce((acc, o) => acc + precoPraticado(o), 0);

    const margens = ordens.map((o) =>
      margemContribuicaoOS(
        {
          id: '',
          numero: '',
          tipo: '',
          status: '',
          descricao: '',
          clienteId: cliente.id,
          custoTotalCalc: o.custoTotalCalc,
          precoSugerido: o.precoSugerido,
          precoFinal: o.precoFinal,
          margemReal: null,
          horasEstimadas: 0,
          horasRealizadas: null,
          custoMateriais: 0,
          markupMateriais: 0,
          custoConsumiveis: 0,
          custoFerramentas: 0,
          aliquotaUsada: o.aliquotaUsada,
          precoPecaNova: null,
          dataOrcamento: o.dataOrcamento,
          dataFinalizacao: o.dataFinalizacao,
          dataFaturamento: o.dataFaturamento,
          dataRecebimento: null,
        },
        parametros.aliquotaImpostos,
      ),
    );

    const datas = ordens
      .map((o) => o.dataFaturamento ?? o.dataFinalizacao ?? o.dataOrcamento)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime());

    // Meses distintos com faturamento, para não distorcer a média de um
    // cliente que comprou muito uma vez só.
    const mesesAtivos = new Set(
      datas.map((d) => `${d.getFullYear()}-${d.getMonth()}`),
    ).size;

    const faturamentoMensalMedio = arredondar(dividir(volumeFaturado, Math.max(1, mesesAtivos)));

    return {
      id: cliente.id,
      codigo: cliente.codigo,
      nome: cliente.nome,
      documento: cliente.documento,
      telefone: cliente.telefone,
      email: cliente.email,
      cidade: cliente.cidade,
      estado: cliente.estado,
      observacoes: cliente.observacoes,
      ativo: cliente.ativo,
      totalOS: ordens.length,
      volumeFaturado: arredondar(volumeFaturado),
      ticketMedio: arredondar(dividir(volumeFaturado, ordens.length)),
      margemMedia: arredondar(dividir(margens.reduce((a, b) => a + b, 0), margens.length), 1),
      ultimaOS: datas[0]?.toISOString() ?? null,
      classificacao: classificar(faturamentoMensalMedio),
      faturamentoMensalMedio,
    };
  });
}

/** Gera um código curto e legível para o cliente (MEN-0001). */
export async function proximoCodigoCliente(): Promise<string> {
  try {
    const total = await prisma.cliente.count();
    return `CLI-${String(total + 1).padStart(4, '0')}`;
  } catch {
    return `CLI-${String(Date.now()).slice(-4)}`;
  }
}
