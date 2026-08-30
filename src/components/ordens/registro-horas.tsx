'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, extrairMensagemErro, numero } from '@/lib/utils';
import { formatarHoras, formatarMoeda, formatarPercentual } from '@/lib/formatacao';

export interface ItemHoras {
  centroId: string;
  centroNome: string;
  horasEstimadas: number;
  horasRealizadas: number | null;
  custoHora: number;
}

/**
 * Registro das horas efetivamente gastas por centro.
 *
 * Mostra o desvio contra o orçado em tempo real, com o impacto em reais —
 * é o número que corrige a estimativa das próximas OS do mesmo tipo.
 */
export function RegistroHoras({
  osId,
  itens,
  horasSetupEstimadas,
  horasSetupRealizadas,
  custoHoraSetup,
  observacoes,
}: {
  osId: string;
  itens: ItemHoras[];
  horasSetupEstimadas: number;
  horasSetupRealizadas: number;
  custoHoraSetup: number;
  observacoes: string;
}): React.JSX.Element {
  const router = useRouter();
  const [valores, setValores] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      itens.map((i) => [i.centroId, String(i.horasRealizadas ?? i.horasEstimadas)]),
    ),
  );
  const [setup, setSetup] = React.useState(String(horasSetupRealizadas || horasSetupEstimadas));
  const [notas, setNotas] = React.useState(observacoes);
  const [salvando, setSalvando] = React.useState(false);

  const totalEstimado =
    itens.reduce((acc, i) => acc + i.horasEstimadas, 0) + horasSetupEstimadas;
  const totalRealizado =
    itens.reduce((acc, i) => acc + numero(valores[i.centroId]), 0) + numero(setup);

  const desvioHoras = totalRealizado - totalEstimado;
  const desvioPct = totalEstimado > 0 ? (desvioHoras / totalEstimado) * 100 : 0;

  const impacto =
    itens.reduce(
      (acc, i) => acc + (numero(valores[i.centroId]) - i.horasEstimadas) * i.custoHora,
      0,
    ) + (numero(setup) - horasSetupEstimadas) * custoHoraSetup;

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    try {
      const resposta = await fetch(`/api/ordens/${osId}/horas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itens: itens.map((i) => ({
            centroId: i.centroId,
            horasRealizadas: numero(valores[i.centroId]),
          })),
          horasSetupRealizadas: numero(setup),
          observacoes: notas || null,
        }),
      });

      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        const mensagem =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível salvar as horas.';
        throw new Error(mensagem);
      }

      toast.success('Horas realizadas registradas.');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Timer className="h-4 w-4 text-primary" aria-hidden />
          Execução real
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Registre as horas efetivamente gastas. O desvio alimenta os alertas e corrige a
          estimativa das próximas OS.
        </p>
      </header>

      <div className="space-y-3">
        {itens.map((item) => {
          const realizado = numero(valores[item.centroId]);
          const desvio = realizado - item.horasEstimadas;

          return (
            <div key={item.centroId} className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`horas-${item.centroId}`}>{item.centroNome}</Label>
                <Input
                  id={`horas-${item.centroId}`}
                  type="text"
                  inputMode="decimal"
                  value={valores[item.centroId] ?? ''}
                  onChange={(e) =>
                    setValores((atual) => ({ ...atual, [item.centroId]: e.target.value }))
                  }
                  className="tabular-nums"
                />
              </div>

              <div className="pb-2.5 text-right text-xs text-muted-foreground">
                <div>orçado</div>
                <div className="tabular-nums">{formatarHoras(item.horasEstimadas)}</div>
              </div>

              <div className="w-20 pb-2.5 text-right text-xs">
                <div className="text-muted-foreground">desvio</div>
                <div
                  className={cn(
                    'tabular-nums font-medium',
                    desvio > 0.01 ? 'text-red-400' : desvio < -0.01 ? 'text-emerald-400' : 'text-muted-foreground',
                  )}
                >
                  {desvio > 0 ? '+' : ''}
                  {formatarHoras(desvio)}
                </div>
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-3 border-t border-[var(--borda-1)] pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="horas-setup">Setup / preparação</Label>
            <Input
              id="horas-setup"
              type="text"
              inputMode="decimal"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="pb-2.5 text-right text-xs text-muted-foreground">
            <div>orçado</div>
            <div className="tabular-nums">{formatarHoras(horasSetupEstimadas)}</div>
          </div>
          <div className="w-20 pb-2.5" />
        </div>
      </div>

      {/* Resumo do desvio */}
      <div
        className={cn(
          'mt-4 rounded-xl border p-3.5',
          Math.abs(desvioPct) < 5
            ? 'border-[var(--borda-1)] bg-[var(--superficie-2)]'
            : desvioPct > 0
              ? 'border-red-500/25 bg-red-500/[0.07]'
              : 'border-emerald-500/25 bg-emerald-500/[0.07]',
        )}
      >
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="label-caps text-[10px]">Orçado</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {formatarHoras(totalEstimado)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-[10px]">Realizado</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">
              {formatarHoras(totalRealizado)}
            </dd>
          </div>
          <div>
            <dt className="label-caps text-[10px]">Desvio</dt>
            <dd
              className={cn(
                'mt-0.5 text-sm font-semibold tabular-nums',
                desvioPct > 5 ? 'text-red-400' : desvioPct < -5 ? 'text-emerald-400' : '',
              )}
            >
              {desvioPct > 0 ? '+' : ''}
              {formatarPercentual(desvioPct)}
            </dd>
          </div>
        </dl>

        {Math.abs(impacto) > 1 ? (
          <p className="mt-3 border-t border-[var(--borda-1)] pt-2.5 text-center text-xs text-muted-foreground">
            Impacto na margem:{' '}
            <span className={cn('font-medium', impacto > 0 ? 'text-red-400' : 'text-emerald-400')}>
              {impacto > 0 ? '−' : '+'}
              {formatarMoeda(Math.abs(impacto))}
            </span>{' '}
            {impacto > 0 ? 'de custo não previsto' : 'de custo economizado'}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="notas-execucao">Observações da execução</Label>
        <Textarea
          id="notas-execucao"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          placeholder="O que explicou o desvio? Peça mais castigada que o previsto, retrabalho, espera de material…"
        />
      </div>

      <Button onClick={() => void salvar()} carregando={salvando} className="mt-4 w-full">
        {!salvando ? <Save className="h-4 w-4" /> : null}
        Registrar horas realizadas
      </Button>
    </section>
  );
}
