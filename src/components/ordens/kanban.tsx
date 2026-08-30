'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Clock,
  Copy,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
} from 'lucide-react';
import { BadgePrioridade, BadgeTipo, IndicadorMargem } from '@/components/dashboard/badges-os';
import { EmptyState } from '@/components/comum/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, extrairMensagemErro } from '@/lib/utils';
import { formatarData, formatarHoras, formatarMoeda } from '@/lib/formatacao';
import {
  FLUXO_KANBAN,
  LABEL_STATUS_OS,
  type ParametrosBase,
  type StatusOS,
} from '@/types';

export interface CartaoOS {
  id: string;
  numero: string;
  clienteNome: string;
  tipo: string;
  status: string;
  prioridade: string;
  preco: number;
  margem: number;
  horasEstimadas: number;
  horasRealizadas: number | null;
  dataPrevisaoEntrega: string | null;
  atrasada: boolean;
}

const COR_COLUNA: Record<StatusOS, string> = {
  orcado: 'border-t-blue-500/70',
  em_execucao: 'border-t-amber-500/70',
  aguardando_pecas: 'border-t-violet-500/70',
  finalizado: 'border-t-emerald-500/70',
  faturado: 'border-t-cyan-500/70',
  pago: 'border-t-emerald-600/70',
  cancelado: 'border-t-gray-500/70',
};

/**
 * Kanban de ordens de serviço com arrastar e soltar.
 *
 * Usa a HTML Drag and Drop API nativa em vez de uma biblioteca: são seis
 * colunas e uma operação (mover cartão), e o teclado tem caminho próprio
 * pelo menu de cada cartão — que é o que torna a tela acessível de verdade.
 */
