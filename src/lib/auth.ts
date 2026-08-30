import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/** Validação das credenciais de login. */
export const schemaLogin = z.object({
  email: z.string().min(1, 'Informe o usuário'),
  password: z.string().min(1, 'Informe a senha'),
});

/**
 * Rate limiting simples em memória para a rota de autenticação.
 * Bloqueia 5 tentativas falhas seguidas por 15 minutos, por usuário.
 * Suficiente para uma aplicação local de uso interno.
 */
const TENTATIVAS_MAX = 5;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { contador: number; primeiraEm: number }>();

function bloqueado(chave: string): boolean {
  const registro = tentativas.get(chave);
  if (!registro) return false;
  if (Date.now() - registro.primeiraEm > JANELA_MS) {
    tentativas.delete(chave);
    return false;
  }
  return registro.contador >= TENTATIVAS_MAX;
}

function registrarFalha(chave: string): void {
  const registro = tentativas.get(chave);
  if (!registro || Date.now() - registro.primeiraEm > JANELA_MS) {
    tentativas.set(chave, { contador: 1, primeiraEm: Date.now() });
    return;
  }
  registro.contador += 1;
}

function limparTentativas(chave: string): void {
  tentativas.delete(chave);
}

export const configAuth: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credenciais',
      credentials: {
        email: { label: 'Usuário', type: 'text' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credenciais) {
        const analise = schemaLogin.safeParse(credenciais);
        if (!analise.success) return null;

        const { email, password } = analise.data;
        const chave = email.toLowerCase().trim();

        if (bloqueado(chave)) {
          throw new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.');
        }

        try {
          const usuario = await prisma.user.findUnique({ where: { email: chave } });
          if (!usuario) {
            registrarFalha(chave);
            return null;
          }

          const senhaCorreta = await bcrypt.compare(password, usuario.password);
          if (!senhaCorreta) {
            registrarFalha(chave);
            return null;
          }

          limparTentativas(chave);
          return {
            id: usuario.id,
            email: usuario.email,
            name: usuario.name,
            role: usuario.role,
          };
        } catch (erro) {
          // Nunca logar credenciais — apenas o fato da falha.
          console.error('[auth] Falha ao autenticar:', erro instanceof Error ? erro.message : erro);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = 'role' in user && typeof user.role === 'string' ? user.role : 'admin';
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === 'string' ? token.id : '';
        session.user.role = typeof token.role === 'string' ? token.role : 'admin';
      }
      return session;
    },
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(configAuth);

/** Sessão exigida em rotas de API. Lança quando não autenticado. */
export async function exigirSessao(): Promise<{ id: string; email: string; name: string }> {
  const sessao = await auth();
  if (!sessao?.user?.email) {
    throw new ErroNaoAutorizado();
  }
  return {
    id: sessao.user.id ?? '',
    email: sessao.user.email,
    name: sessao.user.name ?? 'Usuário',
  };
}

export class ErroNaoAutorizado extends Error {
  constructor() {
    super('Sessão expirada ou inexistente. Faça login novamente.');
    this.name = 'ErroNaoAutorizado';
  }
}
