/**
 * Registro de ícones para os KPIs.
 *
 * Componentes React não atravessam a fronteira entre Server e Client
 * Components: o Next serializa as props, e uma referência de componente não
 * é serializável. Por isso o servidor passa o NOME do ícone e o componente
 * cliente resolve o desenho a partir daqui.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgePercent,
  ClipboardCheck,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';

export const ICONES_KPI = {
  faturamento: TrendingUp,
  margem: BadgePercent,
  ebitda: Activity,
  ordens: ClipboardCheck,
  equilibrio: Scale,
  entradas: ArrowUpCircle,
  saidas: ArrowDownCircle,
  carteira: Wallet,
  alerta: AlertTriangle,
} satisfies Record<string, LucideIcon>;

export type NomeIconeKPI = keyof typeof ICONES_KPI;
