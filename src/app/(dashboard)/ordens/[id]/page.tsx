import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { History, Package, Receipt, User, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/comum/page-header';
import { AcoesOS } from '@/components/ordens/acoes-os';
import { RegistroHoras, type ItemHoras } from '@/components/ordens/registro-horas';
import { AlertCard } from '@/components/dashboard/alert-card';
import { ComparativoPecaNova } from '@/components/orcamento/comparativo-peca-nova';
import { SemaforoMargem } from '@/components/orcamento/semaforo-margem';
import { BadgePrioridade, BadgeStatus, BadgeTipo } from '@/components/dashboard/badges-os';
import { Separator } from '@/components/ui/separator';
import { prisma } from '@/lib/prisma';
import {
  getContextoCalculo,
  margemContribuicaoOS,
  precoPraticado,
  classificarMargem,
  calcularComparativoPecaNova,
} from '@/lib/calculos';
import { alertasDaOS } from '@/lib/alertas';
import {
  formatarData,
  formatarDataHora,
  formatarDocumento,
  formatarHoras,
  formatarMoeda,
  formatarPercentual,
  formatarTelefone,
} from '@/lib/formatacao';
import { dividir } from '@/lib/utils';
import { parseInsumosExtras } from '@/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const os = await prisma.ordemServico
    .findUnique({ where: { id: params.id }, select: { numero: true } })
    .catch(() => null);
  return { title: os ? os.numero : 'Ordem de serviço' };
}

