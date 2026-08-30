'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calculator, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GRUPOS_PARAMETROS, DESCRICOES_PARAMETROS } from '@/lib/constants';
import { calcularDerivados } from '@/lib/precificacao';
import { cn, extrairMensagemErro, numero } from '@/lib/utils';
import { formatarHoras, formatarMoeda } from '@/lib/formatacao';
import type { CentroCustoCalculado, ParametrosBase } from '@/types';

/** Campos que representam dinheiro, para prefixar com R$. */
const MONETARIOS = new Set<keyof ParametrosBase>([
  'folhaBrutaMensal',
  'despesasAdministrativas',
  'energiaEletrica',
  'manutencaoPreventiva',
  'depreciacaoMensal',
  'salariosAdministrativos',
  'prolabore',
  'aluguel',
  'outrasDespesasFixas',
  'metaFaturamentoMensal',
]);

/** Campos percentuais. */
const PERCENTUAIS = new Set<keyof ParametrosBase>([
  'ociosidadePct',
  'aliquotaImpostos',
  'margemMinima',
  'margemIdeal',
  'margemPadrao',
  'markupMateriaisPadrao',
  'descontoToleradoPecaNova',
  'concentracaoClienteMaxPct',
  'limiarProximidadePecaNova',
]);

/**
 * Edição dos parâmetros financeiros.
 *
 * O quadro de taxas ao lado recalcula a cada tecla, ANTES de salvar — o
 * usuário vê o efeito de mudar a folha ou a ociosidade sobre o custo/hora
 * de cada centro antes de confirmar.
 */
