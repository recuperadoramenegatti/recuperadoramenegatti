'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, ClipboardList } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/comum/empty-state';
import { Button } from '@/components/ui/button';
import { BadgePrioridade, BadgeStatus, BadgeTipo, IndicadorMargem } from '@/components/dashboard/badges-os';
import { cn } from '@/lib/utils';
import { formatarData, formatarHoras, formatarMoeda } from '@/lib/formatacao';
import type { CartaoOS } from '@/components/ordens/kanban';
import type { ParametrosBase } from '@/types';

type Coluna = 'numero' | 'cliente' | 'preco' | 'margem' | 'horas' | 'entrega';

export function TabelaOrdens({
  ordens,
  parametros,
}: {
  ordens: CartaoOS[];
  parametros: ParametrosBase;
}): React.JSX.Element {
  const [ordenacao, setOrdenacao] = React.useState<{ coluna: Coluna; asc: boolean }>({
    coluna: 'numero',
    asc: false,
  });

  const ordenadas = React.useMemo(() => {
    const valor = (os: CartaoOS): string | number => {
      switch (ordenacao.coluna) {
        case 'cliente':
          return os.clienteNome.toLowerCase();
        case 'preco':
          return os.preco;
        case 'margem':
          return os.margem;
        case 'horas':
          return os.horasRealizadas ?? os.horasEstimadas;
        case 'entrega':
          return os.dataPrevisaoEntrega ?? '';
        default:
          return os.numero;
      }
    };

    return [...ordens].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const comparacao = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR');
      return ordenacao.asc ? comparacao : -comparacao;
    });
  }, [ordens, ordenacao]);

  const alternar = (coluna: Coluna): void => {
    setOrdenacao((atual) =>
      atual.coluna === coluna ? { coluna, asc: !atual.asc } : { coluna, asc: false },
    );
  };

  if (ordens.length === 0) {
    return (
      <EmptyState
        icone={ClipboardList}
        titulo="Nenhuma OS encontrada"
        descricao="Ajuste os filtros acima ou crie um novo orçamento."
        acao={
          <Button asChild>
            <Link href="/orcamento">Novo orçamento</Link>
          </Button>
        }
      />
    );
  }

  const Cabecalho = ({
    coluna,
    children,
    alinhamento = 'left',
  }: {
    coluna: Coluna;
    children: React.ReactNode;
    alinhamento?: 'left' | 'right';
  }): React.JSX.Element => (
    <TableHead
      className={alinhamento === 'right' ? 'text-right' : undefined}
      // aria-sort pertence ao cabeçalho da coluna, não ao botão dentro dele.
      aria-sort={
        ordenacao.coluna === coluna ? (ordenacao.asc ? 'ascending' : 'descending') : 'none'
      }
    >
      <button
        type="button"
        onClick={() => alternar(coluna)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          ordenacao.coluna === coluna && 'text-foreground',
        )}
      >
        {children}
        {ordenacao.coluna === coluna ? (
          <span aria-hidden className="text-[9px]">
            {ordenacao.asc ? '▲' : '▼'}
          </span>
        ) : null}
      </button>
    </TableHead>
  );

  return (
    <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] px-2 py-2 shadow-card backdrop-blur-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Cabecalho coluna="numero">OS</Cabecalho>
            <Cabecalho coluna="cliente">Cliente</Cabecalho>
            <TableHead>Tipo</TableHead>
            <Cabecalho coluna="horas" alinhamento="right">
              Horas
            </Cabecalho>
            <Cabecalho coluna="preco" alinhamento="right">
              Valor
            </Cabecalho>
            <Cabecalho coluna="margem" alinhamento="right">
              Margem
            </Cabecalho>
            <TableHead>Status</TableHead>
            <Cabecalho coluna="entrega" alinhamento="right">
              Entrega
            </Cabecalho>
            <TableHead className="w-10" aria-label="Ações" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {ordenadas.map((os) => (
            <TableRow key={os.id}>
              <TableCell className="font-mono text-xs font-medium">{os.numero}</TableCell>
              <TableCell className="max-w-48 truncate">{os.clienteNome}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <BadgeTipo tipo={os.tipo} />
                  <BadgePrioridade prioridade={os.prioridade} />
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {os.horasRealizadas !== null ? (
                  <span title="realizadas / estimadas">
                    {formatarHoras(os.horasRealizadas)}
                    <span className="text-muted-foreground/60">
                      {' '}
                      / {formatarHoras(os.horasEstimadas)}
                    </span>
                  </span>
                ) : (
                  formatarHoras(os.horasEstimadas)
                )}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatarMoeda(os.preco)}
              </TableCell>
              <TableCell>
                <IndicadorMargem margem={os.margem} parametros={parametros} className="text-right" />
              </TableCell>
              <TableCell>
                <BadgeStatus status={os.status} />
              </TableCell>
              <TableCell
                className={cn(
                  'text-right text-xs tabular-nums',
                  os.atrasada ? 'font-medium text-red-400' : 'text-muted-foreground',
                )}
              >
                {os.dataPrevisaoEntrega ? formatarData(os.dataPrevisaoEntrega) : '—'}
              </TableCell>
              <TableCell>
                <Link
                  href={`/ordens/${os.id}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--superficie-4)] hover:text-foreground"
                  aria-label={`Abrir OS ${os.numero}`}
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
