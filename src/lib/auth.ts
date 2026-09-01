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
 * Freio contra tentativa de adivinhação — por ESPERA, não por bloqueio.
 *
 * A versão anterior bloqueava o acesso por 15 minutos depois de 5 erros, e
 * fazia isso ANTES de conferir a senha. O efeito era o oposto do pretendido:
 * quem errou algumas vezes e depois lembrou da senha certa continuava sendo
 * recusado, com a mensagem de "usuário ou senha inválidos". O dono da
 * empresa ficou trancado do lado de fora do próprio sistema — e cada nova
 * tentativa reiniciava a contagem, então insistir só piorava.
 *
 * Agora cada erro recente acrescenta uma espera antes da resposta, com teto
 * de 5 segundos. Contra quem chuta senha, isso derruba a velocidade do
 * ataque do mesmo jeito que um bloqueio derrubaria. Para quem sabe a senha,
 * o custo é uma espera de segundos — nunca uma porta fechada.
 *
 * (A contagem vive em memória e, em servidor serverless, vale por instância.
 * Isso já era verdade antes; é mais um motivo para a defesa ser espera em vez
 * de bloqueio, que dependia de um estado confiável que nunca existiu.)
 */
const ESPERA_POR_FALHA_MS = 700;
const ESPERA_MAXIMA_MS = 5_000;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { contador: number; primeiraEm: number }>();

/** Quantas falhas recentes esta conta acumulou. */
function falhasRecentes(chave: string): number {
  const registro = tentativas.get(chave);
  if (!registro) return 0;
  if (Date.now() - registro.primeiraEm > JANELA_MS) {
    tentativas.delete(chave);
    return 0;
  }
  return registro.contador;
}

/** Espera proporcional às falhas recentes, com teto. */
async function penalizar(chave: string): Promise<void> {
  const espera = Math.min(falhasRecentes(chave) * ESPERA_POR_FALHA_MS, ESPERA_MAXIMA_MS);
  if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
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

        // A espera vem ANTES da resposta, mas DEPOIS de conferir a senha:
        // quem acerta entra, por mais que tenha errado antes.
        try {
          const usuario = await prisma.user.findUnique({ where: { email: chave } });
          if (!usuario) {
            registrarFalha(chave);
            await penalizar(chave);
            return null;
          }

          const senhaCorreta = await bcrypt.compare(password, usuario.password);
          if (!senhaCorreta) {
            registrarFalha(chave);
            await penalizar(chave);
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
