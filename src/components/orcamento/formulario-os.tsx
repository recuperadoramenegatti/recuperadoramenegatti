'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Copy,
  FileDown,
  FilePlus2,
  MessageCircle,
  Package,
  PlayCircle,
  Plus,
  Save,
  Settings2,
  Trash2,
  Wrench,
} from 'lucide-react';
import { CampoNumerico } from '@/components/orcamento/campo-numerico';
import { ResultadoTempoReal } from '@/components/orcamento/resultado-tempo-real';
import { SeletorCliente, type ClienteResumo } from '@/components/orcamento/seletor-cliente';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { estadoInicial, useOrcamento, type EstadoOrcamento } from '@/hooks/use-orcamento';
import { cn, extrairMensagemErro } from '@/lib/utils';
import { formatarHoras, formatarMoeda, formatarPercentual } from '@/lib/formatacao';
import {
  LABEL_PRIORIDADE,
  LABEL_TIPO_OS,
  PRIORIDADES,
  TIPOS_OS,
  type ContextoCalculo,
  type Prioridade,
  type TipoOS,
} from '@/types';

interface Props {
  contexto: ContextoCalculo;
  clientesIniciais: ClienteResumo[];
  numeroSugerido: string;
  /** Quando presente, o formulário edita uma OS existente. */
  osId?: string;
  estadoInicialCarregado?: EstadoOrcamento;
}

type Erros = Partial<Record<'clienteId' | 'descricao' | 'tempos' | 'precoPecaNova', string>>;

