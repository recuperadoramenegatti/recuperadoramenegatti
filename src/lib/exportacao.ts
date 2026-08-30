/**
 * Exportações em Excel (SheetJS).
 * Os PDFs ficam em src/components/pdf — são React, não planilha.
 */

import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { formatarPeriodoExtenso, deslocarPeriodo } from '@/lib/formatacao';
import {
  buscarOSDoPeriodo,
  getContextoCalculo,
  margemContribuicaoOS,
  precoPraticado,
  resumirPeriodo,
} from '@/lib/calculos';
import { calcularDRE } from '@/lib/dre';
import { listarClientesComMetricas } from '@/lib/clientes';
import { arredondar } from '@/lib/utils';
import { LABEL_STATUS_OS, LABEL_TIPO_OS, type StatusOS, type TipoOS } from '@/types';

type Linha = Record<string, string | number | null>;

/** Aplica largura de coluna proporcional ao conteúdo. */
function ajustarLarguras(planilha: XLSX.WorkSheet, linhas: Linha[]): void {
  if (linhas.length === 0) return;
  const chaves = Object.keys(linhas[0] ?? {});
  planilha['!cols'] = chaves.map((chave) => {
    const maiorValor = linhas.reduce((max, linha) => {
      const texto = String(linha[chave] ?? '');
      return Math.max(max, texto.length);
    }, chave.length);
    return { wch: Math.min(48, Math.max(10, maiorValor + 2)) };
  });
}

function adicionarAba(livro: XLSX.WorkBook, nome: string, linhas: Linha[]): void {
  const planilha = XLSX.utils.json_to_sheet(linhas);
  ajustarLarguras(planilha, linhas);
  // O Excel limita o nome da aba a 31 caracteres.
  XLSX.utils.book_append_sheet(livro, planilha, nome.slice(0, 31));
}

/** Ordens de serviço de um intervalo de meses, achatadas para planilha. */
export async function linhasOrdens(periodoFinal: string, meses = 12): Promise<Linha[]> {
  const ctx = await getContextoCalculo();
  const linhas: Linha[] = [];

  for (let i = meses - 1; i >= 0; i -= 1) {
    const periodo = deslocarPeriodo(periodoFinal, -i);
    const ordens = await buscarOSDoPeriodo(periodo);
    const clientes = await prisma.cliente.findMany({ select: { id: true, nome: true } });
    const nomePorId = new Map(clientes.map((c) => [c.id, c.nome]));

    for (const os of ordens) {
      const preco = precoPraticado(os);
      linhas.push({
        Período: periodo,
        'Nº OS': os.numero,
        Cliente: nomePorId.get(os.clienteId) ?? '—',
        Tipo: LABEL_TIPO_OS[os.tipo as TipoOS] ?? os.tipo,
        Status: LABEL_STATUS_OS[os.status as StatusOS] ?? os.status,
        Descrição: os.descricao,
        'Horas estimadas': arredondar(os.horasEstimadas, 2),
        'Horas realizadas': os.horasRealizadas ?? null,
        'Custo total (R$)': arredondar(os.custoTotalCalc),
        'Preço sugerido (R$)': arredondar(os.precoSugerido),
        'Preço praticado (R$)': arredondar(preco),
        'Margem (%)': margemContribuicaoOS(os, ctx.parametros.aliquotaImpostos),
        'Peça nova (R$)': os.precoPecaNova ?? null,
        'Data orçamento': os.dataOrcamento.toISOString().slice(0, 10),
        'Data finalização': os.dataFinalizacao?.toISOString().slice(0, 10) ?? null,
        'Data faturamento': os.dataFaturamento?.toISOString().slice(0, 10) ?? null,
        'Data recebimento': os.dataRecebimento?.toISOString().slice(0, 10) ?? null,
      });
    }
  }

  return linhas;
}

/** DRE de um período, achatado para planilha. */
export async function linhasDRE(periodo: string): Promise<Linha[]> {
  const dre = await calcularDRE(periodo);
  return dre.linhas.map((linha) => ({
    Conta: `${'    '.repeat(linha.nivel)}${linha.label}`,
    'Valor (R$)': linha.valor,
    '% Receita': linha.percentualReceita,
    Tipo: linha.tipo,
  }));
}

/** KPIs consolidados dos últimos meses. */
export async function linhasKPIs(periodoFinal: string, meses = 12): Promise<Linha[]> {
  const ctx = await getContextoCalculo();
  const linhas: Linha[] = [];

  for (let i = meses - 1; i >= 0; i -= 1) {
    const periodo = deslocarPeriodo(periodoFinal, -i);
    const ordens = await buscarOSDoPeriodo(periodo);
    const resumo = resumirPeriodo(periodo, ordens, ctx.parametros, ctx.derivados);
    const dre = await calcularDRE(periodo, 'competencia', ctx);

    linhas.push({
      Período: periodo,
      Mês: formatarPeriodoExtenso(periodo),
      'Faturamento (R$)': resumo.faturamento,
      'Meta (R$)': ctx.parametros.metaFaturamentoMensal,
      'OS finalizadas': resumo.quantidadeOS,
      'Ticket médio (R$)': resumo.ticketMedio,
      'Custo total (R$)': resumo.custoTotal,
      'Impostos (R$)': resumo.impostos,
      'Margem de contribuição (R$)': resumo.margemContribuicao,
      'Margem de contribuição (%)': resumo.margemContribuicaoPct,
      'EBITDA (R$)': dre.ebitda,
      'EBITDA (%)': dre.ebitdaPct,
      'Lucro líquido (R$)': dre.lucroLiquido,
      'Lucratividade (%)': dre.lucratividade,
      'Horas realizadas': resumo.horasRealizadas,
      'Horas disponíveis': arredondar(ctx.derivados.totalHorasProdutivas, 1),
      'OS abaixo do mínimo': resumo.osAbaixoMinimo,
    });
  }

  return linhas;
}

