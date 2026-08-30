'use client';

import * as React from 'react';
import { BellOff, ShieldCheck } from 'lucide-react';
import { AlertCard } from '@/components/dashboard/alert-card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/comum/empty-state';
import { contarPorNivel } from '@/lib/alertas-cliente';
import type { Alerta, NivelAlerta } from '@/types';

const FILTROS: Array<{ chave: NivelAlerta | 'todos'; rotulo: string }> = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'critico', rotulo: 'Críticos' },
  { chave: 'alto', rotulo: 'Altos' },
];

/** Feed lateral de alertas determinísticos, com filtro por urgência. */
export function AlertsFeed({ alertas }: { alertas: Alerta[] }): React.JSX.Element {
  const [filtro, setFiltro] = React.useState<NivelAlerta | 'todos'>('todos');
  const contagem = contarPorNivel(alertas);

  const visiveis = filtro === 'todos' ? alertas : alertas.filter((a) => a.nivel === filtro);

  return (
    <section
      id="alertas"
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm"
      aria-labelledby="titulo-alertas"
    >
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="titulo-alertas" className="text-sm font-semibold tracking-tight">
            Alertas do sistema
          </h2>
          {contagem.critico > 0 ? (
            <Badge variant="destructive" pulsante>
              {contagem.critico} crítico{contagem.critico > 1 ? 's' : ''}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Calculados em tempo real a partir dos seus dados, sem depender de IA.
        </p>

        {alertas.length > 0 ? (
          <div className="mt-3 flex gap-1">
            {FILTROS.map((opcao) => {
              const total =
                opcao.chave === 'todos' ? alertas.length : contagem[opcao.chave as NivelAlerta];
              if (total === 0 && opcao.chave !== 'todos') return null;
              return (
                <button
                  key={opcao.chave}
                  type="button"
                  onClick={() => setFiltro(opcao.chave)}
                  aria-pressed={filtro === opcao.chave}
                  className={
                    filtro === opcao.chave
                      ? 'rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium'
                      : 'rounded-lg px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground'
                  }
                >
                  {opcao.rotulo} ({total})
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {alertas.length === 0 ? (
        <EmptyState
          compacto
          icone={ShieldCheck}
          titulo="Nenhum alerta ativo"
          descricao="Margens, ocupação, concentração de clientes e prazos estão dentro dos limites configurados."
        />
      ) : visiveis.length === 0 ? (
        <EmptyState
          compacto
          icone={BellOff}
          titulo="Nada nesta urgência"
          descricao="Troque o filtro para ver os demais alertas."
        />
      ) : (
        <div className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
          {visiveis.map((alerta) => (
            <AlertCard key={alerta.id} alerta={alerta} />
          ))}
        </div>
      )}
    </section>
  );
}