export function FormularioOS({
  contexto,
  clientesIniciais,
  numeroSugerido,
  osId,
  estadoInicialCarregado,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [clientes, setClientes] = React.useState(clientesIniciais);
  const [erros, setErros] = React.useState<Erros>({});
  const [salvando, setSalvando] = React.useState(false);
  const [gerandoPDF, setGerandoPDF] = React.useState(false);
  const [precoManual, setPrecoManual] = React.useState(
    estadoInicialCarregado?.precoFinal !== null && estadoInicialCarregado?.precoFinal !== undefined,
  );

  const orcamento = useOrcamento(
    contexto,
    estadoInicialCarregado ?? estadoInicial(contexto, numeroSugerido),
  );
  const { estado, resultado, resultadoImediato, definir, definirHorasCentro } = orcamento;

  const ehRecuperacao = estado.tipo === 'recuperacao';
  const temSolda = React.useMemo(() => {
    const solda = contexto.centros.find((c) => c.slug.includes('solda'));
    return solda ? (estado.horasPorCentro[solda.id] ?? 0) > 0 : false;
  }, [contexto.centros, estado.horasPorCentro]);

  // ── Validação ──────────────────────────────────────────────────────────
  const validar = (): boolean => {
    const novos: Erros = {};
    if (!estado.clienteId) novos.clienteId = 'Selecione um cliente';
    if (estado.descricao.trim().length < 3) novos.descricao = 'Descreva o serviço';
    if (orcamento.totalHoras <= 0) novos.tempos = 'Informe as horas de trabalho';
    if (ehRecuperacao && (!estado.precoPecaNova || estado.precoPecaNova <= 0)) {
      novos.precoPecaNova = 'Obrigatório para recuperação de peça';
    }
    setErros(novos);

    if (Object.keys(novos).length > 0) {
      toast.error('Revise os campos destacados antes de salvar.');
      return false;
    }
    return true;
  };

  const montarCorpo = (status: 'orcado' | 'em_execucao'): Record<string, unknown> => ({
    numero: estado.numero || undefined,
    clienteId: estado.clienteId,
    tipo: estado.tipo,
    descricao: estado.descricao,
    prioridade: estado.prioridade,
    status,
    tempos: Object.entries(estado.horasPorCentro)
      .filter(([, horas]) => horas > 0)
      .map(([centroId, horas]) => ({ centroId, horas })),
    horasSetup: estado.horasSetup,
    custoMateriais: estado.custoMateriais,
    markupMateriais: estado.markupMateriais,
    custoConsumiveis: estado.custoConsumiveis,
    custoFerramentas: estado.custoFerramentas,
    insumosExtras: estado.insumosExtras
      .filter((i) => i.nome.trim() !== '')
      .map((i) => ({ nome: i.nome, valor: i.valor })),
    margemDesejada: estado.margemDesejada,
    descontoMaximo: estado.descontoMaximo,
    validadeOrcamento: estado.validadeOrcamento,
    precoFinal: precoManual ? estado.precoFinal : null,
    precoPecaNova: ehRecuperacao ? estado.precoPecaNova : null,
    fontePrecoPecaNova: ehRecuperacao ? estado.fontePrecoPecaNova : null,
    descontoTolerado: ehRecuperacao ? estado.descontoTolerado : null,
    dataPrevisaoEntrega: estado.dataPrevisaoEntrega || null,
    observacoes: estado.observacoes || null,
  });

  const salvar = async (status: 'orcado' | 'em_execucao'): Promise<void> => {
    if (!validar()) return;
    setSalvando(true);

    try {
      const url = osId ? `/api/ordens/${osId}` : '/api/ordens';
      const resposta = await fetch(url, {
        method: osId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarCorpo(status)),
      });

      const corpo: unknown = await resposta.json();

      if (!resposta.ok) {
        const mensagem =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível salvar.';
        throw new Error(mensagem);
      }

      const dados = (corpo as { dados: { id: string; numero: string } }).dados;
      toast.success(
        status === 'em_execucao'
          ? `OS ${dados.numero} convertida em execução.`
          : `Orçamento ${dados.numero} salvo.`,
      );
      router.push(`/ordens/${dados.id}`);
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const exportarPDF = async (): Promise<void> => {
    if (!validar()) return;
    setGerandoPDF(true);
    try {
      const resposta = await fetch('/api/ordens/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(montarCorpo('orcado')),
      });

      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        const mensagem =
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível gerar o PDF.';
        throw new Error(mensagem);
      }

      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orcamento_${estado.numero || numeroSugerido}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('PDF gerado.');
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setGerandoPDF(false);
    }
  };

  const enviarWhatsApp = (): void => {
    const cliente = clientes.find((c) => c.id === estado.clienteId);
    const linhas = [
      `*Orçamento ${estado.numero || ''}* — Recuperadora Menegatti`,
      '',
      cliente ? `Cliente: ${cliente.nome}` : '',
      `Serviço: ${estado.descricao || '—'}`,
      `Tipo: ${LABEL_TIPO_OS[estado.tipo]}`,
      '',
      `Prazo estimado de execução: ${formatarHoras(resultado.custo.horasTotais)} de trabalho`,
      `*Valor: ${formatarMoeda(resultado.precoFinal)}*`,
      '',
      resultado.comparativoPecaNova
        ? `Peça nova no mercado: ${formatarMoeda(resultado.comparativoPecaNova.precoPecaNova)}\n` +
          `Sua economia: ${formatarMoeda(resultado.comparativoPecaNova.economiaCliente)} ` +
          `(${formatarPercentual(resultado.comparativoPecaNova.economiaPct, 0)})`
        : '',
      '',
      `Orçamento válido por ${estado.validadeOrcamento} dias.`,
    ].filter(Boolean);

    const texto = encodeURIComponent(linhas.join('\n'));
    window.open(`https://wa.me/?text=${texto}`, '_blank', 'noopener,noreferrer');
  };

  const novoOrcamento = (): void => {
    orcamento.redefinir(numeroSugerido);
    setErros({});
    setPrecoManual(false);
    toast.info('Formulário limpo para um novo orçamento.');
  };

  const duplicar = (): void => {
    orcamento.carregar({ ...estado, numero: '' });
    setErros({});
    toast.info('Orçamento duplicado. Ajuste o que for necessário e salve.');
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      {/* ═══════════════ PAINEL ESQUERDO — FORMULÁRIO ═══════════════ */}
      <div className="space-y-5 pb-2">
        {/* Bloco 1 — Identificação */}
        <Bloco titulo="Identificação" numero={1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="numero">Número da OS</Label>
              <Input
                id="numero"
                value={estado.numero}
                onChange={(e) => definir('numero', e.target.value)}
                placeholder={numeroSugerido}
                className="font-mono"
              />
            </div>

            <SeletorCliente
              clientes={clientes}
              valor={estado.clienteId}
              onChange={(id) => {
                definir('clienteId', id);
                setErros((e) => ({ ...e, clienteId: undefined }));
              }}
              onClienteCriado={(cliente) => setClientes((atual) => [...atual, cliente])}
              erro={erros.clienteId}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de serviço</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIPOS_OS.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => definir('tipo', tipo as TipoOS)}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-xs font-medium transition-all duration-200',
                    estado.tipo === tipo
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground',
                  )}
                  aria-pressed={estado.tipo === tipo}
                >
                  {LABEL_TIPO_OS[tipo as TipoOS]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição do serviço</Label>
            <Textarea
              id="descricao"
              value={estado.descricao}
              onChange={(e) => {
                definir('descricao', e.target.value);
                setErros((x) => ({ ...x, descricao: undefined }));
              }}
              placeholder="Ex.: Recuperação de eixo traseiro — retífica de munhão, solda de reconstituição e balanceamento"
              rows={3}
              aria-invalid={Boolean(erros.descricao)}
              className={cn(erros.descricao && 'border-red-500/50')}
            />
            {erros.descricao ? <p className="text-xs text-red-400">{erros.descricao}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="entrega">Previsão de entrega</Label>
              <Input
                id="entrega"
                type="date"
                value={estado.dataPrevisaoEntrega}
                onChange={(e) => definir('dataPrevisaoEntrega', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select
                value={estado.prioridade}
                onValueChange={(v) => definir('prioridade', v as Prioridade)}
              >
                <SelectTrigger id="prioridade">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {LABEL_PRIORIDADE[p as Prioridade]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Bloco>

        {/* Bloco 2 — Tempo por centro de custo */}
        <Bloco
          titulo="Tempo por centro de custo"
          numero={2}
          acessorio={
            <Badge variant={orcamento.totalHoras > 0 ? 'default' : 'secondary'}>
              {formatarHoras(orcamento.totalHoras)} no total
            </Badge>
          }
        >
          {erros.tempos ? (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erros.tempos}
            </p>
          ) : null}

          <div className="space-y-4">
            {contexto.centros.map((centro) => {
              const horas = estado.horasPorCentro[centro.id] ?? 0;
              const custo = horas * centro.custoHora;
              return (
                <CampoNumerico
                  key={centro.id}
                  id={`centro-${centro.id}`}
                  rotulo={centro.nome}
                  valor={horas}
                  onChange={(v) => {
                    definirHorasCentro(centro.id, v);
                    setErros((e) => ({ ...e, tempos: undefined }));
                  }}
                  min={0}
                  max={40}
                  passo={0.5}
                  sufixo="h"
                  comSlider
                  auxiliar={
                    horas > 0 ? (
                      <span className="tabular-nums">
                        {formatarHoras(horas)} × {formatarMoeda(centro.custoHora)} ={' '}
                        <span className="font-medium text-foreground">{formatarMoeda(custo)}</span>
                      </span>
                    ) : (
                      <span className="tabular-nums">{formatarMoeda(centro.custoHora)}/h</span>
                    )
                  }
                />
              );
            })}

            <Separator />

            <CampoNumerico
              id="setup"
              rotulo="Setup / preparação"
              valor={estado.horasSetup}
              onChange={(v) => definir('horasSetup', v)}
              min={0}
              max={10}
              passo={0.25}
              sufixo="h"
              comSlider
              corTrilha="bg-gradient-azul"
              auxiliar={
                <span className="tabular-nums">
                  {formatarHoras(estado.horasSetup)} ×{' '}
                  {formatarMoeda(contexto.derivados.custoHoraSetup)} ={' '}
                  <span className="font-medium text-foreground">
                    {formatarMoeda(resultadoImediato.custo.custoSetup)}
                  </span>
                </span>
              }
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              O setup não usa máquina específica, então cobra mão de obra (THH) mais overhead
              (CFR): {formatarMoeda(contexto.derivados.thh)} +{' '}
              {formatarMoeda(contexto.derivados.cfr)} ={' '}
              {formatarMoeda(contexto.derivados.custoHoraSetup)}/h.
            </p>
          </div>
        </Bloco>

        {/* Bloco 3 — Insumos e materiais */}
        <Bloco titulo="Insumos e materiais" numero={3} icone={Package}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNumerico
              id="materiais"
              rotulo="Custo de materiais / peças"
              valor={estado.custoMateriais}
              onChange={(v) => definir('custoMateriais', v)}
              prefixo="R$"
            />
            <CampoNumerico
              id="markup"
              rotulo="Markup sobre materiais"
              valor={estado.markupMateriais}
              onChange={(v) => definir('markupMateriais', v)}
              min={0}
              max={100}
              passo={5}
              sufixo="%"
              comSlider
              auxiliar={
                estado.custoMateriais > 0 ? (
                  <span className="tabular-nums">
                    +{formatarMoeda(resultadoImediato.custo.valorMarkupMateriais)}
                  </span>
                ) : undefined
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {temSolda ? (
              <CampoNumerico
                id="consumiveis"
                rotulo="Consumíveis de solda"
                valor={estado.custoConsumiveis}
                onChange={(v) => definir('custoConsumiveis', v)}
                prefixo="R$"
                auxiliar="eletrodo, arame, gás"
              />
            ) : null}
            <CampoNumerico
              id="ferramentas"
              rotulo="Desgaste de ferramentas"
              valor={estado.custoFerramentas}
              onChange={(v) => definir('custoFerramentas', v)}
              prefixo="R$"
              auxiliar="pastilhas, rebolos, brocas"
            />
          </div>

          {/* Itens extras */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Itens extras</Label>
              <span className="text-[11px] text-muted-foreground">
                {estado.insumosExtras.length}/10
              </span>
            </div>

            {estado.insumosExtras.map((item) => (
              <div key={item.chave} className="flex items-center gap-2">
                <Input
                  value={item.nome}
                  onChange={(e) => orcamento.atualizarInsumoExtra(item.chave, 'nome', e.target.value)}
                  placeholder="Nome do item"
                  className="flex-1"
                  aria-label="Nome do item extra"
                />
                <div className="relative w-32 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={item.valor === 0 ? '' : String(item.valor)}
                    onChange={(e) =>
                      orcamento.atualizarInsumoExtra(item.chave, 'valor', e.target.value)
                    }
                    placeholder="0"
                    className="pl-9 text-right tabular-nums"
                    aria-label="Valor do item extra"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => orcamento.removerInsumoExtra(item.chave)}
                  aria-label={`Remover ${item.nome || 'item'}`}
                  className="shrink-0 text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={orcamento.adicionarInsumoExtra}
              disabled={!orcamento.podeAdicionarInsumo}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Adicionar item extra
            </Button>
          </div>
        </Bloco>

        {/* Bloco 4 — Configurações do orçamento */}
        <Bloco titulo="Configurações do orçamento" numero={4} icone={Settings2}>
          <CampoNumerico
            id="margem"
            rotulo="Margem de contribuição desejada"
            valor={estado.margemDesejada}
            onChange={(v) => definir('margemDesejada', v)}
            min={10}
            max={60}
            passo={1}
            sufixo="%"
            comSlider
            corTrilha={
              estado.margemDesejada < contexto.parametros.margemMinima
                ? 'bg-gradient-alerta'
                : estado.margemDesejada >= contexto.parametros.margemIdeal
                  ? 'bg-gradient-sucesso'
                  : 'bg-gradient-hero'
            }
            auxiliar={
              <span>
                mín. {formatarPercentual(contexto.parametros.margemMinima, 0)} · ideal{' '}
                {formatarPercentual(contexto.parametros.margemIdeal, 0)}
              </span>
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <CampoNumerico
              id="desconto"
              rotulo="Desconto máximo na negociação"
              valor={estado.descontoMaximo}
              onChange={(v) => definir('descontoMaximo', v)}
              min={0}
              max={40}
              passo={1}
              sufixo="%"
              comSlider
            />
            <CampoNumerico
              id="validade"
              rotulo="Validade do orçamento"
              valor={estado.validadeOrcamento}
              onChange={(v) => definir('validadeOrcamento', v)}
              min={1}
              max={180}
              passo={1}
              sufixo="dias"
            />
          </div>

          {/* Preço fechado manualmente */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={precoManual}
                onChange={(e) => {
                  setPrecoManual(e.target.checked);
                  definir('precoFinal', e.target.checked ? resultado.precoSugerido : null);
                }}
                className="h-4 w-4 rounded border-white/20 bg-transparent accent-amber-500"
              />
              <span>Definir preço final manualmente</span>
            </label>

            {precoManual ? (
              <div className="mt-3">
                <CampoNumerico
                  id="preco-final"
                  rotulo="Preço fechado com o cliente"
                  valor={estado.precoFinal ?? 0}
                  onChange={(v) => definir('precoFinal', v)}
                  prefixo="R$"
                  auxiliar={
                    <span>sugerido: {formatarMoeda(resultado.precoSugerido)}</span>
                  }
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  A margem no painel ao lado recalcula sobre este valor.
                </p>
              </div>
            ) : null}
          </div>
        </Bloco>

        {/* Bloco 5 — Comparativo com peça nova (só recuperação) */}
        {ehRecuperacao ? (
          <Bloco titulo="Comparativo com peça nova" numero={5} icone={Wrench}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <CampoNumerico
                  id="peca-nova"
                  rotulo="Preço da peça nova no mercado *"
                  valor={estado.precoPecaNova ?? 0}
                  onChange={(v) => {
                    definir('precoPecaNova', v > 0 ? v : null);
                    setErros((e) => ({ ...e, precoPecaNova: undefined }));
                  }}
                  prefixo="R$"
                  className={cn(erros.precoPecaNova && '[&_input]:border-red-500/50')}
                />
                {erros.precoPecaNova ? (
                  <p className="mt-1 text-xs text-red-400">{erros.precoPecaNova}</p>
                ) : null}
              </div>

              <CampoNumerico
                id="desconto-tolerado"
                rotulo="Economia mínima vs peça nova"
                valor={estado.descontoTolerado}
                onChange={(v) => definir('descontoTolerado', v)}
                min={0}
                max={90}
                passo={5}
                sufixo="%"
                comSlider
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fonte-preco">Fonte / referência do preço</Label>
              <Input
                id="fonte-preco"
                value={estado.fontePrecoPecaNova}
                onChange={(e) => definir('fontePrecoPecaNova', e.target.value)}
                placeholder="Ex.: cotação Distribuidora XYZ em 12/08, tabela do fabricante"
              />
            </div>
          </Bloco>
        ) : null}

        {/* Observações */}
        <Bloco titulo="Observações internas" numero={ehRecuperacao ? 6 : 5}>
          <Textarea
            value={estado.observacoes}
            onChange={(e) => definir('observacoes', e.target.value)}
            placeholder="Anotações que não vão para o cliente: particularidades da peça, combinações com o comprador, riscos do serviço…"
            rows={2}
            aria-label="Observações internas"
          />
        </Bloco>

        {/*
          Ações. A barra é fixa no rodapé da coluna; o espaçador abaixo dela
          garante que o último bloco do formulário role até ficar visível em
          vez de terminar escondido atrás dela.
        */}
        <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 rounded-2xl border border-white/15 bg-[#161f33] p-3 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
          <Button onClick={() => void salvar('orcado')} carregando={salvando} className="flex-1 sm:flex-none">
            <Save className="h-4 w-4" />
            {osId ? 'Salvar alterações' : 'Salvar orçamento'}
          </Button>

          <Button
            variant="success"
            onClick={() => void salvar('em_execucao')}
            disabled={salvando}
            className="flex-1 sm:flex-none"
          >
            <PlayCircle className="h-4 w-4" />
            Converter em OS
          </Button>

          <Button
            variant="secondary"
            onClick={() => void exportarPDF()}
            disabled={salvando}
            carregando={gerandoPDF}
          >
            {!gerandoPDF ? <FileDown className="h-4 w-4" /> : null}
            PDF
          </Button>

          <Button variant="secondary" onClick={enviarWhatsApp} disabled={salvando}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>

          <Button variant="ghost" onClick={duplicar} disabled={salvando}>
            <Copy className="h-4 w-4" />
            Duplicar
          </Button>

          <Button variant="ghost" onClick={novoOrcamento} disabled={salvando}>
            <FilePlus2 className="h-4 w-4" />
            Novo
          </Button>
        </div>

        <div className="h-2" aria-hidden />
      </div>

      {/* ═══════════════ PAINEL DIREITO — RESULTADO ═══════════════ */}
      <div className="xl:sticky xl:top-20 xl:h-fit">
        <ResultadoTempoReal
          resultado={resultado}
          parametros={contexto.parametros}
          calculando={orcamento.calculando}
          descontoMaximo={estado.descontoMaximo}
        />
      </div>
    </div>
  );
}

function Bloco({
  titulo,
  numero,
  icone: Icone,
  acessorio,
  children,
}: {
  titulo: string;
  numero: number;
  icone?: React.ComponentType<{ className?: string }>;
  acessorio?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.07] text-xs font-bold text-muted-foreground">
            {numero}
          </span>
          {Icone ? <Icone className="h-4 w-4 text-primary" aria-hidden /> : null}
          {titulo}
        </h2>
        {acessorio}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
