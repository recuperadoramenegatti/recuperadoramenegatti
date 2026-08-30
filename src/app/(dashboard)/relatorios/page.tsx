import type { Metadata } from 'next';
import {
  BarChart3,
  Building2,
  ClipboardList,
  Cog,
  FileSpreadsheet,
  Receipt,
  Settings2,
  Timer,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/comum/page-header';
import { SeletorPeriodoRelatorio } from '@/components/relatorios/seletor-periodo';
import { Button } from '@/components/ui/button';
import { formatarPeriodoExtenso, periodoAtual } from '@/lib/formatacao';

export const metadata: Metadata = { title: 'Relatórios' };
export const dynamic = 'force-dynamic';

interface Relatorio {
  id: string;
  titulo: string;
  descricao: string;
  icone: React.ComponentType<{ className?: string }>;
  tom: 'ambar' | 'azul' | 'verde' | 'roxo';
  usaPeriodo: boolean;
}

const RELATORIOS: Relatorio[] = [
  {
    id: 'completo',
    titulo: 'Relatório gerencial completo',
    descricao:
      'Seis abas em um arquivo: DRE do mês, KPIs dos últimos 12 meses, todas as OS, clientes, centros de custo e os parâmetros que geraram os números.',
    icone: FileSpreadsheet,
    tom: 'ambar',
    usaPeriodo: true,
  },
  {
    id: 'dre-comparativo',
    titulo: 'DRE comparativo',
    descricao:
      'Três abas lado a lado: mês atual, mês anterior e o mesmo mês do ano passado. É onde a tendência aparece.',
    icone: Receipt,
    tom: 'azul',
    usaPeriodo: true,
  },
  {
    id: 'rentabilidade',
    titulo: 'Rentabilidade por serviço',
    descricao:
      'Margem, receita e ticket médio de cada tipo de OS, distribuição das margens por faixa e o painel completo de indicadores.',
    icone: TrendingUp,
    tom: 'verde',
    usaPeriodo: true,
  },
  {
    id: 'clientes',
    titulo: 'Ranking de clientes',
    descricao:
      'Toda a carteira com volume faturado, ticket médio, margem média, classificação e data da última OS.',
    icone: Users,
    tom: 'roxo',
    usaPeriodo: false,
  },
  {
    id: 'centros',
    titulo: 'Performance dos centros de custo',
    descricao:
      'Horas aplicadas contra capacidade, taxa de ocupação e receita atribuída a cada centro no período.',
    icone: Cog,
    tom: 'azul',
    usaPeriodo: true,
  },
  {
    id: 'orcado-realizado',
    titulo: 'Orçado × realizado',
    descricao:
      'Só as OS com horas registradas, com o desvio em horas e em percentual. É o relatório que corrige as estimativas futuras.',
    icone: Timer,
    tom: 'ambar',
    usaPeriodo: true,
  },
  {
    id: 'ordens',
    titulo: 'Ordens de serviço',
    descricao:
      'Todas as OS dos últimos 12 meses com custo, preço, margem, horas e as datas de cada etapa.',
    icone: ClipboardList,
    tom: 'verde',
    usaPeriodo: true,
  },
  {
    id: 'kpis',
    titulo: 'KPIs mensais',
    descricao:
      'Uma linha por mês nos últimos 12: faturamento, meta, ticket, margem, EBITDA, lucro e ocupação.',
    icone: BarChart3,
    tom: 'roxo',
    usaPeriodo: true,
  },
  {
    id: 'fluxo-anual',
    titulo: 'Fluxo de caixa anual',
    descricao:
      'Entradas, saídas e saldo mês a mês ao longo do ano do período selecionado.',
    icone: Wallet,
    tom: 'azul',
    usaPeriodo: true,
  },
  {
    id: 'parametros',
    titulo: 'Parâmetros e taxas vigentes',
    descricao:
      'Todos os parâmetros configurados, a THH, o CFR e o custo/hora de cada centro. Documenta a base de qualquer outro relatório.',
    icone: Settings2,
    tom: 'ambar',
    usaPeriodo: false,
  },
];

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PaginaRelatorios({ searchParams }: Props): React.JSX.Element {
  const bruto = searchParams.periodo;
  const periodo = (Array.isArray(bruto) ? bruto[0] : bruto) ?? periodoAtual();

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Relatórios"
        descricao="Exportações em Excel, prontas para levar ao contador, ao banco ou à reunião de sócios."
      />

      <SeletorPeriodoRelatorio periodo={periodo} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {RELATORIOS.map((relatorio) => (
          <CartaoRelatorio key={relatorio.id} relatorio={relatorio} periodo={periodo} />
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Building2 className="h-4 w-4 text-primary" aria-hidden />
          Sobre estes arquivos
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Todo relatório sai do mesmo motor de cálculo que alimenta as telas — não há uma segunda
          lógica que possa divergir. O relatório completo inclui a aba de parâmetros justamente
          para que qualquer número possa ser reconstruído a partir dela: quem receber o arquivo
          consegue conferir a conta.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Para o orçamento de uma OS específica em PDF, use o botão na tela da própria ordem. Para
          um arquivo com todos os dados do sistema, use o backup completo em Configurações.
        </p>
      </section>
    </div>
  );
}

function CartaoRelatorio({
  relatorio,
  periodo,
}: {
  relatorio: Relatorio;
  periodo: string;
}): React.JSX.Element {
  const Icone = relatorio.icone;

  const bordas = {
    ambar: 'border-amber-500/20 hover:border-amber-500/40',
    azul: 'border-blue-500/20 hover:border-blue-500/40',
    verde: 'border-emerald-500/20 hover:border-emerald-500/40',
    roxo: 'border-violet-500/20 hover:border-violet-500/40',
  };
  const cores = {
    ambar: 'text-amber-400',
    azul: 'text-blue-400',
    verde: 'text-emerald-400',
    roxo: 'text-violet-400',
  };

  const href = relatorio.usaPeriodo
    ? `/api/relatorios/${relatorio.id}?periodo=${periodo}`
    : `/api/relatorios/${relatorio.id}`;

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-white/[0.04] p-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${bordas[relatorio.tom]}`}
    >
      <Icone className={`h-5 w-5 ${cores[relatorio.tom]}`} aria-hidden />

      <h3 className="mt-3 text-sm font-semibold leading-snug">{relatorio.titulo}</h3>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
        {relatorio.descricao}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-[11px] capitalize text-muted-foreground/70">
          {relatorio.usaPeriodo ? formatarPeriodoExtenso(periodo) : 'Dados atuais'}
        </span>
        <Button asChild size="sm" variant="secondary">
          <a href={href} download>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </a>
        </Button>
      </div>
    </article>
  );
}
