'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound, ShieldAlert, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, extrairMensagemErro } from '@/lib/utils';

const schema = z
  .object({
    codigo: z.string().min(1, 'Informe o código de recuperação'),
    novaSenha: z.string().min(8, 'A nova senha precisa de ao menos 8 caracteres'),
    confirmarSenha: z.string().min(1, 'Repita a nova senha'),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  });

type Campos = z.infer<typeof schema>;

export function FormularioRecuperar({ className }: { className?: string }): React.JSX.Element {
  const router = useRouter();

  const [mostrarSenha, setMostrarSenha] = React.useState(false);
  const [erroGeral, setErroGeral] = React.useState<string | null>(null);
  const [codigoNovo, setCodigoNovo] = React.useState<string | null>(null);
  const [copiado, setCopiado] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Campos>({
    resolver: zodResolver(schema),
    defaultValues: { codigo: '', novaSenha: '', confirmarSenha: '' },
  });

  const aoEnviar = async (dados: Campos): Promise<void> => {
    setErroGeral(null);
    try {
      const resposta = await fetch('/api/recuperar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(dados),
      });

      const corpo: unknown = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        const mensagem =
          corpo && typeof corpo === 'object' && 'erro' in corpo && typeof corpo.erro === 'string'
            ? corpo.erro
            : 'Não foi possível redefinir a senha.';
        setErroGeral(mensagem);
        toast.error(mensagem);
        return;
      }

      const novo =
        corpo &&
        typeof corpo === 'object' &&
        'dados' in corpo &&
        corpo.dados &&
        typeof corpo.dados === 'object' &&
        'codigoNovo' in corpo.dados &&
        typeof corpo.dados.codigoNovo === 'string'
          ? corpo.dados.codigoNovo
          : null;

      toast.success('Senha redefinida. Já pode entrar.');

      // Quando o código guardado foi usado, ele deixou de valer e um novo
      // tomou o lugar. Mostrar aqui é a única chance de anotá-lo — depois
      // desta tela, só o hash fica no banco.
      if (novo) {
        setCodigoNovo(novo);
        return;
      }

      router.push('/login');
    } catch (e) {
      const mensagem = extrairMensagemErro(e);
      setErroGeral(mensagem);
      toast.error(mensagem);
    }
  };

  const copiar = async (): Promise<void> => {
    if (!codigoNovo) return;
    try {
      await navigator.clipboard.writeText(codigoNovo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('Não foi possível copiar. Anote o código à mão.');
    }
  };

  // ── Tela de código novo ────────────────────────────────────────────────
  if (codigoNovo) {
    return (
      <div className={cn('space-y-5', className)}>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Guarde este novo código de recuperação
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            O código anterior deixou de valer. Anote este num lugar seguro — ele é o que vai
            permitir entrar caso a senha seja esquecida de novo.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-[var(--borda-1)] bg-[var(--superficie-2)] p-4">
          <code className="flex-1 select-all font-mono text-lg tracking-widest text-foreground">
            {codigoNovo}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copiar}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1.5">{copiado ? 'Copiado' : 'Copiar'}</span>
          </Button>
        </div>

        <Button type="button" className="w-full" onClick={() => router.push('/login')}>
          Anotei — ir para a tela de entrada
        </Button>
      </div>
    );
  }

  // ── Formulário ─────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(aoEnviar)} className={cn('space-y-4', className)} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="codigo">Código de recuperação</Label>
        <Input
          id="codigo"
          autoComplete="off"
          autoFocus
          placeholder="ABCD-EFGH-JKLM-NPQR"
          className="font-mono tracking-widest"
          aria-invalid={Boolean(errors.codigo)}
          {...register('codigo')}
        />
        {errors.codigo ? (
          <p className="text-sm text-destructive">{errors.codigo.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pode digitar com ou sem os hífens, em maiúsculas ou minúsculas.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="novaSenha">Nova senha</Label>
        <div className="relative">
          <Input
            id="novaSenha"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.novaSenha)}
            {...register('novaSenha')}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.novaSenha ? (
          <p className="text-sm text-destructive">{errors.novaSenha.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmarSenha">Repita a nova senha</Label>
        <Input
          id="confirmarSenha"
          type={mostrarSenha ? 'text' : 'password'}
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmarSenha)}
          {...register('confirmarSenha')}
        />
        {errors.confirmarSenha ? (
          <p className="text-sm text-destructive">{errors.confirmarSenha.message}</p>
        ) : null}
      </div>

      {erroGeral ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erroGeral}</span>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        <KeyRound className="h-4 w-4" />
        <span className="ml-1.5">{isSubmitting ? 'Redefinindo…' : 'Redefinir senha'}</span>
      </Button>
    </form>
  );
}
