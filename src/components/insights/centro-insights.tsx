'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  Quote,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { InsightCard } from '@/components/insights/insight-card';
import { PlanoAcao } from '@/components/insights/plano-acao';
import { AlertCard } from '@/components/dashboard/alert-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/comum/empty-state';
import { cn, extrairMensagemErro } from '@/lib/utils';
import {
  deslocarPeriodo,
  formatarDataHora,
  formatarPeriodoExtenso,
  periodoAtual,
  capitalizarPrimeira,
} from '@/lib/formatacao';
import type { Alerta, AnaliseIA } from '@/types';

export interface InsightCarregado {
  id: string;
  periodo: string;
  analise: AnaliseIA;
  acoesConcluidas: Record<string, boolean>;
  modeloUsado: string;
  criadoEm: string;
}

interface Props {
  periodo: string;
  insight: InsightCarregado | null;
  alertas: Alerta[];
  iaConfigurada: boolean;
}

export function CentroInsights({
  periodo,
  insight,
  alertas,
  iaConfigurada,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [gerando, setGerando] = React.useState(false);

  const irPara = (novoPeriodo: string): void => {
    router.push(`/insights?periodo=${novoPeriodo}`);
  };

  const gerar = async (): Promise<void> => {
    setGerando(true);
    try {
      const resposta = await fetch('/api/insights/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodo }),
      });

      const corpo: unknown = await resposta.json();

      if (!resposta.ok) {
        const mensagem =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível gerar a análise.';
        // 428: configuração pendente, não falha do sistema.
        if (resposta.status === 428) {
          toast.error(mensagem, {
            action: { label: 'Configurar', onClick: () => router.push('/configuracoes') },
          });
          return;
        }
        throw new Error(mensagem);
      }

      toast.success('Análise gerada.');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setGerando(false);
    }
  };

  const ehMesCorrente = periodo === periodoAtual();

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => irPara(deslocarPeriodo(periodo, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 px-2 text-center text-sm font-medium">
              {capitalizarPrimeira(formatarPeriodoExtenso(periodo))}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => irPara(deslocarPeriodo(periodo, 1))}
              disabled={ehMesCorrente}
              aria-label="Mês seguinte"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {insight ? (
            <Badge variant="ia">
              Gerado em {formatarDataHora(insight.criadoEm)} · {insight.modeloUsado}
            </Badge>
          ) : null}
        </div>

        <Button variant="ia" onClick={() => void gerar()} carregando={gerando}>
          {!gerando ? (
            insight ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )
          ) : null}
          {insight ? 'Atualizar análise' : 'Gerar análise'}
        </Button>
      </div>

      {/* ── IA não configurada ────────────────────────────────────── */}
      {!iaConfigurada ? (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-6">
          <div className="flex items-start gap-3">
            <Brain className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">Integração de IA não configurada</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                O parecer gerencial usa a API da Anthropic para interpretar os números do mês.
                Cadastre a chave para habilitá-lo. Os alertas abaixo continuam funcionando sem
                IA — eles são calculados diretamente dos seus dados.
              </p>
              <Button asChild variant="ia" size="sm" className="mt-3">
                <Link href="/configuracoes?aba=ia">
                  <Settings className="h-4 w-4" />
                  Configurar chave da API
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Análise da IA ─────────────────────────────────────────── */}
      {insight ? (
        <AnaliseCompleta insight={insight} />
      ) : (
        <EmptyState
          icone={Sparkles}
          titulo={`Nenhuma análise gerada para ${capitalizarPrimeira(formatarPeriodoExtenso(periodo))}`}
          descricao={
            iaConfigurada
              ? 'Clique em "Gerar análise" para que a IA interprete os números deste mês e produza um parecer gerencial com plano de ação.'
              : 'Configure a chave da API para gerar o parecer. Enquanto isso, os alertas automáticos abaixo já apontam o que merece atenção.'
          }
          acao={
            iaConfigurada ? (
              <Button variant="ia" onClick={() => void gerar()} carregando={gerando}>
                <Sparkles className="h-4 w-4" />
                Gerar análise de {capitalizarPrimeira(formatarPeriodoExtenso(periodo))}
              </Button>
            ) : undefined
          }
        />
      )}

      {/* ── Diagnóstico determinístico ────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
        <header className="mb-4">
          <h2 className="text-sm font-semibold tracking-tight">Diagnóstico automático</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Regras determinísticas sobre os seus dados. Sempre disponíveis, com ou sem IA — e são
            elas que alimentam o contexto enviado ao modelo.
          </p>
        </header>

        {alertas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum alerta ativo neste período.
          </p>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {alertas.map((alerta) => (
              <AlertCard key={alerta.id} alerta={alerta} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AnaliseCompleta({ insight }: { insight: InsightCarregado }): React.JSX.Element {
  const { analise } = insight;

  return (
    <div className="space-y-6">
      {/* Resumo executivo */}
      <section className="relative overflow-hidden rounded-2xl border border-violet-500/25 p-6 shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-ia opacity-[0.13]"
        />
        <div className="relative">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="h-4 w-4 text-violet-400" aria-hidden />
            Resumo executivo
          </h2>
          <p className="mt-3 text-base leading-relaxed">{analise.resumo_executivo}</p>
        </div>
      </section>

      {/* Pontos críticos e oportunidades */}
      {analise.pontos_criticos.length > 0 || analise.oportunidades.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Coluna
            titulo="Pontos críticos"
            descricao="O que precisa de decisão agora"
            vazio="Nenhum ponto crítico identificado."
          >
            {analise.pontos_criticos.map((item, i) => (
              <InsightCard key={`${item.titulo}-${i}`} item={item} tipo="critico" />
            ))}
          </Coluna>

          <Coluna
            titulo="Oportunidades"
            descricao="Onde há dinheiro na mesa"
            vazio="Nenhuma oportunidade destacada."
          >
            {analise.oportunidades.map((item, i) => (
              <InsightCard key={`${item.titulo}-${i}`} item={item} tipo="oportunidade" />
            ))}
          </Coluna>
        </div>
      ) : null}

      {/* Planos de ação */}
      <PlanoAcao
        insightId={insight.id}
        titulo="Plano de ação — próximos 30 dias"
        descricao="Marque cada item conforme for concluindo. O progresso fica salvo."
        acoes={analise.acoes_imediatas}
        prefixo="imediata"
        concluidas={insight.acoesConcluidas}
      />

      <PlanoAcao
        insightId={insight.id}
        titulo="Estratégia — 90 a 180 dias"
        descricao="Movimentos estruturais, de prazo mais longo."
        acoes={analise.acoes_estrategicas}
        prefixo="estrategica"
        concluidas={insight.acoesConcluidas}
        variante="estrategica"
      />

      {/* Análises temáticas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <CartaoAnalise
          icone={Target}
          titulo="Precificação"
          texto={analise.analise_precificacao}
          tom="roxo"
        />
        <CartaoAnalise
          icone={Wrench}
          titulo="Produtividade"
          texto={analise.analise_produtividade}
          tom="azul"
        />
        <CartaoAnalise
          icone={BarChart3}
          titulo="Mix de serviços"
          texto={analise.analise_mix_servicos}
          tom="ambar"
        />
      </div>

      {/* Projeção */}
      {analise.projecao ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
            Projeção para os próximos 60 a 90 dias
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{analise.projecao}</p>
        </section>
      ) : null}

      {/* Frase do mês */}
      {analise.frase_do_mes ? (
        <section className="relative overflow-hidden rounded-2xl border border-white/10 px-8 py-10 text-center shadow-card">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-[0.09]"
          />
          <div className="relative">
            <Quote className="mx-auto h-6 w-6 text-primary/60" aria-hidden />
            <blockquote className="mx-auto mt-4 max-w-3xl text-xl font-semibold leading-snug tracking-tight">
              {analise.frase_do_mes}
            </blockquote>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Coluna({
  titulo,
  descricao,
  vazio,
  children,
}: {
  titulo: string;
  descricao: string;
  vazio: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const temItens = React.Children.count(children) > 0;

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
      </header>
      {temItens ? (
        <div className="space-y-2.5">{children}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
          {vazio}
        </p>
      )}
    </section>
  );
}

function CartaoAnalise({
  icone: Icone,
  titulo,
  texto,
  tom,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
  tom: 'roxo' | 'azul' | 'ambar';
}): React.JSX.Element {
  const bordas = {
    roxo: 'border-violet-500/25 bg-violet-500/[0.05]',
    azul: 'border-blue-500/25 bg-blue-500/[0.05]',
    ambar: 'border-amber-500/25 bg-amber-500/[0.05]',
  };
  const cores = { roxo: 'text-violet-400', azul: 'text-blue-400', ambar: 'text-amber-400' };

  if (!texto) return <></>;

  return (
    <section className={cn('rounded-2xl border p-5 shadow-card', bordas[tom])}>
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icone className={cn('h-4 w-4', cores[tom])} aria-hidden />
        {titulo}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{texto}</p>
    </section>
  );
}
