import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Segredo que assina a sessão.
 *
 * Se NEXTAUTH_SECRET (ou AUTH_SECRET) estiver configurado, é ele que vale —
 * é o certo, e continua sendo o recomendado.
 *
 * Quando não está, DERIVAMOS um em vez de deixar `undefined`. O motivo é uma
 * história real: o sistema foi publicado sem essa variável, e o efeito não foi
 * um aviso claro — foi o login recusando TODA senha, com a mensagem "usuário
 * ou senha inválidos". O dono passou dias convencido de que tinha esquecido a
 * própria senha, trocou a senha, tentou de novo, e nada. Uma configuração
 * esquecida não pode custar o acesso ao sistema inteiro.
 *
 * A derivação usa o DATABASE_URL, que é o único segredo que sempre existe
 * quando a aplicação funciona:
 *
 *  - é estável entre deploys, então a sessão de quem está logado sobrevive a
 *    uma nova publicação;
 *  - é diferente em cada instalação, então dois sistemas não compartilham
 *    segredo;
 *  - quem o conhece já tem o banco inteiro — inclusive os hashes de senha —,
 *    então derivar dele não abre porta nenhuma que já não estivesse aberta.
 *
 * O `sha256` com rótulo fixo garante que o valor usado aqui não seja a string
 * de conexão em si, e sim algo dela derivado e de tamanho apropriado.
 */
function segredoDeSessao(): string {
  const configurado = (process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET)?.trim();
  if (configurado) return configurado;

  const base = process.env.DATABASE_URL?.trim();
  if (base) {
    return crypto
      .createHash('sha256')
      .update(`menegatti:sessao:v1:${base}`)
      .digest('base64');
  }

  // Sem banco não há sistema; a tela de configuração explica o que falta.
  // Um valor efêmero aqui só evita que o NextAuth estoure antes disso.
  return crypto.randomBytes(32).toString('base64');
}

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
  // trustHost: o endereço vem da própria requisição, então NEXTAUTH_URL deixa
  // de ser obrigatório — uma variável a menos para faltar.
  trustHost: true,
  secret: segredoDeSessao(),
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
