'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Brain, CheckCircle2, Plug, Save, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn, extrairMensagemErro } from '@/lib/utils';
import { formatarDataHora, formatarNumero } from '@/lib/formatacao';

const MODELOS = [
  { id: 'claude-sonnet-4-5', rotulo: 'Claude Sonnet 4.5 — equilíbrio entre qualidade e custo' },
  { id: 'claude-opus-4-5', rotulo: 'Claude Opus 4.5 — análise mais profunda, custo maior' },
  { id: 'claude-haiku-4-5', rotulo: 'Claude Haiku 4.5 — mais rápido e barato' },
];

export interface UsoIA {
  totalGeracoes: number;
  totalTokens: number;
  ultimaGeracao: string | null;
  porModelo: Array<{ modelo: string; geracoes: number; tokens: number }>;
}

export function AbaIA({
  gerais,
  uso,
}: {
  gerais: Record<string, string>;
  uso: UsoIA;
}): React.JSX.Element {
  const router = useRouter();
  const configurada = gerais.anthropicApiKeyConfigurada === 'true';

  const [chave, setChave] = React.useState('');
  const [modelo, setModelo] = React.useState(gerais.anthropicModelo || 'claude-sonnet-4-5');
  const [automatico, setAutomatico] = React.useState(gerais.iaGeracaoAutomatica !== 'false');
  const [salvando, setSalvando] = React.useState(false);
  const [testando, setTestando] = React.useState(false);
  const [resultadoTeste, setResultadoTeste] = React.useState<{ ok: boolean; mensagem: string } | null>(
    null,
  );

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    try {
      const valores: Record<string, string> = {
        anthropicModelo: modelo,
        iaGeracaoAutomatica: String(automatico),
      };
      // Campo vazio significa "manter a chave atual".
      if (chave.trim()) valores.anthropicApiKey = chave.trim();

      const resposta = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores }),
      });
      if (!resposta.ok) throw new Error('Não foi possível salvar a configuração.');

      toast.success('Configuração de IA salva.');
      setChave('');
      setResultadoTeste(null);
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const testar = async (): Promise<void> => {
    setTestando(true);
    setResultadoTeste(null);
    try {
      const resposta = await fetch('/api/ia/testar', { method: 'POST' });
      const corpo: unknown = await resposta.json();
      if (!resposta.ok) throw new Error('Não foi possível testar a conexão.');

      const dados = (corpo as { dados: { ok: boolean; mensagem: string } }).dados;
      setResultadoTeste(dados);
      if (dados.ok) toast.success(dados.mensagem);
      else toast.error(dados.mensagem);
    } catch (erro) {
      const mensagem = extrairMensagemErro(erro);
      setResultadoTeste({ ok: false, mensagem });
      toast.error(mensagem);
    } finally {
      setTestando(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Brain className="h-4 w-4 text-violet-400" aria-hidden />
          Integração com a Anthropic
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Usada apenas no Centro de Inteligência. Todo o resto do sistema — cálculos, alertas,
          DRE — funciona sem ela.
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="api-key">Chave da API</Label>
              {configurada ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  Configurada
                </Badge>
              ) : (
                <Badge variant="secondary">Não configurada</Badge>
              )}
            </div>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder={configurada ? gerais.anthropicApiKey || '••••••••' : 'sk-ant-…'}
            />
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              A chave é cifrada com AES-256-GCM antes de ir para o banco, e nunca sai do servidor
              — a interface só recebe os quatro últimos caracteres. Deixe o campo vazio para
              manter a chave atual.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="modelo-ia">Modelo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger id="modelo-ia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELOS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] px-3.5 py-3">
            <span className="text-sm">
              Gerar análise automaticamente
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Uma vez por mês, no primeiro acesso após a virada.
              </span>
            </span>
            <Switch
              checked={automatico}
              onCheckedChange={setAutomatico}
              aria-label="Geração automática de insights"
            />
          </label>

          <div className="flex gap-2">
            <Button onClick={() => void salvar()} carregando={salvando} className="flex-1">
              {!salvando ? <Save className="h-4 w-4" /> : null}
              Salvar
            </Button>
            <Button
              variant="secondary"
              onClick={() => void testar()}
              carregando={testando}
              disabled={!configurada && !chave.trim()}
            >
              {!testando ? <Plug className="h-4 w-4" /> : null}
              Testar conexão
            </Button>
          </div>

          {resultadoTeste ? (
            <div
              className={cn(
                'flex items-start gap-2 rounded-xl border p-3 text-sm',
                resultadoTeste.ok
                  ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300'
                  : 'border-red-500/25 bg-red-500/[0.07] text-red-300',
              )}
              role="status"
            >
              {resultadoTeste.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>{resultadoTeste.mensagem}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="h-fit rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
        <h3 className="text-sm font-semibold tracking-tight">Histórico de uso</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Consumo acumulado desde a instalação.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3.5">
            <dt className="label-caps">Análises geradas</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{uso.totalGeracoes}</dd>
          </div>
          <div className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3.5">
            <dt className="label-caps">Tokens consumidos</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {formatarNumero(uso.totalTokens, 0)}
            </dd>
          </div>
        </dl>

        {uso.ultimaGeracao ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Última geração: {formatarDataHora(uso.ultimaGeracao)}
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Nenhuma análise gerada ainda.</p>
        )}

        {uso.porModelo.length > 0 ? (
          <div className="mt-4 space-y-2 border-t border-[var(--borda-1)] pt-4">
            <p className="label-caps">Por modelo</p>
            {uso.porModelo.map((item) => (
              <div key={item.modelo} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {item.modelo}
                </span>
                <span className="shrink-0 tabular-nums">
                  {item.geracoes}× · {formatarNumero(item.tokens, 0)} tokens
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
