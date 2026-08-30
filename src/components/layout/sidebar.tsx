'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAVEGACAO } from '@/components/layout/navegacao';
import { Logo, LogoCompleto } from '@/components/comum/logo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const CHAVE_ARMAZENAMENTO = 'menegatti:sidebar-colapsada';

interface SidebarProps {
  logo?: string;
}

export function Sidebar({ logo }: SidebarProps): React.JSX.Element {
  const pathname = usePathname();
  const [colapsada, setColapsada] = React.useState(false);
  const [montada, setMontada] = React.useState(false);

  React.useEffect(() => {
    try {
      setColapsada(window.localStorage.getItem(CHAVE_ARMAZENAMENTO) === 'true');
    } catch {
      // localStorage indisponível — segue com o padrão expandido.
    }
    setMontada(true);
  }, []);

  const alternar = (): void => {
    setColapsada((atual) => {
      const proximo = !atual;
      try {
        window.localStorage.setItem(CHAVE_ARMAZENAMENTO, String(proximo));
      } catch {
        // ignora falha de persistência
      }
      return proximo;
    });
  };

  const estaAtivo = (href: string, prefixo?: boolean): boolean =>
    prefixo ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  return (
    <aside
      className={cn(
        'sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-[var(--borda-0)] bg-[var(--fundo-sidebar)] backdrop-blur-xl transition-[width] duration-300',
        colapsada ? 'w-[76px]' : 'w-[264px]',
      )}
      aria-label="Navegação principal"
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-[var(--borda-0)] px-4">
        {colapsada ? (
          <Logo tamanho={34} src={logo} className="mx-auto" />
        ) : (
          <LogoCompleto tamanho={34} src={logo} subtitulo="" />
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-none">
        {NAVEGACAO.map((grupo) => (
          <div key={grupo.titulo}>
            {!colapsada ? (
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
                {grupo.titulo}
              </div>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-[var(--superficie-4)]" aria-hidden />
            )}

            <ul className="space-y-1">
              {grupo.itens.map((item) => {
                const ativo = estaAtivo(item.href, item.prefixo);
                const Icone = item.icone;

                const conteudo = (
                  <Link
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      colapsada && 'justify-center px-0',
                      ativo
                        ? 'bg-[var(--superficie-3)] text-foreground'
                        : 'text-muted-foreground hover:bg-[var(--superficie-1)] hover:text-foreground',
                    )}
                    aria-current={ativo ? 'page' : undefined}
                  >
                    {ativo && montada ? (
                      <motion.span
                        layoutId="indicador-nav"
                        className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-hero"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        aria-hidden
                      />
                    ) : null}
                    <Icone
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        ativo ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                      )}
                      aria-hidden
                    />
                    {!colapsada ? <span className="truncate">{item.titulo}</span> : null}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {colapsada ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{conteudo}</TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="font-medium">{item.titulo}</div>
                          <div className="text-muted-foreground">{item.descricao}</div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      conteudo
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--borda-0)] p-3">
        <button
          type="button"
          onClick={alternar}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-[var(--superficie-1)] hover:text-foreground',
            colapsada && 'justify-center px-0',
          )}
          aria-label={colapsada ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {colapsada ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
              <span>Recolher menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
