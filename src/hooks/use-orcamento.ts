'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { precificarOS } from '@/lib/precificacao';
import { idCurto, numero } from '@/lib/utils';
import type {
  ContextoCalculo,
  EntradaCalculoOS,
  InsumoExtra,
  Prioridade,
  ResultadoPrecificacao,
  TipoOS,
} from '@/types';

/** Estado completo do formulário de orçamento. */
export interface EstadoOrcamento {
  numero: string;
  clienteId: string;
  tipo: TipoOS;
  descricao: string;
  prioridade: Prioridade;
  dataPrevisaoEntrega: string;

  /** horas por centro, indexadas pelo id do centro */
  horasPorCentro: Record<string, number>;
  horasSetup: number;

  custoMateriais: number;
  markupMateriais: number;
  custoConsumiveis: number;
  custoFerramentas: number;
  insumosExtras: Array<InsumoExtra & { chave: string }>;

  margemDesejada: number;
  descontoMaximo: number;
  validadeOrcamento: number;

  precoFinal: number | null;
  precoPecaNova: number | null;
  fontePrecoPecaNova: string;
  descontoTolerado: number;

  observacoes: string;
}

export function estadoInicial(ctx: ContextoCalculo, numeroSugerido = ''): EstadoOrcamento {
  const p = ctx.parametros;
  return {
    numero: numeroSugerido,
    clienteId: '',
    tipo: 'recuperacao',
    descricao: '',
    prioridade: 'normal',
    dataPrevisaoEntrega: '',
    horasPorCentro: Object.fromEntries(ctx.centros.map((c) => [c.id, 0])),
    horasSetup: p.setupPadraoHoras,
    custoMateriais: 0,
    markupMateriais: p.markupMateriaisPadrao,
    custoConsumiveis: 0,
    custoFerramentas: 0,
    insumosExtras: [],
    margemDesejada: p.margemPadrao,
    descontoMaximo: 0,
    validadeOrcamento: p.validadeOrcamentoPadrao,
    precoFinal: null,
    precoPecaNova: null,
    fontePrecoPecaNova: '',
    descontoTolerado: p.descontoToleradoPecaNova,
    observacoes: '',
  };
}

const MAX_INSUMOS_EXTRAS = 10;

export interface UseOrcamento {
  estado: EstadoOrcamento;
  /** Resultado com debounce de 300ms — o que a tela exibe. */
  resultado: ResultadoPrecificacao;
  /** Resultado instantâneo — usado nos custos inline de cada centro. */
  resultadoImediato: ResultadoPrecificacao;
  calculando: boolean;
  definir: <K extends keyof EstadoOrcamento>(campo: K, valor: EstadoOrcamento[K]) => void;
  definirHorasCentro: (centroId: string, horas: number) => void;
  adicionarInsumoExtra: () => void;
  atualizarInsumoExtra: (chave: string, campo: 'nome' | 'valor', valor: string | number) => void;
  removerInsumoExtra: (chave: string) => void;
  redefinir: (novoNumero?: string) => void;
  carregar: (estado: EstadoOrcamento) => void;
  totalHoras: number;
  podeAdicionarInsumo: boolean;
}

/**
 * Estado e cálculo da tela de orçamento.
 *
 * A precificação roda com a MESMA função pura que o servidor usa ao salvar,
 * então o número na tela é o número que vai para o banco.
 */
export function useOrcamento(ctx: ContextoCalculo, inicial?: EstadoOrcamento): UseOrcamento {
  const [estado, setEstado] = useState<EstadoOrcamento>(() => inicial ?? estadoInicial(ctx));

  const entrada = useMemo<EntradaCalculoOS>(
    () => ({
      tipo: estado.tipo,
      horasSetup: numero(estado.horasSetup),
      tempos: Object.entries(estado.horasPorCentro).map(([centroId, horas]) => ({
        centroId,
        horas: numero(horas),
      })),
      custoMateriais: numero(estado.custoMateriais),
      markupMateriais: numero(estado.markupMateriais),
      custoConsumiveis: numero(estado.custoConsumiveis),
      custoFerramentas: numero(estado.custoFerramentas),
      insumosExtras: estado.insumosExtras.map((i) => ({ nome: i.nome, valor: numero(i.valor) })),
      margemDesejada: numero(estado.margemDesejada),
      precoPecaNova: estado.precoPecaNova,
      descontoTolerado: estado.descontoTolerado,
      precoFinal: estado.precoFinal,
    }),
    [estado],
  );

  const entradaDebounced = useDebounce(entrada, 300);

  const resultadoImediato = useMemo(() => precificarOS(entrada, ctx), [entrada, ctx]);
  const resultado = useMemo(() => precificarOS(entradaDebounced, ctx), [entradaDebounced, ctx]);

  const calculando = entrada !== entradaDebounced;

  const definir = useCallback(
    <K extends keyof EstadoOrcamento>(campo: K, valor: EstadoOrcamento[K]): void => {
      setEstado((atual) => ({ ...atual, [campo]: valor }));
    },
    [],
  );

  const definirHorasCentro = useCallback((centroId: string, horas: number): void => {
    setEstado((atual) => ({
      ...atual,
      horasPorCentro: { ...atual.horasPorCentro, [centroId]: Math.max(0, numero(horas)) },
    }));
  }, []);

  const adicionarInsumoExtra = useCallback((): void => {
    setEstado((atual) => {
      if (atual.insumosExtras.length >= MAX_INSUMOS_EXTRAS) return atual;
      return {
        ...atual,
        insumosExtras: [...atual.insumosExtras, { chave: idCurto(), nome: '', valor: 0 }],
      };
    });
  }, []);

  const atualizarInsumoExtra = useCallback(
    (chave: string, campo: 'nome' | 'valor', valor: string | number): void => {
      setEstado((atual) => ({
        ...atual,
        insumosExtras: atual.insumosExtras.map((item) =>
          item.chave === chave
            ? {
                ...item,
                [campo]: campo === 'valor' ? Math.max(0, numero(valor)) : String(valor),
              }
            : item,
        ),
      }));
    },
    [],
  );

  const removerInsumoExtra = useCallback((chave: string): void => {
    setEstado((atual) => ({
      ...atual,
      insumosExtras: atual.insumosExtras.filter((item) => item.chave !== chave),
    }));
  }, []);

  const redefinir = useCallback(
    (novoNumero?: string): void => {
      setEstado(estadoInicial(ctx, novoNumero ?? ''));
    },
    [ctx],
  );

  const carregar = useCallback((novo: EstadoOrcamento): void => {
    setEstado(novo);
  }, []);

  const totalHoras = useMemo(
    () =>
      Object.values(estado.horasPorCentro).reduce((acc, h) => acc + numero(h), 0) +
      numero(estado.horasSetup),
    [estado.horasPorCentro, estado.horasSetup],
  );

  return {
    estado,
    resultado,
    resultadoImediato,
    calculando,
    definir,
    definirHorasCentro,
    adicionarInsumoExtra,
    atualizarInsumoExtra,
    removerInsumoExtra,
    redefinir,
    carregar,
    totalHoras,
    podeAdicionarInsumo: estado.insumosExtras.length < MAX_INSUMOS_EXTRAS,
  };
}