/** Clientes com métricas de rentabilidade. */
export async function linhasClientes(): Promise<Linha[]> {
  const clientes = await listarClientesComMetricas(true);
  return clientes.map((c) => ({
    Código: c.codigo,
    Nome: c.nome,
    'CNPJ/CPF': c.documento,
    Telefone: c.telefone,
    'E-mail': c.email,
    Cidade: c.cidade,
    UF: c.estado,
    Classificação: c.classificacao,
    'Total de OS': c.totalOS,
    'Volume faturado (R$)': c.volumeFaturado,
    'Ticket médio (R$)': c.ticketMedio,
    'Margem média (%)': c.margemMedia,
    'Faturamento mensal médio (R$)': c.faturamentoMensalMedio,
    'Última OS': c.ultimaOS ? c.ultimaOS.slice(0, 10) : null,
    Ativo: c.ativo ? 'Sim' : 'Não',
  }));
}

/** Parâmetros financeiros vigentes — documenta a base de qualquer relatório. */
export async function linhasParametros(): Promise<Linha[]> {
  const ctx = await getContextoCalculo();
  const linhas: Linha[] = Object.entries(ctx.parametros).map(([chave, valor]) => ({
    Parâmetro: chave,
    Valor: typeof valor === 'number' ? valor : String(valor),
  }));

  linhas.push({ Parâmetro: '', Valor: '' });
  linhas.push({ Parâmetro: '— DERIVADOS —', Valor: '' });
  linhas.push({ Parâmetro: 'Folha com encargos (R$/mês)', Valor: ctx.derivados.folhaComEncargos });
  linhas.push({ Parâmetro: 'THH (R$/h)', Valor: arredondar(ctx.derivados.thh) });
  linhas.push({ Parâmetro: 'CFR (R$/h)', Valor: arredondar(ctx.derivados.cfr) });
  linhas.push({
    Parâmetro: 'Total de horas produtivas (h/mês)',
    Valor: arredondar(ctx.derivados.totalHorasProdutivas, 1),
  });

  linhas.push({ Parâmetro: '', Valor: '' });
  linhas.push({ Parâmetro: '— CUSTO POR HORA DOS CENTROS —', Valor: '' });
  for (const centro of ctx.centros) {
    linhas.push({ Parâmetro: `${centro.nome} (R$/h)`, Valor: arredondar(centro.custoHora) });
  }

  return linhas;
}

/** Ocupação e receita por centro de custo. */
export async function linhasCentros(periodo: string): Promise<Linha[]> {
  const { calcularOcupacaoCentros } = await import('@/lib/calculos');
  const ocupacao = await calcularOcupacaoCentros(periodo);
  return ocupacao.map((c) => ({
    Centro: c.nome,
    'Horas realizadas': c.horasRealizadas,
    'Horas disponíveis': c.horasDisponiveis,
    'Ocupação (%)': c.ocupacaoPct,
    'Receita gerada (R$)': c.receitaGerada,
  }));
}

/**
 * Relatório gerencial completo em XLSX: DRE, KPIs, OS, clientes,
 * centros e os parâmetros que geraram tudo isso.
 */
export async function gerarRelatorioExcel(periodo: string, meses = 12): Promise<Buffer> {
  const livro = XLSX.utils.book_new();

  const [dre, kpis, ordens, clientes, centros, parametros] = await Promise.all([
    linhasDRE(periodo),
    linhasKPIs(periodo, meses),
    linhasOrdens(periodo, meses),
    linhasClientes(),
    linhasCentros(periodo),
    linhasParametros(),
  ]);

  adicionarAba(livro, `DRE ${periodo}`, dre);
  adicionarAba(livro, 'KPIs mensais', kpis);
  adicionarAba(livro, 'Ordens de serviço', ordens);
  adicionarAba(livro, 'Clientes', clientes);
  adicionarAba(livro, 'Centros de custo', centros);
  adicionarAba(livro, 'Parâmetros', parametros);

  const buffer = XLSX.write(livro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buffer;
}

/** Planilha de uma única aba, para exportações pontuais. */
export function gerarExcelSimples(nomeAba: string, linhas: Linha[]): Buffer {
  const livro = XLSX.utils.book_new();
  adicionarAba(livro, nomeAba, linhas.length > 0 ? linhas : [{ Aviso: 'Nenhum dado no período.' }]);
  return XLSX.write(livro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Planilha com várias abas. */
export function gerarExcelMultiAba(abas: Array<{ nome: string; linhas: Linha[] }>): Buffer {
  const livro = XLSX.utils.book_new();
  for (const aba of abas) {
    adicionarAba(livro, aba.nome, aba.linhas.length > 0 ? aba.linhas : [{ Aviso: 'Sem dados.' }]);
  }
  return XLSX.write(livro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
