'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Award, ExternalLink, Plus, Search, Users } from 'lucide-react';
import { PainelCliente } from '@/components/clientes/painel-cliente';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/comum/empty-state';
import { IndicadorMargem } from '@/components/dashboard/badges-os';
import { cn } from '@/lib/utils';
import { formatarData, formatarDocumento, formatarMoeda, formatarTelefone } from '@/lib/formatacao';
import type { ClassificacaoCliente, ClienteComMetricas, ParametrosBase } from '@/types';

const CLASSIFICACAO: Record<
  ClassificacaoCliente,
  { rotulo: string; emoji: string; variante: React.ComponentProps<typeof Badge>['variant']; dica: string }
> = {
  premium: {
    rotulo: 'Premium',
    emoji: '🥇',
    variante: 'default',
    dica: 'Mais de R$ 10.000 por mês de faturamento médio.',
  },
  regular: {
    rotulo: 'Regular',
    emoji: '🥈',
    variante: 'info',
    dica: 'Entre R$ 2.000 e R$ 10.000 por mês.',
  },
  esporadico: {
    rotulo: 'Esporádico',
    emoji: '🥉',
    variante: 'secondary',
    dica: 'Menos de R$ 2.000 por mês.',
  },
};

type Ordenacao = 'volume' | 'margem' | 'nome' | 'os' | 'recente';

export function ListaClientes({
  clientes,
  parametros,
}: {
  clientes: ClienteComMetricas[];
  parametros: ParametrosBase;
}): React.JSX.Element {
  const [busca, setBusca] = React.useState('');
  const [ordenacao, setOrdenacao] = React.useState<Ordenacao>('volume');
  const [mostrarInativos, setMostrarInativos] = React.useState(false);
  const [emEdicao, setEmEdicao] = React.useState<ClienteComMetricas | null>(null);
  const [painelAberto, setPainelAberto] = React.useState(false);

  const visiveis = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = clientes.filter((c) => {
      if (!mostrarInativos && !c.ativo) return false;
      if (!termo) return true;
      return (
        c.nome.toLowerCase().includes(termo) ||
        (c.documento ?? '').toLowerCase().includes(termo) ||
        (c.cidade ?? '').toLowerCase().includes(termo)
      );
    });

    return filtrados.sort((a, b) => {
      switch (ordenacao) {
        case 'margem':
          return b.margemMedia - a.margemMedia;
        case 'nome':
          return a.nome.localeCompare(b.nome, 'pt-BR');
        case 'os':
          return b.totalOS - a.totalOS;
        case 'recente':
          return (b.ultimaOS ?? '').localeCompare(a.ultimaOS ?? '');
        default:
          return b.volumeFaturado - a.volumeFaturado;
      }
    });
  }, [clientes, busca, ordenacao, mostrarInativos]);

  const abrirNovo = (): void => {
    setEmEdicao(null);
    setPainelAberto(true);
  };

  const abrirEdicao = (cliente: ClienteComMetricas): void => {
    setEmEdicao(cliente);
    setPainelAberto(true);
  };

  const totalFaturado = visiveis.reduce((acc, c) => acc + c.volumeFaturado, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, documento ou cidade…"
            className="pl-9"
            aria-label="Buscar clientes"
          />
        </div>

        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              ['volume', 'Volume'],
              ['margem', 'Margem'],
              ['os', 'OS'],
              ['nome', 'Nome'],
            ] as Array<[Ordenacao, string]>
          ).map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              onClick={() => setOrdenacao(chave)}
              aria-pressed={ordenacao === chave}
              className={cn(
                'rounded-lg px-2.5 py-1 text-xs transition-colors',
                ordenacao === chave
                  ? 'bg-white/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="mostrar-inativos"
            checked={mostrarInativos}
            onCheckedChange={setMostrarInativos}
          />
          <Label htmlFor="mostrar-inativos" className="cursor-pointer normal-case tracking-normal">
            Incluir inativos
          </Label>
        </div>

        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo={clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
          descricao={
            clientes.length === 0
              ? 'Cadastre o primeiro cliente para começar a orçar serviços.'
              : 'Ajuste a busca ou inclua os clientes inativos.'
          }
          acao={
            clientes.length === 0 ? <Button onClick={abrirNovo}>Cadastrar cliente</Button> : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-2 shadow-card backdrop-blur-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">OS</TableHead>
                <TableHead className="text-right">Faturado</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                <TableHead className="text-right">Margem média</TableHead>
                <TableHead className="text-right">Última OS</TableHead>
                <TableHead className="w-20" aria-label="Ações" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {visiveis.map((cliente) => {
                const classe = CLASSIFICACAO[cliente.classificacao];
                const margemBaixa = cliente.totalOS > 0 && cliente.margemMedia < parametros.margemMinima;

                return (
                  <TableRow key={cliente.id} className={cn(!cliente.ativo && 'opacity-50')}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(cliente)}
                        className="text-left font-medium transition-colors hover:text-primary"
                      >
                        {cliente.nome}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {[formatarDocumento(cliente.documento), cliente.cidade]
                          .filter((v) => v && v !== '—')
                          .join(' · ') || cliente.codigo}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      <div>{formatarTelefone(cliente.telefone)}</div>
                      {cliente.email ? <div className="truncate">{cliente.email}</div> : null}
                    </TableCell>

                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            <Badge variant={classe.variante}>
                              {classe.emoji} {classe.rotulo}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {classe.dica}
                          <div className="mt-1 text-muted-foreground">
                            Média atual: {formatarMoeda(cliente.faturamentoMensalMedio)}/mês
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    <TableCell className="text-right tabular-nums">{cliente.totalOS}</TableCell>

                    <TableCell className="text-right font-medium tabular-nums">
                      {formatarMoeda(cliente.volumeFaturado)}
                    </TableCell>

                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatarMoeda(cliente.ticketMedio)}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {margemBaixa ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle
                                className="h-3.5 w-3.5 shrink-0 text-red-400"
                                aria-label="Margem média abaixo do mínimo"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              Margem média abaixo do mínimo de {parametros.margemMinima}%. Reveja a
                              precificação deste cliente.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        {cliente.totalOS > 0 ? (
                          <IndicadorMargem margem={cliente.margemMedia} parametros={parametros} />
                        ) : (
                          <span className="text-sm text-muted-foreground/60">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right text-xs text-muted-foreground">
                      {cliente.ultimaOS ? formatarData(cliente.ultimaOS) : '—'}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {cliente.totalOS > 0 ? (
                          <Link
                            href={`/ordens?clienteId=${cliente.id}&visao=tabela`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                            aria-label={`Ver OS de ${cliente.nome}`}
                            title="Ver histórico de OS"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {visiveis.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
          <span>
            {visiveis.length} cliente{visiveis.length > 1 ? 's' : ''} ·{' '}
            {formatarMoeda(totalFaturado)} faturado no total
          </span>
          <span className="flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5" aria-hidden />
            Classificação automática pelo faturamento mensal médio
          </span>
        </div>
      ) : null}

      <PainelCliente
        aberto={painelAberto}
        cliente={emEdicao}
        onFechar={() => setPainelAberto(false)}
      />
    </div>
  );
}
