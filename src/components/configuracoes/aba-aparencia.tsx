'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Monitor, Moon, Palette, Save, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, extrairMensagemErro } from '@/lib/utils';

const DENSIDADES = [
  { valor: 'compacto', rotulo: 'Compacto', descricao: 'Mais informação por tela' },
  { valor: 'normal', rotulo: 'Normal', descricao: 'Equilíbrio padrão' },
  { valor: 'espacoso', rotulo: 'Espaçoso', descricao: 'Mais respiro entre os elementos' },
] as const;

export function AbaAparencia({ gerais }: { gerais: Record<string, string> }): React.JSX.Element {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [densidade, setDensidade] = React.useState(gerais.aparenciaDensidade || 'normal');
  const [salvando, setSalvando] = React.useState(false);
  const [montado, setMontado] = React.useState(false);

  React.useEffect(() => setMontado(true), []);

  // Aplica a densidade imediatamente, para o usuário ver o efeito.
  React.useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.densidade = densidade;
    const escalas: Record<string, string> = {
      compacto: '0.92',
      normal: '1',
      espacoso: '1.08',
    };
    raiz.style.setProperty('--escala-densidade', escalas[densidade] ?? '1');
  }, [densidade]);

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    try {
      const resposta = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valores: { aparenciaDensidade: densidade, aparenciaTema: theme ?? 'dark' },
        }),
      });
      if (!resposta.ok) throw new Error('Não foi possível salvar a aparência.');
      toast.success('Preferências de aparência salvas.');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Palette className="h-4 w-4 text-primary" aria-hidden />
          Tema
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          O sistema foi desenhado para o modo escuro, que é o padrão. O modo claro está disponível
          para uso em ambiente muito iluminado — o chão de fábrica, por exemplo.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <OpcaoTema
            icone={Moon}
            rotulo="Escuro"
            ativo={montado && theme === 'dark'}
            onSelect={() => setTheme('dark')}
          />
          <OpcaoTema
            icone={Sun}
            rotulo="Claro"
            ativo={montado && theme === 'light'}
            onSelect={() => setTheme('light')}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-card backdrop-blur-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Monitor className="h-4 w-4 text-primary" aria-hidden />
          Densidade da interface
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ajusta o espaçamento geral. Em telas de 1280px, compacto rende mais linhas visíveis.
        </p>

        <div className="mt-4 space-y-2">
          {DENSIDADES.map((opcao) => (
            <label
              key={opcao.valor}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                densidade === opcao.valor
                  ? 'border-primary/40 bg-primary/[0.06]'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20',
              )}
            >
              <input
                type="radio"
                name="densidade"
                value={opcao.valor}
                checked={densidade === opcao.valor}
                onChange={() => setDensidade(opcao.valor)}
                className="mt-1 accent-amber-500"
              />
              <span>
                <span className="block text-sm font-medium">{opcao.rotulo}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {opcao.descricao}
                </span>
              </span>
            </label>
          ))}
        </div>

        <Button onClick={() => void salvar()} carregando={salvando} className="mt-5 w-full">
          {!salvando ? <Save className="h-4 w-4" /> : null}
          Salvar preferências
        </Button>
      </section>
    </div>
  );
}

function OpcaoTema({
  icone: Icone,
  rotulo,
  ativo,
  onSelect,
}: {
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  ativo: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={ativo}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-5 transition-colors',
        ativo
          ? 'border-primary/40 bg-primary/[0.06]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20',
      )}
    >
      <Icone className={cn('h-6 w-6', ativo ? 'text-primary' : 'text-muted-foreground')} />
      <span className="text-sm font-medium">{rotulo}</span>
    </button>
  );
}
