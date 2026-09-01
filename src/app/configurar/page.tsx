/**
 * Tela de configuração pendente.
 *
 * É o que aparece quando o sistema foi publicado mas ainda não tem banco de
 * dados — a situação em que a Vercel antes devolvia um erro técnico que não
 * dizia nada a quem estava publicando.
 *
 * A tela responde três coisas, nessa ordem: o que está faltando, por que, e
 * quais cliques resolvem.
 */
import { estadoDoBanco, type MotivoIndisponivel } from '@/lib/estado-banco';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Explicacao {
  titulo: string;
  resumo: string;
  passos: string[];
  /**
   * Caminho B, para quando o caminho A esbarra em algo fora do nosso alcance.
   * O plano gratuito da Vercel limita quantos bancos a conta pode ter, e quem
   * bate nesse limite fica sem saída se a tela só souber explicar um jeito.
   */
  alternativa?: { titulo: string; passos: string[] };
}

const EXPLICACOES: Record<MotivoIndisponivel, Explicacao> = {
  sem_url: {
    titulo: 'Falta conectar um banco de dados',
    resumo:
      'O sistema está publicado e funcionando, mas ainda não tem onde guardar ' +
      'os dados. É o último passo da publicação, e é feito pelo painel da Vercel.',
    passos: [
      'No painel da Vercel, abra este projeto e clique na aba "Storage".',
      'Clique em "Create Database", escolha Postgres (aparece como Neon nas contas novas) e dê um nome como menegatti-db.',
      'Clique em "Connect" para ligar o banco a este projeto.',
      'Vá em Settings → Environment Variables e confira que existe uma variável chamada exatamente DATABASE_URL. Se a integração criou com outro nome (POSTGRES_URL ou POSTGRES_PRISMA_URL ou DATABASE_POSTGRES_URL), copie o valor dela para uma variável nova chamada DATABASE_URL.',
      'Nessa mesma variável, deixe as TRÊS caixas marcadas: Production, Preview e Development. É o engano mais comum — marcada só em Production, o endereço da versão de teste continua caindo nesta tela.',
      'Volte em Deployments e clique nos três pontinhos do deploy mais recente → "Redeploy". Aguarde terminar e recarregue esta página.',
    ],
    alternativa: {
      titulo: 'Se a Vercel disser que você atingiu o limite de bancos',
      passos: [
        'O plano gratuito da Vercel permite poucos bancos. Se ela recusar, crie o banco fora dela — o sistema não sabe a diferença, e continua sendo de graça.',
        'Entre em neon.com e crie uma conta (dá para entrar com o GitHub, sem cadastrar cartão).',
        'Crie um projeto. Na tela seguinte aparece a "Connection string": um texto que começa com postgresql://. Copie inteiro. Se houver a opção "Pooled connection", prefira ela.',
        'Volte na Vercel, em Settings → Environment Variables. Crie a variável DATABASE_URL e cole esse texto no valor.',
        'Marque as TRÊS caixas: Production, Preview e Development. Salve.',
        'Em Deployments, três pontinhos do deploy mais recente → "Redeploy". Ao terminar, recarregue esta página.',
      ],
    },
  },
  url_incompativel: {
    titulo: 'O banco configurado não serve para este servidor',
    resumo:
      'A configuração aponta para um arquivo SQLite. Isso funciona no computador ' +
      'da empresa, onde o arquivo fica no disco — mas este servidor não guarda ' +
      'arquivos entre um acesso e outro, então os dados sumiriam.',
    passos: [
      'No painel da Vercel, aba "Storage", crie um banco Postgres.',
      'Conecte-o ao projeto.',
      'Em Settings → Environment Variables, troque o valor de DATABASE_URL pela conexão do Postgres (começa com postgres://).',
      'Confira que a variável está marcada para Production, Preview e Development — as três.',
      'Clique em "Redeploy".',
    ],
  },
  sem_conexao: {
    titulo: 'Não foi possível falar com o banco de dados',
    resumo:
      'A configuração existe, mas o banco não respondeu. Normalmente é uma ' +
      'conexão escrita com algum caractere a mais ou a menos, ou um banco que ' +
      'foi apagado.',
    passos: [
      'Em Settings → Environment Variables, confira se o valor de DATABASE_URL foi colado inteiro, sem espaços no começo ou no fim.',
      'Confira, na aba "Storage", se o banco ainda existe e está ativo.',
      'Depois de corrigir, clique em "Redeploy".',
    ],
  },
  sem_tabelas: {
    titulo: 'O banco está vazio',
    resumo:
      'O banco respondeu, mas as tabelas do sistema ainda não foram criadas. ' +
      'Elas são criadas sozinhas durante a publicação, então normalmente basta ' +
      'publicar de novo agora que o banco existe.',
    passos: [
      'No painel da Vercel, vá em Deployments.',
      'No deploy mais recente, clique em "Redeploy".',
      'Aguarde terminar e recarregue esta página.',
    ],
  },
  sem_dados: {
    titulo: 'Faltam os parâmetros iniciais',
    resumo:
      'As tabelas existem, mas os parâmetros da Menegatti (folha, centros de ' +
      'custo, taxas por hora) ainda não foram carregados.',
    passos: [
      'No painel da Vercel, vá em Deployments.',
      'No deploy mais recente, clique em "Redeploy".',
      'Aguarde terminar e recarregue esta página.',
    ],
  },
};

