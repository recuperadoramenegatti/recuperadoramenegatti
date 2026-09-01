'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, extrairMensagemErro } from '@/lib/utils';

const schema = z.object({
  email: z.string().min(1, 'Informe o usuário'),
  password: z.string().min(1, 'Informe a senha'),
});

type Campos = z.infer<typeof schema>;

export function FormularioLogin({ className }: { className?: string }): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const destino = searchParams.get('destino') ?? '/dashboard';

  const [mostrarSenha, setMostrarSenha] = React.useState(false);
  const [erroGeral, setErroGeral] = React.useState<string | null>(null);

  /**
   * Quantas vezes o login falhou nesta tela.
   *
   * O servidor bloqueia por 15 minutos depois de 5 tentativas erradas, mas
   * essa informação não chega até aqui: o NextAuth transforma o bloqueio no
   * mesmo erro genérico de credencial recusada. Sem este contador, quem erra
   * a senha algumas vezes passa a receber "usuário ou senha inválidos" mesmo
   * depois de digitar a senha CERTA — e não tem como saber que é só esperar.
   */
  const [falhas, setFalhas] = React.useState(0);
  const TENTATIVAS_ATE_BLOQUEIO = 5;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Campos>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const aoEnviar = async (dados: Campos): Promise<void> => {
    setErroGeral(null);
    try {
      const resultado = await signIn('credentials', {
        email: dados.email.trim().toLowerCase(),
        password: dados.password,
        redirect: false,
      });

      if (!resultado || resultado.error) {
        // Nem toda falha aqui é senha errada. O NextAuth também devolve erro
        // quando FALTA CONFIGURAÇÃO — sem o segredo de sessão, por exemplo,
        // nenhum login passa. Dizer "senha inválida" nesse caso manda a
        // pessoa tentar de novo a senha certa, sem chance de acertar; foi
        // exatamente o que aconteceu na primeira publicação do sistema.
        //
        // "CredentialsSignin" é o código que o NextAuth usa para credencial
        // recusada. Qualquer outro código é problema de configuração ou de
        // infraestrutura, e merece uma mensagem que aponte para lá.
        const credencialRecusada =
          !resultado?.error || resultado.error === 'CredentialsSignin';

        const falhasAgora = falhas + 1;
        setFalhas(falhasAgora);

        const mensagem = !credencialRecusada
          ? 'O sistema não conseguiu concluir o login por um problema de configuração — ' +
            'não é a sua senha. Abra a página /configurar para ver o que falta.'
          : falhasAgora >= TENTATIVAS_ATE_BLOQUEIO
            ? 'Usuário ou senha inválidos. Atenção: depois de ' +
              `${TENTATIVAS_ATE_BLOQUEIO} tentativas erradas o sistema bloqueia o acesso por ` +
              '15 minutos. Se você tem certeza da senha, espere 15 minutos antes de tentar ' +
              'de novo — insistir agora só renova o bloqueio.'
            : 'Usuário ou senha inválidos.';

        setErroGeral(mensagem);
        toast.error(mensagem);
        return;
      }

      setFalhas(0);

      toast.success('Bem-vindo de volta!');
      router.push(destino);
      router.refresh();
    } catch (erro) {
      const mensagem = extrairMensagemErro(erro);
      setErroGeral(mensagem);
      toast.error(mensagem);
    }
  };

  return (
    <form onSubmit={handleSubmit(aoEnviar)} className={cn('space-y-4', className)} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Usuário</Label>
        <Input
          id="email"
          type="text"
          autoComplete="username"
          autoFocus
          placeholder="admin"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'erro-email' : undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p id="erro-email" className="text-xs text-red-400">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            type={mostrarSenha ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-11"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'erro-senha' : undefined}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password ? (
          <p id="erro-senha" className="text-xs text-red-400">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {erroGeral ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{erroGeral}</span>
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" carregando={isSubmitting}>
        {!isSubmitting ? <LogIn className="h-4 w-4" /> : null}
        Entrar
      </Button>
    </form>
  );
}
