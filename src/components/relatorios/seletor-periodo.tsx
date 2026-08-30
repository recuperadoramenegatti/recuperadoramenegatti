'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deslocarPeriodo, formatarPeriodoExtenso, periodoAtual,
  capitalizarPrimeira,
} from '@/lib/formatacao';

/** Período de referência dos relatórios. Estado na URL. */
export function SeletorPeriodoRelatorio({ periodo }: { periodo: string }): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const definir = (novo: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('periodo', novo);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const ehMesCorrente = periodo === periodoAtual();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <CalendarRange className="h-4 w-4" aria-hidden />
        Período de referência
      </span>

      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => definir(deslocarPeriodo(periodo, -1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-36 px-2 text-center text-sm font-medium">
          {capitalizarPrimeira(formatarPeriodoExtenso(periodo))}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => definir(deslocarPeriodo(periodo, 1))}
          disabled={ehMesCorrente}
          aria-label="Mês seguinte"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!ehMesCorrente ? (
        <Button variant="ghost" size="sm" onClick={() => definir(periodoAtual())}>
          Mês atual
        </Button>
      ) : null}

      <p className="ml-auto text-xs text-muted-foreground">
        Relatórios com histórico usam os 12 meses até este período.
      </p>
    </div>
  );
}
