'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, extrairMensagemErro } from '@/lib/utils';
import { formatarDocumento } from '@/lib/formatacao';

export interface ClienteResumo {
  id: string;
  nome: string;
  documento: string | null;
  cidade: string | null;
}

interface Props {
  clientes: ClienteResumo[];
  valor: string;
  onChange: (clienteId: string) => void;
  onClienteCriado: (cliente: ClienteResumo) => void;
  erro?: string;
}

/** Autocomplete de clientes com cadastro rápido inline. */
export function SeletorCliente({
  clientes,
  valor,
  onChange,
  onClienteCriado,
  erro,
}: Props): React.JSX.Element {
  const [aberto, setAberto] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [modalAberto, setModalAberto] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selecionado = clientes.find((c) => c.id === valor) ?? null;

  const filtrados = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 30);
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          (c.documento ?? '').toLowerCase().includes(termo) ||
          (c.cidade ?? '').toLowerCase().includes(termo),
      )
      .slice(0, 30);
  }, [clientes, busca]);

  React.useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (evento: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="cliente-busca">Cliente</Label>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:brightness-125"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Cadastrar novo
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          id="cliente-busca"
          onClick={() => setAberto((v) => !v)}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border bg-[var(--superficie-2)] px-3 py-2 text-sm transition-colors',
            'hover:border-[var(--borda-2)] focus:outline-none focus:ring-2 focus:ring-primary/30',
            erro ? 'border-red-500/50' : 'border-[var(--borda-1)]',
          )}
          aria-haspopup="listbox"
          aria-expanded={aberto}
        >
          <span className={cn('truncate', !selecionado && 'text-muted-foreground/60')}>
            {selecionado ? selecionado.nome : 'Selecione ou busque um cliente'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>

        {aberto ? (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--borda-1)] bg-popover shadow-card backdrop-blur-xl">
            <div className="flex items-center gap-2 border-b border-[var(--borda-1)] px-3">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, documento ou cidade…"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                aria-label="Buscar cliente"
              />
            </div>

            <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
              {filtrados.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {clientes.length === 0
                    ? 'Nenhum cliente cadastrado ainda.'
                    : 'Nenhum cliente encontrado.'}
                  <button
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      setModalAberto(true);
                    }}
                    className="mt-2 block w-full text-primary hover:underline"
                  >
                    Cadastrar {busca.trim() ? `"${busca.trim()}"` : 'um cliente'}
                  </button>
                </li>
              ) : (
                filtrados.map((cliente) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={cliente.id === valor}
                      onClick={() => {
                        onChange(cliente.id);
                        setAberto(false);
                        setBusca('');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[var(--superficie-4)]"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0 text-primary',
                          cliente.id === valor ? 'opacity-100' : 'opacity-0',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{cliente.nome}</span>
                        {cliente.documento || cliente.cidade ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {[
                              cliente.documento ? formatarDocumento(cliente.documento) : null,
                              cliente.cidade,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>

      {erro ? <p className="text-xs text-red-400">{erro}</p> : null}

      <ModalNovoCliente
        aberto={modalAberto}
        nomeInicial={busca}
        onFechar={() => setModalAberto(false)}
        onCriado={(cliente) => {
          onClienteCriado(cliente);
          onChange(cliente.id);
          setModalAberto(false);
          setBusca('');
        }}
      />
    </div>
  );
}

function ModalNovoCliente({
  aberto,
  nomeInicial,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  nomeInicial: string;
  onFechar: () => void;
  onCriado: (cliente: ClienteResumo) => void;
}): React.JSX.Element {
  const [nome, setNome] = React.useState(nomeInicial);
  const [documento, setDocumento] = React.useState('');
  const [telefone, setTelefone] = React.useState('');
  const [cidade, setCidade] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    if (aberto) setNome(nomeInicial);
  }, [aberto, nomeInicial]);

  const salvar = async (): Promise<void> => {
    if (nome.trim().length < 2) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    setSalvando(true);
    try {
      const resposta = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, documento, telefone, cidade, ativo: true }),
      });
      const corpo: unknown = await resposta.json();

      if (!resposta.ok) {
        const mensagem =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível cadastrar o cliente.';
        throw new Error(mensagem);
      }

      const dados = (corpo as { dados: ClienteResumo }).dados;
      toast.success(`Cliente "${dados.nome}" cadastrado.`);
      onCriado(dados);
      setNome('');
      setDocumento('');
      setTelefone('');
      setCidade('');
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? undefined : onFechar())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" aria-hidden />
            Cadastro rápido de cliente
          </DialogTitle>
          <DialogDescription>
            Apenas o nome é obrigatório. Os demais dados podem ser completados depois em Clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="novo-nome">Nome / Razão social *</Label>
            <Input
              id="novo-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Transportes São João Ltda"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="novo-doc">CNPJ / CPF</Label>
              <Input
                id="novo-doc"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="novo-tel">Telefone</Label>
              <Input
                id="novo-tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nova-cidade">Cidade</Label>
            <Input
              id="nova-cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Cidade"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onFechar} type="button">
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} carregando={salvando} type="button">
            Cadastrar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
