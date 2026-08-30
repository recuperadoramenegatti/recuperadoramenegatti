/**
 * Camada de serviço das Ordens de Serviço.
 *
 * Concentra a persistência: geração de número, recálculo da precificação
 * (sempre via lib/calculos.ts), snapshot das taxas em cada item, registro
 * do log de alterações e disparo do backup incremental.
 */

import { prisma } from '@/lib/prisma';
import { getContextoCalculo, precificarOS } from '@/lib/calculos';
import { arredondar } from '@/lib/utils';
import type { SaidaOrdemServico } from '@/lib/validacoes';
import type { ContextoCalculo, EntradaCalculoOS, ResultadoPrecificacao, StatusOS } from '@/types';
import { LABEL_STATUS_OS } from '@/types';

/**
 * Gera o próximo número de OS no formato `OS-AAAA-NNNN`.
 * A numeração reinicia a cada ano.
 */
export async function proximoNumeroOS(): Promise<string> {
  const ano = new Date().getFullYear();
  const prefixo = `OS-${ano}-`;
  try {
    const ultima = await prisma.ordemServico.findFirst({
      where: { numero: { startsWith: prefixo } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const sequencial = ultima ? Number(ultima.numero.slice(prefixo.length)) + 1 : 1;
    return `${prefixo}${String(Number.isFinite(sequencial) ? sequencial : 1).padStart(4, '0')}`;
  } catch (erro) {
    console.error('[ordens] Falha ao gerar número, usando timestamp:', erro);
    return `${prefixo}${String(Date.now()).slice(-4)}`;
  }
}

/** Converte os dados validados do formulário na entrada do motor de cálculo. */
export function paraEntradaCalculo(dados: SaidaOrdemServico): EntradaCalculoOS {
  return {
    tipo: dados.tipo,
    horasSetup: dados.horasSetup,
    tempos: dados.tempos.filter((t) => t.horas > 0),
    custoMateriais: dados.custoMateriais,
    markupMateriais: dados.markupMateriais,
    custoConsumiveis: dados.custoConsumiveis,
    custoFerramentas: dados.custoFerramentas,
    insumosExtras: dados.insumosExtras,
    margemDesejada: dados.margemDesejada,
    precoPecaNova: dados.precoPecaNova,
    descontoTolerado: dados.descontoTolerado,
    precoFinal: dados.precoFinal,
  };
}

/** Campos escalares da OS derivados do cálculo. */
function camposCalculados(
  dados: SaidaOrdemServico,
  resultado: ResultadoPrecificacao,
  ctx: ContextoCalculo,
) {
  return {
    tipo: dados.tipo,
    descricao: dados.descricao,
    prioridade: dados.prioridade,
    margemDesejada: dados.margemDesejada,
    descontoMaximo: dados.descontoMaximo,
    custoTotalCalc: resultado.custo.custoTotal,
    precoMinimoCalc: resultado.precoMinimo,
    precoSugerido: resultado.precoSugerido,
    precoFinal: dados.precoFinal,
    margemReal: resultado.margemContribuicao,
    aliquotaUsada: ctx.parametros.aliquotaImpostos,
    precoPecaNova: dados.precoPecaNova,
    fontePrecoPecaNova: dados.fontePrecoPecaNova,
    descontoTolerado: dados.descontoTolerado,
    horasSetup: dados.horasSetup,
    horasEstimadas: resultado.custo.horasTotais,
    custoMateriais: dados.custoMateriais,
    markupMateriais: dados.markupMateriais,
    custoConsumiveis: dados.custoConsumiveis,
    custoFerramentas: dados.custoFerramentas,
    insumosExtras: JSON.stringify(dados.insumosExtras),
    dataPrevisaoEntrega: dados.dataPrevisaoEntrega,
    validadeOrcamento: dados.validadeOrcamento,
    observacoes: dados.observacoes,
  };
}

/** Itens por centro, com snapshot das taxas vigentes. */
function itensDoCalculo(resultado: ResultadoPrecificacao) {
  return resultado.custo.linhasCentro.map((linha) => ({
    centroId: linha.centroId,
    horasEstimadas: linha.horas,
    thhUsado: linha.thh,
    thmUsado: linha.thm,
    cfrUsado: linha.cfr,
    custoCalculado: linha.custo,
  }));
}

export interface ResultadoSalvarOS {
  id: string;
  numero: string;
  resultado: ResultadoPrecificacao;
}

/** Cria uma OS já precificada. */
export async function criarOS(
  dados: SaidaOrdemServico,
  usuario: string,
): Promise<ResultadoSalvarOS> {
  const ctx = await getContextoCalculo();
  const resultado = precificarOS(paraEntradaCalculo(dados), ctx);
  const numero = dados.numero?.trim() || (await proximoNumeroOS());

  const os = await prisma.ordemServico.create({
    data: {
      numero,
      clienteId: dados.clienteId,
      status: dados.status,
      ...camposCalculados(dados, resultado, ctx),
      itens: { create: itensDoCalculo(resultado) },
      logs: {
        create: {
          entidade: 'ordem',
          entidadeId: numero,
          acao: 'criacao',
          descricao: `OS criada com preço sugerido de R$ ${resultado.precoSugerido.toFixed(2)} e margem de ${resultado.margemContribuicao.toFixed(1)}%.`,
          usuario,
        },
      },
    },
    select: { id: true, numero: true },
  });

  return { id: os.id, numero: os.numero, resultado };
}

/** Atualiza uma OS existente, recalculando tudo com os parâmetros vigentes. */
export async function atualizarOS(
  id: string,
  dados: SaidaOrdemServico,
  usuario: string,
): Promise<ResultadoSalvarOS> {
  const ctx = await getContextoCalculo();
  const resultado = precificarOS(paraEntradaCalculo(dados), ctx);

  const anterior = await prisma.ordemServico.findUnique({
    where: { id },
    select: { numero: true, precoSugerido: true, precoFinal: true, status: true },
  });
  if (!anterior) throw new Error('Ordem de serviço não encontrada.');

  const os = await prisma.$transaction(async (tx) => {
    // Os itens são recriados: o conjunto de centros pode ter mudado.
    await tx.oSItemCentro.deleteMany({ where: { ordemId: id } });

    const atualizada = await tx.ordemServico.update({
      where: { id },
      data: {
        clienteId: dados.clienteId,
        status: dados.status,
        ...camposCalculados(dados, resultado, ctx),
        itens: { create: itensDoCalculo(resultado) },
      },
      select: { id: true, numero: true },
    });

    await tx.logAlteracao.create({
      data: {
        ordemId: id,
        entidade: 'ordem',
        entidadeId: atualizada.numero,
        acao: 'atualizacao',
        descricao:
          `OS atualizada. Preço sugerido: R$ ${anterior.precoSugerido.toFixed(2)} → ` +
          `R$ ${resultado.precoSugerido.toFixed(2)}.`,
        usuario,
      },
    });

    return atualizada;
  });

  return { id: os.id, numero: os.numero, resultado };
}

/** Datas automáticas conforme a transição de status. */
function datasDoStatus(status: StatusOS): Record<string, Date | null> {
  const agora = new Date();
  switch (status) {
    case 'finalizado':
      return { dataFinalizacao: agora };
    case 'faturado':
      return { dataFaturamento: agora };
    case 'pago':
      return { dataRecebimento: agora };
    default:
      return {};
  }
}

/** Move a OS de status, carimbando as datas correspondentes. */
export async function mudarStatusOS(
  id: string,
  status: StatusOS,
  usuario: string,
): Promise<{ id: string; status: string }> {
  const atual = await prisma.ordemServico.findUnique({
    where: { id },
    select: { numero: true, status: true, dataFinalizacao: true, dataFaturamento: true },
  });
  if (!atual) throw new Error('Ordem de serviço não encontrada.');

  const extras = datasDoStatus(status);

  // Ao pular etapas, preenche as datas anteriores para o DRE não perder a OS.
  if (status === 'faturado' && !atual.dataFinalizacao) extras.dataFinalizacao = new Date();
  if (status === 'pago') {
    if (!atual.dataFinalizacao) extras.dataFinalizacao = new Date();
    if (!atual.dataFaturamento) extras.dataFaturamento = new Date();
  }

  const atualizada = await prisma.ordemServico.update({
    where: { id },
    data: {
      status,
      ...extras,
      logs: {
        create: {
          entidade: 'ordem',
          entidadeId: atual.numero,
          acao: 'status',
          descricao: `Status alterado de "${LABEL_STATUS_OS[atual.status as StatusOS] ?? atual.status}" para "${LABEL_STATUS_OS[status]}".`,
          usuario,
        },
      },
    },
    select: { id: true, status: true },
  });

  return atualizada;
}

/** Registra as horas realizadas por centro e recalcula o total. */
export async function registrarHorasRealizadas(
  id: string,
  itens: Array<{ centroId: string; horasRealizadas: number }>,
  horasSetupRealizadas: number,
  observacoes: string | null,
  usuario: string,
): Promise<{ horasRealizadas: number; desvioPct: number }> {
  const os = await prisma.ordemServico.findUnique({
    where: { id },
    select: { numero: true, horasEstimadas: true },
  });
  if (!os) throw new Error('Ordem de serviço não encontrada.');

  const totalCentros = itens.reduce((acc, i) => acc + i.horasRealizadas, 0);
  const total = arredondar(totalCentros + horasSetupRealizadas, 2);
  const desvioPct =
    os.horasEstimadas > 0
      ? arredondar(((total - os.horasEstimadas) / os.horasEstimadas) * 100, 1)
      : 0;

  await prisma.$transaction(async (tx) => {
    for (const item of itens) {
      await tx.oSItemCentro.updateMany({
        where: { ordemId: id, centroId: item.centroId },
        data: { horasRealizadas: item.horasRealizadas },
      });
    }

    await tx.ordemServico.update({
      where: { id },
      data: {
        horasRealizadas: total,
        ...(observacoes !== null ? { observacoes } : {}),
      },
    });

    await tx.logAlteracao.create({
      data: {
        ordemId: id,
        entidade: 'ordem',
        entidadeId: os.numero,
        acao: 'atualizacao',
        descricao:
          `Horas realizadas registradas: ${total.toFixed(1)}h contra ` +
          `${os.horasEstimadas.toFixed(1)}h estimadas (desvio de ${desvioPct.toFixed(1)}%).`,
        usuario,
      },
    });
  });

  return { horasRealizadas: total, desvioPct };
}

/** Duplica uma OS como novo orçamento. */
export async function duplicarOS(id: string, usuario: string): Promise<{ id: string; numero: string }> {
  const original = await prisma.ordemServico.findUnique({
    where: { id },
    include: { itens: true },
  });
  if (!original) throw new Error('Ordem de serviço não encontrada.');

  const numero = await proximoNumeroOS();

  const nova = await prisma.ordemServico.create({
    data: {
      numero,
      clienteId: original.clienteId,
      tipo: original.tipo,
      descricao: original.descricao,
      prioridade: original.prioridade,
      status: 'orcado',
      margemDesejada: original.margemDesejada,
      descontoMaximo: original.descontoMaximo,
      custoTotalCalc: original.custoTotalCalc,
      precoMinimoCalc: original.precoMinimoCalc,
      precoSugerido: original.precoSugerido,
      precoFinal: original.precoFinal,
      margemReal: original.margemReal,
      aliquotaUsada: original.aliquotaUsada,
      precoPecaNova: original.precoPecaNova,
      fontePrecoPecaNova: original.fontePrecoPecaNova,
      descontoTolerado: original.descontoTolerado,
      horasSetup: original.horasSetup,
      horasEstimadas: original.horasEstimadas,
      custoMateriais: original.custoMateriais,
      markupMateriais: original.markupMateriais,
      custoConsumiveis: original.custoConsumiveis,
      custoFerramentas: original.custoFerramentas,
      insumosExtras: original.insumosExtras,
      validadeOrcamento: original.validadeOrcamento,
      observacoes: original.observacoes,
      itens: {
        create: original.itens.map((i) => ({
          centroId: i.centroId,
          horasEstimadas: i.horasEstimadas,
          thhUsado: i.thhUsado,
          thmUsado: i.thmUsado,
          cfrUsado: i.cfrUsado,
          custoCalculado: i.custoCalculado,
        })),
      },
      logs: {
        create: {
          entidade: 'ordem',
          entidadeId: numero,
          acao: 'criacao',
          descricao: `Duplicada a partir da OS ${original.numero}.`,
          usuario,
        },
      },
    },
    select: { id: true, numero: true },
  });

  return nova;
}
