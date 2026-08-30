import * as React from 'react';
import Link from 'next/link';
import { ClipboardList, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/comum/empty-state';
import { BadgeStatus, BadgeTipo, IndicadorMargem } from '@/components/dashboard/badges-os';
import { formatarData, formatarHoras, formatarMoeda } from '@/lib/formatacao';
import type { ParametrosBase } from '@/types';

export interface LinhaOSRecente {
  id: string;
  numero: string;
  clienteNome: string;
  tipo: string;
  status: string;
  horas: number;
  custo: number;
  preco: number;
  margem: number;
  data: Date;
}

export function OSRecentesTable({
  ordens,
  parametros,
}: {
  ordens: LinhaOSRecente[];
  parametros: ParametrosBase;
}): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-card backdrop-blur-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Ordens de serviço recentes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Últimas 10 OS registradas</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/ordens">
            Ver todas
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      {ordens.length === 0 ? (
        <div className="p-5 pt-0">
          <EmptyState
            icone={ClipboardList}
            titulo="Nenhuma OS registrada"
            descricao="Crie o primeiro orçamento e ele aparecerá aqui com custo, preço e margem."
            acao={
              <Button asChild>
                <Link href="/orcamento">Criar primeiro orçamento</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="px-2 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Margem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Data</TableHead>
                <TableHead className="w-10" aria-label="Ações" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordens.map((os) => (
                <TableRow key={os.id}>
                  <TableCell className="font-mono text-xs font-medium">{os.numero}</TableCell>
                  <TableCell className="max-w-40 truncate">{os.clienteNome}</TableCell>
                  <TableCell>
                    <BadgeTipo tipo={os.tipo} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatarHoras(os.horas)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatarMoeda(os.custo)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatarMoeda(os.preco)}
                  </TableCell>
                  <TableCell>
                    <IndicadorMargem
                      margem={os.margem}
                      parametros={parametros}
                      className="text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <BadgeStatus status={os.status} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatarData(os.data)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/ordens/${os.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
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
      )}
    </section>
  );
}
