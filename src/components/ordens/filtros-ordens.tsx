'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { LABEL_STATUS_OS, LABEL_TIPO_OS, STATUS_OS, TIPOS_OS } from '@/types';

export interface OpcaoFiltro {
  id: string;
  nome: string;
}

/**
 * Barra de filtros das OS. O estado vive na URL, então um filtro montado
 * pode ser compartilhado ou salvo nos favoritos.
 */
export function FiltrosOrdens({
  clientes,
  centros,
  visao,
  total,
}: {
  clientes: OpcaoFiltro[];
  centros: OpcaoFiltro[];
  visao: 'kanban' | 'tabela';
  total: number;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busca, setBusca] = React.useState(searchParams.get('busca') ?? '');
  const [avancados, setAvancados] = React.useState(false);
  const buscaDebounced = useDebounce(busca, 300);
  const primeiroRender = React.useRef(true);

  const definir = React.useCallback(
    (chave: string, valor: string | null): void => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor === null || valor === '' || valor === 'todos') params.delete(chave);
      else params.set(chave, valor);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    definir('busca', buscaDebounced || null);
  }, [buscaDebounced, definir]);

  const ativos = ['status', 'tipo', 'clienteId', 'centroId', 'dataInicio', 'dataFim', 'margemMax', 'valorMin']
    .filter((chave) => searchParams.get(chave))
    .length;

  const limpar = (): void => {
    setBusca('');
    router.replace(`${pathname}?visao=${visao}`, { scroll: false });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número, cliente ou descrição…"
            className="pl-9"
            aria-label="Buscar ordens de serviço"
          />
        </div>

        <Select
          value={searchParams.get('status') ?? 'todos'}
          onValueChange={(v) => definir('status', v)}
        >
          <SelectTrigger className="w-44" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_OS.map((status) => (
              <SelectItem key={status} value={status}>
                {LABEL_STATUS_OS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={searchParams.get('tipo') ?? 'todos'} onValueChange={(v) => definir('tipo', v)}>
          <SelectTrigger className="w-48" aria-label="Filtrar por tipo de serviço">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_OS.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {LABEL_TIPO_OS[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={avancados || ativos > 2 ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setAvancados((v) => !v)}
          aria-expanded={avancados}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Mais filtros
          {ativos > 0 ? (
            <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">
              {ativos}
            </Badge>
          ) : null}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {total} {total === 1 ? 'OS' : 'OS'}
          </span>

          <div className="flex rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-1">
            <BotaoVisao atual={visao} alvo="kanban" icone={LayoutGrid} rotulo="Kanban" onSelect={definir} />
            <BotaoVisao atual={visao} alvo="tabela" icone={List} rotulo="Tabela" onSelect={definir} />
          </div>
        </div>
      </div>

      {avancados ? (
        <div className="grid gap-3 rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-cliente">Cliente</Label>
            <Select
              value={searchParams.get('clienteId') ?? 'todos'}
              onValueChange={(v) => definir('clienteId', v)}
            >
              <SelectTrigger id="filtro-cliente">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-centro">Centro de custo</Label>
            <Select
              value={searchParams.get('centroId') ?? 'todos'}
              onValueChange={(v) => definir('centroId', v)}
            >
              <SelectTrigger id="filtro-centro">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os centros</SelectItem>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-inicio">Orçadas a partir de</Label>
            <Input
              id="filtro-inicio"
              type="date"
              value={searchParams.get('dataInicio') ?? ''}
              onChange={(e) => definir('dataInicio', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-fim">Orçadas até</Label>
            <Input
              id="filtro-fim"
              type="date"
              value={searchParams.get('dataFim') ?? ''}
              onChange={(e) => definir('dataFim', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-margem-min">Margem mínima (%)</Label>
            <Input
              id="filtro-margem-min"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={searchParams.get('margemMin') ?? ''}
              onChange={(e) => definir('margemMin', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-margem-max">Margem máxima (%)</Label>
            <Input
              id="filtro-margem-max"
              type="number"
              inputMode="decimal"
              placeholder="100"
              value={searchParams.get('margemMax') ?? ''}
              onChange={(e) => definir('margemMax', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-valor-min">Valor mínimo (R$)</Label>
            <Input
              id="filtro-valor-min"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={searchParams.get('valorMin') ?? ''}
              onChange={(e) => definir('valorMin', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-valor-max">Valor máximo (R$)</Label>
            <Input
              id="filtro-valor-max"
              type="number"
              inputMode="decimal"
              placeholder="Sem limite"
              value={searchParams.get('valorMax') ?? ''}
              onChange={(e) => definir('valorMax', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <Button variant="ghost" size="sm" onClick={limpar}>
              <X className="h-4 w-4" />
              Limpar todos os filtros
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BotaoVisao({
  atual,
  alvo,
  icone: Icone,
  rotulo,
  onSelect,
}: {
  atual: string;
  alvo: string;
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  onSelect: (chave: string, valor: string) => void;
}): React.JSX.Element {
  const ativo = atual === alvo;
  return (
    <button
      type="button"
      onClick={() => onSelect('visao', alvo)}
      aria-pressed={ativo}
      title={rotulo}
      className={cn(
        'flex h-7 w-8 items-center justify-center rounded-lg transition-colors',
        ativo ? 'bg-[var(--superficie-4)] text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icone className="h-4 w-4" />
      <span className="sr-only">{rotulo}</span>
    </button>
  );
}
