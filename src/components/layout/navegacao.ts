import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Calculator,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  Receipt,
  Settings,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

export interface ItemNav {
  titulo: string;
  href: string;
  icone: LucideIcon;
  descricao: string;
  /** Marca correspondência de prefixo (ex.: /ordens/[id]). */
  prefixo?: boolean;
}

export interface GrupoNav {
  titulo: string;
  itens: ItemNav[];
}

export const NAVEGACAO: GrupoNav[] = [
  {
    titulo: 'Operação',
    itens: [
      {
        titulo: 'Dashboard',
        href: '/dashboard',
        icone: LayoutDashboard,
        descricao: 'Visão executiva do mês',
      },
      {
        titulo: 'Orçamento',
        href: '/orcamento',
        icone: Calculator,
        descricao: 'Simulador de precificação',
        prefixo: true,
      },
      {
        titulo: 'Ordens de Serviço',
        href: '/ordens',
        icone: ClipboardList,
        descricao: 'Kanban e tabela de OS',
        prefixo: true,
      },
      {
        titulo: 'Clientes',
        href: '/clientes',
        icone: Users,
        descricao: 'Carteira e rentabilidade',
        prefixo: true,
      },
    ],
  },
  {
    titulo: 'Financeiro',
    itens: [
      {
        titulo: 'DRE Gerencial',
        href: '/financeiro/dre',
        icone: Receipt,
        descricao: 'Resultado por competência e caixa',
      },
      {
        titulo: 'Fluxo de Caixa',
        href: '/financeiro/fluxo-caixa',
        icone: Wallet,
        descricao: 'Projeção dia a dia e NCG',
      },
      {
        titulo: 'Indicadores',
        href: '/indicadores',
        icone: BarChart3,
        descricao: 'KPIs avançados e histórico',
      },
    ],
  },
  {
    titulo: 'Inteligência',
    itens: [
      {
        titulo: 'Insights',
        href: '/insights',
        icone: Sparkles,
        descricao: 'Parecer gerencial com IA',
      },
      {
        titulo: 'Relatórios',
        href: '/relatorios',
        icone: FileBarChart,
        descricao: 'Exportações em PDF e Excel',
      },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      {
        titulo: 'Configurações',
        href: '/configuracoes',
        icone: Settings,
        descricao: 'Parâmetros, IA e backup',
      },
    ],
  },
];

/** Mapa href → título, usado pelos breadcrumbs. */
export const TITULOS_ROTA: Record<string, string> = Object.fromEntries(
  NAVEGACAO.flatMap((g) => g.itens.map((i) => [i.href, i.titulo])),
);
