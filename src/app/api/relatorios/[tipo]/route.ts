import { NextResponse } from 'next/server';
import { exigirSessao } from '@/lib/auth';
import { erro, tratarErro } from '@/lib/api';
import {
  gerarExcelMultiAba,
  gerarExcelSimples,
  gerarRelatorioExcel,
  linhasCentros,
  linhasClientes,
  linhasDRE,
  linhasKPIs,
  linhasOrdens,
  linhasParametros,
} from '@/lib/exportacao';
import { calcularFluxoAnual } from '@/lib/dre';
import { calcularPainelIndicadores } from '@/lib/indicadores';
import { periodoAtual, deslocarPeriodo } from '@/lib/formatacao';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface Contexto {
  params: { tipo: string };
}

const TIPOS_VALIDOS = [
  'completo',
  'dre',
  'dre-comparativo',
  'ordens',
  'clientes',
  'centros',
  'kpis',
  'rentabilidade',
  'orcado-realizado',
  'fluxo-anual',
  'parametros',
] as const;

/** GET — exporta um relatório em XLSX. */
export async function GET(request: Request, { params }: Contexto): Promise<NextResponse | Response> {
  try {
    await exigirSessao();

    const tipo = params.tipo;
    if (!TIPOS_VALIDOS.includes(tipo as (typeof TIPOS_VALIDOS)[number])) {
      return erro(
        `Relatório desconhecido: "${tipo}". Disponíveis: ${TIPOS_VALIDOS.join(', ')}.`,
        404,
      );
    }

    const url = new URL(request.url);
    const periodo = url.searchParams.get('periodo') ?? periodoAtual();
    const meses = Number(url.searchParams.get('meses') ?? 12) || 12;

    let buffer: Buffer;
    let nome: string;

    switch (tipo) {
      case 'completo':
        buffer = await gerarRelatorioExcel(periodo, meses);
        nome = `menegatti_relatorio_completo_${periodo}.xlsx`;
        break;

      case 'dre':
        buffer = gerarExcelSimples(`DRE ${periodo}`, await linhasDRE(periodo));
        nome = `menegatti_dre_${periodo}.xlsx`;
        break;

      case 'dre-comparativo': {
        const [atual, anterior, anoAnterior] = await Promise.all([
          linhasDRE(periodo),
          linhasDRE(deslocarPeriodo(periodo, -1)),
          linhasDRE(deslocarPeriodo(periodo, -12)),
        ]);
        buffer = gerarExcelMultiAba([
          { nome: `Atual ${periodo}`, linhas: atual },
          { nome: `Mês anterior`, linhas: anterior },
          { nome: `Ano anterior`, linhas: anoAnterior },
        ]);
        nome = `menegatti_dre_comparativo_${periodo}.xlsx`;
        break;
      }

      case 'ordens':
        buffer = gerarExcelSimples('Ordens de serviço', await linhasOrdens(periodo, meses));
        nome = `menegatti_ordens_${periodo}.xlsx`;
        break;

      case 'clientes':
        buffer = gerarExcelSimples('Clientes', await linhasClientes());
        nome = `menegatti_clientes_${periodo}.xlsx`;
        break;

      case 'centros':
        buffer = gerarExcelSimples('Centros de custo', await linhasCentros(periodo));
        nome = `menegatti_centros_${periodo}.xlsx`;
        break;

      case 'kpis':
        buffer = gerarExcelSimples('KPIs mensais', await linhasKPIs(periodo, meses));
        nome = `menegatti_kpis_${periodo}.xlsx`;
        break;

      case 'rentabilidade': {
        const painel = await calcularPainelIndicadores(periodo);
        buffer = gerarExcelMultiAba([
          {
            nome: 'Margem por tipo',
            linhas: painel.margemPorTipo.map((m) => ({
              'Tipo de serviço': m.label,
              Quantidade: m.quantidade,
              'Receita (R$)': m.receita,
              'Custo (R$)': m.custo,
              'Margem (%)': m.margemPct,
              'Ticket médio (R$)': m.ticketMedio,
            })),
          },
          {
            nome: 'Distribuição de margens',
            linhas: painel.histogramaMargens.map((f) => ({
              Faixa: f.faixa,
              'Quantidade de OS': f.quantidade,
              'Receita (R$)': f.receita,
            })),
          },
          {
            nome: 'Indicadores',
            linhas: painel.grupos.flatMap((g) =>
              g.indicadores.map((i) => ({
                Grupo: g.grupo,
                Indicador: i.label,
                Valor: i.valor,
                Formato: i.formato,
                Descrição: i.descricao,
              })),
            ),
          },
        ]);
        nome = `menegatti_rentabilidade_${periodo}.xlsx`;
        break;
      }

      case 'orcado-realizado': {
        const linhas = (await linhasOrdens(periodo, meses)).filter(
          (l) => l['Horas realizadas'] !== null,
        );
        buffer = gerarExcelSimples(
          'Orçado x Realizado',
          linhas.map((l) => {
            const estimadas = Number(l['Horas estimadas'] ?? 0);
            const realizadas = Number(l['Horas realizadas'] ?? 0);
            const desvio = estimadas > 0 ? ((realizadas - estimadas) / estimadas) * 100 : 0;
            return {
              'Nº OS': l['Nº OS'],
              Cliente: l.Cliente,
              Tipo: l.Tipo,
              'Horas estimadas': estimadas,
              'Horas realizadas': realizadas,
              'Desvio (h)': Number((realizadas - estimadas).toFixed(2)),
              'Desvio (%)': Number(desvio.toFixed(1)),
              'Preço praticado (R$)': l['Preço praticado (R$)'],
              'Margem (%)': l['Margem (%)'],
            };
          }),
        );
        nome = `menegatti_orcado_realizado_${periodo}.xlsx`;
        break;
      }

      case 'fluxo-anual': {
        const ano = Number(periodo.slice(0, 4));
        const fluxo = await calcularFluxoAnual(ano);
        buffer = gerarExcelSimples(
          `Fluxo ${ano}`,
          fluxo.map((f) => ({
            Período: f.periodo,
            'Entradas projetadas (R$)': f.entradas,
            'Entradas realizadas (R$)': f.entradasRealizadas,
            'A receber (R$)': f.entradasPrevistas,
            'Saídas projetadas (R$)': f.saidas,
            'Saldo projetado (R$)': f.saldo,
            'Saldo realizado (R$)': f.saldoRealizado,
          })),
        );
        nome = `menegatti_fluxo_anual_${ano}.xlsx`;
        break;
      }

      case 'parametros':
      default:
        buffer = gerarExcelSimples('Parâmetros', await linhasParametros());
        nome = `menegatti_parametros_${periodo}.xlsx`;
        break;
    }

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return tratarErro(e);
  }
}