export default async function PaginaDetalheOS({ params }: Props): Promise<React.JSX.Element> {
  const [os, ctx] = await Promise.all([
    prisma.ordemServico.findUnique({
      where: { id: params.id },
      include: {
        cliente: true,
        itens: { include: { centro: true } },
        logs: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    }),
    getContextoCalculo(),
  ]);

  if (!os) notFound();

  const preco = precoPraticado(os);
  const agregavel = { ...os, descricao: os.descricao };
  const margem = margemContribuicaoOS(agregavel, ctx.parametros.aliquotaImpostos);
  const alertas = alertasDaOS(agregavel, ctx);
  const insumosExtras = parseInsumosExtras(os.insumosExtras);

  const comparativo =
    os.tipo === 'recuperacao'
      ? calcularComparativoPecaNova(
          preco,
          os.precoPecaNova,
          os.descontoTolerado ?? ctx.parametros.descontoToleradoPecaNova,
          ctx.parametros,
        )
      : null;

  const itensHoras: ItemHoras[] = os.itens.map((item) => ({
    centroId: item.centroId,
    centroNome: item.centro.nome,
    horasEstimadas: item.horasEstimadas,
    horasRealizadas: item.horasRealizadas,
    custoHora: item.thhUsado + item.thmUsado + item.cfrUsado,
  }));

  const impostos = preco * (os.aliquotaUsada > 0 ? os.aliquotaUsada : ctx.parametros.aliquotaImpostos) / 100;
  const lucro = preco - os.custoTotalCalc - impostos;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={os.numero}
        descricao={os.descricao}
        acoes={
          <AcoesOS
            osId={os.id}
            numero={os.numero}
            statusAtual={os.status}
            clienteNome={os.cliente.nome}
            clienteTelefone={os.cliente.telefone}
            tipo={os.tipo}
            descricao={os.descricao}
            preco={preco}
            validadeDias={os.validadeOrcamento}
            economiaPecaNova={
              comparativo && comparativo.economiaCliente > 0
                ? { valor: comparativo.economiaCliente, pct: comparativo.economiaPct }
                : null
            }
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <BadgeStatus status={os.status} />
        <BadgeTipo tipo={os.tipo} />
        <BadgePrioridade prioridade={os.prioridade} />
        <span className="text-xs text-muted-foreground">
          Orçada em {formatarData(os.dataOrcamento)} · válida por {os.validadeOrcamento} dias
        </span>
      </div>

      {alertas.length > 0 ? (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {alertas.map((alerta) => (
            <AlertCard key={alerta.id} alerta={alerta} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Coluna principal ───────────────────────────────────────── */}
        <div className="space-y-6">
          <Cartao titulo="Cliente" icone={User}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Campo rotulo="Nome / Razão social">
                <Link
                  href={`/clientes?cliente=${os.cliente.id}`}
                  className="font-medium transition-colors hover:text-primary"
                >
                  {os.cliente.nome}
                </Link>
              </Campo>
              <Campo rotulo="CNPJ / CPF">{formatarDocumento(os.cliente.documento)}</Campo>
              <Campo rotulo="Telefone">{formatarTelefone(os.cliente.telefone)}</Campo>
              <Campo rotulo="Cidade">
                {[os.cliente.cidade, os.cliente.estado].filter(Boolean).join(' / ') || '—'}
              </Campo>
            </dl>
          </Cartao>

          <Cartao titulo="Custo por centro de custo" icone={Wrench}>
            <div className="space-y-2.5">
              {os.itens.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {item.centro.nome}
                    <span className="ml-2 text-xs">
                      {formatarHoras(item.horasEstimadas)} ×{' '}
                      {formatarMoeda(item.thhUsado + item.thmUsado + item.cfrUsado)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatarMoeda(item.custoCalculado)}
                  </span>
                </div>
              ))}

              {os.horasSetup > 0 ? (
                <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2.5 text-sm">
                  <span className="text-muted-foreground">
                    Setup / preparação
                    <span className="ml-2 text-xs">{formatarHoras(os.horasSetup)}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatarMoeda(os.horasSetup * ctx.derivados.custoHoraSetup)}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              As taxas foram congeladas no momento do orçamento (THH{' '}
              {formatarMoeda(os.itens[0]?.thhUsado ?? ctx.derivados.thh)}/h, CFR{' '}
              {formatarMoeda(os.itens[0]?.cfrUsado ?? ctx.derivados.cfr)}/h), então o custo desta OS
              não muda se os parâmetros forem ajustados depois.
            </p>
          </Cartao>

          <Cartao titulo="Insumos e materiais" icone={Package}>
            <dl className="space-y-2 text-sm">
              <LinhaValor
                rotulo={`Materiais (+${formatarPercentual(os.markupMateriais, 0)} de markup)`}
                valor={os.custoMateriais * (1 + os.markupMateriais / 100)}
              />
              {os.custoConsumiveis > 0 ? (
                <LinhaValor rotulo="Consumíveis de solda" valor={os.custoConsumiveis} />
              ) : null}
              {os.custoFerramentas > 0 ? (
                <LinhaValor rotulo="Desgaste de ferramentas" valor={os.custoFerramentas} />
              ) : null}
              {insumosExtras.map((item) => (
                <LinhaValor key={item.nome} rotulo={item.nome} valor={item.valor} />
              ))}
              {os.custoMateriais === 0 &&
              os.custoConsumiveis === 0 &&
              os.custoFerramentas === 0 &&
              insumosExtras.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Nenhum insumo lançado nesta OS.</p>
              ) : null}
            </dl>
          </Cartao>

          {itensHoras.length > 0 ? (
            <RegistroHoras
              osId={os.id}
              itens={itensHoras}
              horasSetupEstimadas={os.horasSetup}
              horasSetupRealizadas={0}
              custoHoraSetup={ctx.derivados.custoHoraSetup}
              observacoes={os.observacoes ?? ''}
            />
          ) : null}

          <Cartao titulo="Histórico de alterações" icone={History}>
            {os.logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
            ) : (
              <ol className="space-y-3">
                {os.logs.map((log) => (
                  <li key={log.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="mt-1 w-px flex-1 bg-white/10" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm leading-snug">{log.descricao}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatarDataHora(log.createdAt)}
                        {log.usuario ? ` · ${log.usuario}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
        </div>

        {/* ── Coluna lateral ─────────────────────────────────────────── */}
        <div className="space-y-4 xl:sticky xl:top-20 xl:h-fit">
          <Cartao titulo="Resultado financeiro" icone={Receipt}>
            <div className="mb-4">
              <span className="label-caps">Preço ao cliente</span>
              <p className="mt-1 text-3xl font-bold tracking-tight gradient-text-hero tabular-nums">
                {formatarMoeda(preco)}
              </p>
              {os.precoFinal && os.precoFinal !== os.precoSugerido ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sugerido pelo sistema: {formatarMoeda(os.precoSugerido)}
                </p>
              ) : null}
            </div>

            <Separator className="my-3" />

            <dl className="space-y-2 text-sm">
              <LinhaValor rotulo="Custo total" valor={os.custoTotalCalc} />
              <LinhaValor rotulo="Impostos" valor={impostos} negativo />
              <LinhaValor rotulo="Lucro estimado" valor={lucro} destaque />
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Total de horas</dt>
                <dd className="tabular-nums">{formatarHoras(os.horasEstimadas)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Custo por hora</dt>
                <dd className="tabular-nums">
                  {formatarMoeda(dividir(os.custoTotalCalc, os.horasEstimadas))}
                </dd>
              </div>
            </dl>
          </Cartao>

          <SemaforoMargem
            margem={margem}
            classificacao={classificarMargem(margem, ctx.parametros)}
            parametros={ctx.parametros}
          />

          {comparativo ? (
            <>
              <ComparativoPecaNova comparativo={comparativo} />
              {os.fontePrecoPecaNova ? (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Referência do preço: {os.fontePrecoPecaNova}
                </p>
              ) : null}
            </>
          ) : null}

          <Cartao titulo="Datas">
            <dl className="space-y-2 text-sm">
              <LinhaData rotulo="Orçamento" data={os.dataOrcamento} />
              <LinhaData rotulo="Previsão de entrega" data={os.dataPrevisaoEntrega} />
              <LinhaData rotulo="Finalização" data={os.dataFinalizacao} />
              <LinhaData rotulo="Faturamento" data={os.dataFaturamento} />
              <LinhaData rotulo="Recebimento" data={os.dataRecebimento} />
            </dl>
          </Cartao>
        </div>
      </div>
    </div>
  );
}

function Cartao({
  titulo,
  icone: Icone,
  children,
}: {
  titulo: string;
  icone?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
        {Icone ? <Icone className="h-4 w-4 text-primary" aria-hidden /> : null}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <dt className="label-caps">{rotulo}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function LinhaValor({
  rotulo,
  valor,
  negativo = false,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  negativo?: boolean;
  destaque?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd
        className={
          destaque
            ? valor >= 0
              ? 'font-semibold tabular-nums text-emerald-400'
              : 'font-semibold tabular-nums text-red-400'
            : negativo
              ? 'tabular-nums text-red-400'
              : 'tabular-nums'
        }
      >
        {formatarMoeda(valor)}
      </dd>
    </div>
  );
}

function LinhaData({ rotulo, data }: { rotulo: string; data: Date | null }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={data ? 'tabular-nums' : 'text-muted-foreground/60'}>{formatarData(data)}</dd>
    </div>
  );
}
