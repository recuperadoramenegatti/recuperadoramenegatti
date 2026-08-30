'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, FileDown, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deslocarPeriodo, formatarPeriodoExtenso, periodoAtual,
  capitalizarPrimeira,
} from '@/lib/formatacao';
import type { Regime } from '@/types';

/** Seletor de período, regime e comparativo do DRE. Estado na URL. */
export function ControlesDRE({
  periodo,
  regime,
  comparativo,
}: {
  periodo: string;
  regime: Regime;
  comparativo: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const definir = (mudancas: Record<string, string | null>): void => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) params.delete(chave);
      else params.set(chave, valor);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const ehMesCorrente = periodo === periodoAtual();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Navegação de período */}
      <div className="flex items-center gap-1 rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => definir({ periodo: deslocarPeriodo(periodo, -1) })}
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
          onClick={() => definir({ periodo: deslocarPeriodo(periodo, 1) })}
          disabled={ehMesCorrente}
          aria-label="Mês seguinte"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!ehMesCorrente ? (
        <Button variant="ghost" size="sm" onClick={() => definir({ periodo: periodoAtual() })}>
          Voltar ao mês atual
        </Button>
      ) : null}

      {/* Regime */}
      <Tabs value={regime} onValueChange={(v) => definir({ regime: v })}>
        <TabsList>
          <TabsTrigger value="competencia">Competência</TabsTrigger>
          <TabsTrigger value="caixa">Caixa</TabsTrigger>
        </TabsList>
      </Tabs>

      <Button
        variant={comparativo ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => definir({ comparativo: comparativo ? null : 'true' })}
        aria-pressed={comparativo}
      >
        <GitCompare className="h-4 w-4" />
        Comparar períodos
      </Button>

      <div className="ml-auto flex gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={`/api/relatorios/dre?periodo=${periodo}`} download>
            <FileDown className="h-4 w-4" />
            Excel
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={`/api/relatorios/dre-comparativo?periodo=${periodo}`} download>
            <FileDown className="h-4 w-4" />
            Comparativo
          </a>
        </Button>
      </div>
    </div>
  );
}
