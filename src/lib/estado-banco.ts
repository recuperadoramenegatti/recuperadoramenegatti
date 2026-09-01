/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTADO DO BANCO DE DADOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responde uma pergunta só: dá para usar o sistema agora?
 *
 * Existe porque publicar na Vercel sem ter criado o banco antes é o erro
 * mais fácil de cometer — e o que acontecia era o site inteiro estourar com
 * um erro técnico, sem dizer o que faltava. Com isto, a mesma situação vira
 * uma tela que explica os três cliques que resolvem.
 *
 * Nunca lança: quem chama precisa poder decidir o que mostrar, e uma falha
 * de diagnóstico não pode virar mais um erro na tela.
 */
import { prisma } from '@/lib/prisma';
import { extrairMensagemErro } from '@/lib/utils';

export type MotivoIndisponivel =
  | 'sem_segredo'
  | 'sem_url'
  | 'url_incompativel'
  | 'sem_conexao'
  | 'sem_tabelas'
  | 'sem_dados';

export interface EstadoBanco {
  pronto: boolean;
  motivo?: MotivoIndisponivel;
  detalhe?: string;
}

/**
 * Diagnóstico em cache.
 *
 * Uma vez que o banco respondeu, ele não vai "desconfigurar" no meio do
 * expediente — então o caminho feliz custa uma única consulta por processo.
 * O caminho ruim é reavaliado a cada 15 segundos, para que configurar o
 * banco e recarregar a página funcione sem precisar reiniciar nada.
 */
const CACHE_ERRO_MS = 15_000;

interface Cache {
  estado: EstadoBanco;
  em: number;
}

const globalParaEstado = globalThis as unknown as { __estadoBancoMenegatti?: Cache };

/**
 * O segredo de sessão está configurado?
 *
 * Sem ele o NextAuth não consegue assinar a sessão e toda tentativa de login
 * falha — mas o formulário mostrava "Usuário ou senha inválidos", porque ele
 * trata qualquer falha do mesmo jeito. O dono ficava digitando a senha certa
 * e recebendo "senha errada", sem nenhuma pista do que faltava.
 *
 * Checar aqui é barato (só lê variável de ambiente) e transforma esse beco
 * sem saída numa tela que diz o que fazer.
 */
function segredoConfigurado(): EstadoBanco | null {
  const segredo = (process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET)?.trim();

  if (!segredo) {
    return {
      pronto: false,
      motivo: 'sem_segredo',
      detalhe: 'Nem NEXTAUTH_SECRET nem AUTH_SECRET estão definidas neste ambiente.',
    };
  }

  return null;
}

function urlConfigurada(): EstadoBanco | null {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    return {
      pronto: false,
      motivo: 'sem_url',
      detalhe: 'A variável DATABASE_URL não está definida neste ambiente.',
    };
  }

  // SQLite em arquivo não sobrevive num servidor sem disco permanente. É um
  // engano comum ao publicar: copiar o valor do .env.example para a Vercel.
  if (process.env.VERCEL === '1' && url.startsWith('file:')) {
    return {
      pronto: false,
      motivo: 'url_incompativel',
      detalhe:
        'A DATABASE_URL aponta para um arquivo SQLite, mas este servidor não ' +
        'guarda arquivos entre um acesso e outro. É preciso um banco Postgres.',
    };
  }

  return null;
}

async function diagnosticar(): Promise<EstadoBanco> {
  // Antes do banco: sem segredo de sessão não há login possível, e essa
  // falha se disfarçava de "senha errada".
  const problemaDeSegredo = segredoConfigurado();
  if (problemaDeSegredo) return problemaDeSegredo;

  const problemaDeUrl = urlConfigurada();
  if (problemaDeUrl) return problemaDeUrl;

  try {
    // Consulta a tabela que o seed sempre preenche: responde de uma vez se o
    // banco conecta, se as tabelas existem e se os parâmetros foram carregados.
    const parametros = await prisma.configuracao.count();

    if (parametros === 0) {
      return {
        pronto: false,
        motivo: 'sem_dados',
        detalhe: 'O banco está conectado, mas os parâmetros iniciais não foram carregados.',
      };
    }

    return { pronto: true };
  } catch (erro) {
    const mensagem = extrairMensagemErro(erro);

    // O Prisma usa P2021/P2022 para "tabela/coluna não existe" e P1001/P1002
    // para "não consegui alcançar o banco".
    const tabelaFaltando = /P2021|P2022|does not exist|no such table/i.test(mensagem);

    return {
      pronto: false,
      motivo: tabelaFaltando ? 'sem_tabelas' : 'sem_conexao',
      detalhe: mensagem,
    };
  }
}

/** O sistema pode operar agora? Resultado em cache (ver CACHE_ERRO_MS). */
export async function estadoDoBanco(): Promise<EstadoBanco> {
  const cache = globalParaEstado.__estadoBancoMenegatti;

  if (cache) {
    if (cache.estado.pronto) return cache.estado;
    if (Date.now() - cache.em < CACHE_ERRO_MS) return cache.estado;
  }

  const estado = await diagnosticar();
  globalParaEstado.__estadoBancoMenegatti = { estado, em: Date.now() };
  return estado;
}

/** Esquece o diagnóstico anterior — usado depois de configurar o banco. */
export function esquecerEstadoDoBanco(): void {
  globalParaEstado.__estadoBancoMenegatti = undefined;
}
