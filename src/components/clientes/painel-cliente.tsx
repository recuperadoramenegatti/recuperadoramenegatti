'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { extrairMensagemErro } from '@/lib/utils';
import type { ClienteComMetricas } from '@/types';

export interface FormularioCliente {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  observacoes: string;
  ativo: boolean;
}

const VAZIO: FormularioCliente = {
  nome: '',
  documento: '',
  telefone: '',
  email: '',
  cidade: '',
  estado: '',
  observacoes: '',
  ativo: true,
};

/** Modal de cadastro e edição de cliente. */
export function PainelCliente({
  aberto,
  cliente,
  onFechar,
}: {
  aberto: boolean;
  cliente: ClienteComMetricas | null;
  onFechar: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const [dados, setDados] = React.useState<FormularioCliente>(VAZIO);
  const [salvando, setSalvando] = React.useState(false);
  const [erroNome, setErroNome] = React.useState('');

  React.useEffect(() => {
    if (!aberto) return;
    setErroNome('');
    setDados(
      cliente
        ? {
            nome: cliente.nome,
            documento: cliente.documento ?? '',
            telefone: cliente.telefone ?? '',
            email: cliente.email ?? '',
            cidade: cliente.cidade ?? '',
            estado: cliente.estado ?? '',
            observacoes: cliente.observacoes ?? '',
            ativo: cliente.ativo,
          }
        : VAZIO,
    );
  }, [aberto, cliente]);

  const definir = <K extends keyof FormularioCliente>(
    campo: K,
    valor: FormularioCliente[K],
  ): void => {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  };

  const salvar = async (): Promise<void> => {
    if (dados.nome.trim().length < 2) {
      setErroNome('Informe o nome do cliente');
      return;
    }
    setSalvando(true);
    try {
      const resposta = await fetch(cliente ? `/api/clientes/${cliente.id}` : '/api/clientes', {
        method: cliente ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });

      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível salvar o cliente.',
        );
      }

      toast.success(cliente ? 'Cliente atualizado.' : `Cliente "${dados.nome}" cadastrado.`);
      onFechar();
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (): Promise<void> => {
    if (!cliente) return;
    try {
      const resposta = await fetch(`/api/clientes/${cliente.id}`, { method: 'DELETE' });
      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível remover o cliente.',
        );
      }
      const dadosResposta = (corpo as { dados: { mensagem: string } }).dados;
      toast.success(dadosResposta.mensagem);
      onFechar();
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? undefined : onFechar())}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" aria-hidden />
            {cliente ? `Editar ${cliente.nome}` : 'Novo cliente'}
          </DialogTitle>
          <DialogDescription>
            {cliente
              ? `${cliente.totalOS} OS no histórico · margem média de ${cliente.margemMedia.toFixed(1)}%`
              : 'Apenas o nome é obrigatório.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cli-nome">Nome / Razão social *</Label>
            <Input
              id="cli-nome"
              value={dados.nome}
              onChange={(e) => {
                definir('nome', e.target.value);
                setErroNome('');
              }}
              placeholder="Transportes São João Ltda"
              aria-invalid={Boolean(erroNome)}
              className={erroNome ? 'border-red-500/50' : undefined}
            />
            {erroNome ? <p className="text-xs text-red-400">{erroNome}</p> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cli-doc">CNPJ / CPF</Label>
              <Input
                id="cli-doc"
                value={dados.documento}
                onChange={(e) => definir('documento', e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-tel">Telefone</Label>
              <Input
                id="cli-tel"
                value={dados.telefone}
                onChange={(e) => definir('telefone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cli-email">E-mail</Label>
            <Input
              id="cli-email"
              type="email"
              value={dados.email}
              onChange={(e) => definir('email', e.target.value)}
              placeholder="contato@empresa.com.br"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <div className="space-y-1.5">
              <Label htmlFor="cli-cidade">Cidade</Label>
              <Input
                id="cli-cidade"
                value={dados.cidade}
                onChange={(e) => definir('cidade', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cli-uf">UF</Label>
              <Input
                id="cli-uf"
                value={dados.estado}
                onChange={(e) => definir('estado', e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cli-obs">Observações</Label>
            <Textarea
              id="cli-obs"
              value={dados.observacoes}
              onChange={(e) => definir('observacoes', e.target.value)}
              rows={2}
              placeholder="Condições de pagamento combinadas, contato responsável, particularidades…"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] px-3.5 py-2.5">
            <span className="text-sm">
              Cliente ativo
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Clientes inativos não aparecem na busca do orçamento.
              </span>
            </span>
            <Switch
              checked={dados.ativo}
              onCheckedChange={(v) => definir('ativo', v)}
              aria-label="Cliente ativo"
            />
          </label>
        </div>

        <DialogFooter className="sm:justify-between">
          {cliente ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {cliente.nome}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se o cliente tiver OS no histórico, ele será apenas inativado — excluí-lo
                    apagaria receita já reconhecida no DRE.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void excluir()}
                    className="bg-gradient-alerta text-white"
                  >
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onFechar} type="button">
              Cancelar
            </Button>
            <Button onClick={() => void salvar()} carregando={salvando} type="button">
              {!salvando ? <Save className="h-4 w-4" /> : null}
              {cliente ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
