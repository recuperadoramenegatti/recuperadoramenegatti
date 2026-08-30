import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { FluxoChart } from '@/components/charts/fluxo-chart';
import { ControlesFluxo } from '@/components/financeiro/controles-fluxo';
import { PageHeader } from '@/components/comum/page-header';
import { ErrorBoundary } from '@/components/comum/error-boundary';
import { SkeletonGrafico } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { calcularFluxoCaixa } from '@/lib/dre';
import { getParametros } from '@/lib/calculos';
import { formatarMoeda, periodoAtual } from '@/lib/formatacao';
import { numero } from '@/lib/utils';
import type { ResultadoFluxoCaixa } from '@/types';

export const metadata: Metadata = { title: 'Fluxo de Caixa' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

function texto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default function PaginaFluxoCaixa({ searchParams }: Props): React.JSX.Element {
  const periodo = texto(searchParams.periodo) ?? periodoAtual();
  const saldoInicial = numero(texto(searchParams.saldoInicial), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Fluxo de Caixa"
        descricao="Projeção diária a partir das OS em aberto, dos prazos configurados e das despesas fixas."
      />

      <ControlesFluxo periodo={periodo} saldoInicial={saldoInicial} />

      <Suspense key={`${periodo}-${saldoInicial}`} fallback={<SkeletonGrafico altura={420} />}>
        <ConteudoFluxo periodo={periodo} saldoInicial={saldoInicial} />
      </Suspense>
    </div>
  );
}

async function ConteudoFluxo({
  periodo,
  saldoInicial,
}: {
  periodo: string;
  saldoInicial: number;
}): Promise<React.JSX.Element> {
  const [fluxo, parametros] = await Promise.all([
    calcularFluxoCaixa(periodo, saldoInicial),
    getParametros(),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardFluxo
          icone={ArrowUpCircle}
          rotulo="Entradas do mês"
          valor={fluxo.totalEntradas}
          detalhe={
            fluxo.entradasPrevistas > 0
              ? `${formatarMoeda(fluxo.entradasRealizadas)} recebidos · ${formatarMoeda(fluxo.entradasPrevistas)} a receber`
              : `${formatarMoeda(fluxo.entradasRealizadas)} já recebidos`
          }
          tom="verde"
        />
        <CardFluxo
          icone={ArrowDownCircle}
          rotulo="Saídas do mês"
          valor={fluxo.totalSaidas}
          detalhe="folha, custos fixos e insumos"
          tom="vermelho"
        />
        <CardFluxo
          icone={Wallet}
          rotulo="Saldo no fim do mês"
          valor={fluxo.saldoFinal}
          detalhe={`partindo de ${formatarMoeda(fluxo.saldoInicial)}`}
          tom={fluxo.saldoFinal >= 0 ? 'azul' : 'vermelho'}
        />
        <CardFluxo
          icone={AlertTriangle}
          rotulo="Dias com saldo negativo"
          valor={fluxo.diasNegativos}
          detalhe={fluxo.diasNegativos > 0 ? 'precisa de reforço de caixa' : 'nenhum dia no vermelho'}
          tom={fluxo.diasNegativos > 0 ? 'vermelho' : 'verde'}
          moeda={false}
        />
      </div>

      {fluxo.diasNegativos > 0 ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">
              {fluxo.diasNegativos} dia{fluxo.diasNegativos > 1 ? 's' : ''} com saldo projetado
              negativo
            </p>
            <p className="mt-0.5 text-muted-foreground">
              O primeiro é o dia {fluxo.dias.find((d) => d.negativo)?.dia}. Antecipe recebimentos,
              negocie prazo com fornecedores ou reserve capital de giro antes dessa data.
            </p>
          </div>
        </div>
      ) : null}

      <ErrorBoundary titulo="Não foi possível montar o gráfico de fluxo">
        <FluxoChart dias={fluxo.dias} />
      </ErrorBoundary>

      <PainelNCG fluxo={fluxo} pmr={parametros.pmrDias} pmp={parametros.pmpDias} />

      <TabelaDias fluxo={fluxo} />
    </div>
  );
}

function PainelNCG({
  fluxo,
  pmr,
  pmp,
}: {
  fluxo: ResultadoFluxoCaixa;
  pmr: number;
  pmp: number;
}): React.JSX.Element {
  const { ncg } = fluxo;

  return (
    <section className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
      <header className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight">Necessidade de capital de giro</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quanto dinheiro fica preso no ciclo entre pagar o fornecedor e receber do cliente.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ItemNCG rotulo="PMR" valor={`${pmr} dias`} dica="Prazo médio de recebimento dos clientes." />
        <ItemNCG rotulo="PMP" valor={`${pmp} dias`} dica="Prazo médio de pagamento a fornecedores." />
        <ItemNCG
          rotulo="Ciclo financeiro"
          valor={`${ncg.cicloFinanceiro} dias`}
          dica="PMR menos PMP. Positivo significa que a empresa financia o cliente."
        />
        <ItemNCG
          rotulo="NCG"
          valor={formatarMoeda(ncg.ncg)}
          destaque={ncg.ncg > 0}
          dica="Ciclo financeiro × faturamento diário médio. É o capital que precisa estar disponível o tempo todo."
        />
      </div>

      {ncg.ncg > 0 ? (
        <p className="mt-4 border-t border-[var(--borda-1)] pt-3 text-xs leading-relaxed text-muted-foreground">
          Com um ciclo de {ncg.cicloFinanceiro} dias, {formatarMoeda(ncg.ncg)} ficam
          permanentemente imobilizados financiando o giro. Reduzir o PMR em 5 dias liberaria
          aproximadamente {formatarMoeda(5 * ncg.faturamentoDiarioMedio)} de caixa. Os prazos são
          editáveis em{' '}
          <Link href="/configuracoes" className="text-primary hover:underline">
            Configurações → Parâmetros Financeiros
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}

function ItemNCG({
  rotulo,
  valor,
  dica,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  dica: string;
  destaque?: boolean;
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3.5">
          <span className="label-caps">{rotulo}</span>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${destaque ? 'text-amber-400' : ''}`}
          >
            {valor}
          </p>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{dica}</TooltipContent>
    </Tooltip>
  );
}

function TabelaDias({ fluxo }: { fluxo: ResultadoFluxoCaixa }): React.JSX.Element {
  const comMovimento = fluxo.dias.filter((d) => d.entradas > 0 || d.saidas > 0);

  if (comMovimento.length === 0) return <></>;

  return (
    <section className="overflow-x-auto rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] shadow-card backdrop-blur-sm">
      <header className="px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight">Dias com movimentação</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {comMovimento.length} de {fluxo.dias.length} dias do mês
        </p>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--borda-1)]">
            <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Dia
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Entradas
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Saídas
            </th>
            <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Situação
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Saldo do dia
            </th>
            <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Acumulado
            </th>
          </tr>
        </thead>
        <tbody>
          {comMovimento.map((dia) => (
            <tr
              key={dia.dia}
              className={`border-b border-[var(--borda-0)] transition-colors hover:bg-[var(--superficie-2)] ${
                dia.negativo ? 'bg-red-500/[0.05]' : ''
              }`}
            >
              <td className="px-5 py-2.5 tabular-nums">{dia.dia}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">
                {dia.entradas > 0 ? formatarMoeda(dia.entradas) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-red-400">
                {dia.saidas > 0 ? formatarMoeda(dia.saidas) : '—'}
              </td>
              <td className="px-4 py-2.5 text-center">
                {dia.entradasRealizadas > 0 || dia.saidasRealizadas > 0 ? (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                    realizado
                  </span>
                ) : (
                  <span className="rounded-md bg-[var(--superficie-3)] px-2 py-0.5 text-[11px] text-muted-foreground">
                    previsto
                  </span>
                )}
              </td>
              <td
                className={`px-4 py-2.5 text-right tabular-nums ${
                  dia.saldoDia < 0 ? 'text-red-400' : ''
                }`}
              >
                {formatarMoeda(dia.saldoDia)}
              </td>
              <td
                className={`px-5 py-2.5 text-right font-medium tabular-nums ${
                  dia.negativo ? 'text-red-400' : ''
                }`}
              >
                {formatarMoeda(dia.saldoAcumulado)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CardFluxo({
  icone: Icone,
  rotulo,
  valor,
  detalhe,
  tom,
  moeda = true,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: number;
  detalhe: string;
  tom: 'verde' | 'vermelho' | 'azul';
  moeda?: boolean;
}): React.JSX.Element {
  const gradientes = {
    verde: 'gradient-text-sucesso',
    vermelho: 'gradient-text-alerta',
    azul: 'bg-gradient-azul bg-clip-text text-transparent',
  };

  return (
    <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="label-caps">{rotulo}</span>
        <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${gradientes[tom]}`}>
        {moeda ? formatarMoeda(valor) : valor.toLocaleString('pt-BR')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}