export function Kanban({
  ordens,
  parametros,
}: {
  ordens: CartaoOS[];
  parametros: ParametrosBase;
}): React.JSX.Element {
  const router = useRouter();
  const [arrastando, setArrastando] = React.useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = React.useState<StatusOS | null>(null);
  const [movendo, setMovendo] = React.useState<string | null>(null);
  const [otimista, setOtimista] = React.useState<Record<string, StatusOS>>({});

  const statusDe = (os: CartaoOS): string => otimista[os.id] ?? os.status;

  const mover = async (id: string, status: StatusOS): Promise<void> => {
    const os = ordens.find((o) => o.id === id);
    if (!os || statusDe(os) === status) return;

    setMovendo(id);
    setOtimista((atual) => ({ ...atual, [id]: status }));

    try {
      const resposta = await fetch(`/api/ordens/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        const mensagem =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível mover a OS.';
        throw new Error(mensagem);
      }

      toast.success(`${os.numero} → ${LABEL_STATUS_OS[status]}`);
      router.refresh();
    } catch (erro) {
      // Desfaz o otimismo: a coluna volta para onde o cartão realmente está.
      setOtimista((atual) => {
        const copia = { ...atual };
        delete copia[id];
        return copia;
      });
      toast.error(extrairMensagemErro(erro));
    } finally {
      setMovendo(null);
    }
  };

  const duplicar = async (id: string, numero: string): Promise<void> => {
    try {
      const resposta = await fetch(`/api/ordens/${id}/duplicar`, { method: 'POST' });
      if (!resposta.ok) throw new Error('Não foi possível duplicar a OS.');
      toast.success(`${numero} duplicada.`);
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  };

  if (ordens.length === 0) {
    return (
      <EmptyState
        icone={Clock}
        titulo="Nenhuma OS no filtro atual"
        descricao="Ajuste os filtros acima ou crie um novo orçamento."
      />
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {FLUXO_KANBAN.map((status) => {
        const daColuna = ordens.filter((os) => statusDe(os) === status);
        const total = daColuna.reduce((acc, os) => acc + os.preco, 0);

        return (
          <div
            key={status}
            className={cn(
              'flex w-[300px] shrink-0 flex-col rounded-2xl border border-t-2 border-white/10 bg-white/[0.03] transition-colors',
              COR_COLUNA[status],
              colunaAlvo === status && 'border-white/25 bg-white/[0.07]',
            )}
            onDragOver={(evento) => {
              evento.preventDefault();
              setColunaAlvo(status);
            }}
            onDragLeave={() => setColunaAlvo((atual) => (atual === status ? null : atual))}
            onDrop={(evento) => {
              evento.preventDefault();
              setColunaAlvo(null);
              const id = evento.dataTransfer.getData('text/plain');
              if (id) void mover(id, status);
            }}
          >
            <header className="border-b border-white/[0.07] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider">
                  {LABEL_STATUS_OS[status]}
                </h3>
                <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {daColuna.length}
                </span>
              </div>
              {total > 0 ? (
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {formatarMoeda(total)}
                </p>
              ) : null}
            </header>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5" style={{ maxHeight: 640 }}>
              {daColuna.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">
                  Arraste uma OS para cá
                </p>
              ) : (
                daColuna.map((os) => (
                  <article
                    key={os.id}
                    draggable
                    onDragStart={(evento) => {
                      evento.dataTransfer.setData('text/plain', os.id);
                      evento.dataTransfer.effectAllowed = 'move';
                      setArrastando(os.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                    className={cn(
                      'group rounded-xl border border-white/10 bg-[#141c2e] p-3 transition-all duration-200',
                      'hover:border-white/20 hover:shadow-card',
                      arrastando === os.id && 'opacity-40',
                      movendo === os.id && 'pointer-events-none',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/ordens/${os.id}`}
                        className="min-w-0 flex-1 font-mono text-xs font-medium transition-colors hover:text-primary"
                      >
                        {os.numero}
                      </Link>

                      <div className="flex shrink-0 items-center">
                        {movendo === os.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <GripVertical
                            className="h-3.5 w-3.5 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground"
                            aria-hidden
                          />
                        )}

                        <MenuCartao
                          os={os}
                          statusAtual={statusDe(os) as StatusOS}
                          onMover={(novo) => void mover(os.id, novo)}
                          onDuplicar={() => void duplicar(os.id, os.numero)}
                        />
                      </div>
                    </div>

                    <p className="mt-1 truncate text-sm">{os.clienteNome}</p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <BadgeTipo tipo={os.tipo} />
                      <BadgePrioridade prioridade={os.prioridade} />
                    </div>

                    <div className="mt-2.5">
                      <IndicadorMargem margem={os.margem} parametros={parametros} comBarra />
                    </div>

                    <dl className="mt-2.5 space-y-1 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Valor</dt>
                        <dd className="font-medium tabular-nums">{formatarMoeda(os.preco)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Horas</dt>
                        <dd className="tabular-nums text-muted-foreground">
                          {os.horasRealizadas !== null
                            ? `${formatarHoras(os.horasRealizadas)} / ${formatarHoras(os.horasEstimadas)}`
                            : formatarHoras(os.horasEstimadas)}
                        </dd>
                      </div>
                      {os.dataPrevisaoEntrega ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Entrega</dt>
                          <dd
                            className={cn(
                              'flex items-center gap-1 tabular-nums',
                              os.atrasada ? 'font-medium text-red-400' : 'text-muted-foreground',
                            )}
                          >
                            {os.atrasada ? (
                              <AlertTriangle className="h-3 w-3" aria-label="Atrasada" />
                            ) : null}
                            {formatarData(os.dataPrevisaoEntrega)}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </article>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Menu do cartão — o caminho acessível por teclado para mover uma OS. */
function MenuCartao({
  os,
  statusAtual,
  onMover,
  onDuplicar,
}: {
  os: CartaoOS;
  statusAtual: StatusOS;
  onMover: (status: StatusOS) => void;
  onDuplicar: () => void;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          aria-label={`Ações da OS ${os.numero}`}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Mover para</DropdownMenuLabel>
        {FLUXO_KANBAN.filter((s) => s !== statusAtual).map((status) => (
          <DropdownMenuItem key={status} onSelect={() => onMover(status)}>
            {LABEL_STATUS_OS[status]}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href={`/orcamento/${os.id}`}>
            <Pencil className="h-4 w-4" aria-hidden />
            Editar orçamento
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicar}>
          <Copy className="h-4 w-4" aria-hidden />
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onMover('cancelado')} className="text-red-400 focus:text-red-400">
          Cancelar OS
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
