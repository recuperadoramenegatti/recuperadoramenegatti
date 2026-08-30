import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatadorBRLCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatadorNumero = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** R$ 1.234,56 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'R$ 0,00';
  return formatadorBRL.format(valor);
}

/** R$ 1,2 mi — para eixos de gráfico e espaços apertados. */
export function formatarMoedaCompacta(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'R$ 0';
  return formatadorBRLCompacto.format(valor);
}

/** 12,5% */
export function formatarPercentual(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '0,0%';
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** +12,5% / −3,0% — para variações. */
export function formatarVariacao(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  const sinal = valor > 0 ? '+' : valor < 0 ? '−' : '';
  return `${sinal}${Math.abs(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

export function formatarNumero(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '0';
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
}

/** 8,5h */
export function formatarHoras(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '0h';
  return `${formatadorNumero.format(valor)}h`;
}

function paraData(valor: Date | string | null | undefined): Date | null {
  if (!valor) return null;
  const data = typeof valor === 'string' ? parseISO(valor) : valor;
  return isValid(data) ? data : null;
}

export function formatarData(valor: Date | string | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : '—';
}

export function formatarDataHora(valor: Date | string | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
}

export function formatarDataInput(valor: Date | string | null | undefined): string {
  const data = paraData(valor);
  return data ? format(data, 'yyyy-MM-dd') : '';
}

/** Maiúscula só na primeira letra — `capitalize` do CSS capitaliza cada palavra. */
export function capitalizarPrimeira(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "agosto de 2026" */
export function formatarPeriodoExtenso(periodo: string): string {
  const [ano, mes] = periodo.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  if (!isValid(data)) return periodo;
  return format(data, "MMMM 'de' yyyy", { locale: ptBR });
}

/** "ago/26" */
export function formatarPeriodoCurto(periodo: string): string {
  const [ano, mes] = periodo.split('-');
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  if (!isValid(data)) return periodo;
  return format(data, 'MMM/yy', { locale: ptBR });
}

/** "há 3 horas" */
export function formatarTempoRelativo(valor: Date | string | null | undefined): string {
  const data = paraData(valor);
  if (!data) return 'nunca';
  const diff = Date.now() - data.getTime();
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const meses = Math.floor(dias / 30);
  return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

export function formatarDocumento(doc: string | null | undefined): string {
  if (!doc) return '—';
  const digitos = doc.replace(/\D/g, '');
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

export function formatarTelefone(tel: string | null | undefined): string {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return tel;
}

export function formatarTamanhoArquivo(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${unidades[i]}`;
}

/** Converte texto digitado em número, tolerando "1.234,56" e "R$". */
export function parseNumeroBR(texto: string): number {
  if (!texto) return 0;
  const limpo = texto
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/** Período "YYYY-MM" de uma data. */
export function periodoDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

/** Período do mês atual. */
export function periodoAtual(): string {
  return periodoDe(new Date());
}

/** Soma (ou subtrai) meses a um período "YYYY-MM". */
export function deslocarPeriodo(periodo: string, meses: number): string {
  const [ano, mes] = periodo.split('-').map(Number);
  const data = new Date(ano, (mes ?? 1) - 1 + meses, 1);
  return periodoDe(data);
}

/** Primeiro e último instante de um período "YYYY-MM". */
export function intervaloPeriodo(periodo: string): { inicio: Date; fim: Date } {
  const [ano, mes] = periodo.split('-').map(Number);
  const inicio = new Date(ano, (mes ?? 1) - 1, 1, 0, 0, 0, 0);
  const fim = new Date(ano, mes ?? 1, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

export function diasNoPeriodo(periodo: string): number {
  const { fim } = intervaloPeriodo(periodo);
  return fim.getDate();
}

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncar(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  return `${texto.slice(0, limite - 1)}…`;
}

export function iniciais(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}
