'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { deslocarPeriodo, formatarPeriodoExtenso, periodoAtual } from '@/lib/formatacao';

/** Período e saldo inicial do fluxo de caixa. Estado na URL. */
export function ControlesFluxo({
  periodo,
  saldoInicial,
}: {
  periodo: string;
  saldoInicial: number;
}): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [saldo, setSaldo] = React.useState(saldoInicial === 0 ? '' : String(saldoInicial));
  const saldoDebounced = useDebounce(saldo, 400);
  const primeiro = React.useRef(true);

  const definir = React.useCallback(
    (chave: string, valor: string | null): void => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor === null || valor === '') params.delete(chave);
      else params.set(chave, valor);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    definir('saldoInicial', saldoDebounced || null);
  }, [saldoDebounced, definir]);

  const ehMesCorrente = periodo === periodoAtual();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => definir('periodo', deslocarPeriodo(periodo, -1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-36 px-2 text-center text-sm font-medium capitalize">
          {formatarPeriodoExtenso(periodo)}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => definir('periodo', deslocarPeriodo(periodo, 1))}
          aria-label="Mês seguinte"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {!ehMesCorrente ? (
        <Button variant="ghost" size="sm" onClick={() => definir('periodo', periodoAtual())}>
          Mês atual
        </Button>
      ) : null}

      <div className="w-48 space-y-1.5">
        <Label htmlFor="saldo-inicial">Saldo em caixa no dia 1º</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            R$
          </span>
          <Input
            id="saldo-inicial"
            type="text"
            inputMode="decimal"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            placeholder="0"
            className="pl-9 tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}
