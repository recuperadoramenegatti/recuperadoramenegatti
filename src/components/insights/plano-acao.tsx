'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle2, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn, extrairMensagemErro } from '@/lib/utils';
import type { AcaoInsight } from '@/types';

/**
 * Checklist do plano de ação.
 *
 * As marcações vão para o banco assim que mudam, com atualização otimista —
 * o gestor marca o item e segue lendo, sem esperar a resposta.
 */
export function PlanoAcao({
  insightId,
  titulo,
  descricao,
  acoes,
  prefixo,
  concluidas,
  variante = 'imediata',
}: {
  insightId: string;
  titulo: string;
  descricao: string;
  acoes: AcaoInsight[];
  prefixo: string;
  concluidas: Record<string, boolean>;
  variante?: 'imediata' | 'estrategica';
}): React.JSX.Element {
  const router = useRouter();
  const [estado, setEstado] = React.useState(concluidas);
  const [salvando, setSalvando] = React.useState(false);

  const total = acoes.length;
  const feitas = acoes.filter((_, i) => estado[`${prefixo}-${i}`]).length;
  const progresso = total > 0 ? (feitas / total) * 100 : 0;

  const alternar = async (chave: string, marcada: boolean): Promise<void> => {
    const proximo = { ...estado, [chave]: marcada };
    setEstado(proximo);
    setSalvando(true);

    try {
      const resposta = await fetch(`/api/insights/${insightId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acoesConcluidas: proximo }),
      });
      if (!resposta.ok) throw new Error('Não foi possível salvar a marcação.');
      router.refresh();
    } catch (erro) {
      setEstado(estado);
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  if (acoes.length === 0) return <></>;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
      <header className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {feitas} de {total} concluída{total > 1 ? 's' : ''}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
        <Progress
          value={progresso}
          corBarra={progresso === 100 ? 'bg-gradient-sucesso' : 'bg-gradient-hero'}
          className="mt-3 h-1.5"
        />
      </header>

      <ol className={cn('space-y-2.5', variante === 'estrategica' && 'relative')}>
        {acoes.map((acao, indice) => {
          const chave = `${prefixo}-${indice}`;
          const marcada = Boolean(estado[chave]);

          return (
            <li
              key={chave}
              className={cn(
                'rounded-xl border p-3.5 transition-all duration-200',
                marcada
                  ? 'border-emerald-500/25 bg-emerald-500/[0.05]'
                  : 'border-white/10 bg-white/[0.03]',
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={chave}
                  checked={marcada}
                  onCheckedChange={(v) => void alternar(chave, v === true)}
                  disabled={salvando}
                  className="mt-0.5"
                  aria-label={`Marcar "${acao.titulo}" como concluída`}
                />

                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={chave}
                    className={cn(
                      'cursor-pointer text-sm font-medium leading-snug',
                      marcada && 'text-muted-foreground line-through',
                    )}
                  >
                    {acao.titulo}
                  </label>

                  {acao.descricao ? (
                    <p
                      className={cn(
                        'mt-1 text-xs leading-relaxed text-muted-foreground',
                        marcada && 'line-through',
                      )}
                    >
                      {acao.descricao}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {acao.responsavel ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden />
                        {acao.responsavel}
                      </span>
                    ) : null}
                    {acao.prazo ? (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" aria-hidden />
                        {acao.prazo}
                      </span>
                    ) : null}
                    {acao.impactoEstimado ? (
                      <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5">
                        {acao.impactoEstimado}
                      </span>
                    ) : null}
                  </div>
                </div>

                {marcada ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
