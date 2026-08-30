'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Cog, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { cn, extrairMensagemErro, numero } from '@/lib/utils';
import { formatarMoeda } from '@/lib/formatacao';
import type { CentroCustoCalculado, ParametrosDerivados } from '@/types';

interface CentroEditavel {
  id: string | null;
  nome: string;
  qtdMaquinas: string;
  qtdOperadores: string;
  thmEstimado: string;
  ativo: boolean;
  ordem: number;
}

/** CRUD de centros de custo, com o custo/hora recalculado ao vivo. */
export function AbaCentros({
  centros,
  derivados,
}: {
  centros: Array<CentroCustoCalculado & { ativo?: boolean }>;
  derivados: ParametrosDerivados;
}): React.JSX.Element {
  const router = useRouter();
  const [novo, setNovo] = React.useState<CentroEditavel | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Cog className="h-4 w-4 text-primary" aria-hidden />
              Centros de custo
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              O custo por hora de cada centro é THH + THM + CFR. Só a THM é específica do centro —
              THH ({formatarMoeda(derivados.thh)}/h) e CFR ({formatarMoeda(derivados.cfr)}/h) vêm
              dos parâmetros gerais.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() =>
              setNovo({
                id: null,
                nome: '',
                qtdMaquinas: '1',
                qtdOperadores: '1',
                thmEstimado: '0',
                ativo: true,
                ordem: centros.length + 1,
              })
            }
            disabled={novo !== null}
          >
            <Plus className="h-4 w-4" />
            Novo centro
          </Button>
        </header>

        <div className="space-y-3">
          {novo ? (
            <LinhaCentro
              centro={novo}
              derivados={derivados}
              onCancelar={() => setNovo(null)}
              onSalvo={() => {
                setNovo(null);
                router.refresh();
              }}
            />
          ) : null}

          {centros.map((centro) => (
            <LinhaCentro
              key={centro.id}
              centro={{
                id: centro.id,
                nome: centro.nome,
                qtdMaquinas: String(centro.qtdMaquinas),
                qtdOperadores: String(centro.qtdOperadores),
                thmEstimado: String(centro.thm),
                ativo: centro.ativo ?? true,
                ordem: centro.ordem,
              }}
              derivados={derivados}
              onSalvo={() => router.refresh()}
            />
          ))}

          {centros.length === 0 && !novo ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum centro de custo cadastrado. Sem eles não é possível orçar um serviço.
            </p>
          ) : null}
        </div>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Alterar a THM de um centro muda o custo dos próximos orçamentos, mas não mexe nas OS já
        registradas — cada uma guarda as taxas do momento em que foi orçada. Um centro já usado por
        alguma OS não pode ser excluído: ele é inativado, some dos novos orçamentos e o histórico
        continua íntegro.
      </p>
    </div>
  );
}

function LinhaCentro({
  centro,
  derivados,
  onSalvo,
  onCancelar,
}: {
  centro: CentroEditavel;
  derivados: ParametrosDerivados;
  onSalvo: () => void;
  onCancelar?: () => void;
}): React.JSX.Element {
  const [dados, setDados] = React.useState(centro);
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => setDados(centro), [centro]);

  const custoHora = derivados.thh + numero(dados.thmEstimado) + derivados.cfr;
  const alterado =
    dados.nome !== centro.nome ||
    dados.qtdMaquinas !== centro.qtdMaquinas ||
    dados.qtdOperadores !== centro.qtdOperadores ||
    dados.thmEstimado !== centro.thmEstimado ||
    dados.ativo !== centro.ativo;

  const definir = <K extends keyof CentroEditavel>(campo: K, valor: CentroEditavel[K]): void => {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  };

  const salvar = async (): Promise<void> => {
    if (dados.nome.trim().length < 2) {
      toast.error('Informe o nome do centro de custo.');
      return;
    }

    setSalvando(true);
    try {
      const resposta = await fetch(dados.id ? `/api/centros/${dados.id}` : '/api/centros', {
        method: dados.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: dados.nome,
          qtdMaquinas: numero(dados.qtdMaquinas),
          qtdOperadores: numero(dados.qtdOperadores),
          thmEstimado: numero(dados.thmEstimado),
          ordem: dados.ordem,
          ativo: dados.ativo,
        }),
      });

      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível salvar o centro.',
        );
      }

      toast.success(dados.id ? 'Centro atualizado.' : `Centro "${dados.nome}" criado.`);
      onSalvo();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (): Promise<void> => {
    if (!dados.id) return;
    try {
      const resposta = await fetch(`/api/centros/${dados.id}`, { method: 'DELETE' });
      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível remover o centro.',
        );
      }
      const resultado = (corpo as { dados: { mensagem: string } }).dados;
      toast.success(resultado.mensagem);
      onSalvo();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  };

  return (
    <div
      className={cn(
        'grid items-end gap-3 rounded-xl border p-3.5 transition-colors',
        'grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_88px_88px_110px_auto]',
        alterado ? 'border-primary/40 bg-primary/[0.05]' : 'border-[var(--borda-1)] bg-[var(--superficie-2)]',
        !dados.ativo && 'opacity-60',
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`nome-${dados.id ?? 'novo'}`}>Nome do centro</Label>
        <Input
          id={`nome-${dados.id ?? 'novo'}`}
          value={dados.nome}
          onChange={(e) => definir('nome', e.target.value)}
          placeholder="Ex.: Prensa hidráulica"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`maq-${dados.id ?? 'novo'}`}>Máquinas</Label>
        <Input
          id={`maq-${dados.id ?? 'novo'}`}
          type="text"
          inputMode="numeric"
          value={dados.qtdMaquinas}
          onChange={(e) => definir('qtdMaquinas', e.target.value)}
          className="tabular-nums"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ope-${dados.id ?? 'novo'}`}>Operadores</Label>
        <Input
          id={`ope-${dados.id ?? 'novo'}`}
          type="text"
          inputMode="numeric"
          value={dados.qtdOperadores}
          onChange={(e) => definir('qtdOperadores', e.target.value)}
          className="tabular-nums"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`thm-${dados.id ?? 'novo'}`}>THM (R$/h)</Label>
        <Input
          id={`thm-${dados.id ?? 'novo'}`}
          type="text"
          inputMode="decimal"
          value={dados.thmEstimado}
          onChange={(e) => definir('thmEstimado', e.target.value)}
          className="tabular-nums"
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-24 text-right">
          <span className="label-caps block text-[10px]">Custo/hora</span>
          <span className="text-sm font-semibold tabular-nums text-primary">
            {formatarMoeda(custoHora)}
          </span>
        </div>

        {alterado || !dados.id ? (
          <Button size="icon-sm" onClick={() => void salvar()} carregando={salvando} aria-label="Salvar centro">
            {!salvando ? <Save className="h-4 w-4" /> : null}
          </Button>
        ) : null}

        {onCancelar ? (
          <Button variant="ghost" size="icon-sm" onClick={onCancelar} aria-label="Cancelar">
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : dados.id ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-red-400"
                aria-label={`Remover ${dados.nome}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover o centro {dados.nome}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se alguma OS já usou este centro, ele será apenas inativado — excluí-lo quebraria
                  o histórico de custo dessas ordens.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Manter</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void remover()}
                  className="bg-gradient-alerta text-white"
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {!dados.ativo ? (
        <div className="sm:col-span-5">
          <Badge variant="secondary">Inativo — não aparece em novos orçamentos</Badge>
        </div>
      ) : null}
    </div>
  );
}
