'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  titulo?: string;
  /** Renderização alternativa completa; sobrepõe o fallback padrão. */
  fallback?: React.ReactNode;
}

interface State {
  temErro: boolean;
  mensagem: string;
}

/**
 * Boundary de erro para componentes críticos (gráficos, painéis pesados).
 * Isola a falha em vez de derrubar a página inteira.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { temErro: false, mensagem: '' };
  }

  static getDerivedStateFromError(erro: unknown): State {
    const mensagem = erro instanceof Error ? erro.message : 'Erro inesperado.';
    return { temErro: true, mensagem };
  }

  componentDidCatch(erro: unknown, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', erro, info.componentStack);
  }

  private reiniciar = (): void => {
    this.setState({ temErro: false, mensagem: '' });
  };

  render(): React.ReactNode {
    if (!this.state.temErro) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-red-400" aria-hidden />
        <h3 className="font-semibold">{this.props.titulo ?? 'Não foi possível exibir esta seção'}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{this.state.mensagem}</p>
        <Button variant="secondary" size="sm" onClick={this.reiniciar}>
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }
}
