'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, FileDown, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import { LABEL_STATUS_OS, LABEL_TIPO_OS, STATUS_OS, type StatusOS, type TipoOS } from '@/types';

interface Props {
  osId: string;
  numero: string;
  statusAtual: string;
  clienteNome: string;
  clienteTelefone: string | null;
  tipo: string;
  descricao: string;
  preco: number;
  validadeDias: number;
  economiaPecaNova: { valor: number; pct: number } | null;
}

export function AcoesOS({
  osId,
  numero,
  statusAtual,
  clienteNome,
  clienteTelefone,
  tipo,
  descricao,
  preco,
  validadeDias,
  economiaPecaNova,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [mudando, setMudando] = React.useState(false);
  const [excluindo, setExcluindo] = React.useState(false);

  const mudarStatus = async (status: string): Promise<void> => {
    setMudando(true);
    try {
      const resposta = await fetch(`/api/ordens/${osId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível alterar o status.',
        );
      }
      toast.success(`Status alterado para "${LABEL_STATUS_OS[status as StatusOS]}".`);
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setMudando(false);
    }
  };

  const duplicar = async (): Promise<void> => {
    try {
      const resposta = await fetch(`/api/ordens/${osId}/duplicar`, { method: 'POST' });
      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível duplicar.',
        );
      }
      const dados = (corpo as { dados: { id: string; numero: string } }).dados;
      toast.success(`Duplicada como ${dados.numero}.`);
      router.push(`/orcamento/${dados.id}`);
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    }
  };

  const excluir = async (): Promise<void> => {
    setExcluindo(true);
    try {
      const resposta = await fetch(`/api/ordens/${osId}`, { method: 'DELETE' });
      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível excluir a OS.',
        );
      }
      toast.success(`OS ${numero} excluída.`);
      router.push('/ordens');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setExcluindo(false);
    }
  };

  const enviarWhatsApp = (): void => {
    const linhas = [
      `*Orçamento ${numero}* — Recuperadora Menegatti`,
      '',
      `Cliente: ${clienteNome}`,
      `Serviço: ${descricao}`,
      `Tipo: ${LABEL_TIPO_OS[tipo as TipoOS] ?? tipo}`,
      '',
      `*Valor: ${formatarMoeda(preco)}*`,
      economiaPecaNova
        ? `\nPeça nova no mercado custaria mais ${formatarMoeda(economiaPecaNova.valor)} ` +
          `— economia de ${formatarPercentual(economiaPecaNova.pct, 0)}.`
        : '',
      '',
      `Orçamento válido por ${validadeDias} dias.`,
    ].filter(Boolean);

    const numeroLimpo = (clienteTelefone ?? '').replace(/\D/g, '');
    const destino = numeroLimpo.length >= 10 ? `55${numeroLimpo}` : '';
    const texto = encodeURIComponent(linhas.join('\n'));
    window.open(`https://wa.me/${destino}?text=${texto}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={statusAtual} onValueChange={(v) => void mudarStatus(v)} disabled={mudando}>
        <SelectTrigger className="w-44" aria-label="Alterar status da OS">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OS.map((status) => (
            <SelectItem key={status} value={status}>
              {LABEL_STATUS_OS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button asChild variant="secondary">
        <Link href={`/orcamento/${osId}`}>
          <Pencil className="h-4 w-4" />
          Editar
        </Link>
      </Button>

      <Button asChild variant="secondary">
        <a href={`/api/ordens/${osId}/pdf`} target="_blank" rel="noopener noreferrer">
          <FileDown className="h-4 w-4" />
          PDF
        </a>
      </Button>

      <Button variant="secondary" onClick={enviarWhatsApp}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>

      <Button variant="ghost" onClick={() => void duplicar()}>
        <Copy className="h-4 w-4" />
        Duplicar
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="text-red-400 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a OS {numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem e seus itens serão removidos definitivamente. OS já faturadas ou pagas não
              podem ser excluídas — nesses casos, altere o status para &quot;cancelado&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void excluir()}
              className="bg-gradient-alerta text-white"
              disabled={excluindo}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