export default async function ConfigurarPage() {
  const estado = await estadoDoBanco();

  // Já está tudo certo: esta tela não tem mais razão de existir.
  if (estado.pronto) redirect('/dashboard');

  const explicacao = EXPLICACOES[estado.motivo ?? 'sem_conexao'];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
      <div className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-8 shadow-[var(--sombra-cartao)]">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-600 dark:text-amber-500">
          Configuração pendente
        </p>

        <h1 className="mt-2 text-2xl font-semibold text-foreground">{explicacao.titulo}</h1>

        <p className="mt-4 leading-relaxed text-muted-foreground">{explicacao.resumo}</p>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          O que fazer
        </h2>

        <ol className="mt-4 space-y-3">
          {explicacao.passos.map((passo, indice) => (
            <li key={passo} className="flex gap-3 text-foreground">
              <span
                aria-hidden
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--superficie-3)] text-sm font-semibold text-muted-foreground"
              >
                {indice + 1}
              </span>
              <span className="leading-relaxed">{passo}</span>
            </li>
          ))}
        </ol>

        {explicacao.alternativa ? (
          <div className="mt-8 rounded-lg border border-dashed border-[var(--borda-1)] bg-[var(--superficie-2)] p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {explicacao.alternativa.titulo}
            </h2>
            <ol className="mt-3 space-y-2">
              {explicacao.alternativa.passos.map((passo, indice) => (
                <li key={passo} className="flex gap-3 text-sm text-muted-foreground">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--superficie-3)] text-xs font-semibold"
                  >
                    {indice + 1}
                  </span>
                  <span className="leading-relaxed">{passo}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--borda-1)] pt-6">
          <a
            href="/configurar"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Já configurei — verificar de novo
          </a>
          <a
            href="https://github.com/recuperadoramenegatti/recuperadoramenegatti/blob/main/docs/DEPLOY_VERCEL.md"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Guia completo, passo a passo
          </a>
        </div>

        {estado.detalhe ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-muted-foreground/70 hover:text-muted-foreground">
              Detalhe técnico (para quem for dar suporte)
            </summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-[var(--superficie-2)] p-3 text-xs text-muted-foreground/70">
              {estado.detalhe}
            </pre>
          </details>
        ) : null}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground/70">
        Nada foi perdido. Assim que o banco estiver conectado, o sistema abre normalmente.
      </p>
    </main>
  );
}
