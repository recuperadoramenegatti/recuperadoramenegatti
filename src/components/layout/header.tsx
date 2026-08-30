'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import {
  Bell,
  ChevronRight,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  User as UserIcon,
} from 'lucide-react';
import { TITULOS_ROTA } from '@/components/layout/navegacao';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatarPeriodoExtenso, iniciais, periodoAtual } from '@/lib/formatacao';

interface HeaderProps {
  nomeUsuario: string;
  emailUsuario: string;
  totalAlertas: number;
  alertasCriticos: number;
}

export function Header({
  nomeUsuario,
  emailUsuario,
  totalAlertas,
  alertasCriticos,
}: HeaderProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);

  React.useEffect(() => setMontado(true), []);

  const migalhas = React.useMemo(() => {
    const partes = pathname.split('/').filter(Boolean);
    const acumulado: Array<{ href: string; titulo: string }> = [];
    let caminho = '';
    for (const parte of partes) {
      caminho += `/${parte}`;
      const titulo =
        TITULOS_ROTA[caminho] ??
        (parte.length > 20 ? 'Detalhe' : parte.charAt(0).toUpperCase() + parte.slice(1));
      acumulado.push({ href: caminho, titulo });
    }
    return acumulado;
  }, [pathname]);

  const sair = async (): Promise<void> => {
    await signOut({ redirect: false });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/[0.07] bg-background/70 px-6 backdrop-blur-xl">
      <nav aria-label="Trilha de navegação" className="flex min-w-0 items-center gap-1.5 text-sm">
        {migalhas.map((migalha, indice) => (
          <React.Fragment key={migalha.href}>
            {indice > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
            ) : null}
            {indice === migalhas.length - 1 ? (
              <span className="truncate font-medium">{migalha.titulo}</span>
            ) : (
              <Link
                href={migalha.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {migalha.titulo}
              </Link>
            )}
          </React.Fragment>
        ))}
        <span className="ml-3 hidden shrink-0 text-xs capitalize text-muted-foreground/70 lg:inline">
          · {formatarPeriodoExtenso(periodoAtual())}
        </span>
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/orcamento">
            <Plus className="h-4 w-4" />
            Novo orçamento
          </Link>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard#alertas"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              aria-label={`${totalAlertas} alertas ativos`}
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden />
              {totalAlertas > 0 ? (
                <Badge
                  variant={alertasCriticos > 0 ? 'destructive' : 'warning'}
                  pulsante={alertasCriticos > 0}
                  className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]"
                >
                  {totalAlertas > 9 ? '9+' : totalAlertas}
                </Badge>
              ) : null}
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            {totalAlertas > 0
              ? `${totalAlertas} alerta(s) ativo(s)${alertasCriticos > 0 ? `, ${alertasCriticos} crítico(s)` : ''}`
              : 'Nenhum alerta ativo'}
          </TooltipContent>
        </Tooltip>

        {montado ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-[18px] w-[18px]" aria-hidden />
                ) : (
                  <Moon className="h-[18px] w-[18px]" aria-hidden />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="h-9 w-9" aria-hidden />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-3 transition-colors hover:bg-white/[0.07]',
              )}
              aria-label="Menu do usuário"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-hero text-xs font-bold text-black">
                {iniciais(nomeUsuario)}
              </span>
              <span className="hidden text-sm font-medium md:inline">{nomeUsuario}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Conectado como</DropdownMenuLabel>
            <div className="px-2 pb-2 text-sm">
              <div className="font-medium">{nomeUsuario}</div>
              <div className="text-xs text-muted-foreground">{emailUsuario}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">
                <UserIcon className="h-4 w-4" aria-hidden />
                Minha conta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes">
                <Settings className="h-4 w-4" aria-hidden />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void sair();
              }}
              className="text-red-400 focus:text-red-400"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
