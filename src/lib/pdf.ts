/**
 * Montagem dos dados e renderização do PDF do orçamento.
 * Server-only — o @react-pdf/renderer nunca vai para o bundle do cliente.
 */

import * as React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { prisma } from '@/lib/prisma';
import { getConfigs, getContextoCalculo, precificarOS, precoPraticado } from '@/lib/calculos';
import { paraEntradaCalculo } from '@/lib/ordens';
import { calcularComparativoPecaNova } from '@/lib/precificacao';
import { formatarDocumento, formatarTelefone } from '@/lib/formatacao';
import { parseInsumosExtras, type TipoOS } from '@/types';
import {
  OrcamentoPDF,
  type DadosEmpresaPDF,
  type DadosOrcamentoPDF,
} from '@/components/pdf/orcamento-pdf';
import type { SaidaOrdemServico } from '@/lib/validacoes';

/**
 * `renderToBuffer` exige `ReactElement<DocumentProps>`, mas nosso componente
 * declara props próprias — o elemento é um `<Document>` válido em tempo de
 * execução, e a asserção apenas informa isso ao compilador.
 */
function renderizar(empresa: DadosEmpresaPDF, orcamento: DadosOrcamentoPDF): Promise<Buffer> {
  const elemento = React.createElement(OrcamentoPDF, {
    empresa,
    orcamento,
  }) as React.ReactElement<DocumentProps>;
  return renderToBuffer(elemento);
}

const CHAVES_EMPRESA = [
  'empresaNome',
  'empresaCnpj',
  'empresaEndereco',
  'empresaTelefone',
  'empresaEmail',
  'empresaLogo',
  'empresaSetor',
];

export async function dadosEmpresaPDF(): Promise<DadosEmpresaPDF> {
  const cfg = await getConfigs(CHAVES_EMPRESA);
  const logo = cfg.empresaLogo ?? '';
  return {
    nome: cfg.empresaNome || 'Recuperadora Menegatti',
    cnpj: cfg.empresaCnpj ? formatarDocumento(cfg.empresaCnpj) : '',
    endereco: cfg.empresaEndereco ?? '',
    telefone: cfg.empresaTelefone ? formatarTelefone(cfg.empresaTelefone) : '',
    email: cfg.empresaEmail ?? '',
    // Apenas data URLs de imagem: um caminho externo travaria a renderização.
    logo: logo.startsWith('data:image/') ? logo : '',
    setor: cfg.empresaSetor ?? '',
  };
}

/** PDF a partir dos dados do formulário, sem OS salva. */
export async function pdfDeFormulario(
  dados: SaidaOrdemServico,
  numeroSugerido: string,
): Promise<Buffer> {
  const ctx = await getContextoCalculo();
  const resultado = precificarOS(paraEntradaCalculo(dados), ctx);

  const cliente = await prisma.cliente.findUnique({
    where: { id: dados.clienteId },
    select: { nome: true, documento: true, cidade: true, estado: true, telefone: true },
  });

  const nomePorCentro = new Map(ctx.centros.map((c) => [c.id, c.nome]));
  const itens = resultado.custo.linhasCentro.map((linha) => ({
    nome: nomePorCentro.get(linha.centroId) ?? 'Centro de custo',
    horas: linha.horas,
  }));
  if (resultado.custo.horasSetup > 0) {
    itens.push({ nome: 'Setup e preparação', horas: resultado.custo.horasSetup });
  }

  const orcamento: DadosOrcamentoPDF = {
    numero: dados.numero?.trim() || numeroSugerido,
    tipo: dados.tipo,
    descricao: dados.descricao,
    clienteNome: cliente?.nome ?? 'Cliente não identificado',
    clienteDocumento: cliente?.documento ? formatarDocumento(cliente.documento) : null,
    clienteCidade: cliente
      ? [cliente.cidade, cliente.estado].filter(Boolean).join(' / ') || null
      : null,
    clienteTelefone: cliente?.telefone ? formatarTelefone(cliente.telefone) : null,
    dataOrcamento: new Date().toISOString(),
    dataPrevisaoEntrega: dados.dataPrevisaoEntrega?.toISOString() ?? null,
    validadeDias: dados.validadeOrcamento,
    horasTotais: resultado.custo.horasTotais,
    precoFinal: resultado.precoFinal,
    descontoMaximo: dados.descontoMaximo,
    precoComDesconto: resultado.precoComDescontoMaximo,
    observacoesCliente: null,
    comparativo: resultado.comparativoPecaNova,
    itens,
  };

  return renderizar(await dadosEmpresaPDF(), orcamento);
}

/** PDF de uma OS já salva. */
export async function pdfDeOS(id: string): Promise<Buffer | null> {
  const os = await prisma.ordemServico.findUnique({
    where: { id },
    include: { cliente: true, itens: { include: { centro: true } } },
  });
  if (!os) return null;

  const ctx = await getContextoCalculo();
  const preco = precoPraticado(os);

  const itens = os.itens
    .filter((i) => i.horasEstimadas > 0)
    .map((i) => ({ nome: i.centro.nome, horas: i.horasEstimadas }));
  if (os.horasSetup > 0) {
    itens.push({ nome: 'Setup e preparação', horas: os.horasSetup });
  }

  const comparativo =
    os.tipo === 'recuperacao'
      ? calcularComparativoPecaNova(
          preco,
          os.precoPecaNova,
          os.descontoTolerado ?? ctx.parametros.descontoToleradoPecaNova,
          ctx.parametros,
        )
      : null;

  const orcamento: DadosOrcamentoPDF = {
    numero: os.numero,
    tipo: os.tipo as TipoOS,
    descricao: os.descricao,
    clienteNome: os.cliente.nome,
    clienteDocumento: os.cliente.documento ? formatarDocumento(os.cliente.documento) : null,
    clienteCidade: [os.cliente.cidade, os.cliente.estado].filter(Boolean).join(' / ') || null,
    clienteTelefone: os.cliente.telefone ? formatarTelefone(os.cliente.telefone) : null,
    dataOrcamento: os.dataOrcamento.toISOString(),
    dataPrevisaoEntrega: os.dataPrevisaoEntrega?.toISOString() ?? null,
    validadeDias: os.validadeOrcamento,
    horasTotais: os.horasEstimadas,
    precoFinal: preco,
    descontoMaximo: os.descontoMaximo,
    precoComDesconto: preco * (1 - os.descontoMaximo / 100),
    // Itens extras aparecem como condição comercial, sem revelar custo interno.
    observacoesCliente:
      parseInsumosExtras(os.insumosExtras).length > 0
        ? `Inclui: ${parseInsumosExtras(os.insumosExtras)
            .map((i) => i.nome)
            .join(', ')}.`
        : null,
    comparativo,
    itens,
  };

  return renderizar(await dadosEmpresaPDF(), orcamento);
}
