import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Arredonda para `casas` decimais evitando ruído de ponto flutuante. */
export function arredondar(valor: number, casas = 2): number {
  if (!Number.isFinite(valor)) return 0;
  const fator = Math.pow(10, casas);
  return Math.round((valor + Number.EPSILON) * fator) / fator;
}

/** Divisão segura: retorna `fallback` quando o divisor é 0/inválido. */
export function dividir(numerador: number, divisor: number, fallback = 0): number {
  if (!Number.isFinite(numerador) || !Number.isFinite(divisor) || divisor === 0) return fallback;
  return numerador / divisor;
}

/** Variação percentual entre dois valores. `null` quando não há base. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

export function limitar(valor: number, min: number, max: number): number {
  if (!Number.isFinite(valor)) return min;
  return Math.min(Math.max(valor, min), max);
}

/** Converte para número finito, com fallback. */
export function numero(valor: unknown, fallback = 0): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : fallback;
  if (typeof valor === 'string') {
    const n = Number(valor.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function somar<T>(itens: T[], seletor: (item: T) => number): number {
  return itens.reduce((acc, item) => acc + (Number.isFinite(seletor(item)) ? seletor(item) : 0), 0);
}

export function agruparPor<T, K extends string | number>(
  itens: T[],
  chave: (item: T) => K,
): Map<K, T[]> {
  const mapa = new Map<K, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const atual = mapa.get(k);
    if (atual) atual.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}

export function extrairMensagemErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === 'string') return erro;
  if (typeof erro === 'object' && erro !== null && 'message' in erro) {
    const m = (erro as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Erro inesperado. Tente novamente.';
}

/** Gera um id curto e legível (para chaves de UI e itens repetíveis). */
export function idCurto(): string {
  return Math.random().toString(36).slice(2, 10);
}