export function AbaParametros({
  parametros,
  centros,
}: {
  parametros: ParametrosBase;
  centros: CentroCustoCalculado[];
}): React.JSX.Element {
  const router = useRouter();
  const [valores, setValores] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(parametros).map(([k, v]) => [k, String(v)])),
  );
  const [salvando, setSalvando] = React.useState(false);

  const parametrosEditados = React.useMemo<ParametrosBase>(() => {
    const saida = { ...parametros };
    for (const chave of Object.keys(parametros) as Array<keyof ParametrosBase>) {
      saida[chave] = numero(valores[chave], parametros[chave]);
    }
    return saida;
  }, [valores, parametros]);

  const derivados = React.useMemo(
    () => calcularDerivados(parametrosEditados),
    [parametrosEditados],
  );

  const alterado = React.useMemo(
    () =>
      (Object.keys(parametros) as Array<keyof ParametrosBase>).some(
        (chave) => numero(valores[chave], parametros[chave]) !== parametros[chave],
      ),
    [valores, parametros],
  );

  const definir = (chave: string, valor: string): void => {
    setValores((atual) => ({ ...atual, [chave]: valor }));
  };

  const restaurar = (): void => {
    setValores(Object.fromEntries(Object.entries(parametros).map(([k, v]) => [k, String(v)])));
    toast.info('Alterações descartadas.');
  };

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    try {
      const resposta = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valores: Object.fromEntries(
            (Object.keys(parametros) as Array<keyof ParametrosBase>).map((chave) => [
              chave,
              numero(valores[chave], parametros[chave]),
            ]),
          ),
        }),
      });

      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível salvar os parâmetros.',
        );
      }

      toast.success('Parâmetros salvos. Todos os cálculos do sistema já usam os novos valores.');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {GRUPOS_PARAMETROS.map((grupo) => (
          <section
            key={grupo.titulo}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm"
          >
            <header className="mb-4">
              <h3 className="text-sm font-semibold tracking-tight">{grupo.titulo}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{grupo.descricao}</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              {grupo.chaves.map((chave) => {
                const monetario = MONETARIOS.has(chave);
                const percentual = PERCENTUAIS.has(chave);
                const mudou = numero(valores[chave], parametros[chave]) !== parametros[chave];

                return (
                  <div key={chave} className="space-y-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label htmlFor={`param-${chave}`} className="cursor-help">
                          {DESCRICOES_PARAMETROS[chave]}
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Valor atual: {parametros[chave]}
                      </TooltipContent>
                    </Tooltip>

                    <div className="relative">
                      {monetario ? (
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R$
                        </span>
                      ) : null}
                      <Input
                        id={`param-${chave}`}
                        type="text"
                        inputMode="decimal"
                        value={valores[chave] ?? ''}
                        onChange={(e) => definir(chave, e.target.value)}
                        className={cn(
                          'tabular-nums',
                          monetario && 'pl-9',
                          percentual && 'pr-8',
                          mudou && 'border-primary/50 bg-primary/[0.06]',
                        )}
                      />
                      {percentual ? (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          %
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Quadro de taxas, recalculado ao vivo ─────────────────── */}
      <div className="xl:sticky xl:top-20 xl:h-fit">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Calculator className="h-4 w-4 text-primary" aria-hidden />
            Taxas resultantes
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {alterado
              ? 'Prévia com os valores editados, ainda não salvos.'
              : 'Valores vigentes no sistema.'}
          </p>

          <dl className="mt-4 space-y-2.5 text-sm">
            <Taxa rotulo="Folha com encargos" valor={formatarMoeda(derivados.folhaComEncargos)} sufixo="/mês" />
            <Taxa
              rotulo="Horas disponíveis por operador"
              valor={formatarHoras(derivados.horasDisponiveisPorOperador)}
              sufixo="/mês"
            />
            <Taxa
              rotulo="Horas produtivas por operador"
              valor={formatarHoras(derivados.horasProdutivasPorOperador)}
              sufixo="/mês"
            />
            <Taxa
              rotulo="Capacidade total"
              valor={formatarHoras(derivados.totalHorasProdutivas)}
              sufixo="/mês"
            />

            <Separator className="my-3" />

            <Taxa rotulo="THH — Taxa Hora-Homem" valor={formatarMoeda(derivados.thh)} sufixo="/h" destaque />
            <Taxa rotulo="Overhead indireto" valor={formatarMoeda(derivados.overheadIndiretoMensal)} sufixo="/mês" />
            <Taxa rotulo="CFR — Custo Fixo Rateado" valor={formatarMoeda(derivados.cfr)} sufixo="/h" destaque />
            <Taxa rotulo="Hora de setup (THH + CFR)" valor={formatarMoeda(derivados.custoHoraSetup)} sufixo="/h" />

            <Separator className="my-3" />

            <p className="label-caps">Custo por hora dos centros</p>
            {centros.map((centro) => (
              <Taxa
                key={centro.id}
                rotulo={centro.nome}
                valor={formatarMoeda(derivados.thh + centro.thm + derivados.cfr)}
                sufixo="/h"
              />
            ))}

            <Separator className="my-3" />

            <Taxa
              rotulo="Custos fixos totais"
              valor={formatarMoeda(derivados.custosFixosTotaisMensais)}
              sufixo="/mês"
            />
          </dl>

          <div className="mt-5 flex gap-2">
            <Button
              onClick={() => void salvar()}
              carregando={salvando}
              disabled={!alterado}
              className="flex-1"
            >
              {!salvando ? <Save className="h-4 w-4" /> : null}
              Salvar e recalcular
            </Button>
            {alterado ? (
              <Button variant="ghost" size="icon" onClick={restaurar} aria-label="Descartar alterações">
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {alterado ? (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Ao salvar, todos os cálculos passam a usar estes valores. As OS já registradas
              mantêm as taxas congeladas no momento em que foram orçadas.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Taxa({
  rotulo,
  valor,
  sufixo,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  sufixo?: string;
  destaque?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={cn('shrink-0 tabular-nums', destaque && 'font-semibold text-primary')}>
        {valor}
        {sufixo ? <span className="text-xs text-muted-foreground">{sufixo}</span> : null}
      </dd>
    </div>
  );
}
