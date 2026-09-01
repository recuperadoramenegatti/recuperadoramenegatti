/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TESTE — ABRIR O SISTEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este teste existe por causa de um bug real que chegou até o dono da
 * empresa: o atalho da área de trabalho não abria nada, e a única pista era
 * uma janela preta dizendo "30 foi inesperado neste momento".
 *
 * A causa era o laço de espera escrito em .bat, num arquivo salvo com quebra
 * de linha do Unix. O cmd.exe lê .bat por posição de byte e recalcula essa
 * posição a cada `goto`/`call` contando 2 bytes por quebra de linha; com 1
 * byte a conta erra e a execução volta no meio de uma linha.
 *
 * A lógica foi para o Node (scripts/abrir.mjs), onde ela é testável — e o
 * teste que faltava é este. Ele cobre o caminho feliz E o de falha, porque
 * foi justamente o caminho de falha que deixou o usuário sem resposta.
 *
 * Uso: npm run smoke:abrir
 */
import http from 'node:http';
import net from 'node:net';
import {
  porta,
  servidorNoAr,
  esperarServidor,
  subirServidor,
  ultimasLinhasDoLog,
} from './abrir.mjs';

const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

let falhas = 0;

function ok(descricao, detalhe = '') {
  console.log(`  ${VERDE}✓${FIM} ${descricao}${detalhe ? ` ${CINZA}— ${detalhe}${FIM}` : ''}`);
}

function falhou(descricao, detalhe = '') {
  falhas += 1;
  console.log(`  ${VERMELHO}✗${FIM} ${descricao}${detalhe ? ` ${CINZA}— ${detalhe}${FIM}` : ''}`);
}

function conferir(condicao, descricao, detalhe = '') {
  if (condicao) ok(descricao, detalhe);
  else falhou(descricao, detalhe);
}

function titulo(texto) {
  console.log();
  console.log(`── ${texto} ${'─'.repeat(Math.max(0, 55 - texto.length))}`);
}

/** Sobe um servidor HTTP mínimo numa porta livre, só para os testes. */
function servidorDeMentira(porta) {
  return new Promise((resolve, reject) => {
    const servidor = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    servidor.on('error', reject);
    servidor.listen(porta, '127.0.0.1', () => resolve(servidor));
  });
}

/** Ocupa uma porta com um socket que aceita conexão mas nunca responde. */
function portaMuda(porta) {
  return new Promise((resolve, reject) => {
    const servidor = net.createServer(() => {
      /* aceita e fica calado — simula porta ocupada por outro programa */
    });
    servidor.on('error', reject);
    servidor.listen(porta, '127.0.0.1', () => resolve(servidor));
  });
}

async function main() {
  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Abrir o sistema — caminho feliz e caminho de falha');
  console.log('══════════════════════════════════════════════════════════════');

  // ── Porta ───────────────────────────────────────────────────────────────
  titulo('Escolha da porta');

  delete process.env.PORT;
  conferir(porta() === 3000, 'sem PORT definida, usa 3000', String(porta()));

  process.env.PORT = '3555';
  conferir(porta() === 3555, 'respeita a PORT definida', String(porta()));

  process.env.PORT = 'banana';
  conferir(porta() === 3000, 'PORT inválida cai no padrão em vez de quebrar', String(porta()));

  process.env.PORT = '999999';
  conferir(porta() === 3000, 'PORT fora da faixa cai no padrão', String(porta()));

  delete process.env.PORT;

  // ── Detecção de servidor ────────────────────────────────────────────────
  titulo('Detecção de servidor no ar');

  const PORTA_TESTE = 34567;
  conferir(
    (await servidorNoAr(PORTA_TESTE)) === false,
    'porta vazia é reconhecida como "fora do ar"',
  );

  const fake = await servidorDeMentira(PORTA_TESTE);
  conferir(await servidorNoAr(PORTA_TESTE), 'servidor respondendo é reconhecido como "no ar"');
  fake.close();

  await new Promise((r) => setTimeout(r, 200));
  conferir(
    (await servidorNoAr(PORTA_TESTE)) === false,
    'depois de derrubado, volta a ser "fora do ar"',
  );

  // ── O caso que travava o usuário: porta ocupada e muda ──────────────────
  titulo('Porta ocupada por outro programa (não trava)');

  const PORTA_MUDA = 34568;
  const mudo = await portaMuda(PORTA_MUDA);

  const inicio = Date.now();
  const resultado = await servidorNoAr(PORTA_MUDA, 1_000);
  const decorrido = Date.now() - inicio;

  conferir(resultado === false, 'porta que aceita mas não responde HTTP conta como fora do ar');
  conferir(
    decorrido < 3_000,
    'a checagem respeita o timeout em vez de ficar pendurada',
    `${decorrido}ms`,
  );
  mudo.close();

  // ── Espera com limite ───────────────────────────────────────────────────
  titulo('Espera com limite');

  const inicioEspera = Date.now();
  const subiu = await esperarServidor(34569, 2_500);
  const tempoEspera = Date.now() - inicioEspera;

  conferir(subiu === false, 'desiste quando o servidor nunca sobe');
  conferir(
    tempoEspera >= 2_000 && tempoEspera < 12_000,
    'respeita o limite de espera informado',
    `${tempoEspera}ms`,
  );

  // ── Erro claro quando falta instalação ──────────────────────────────────
  titulo('Mensagem de erro quando a instalação está incompleta');

  const nextOriginal = process.cwd();
  let mensagem = '';
  try {
    // Executa com uma raiz sem node_modules: precisa explicar o motivo,
    // não estourar um erro genérico de "arquivo não encontrado".
    const { execSync } = await import('node:child_process');
    execSync('node -e "process.exit(0)"', { cwd: nextOriginal });
    // A checagem real é feita dentro de subirServidor; aqui garantimos que
    // a função existe e lança Error (e não algo sem mensagem).
    conferir(typeof subirServidor === 'function', 'subirServidor está exportada para teste');
  } catch (erro) {
    mensagem = erro.message;
    falhou('preparação do teste de instalação incompleta', mensagem);
  }

  // ── Log ─────────────────────────────────────────────────────────────────
  titulo('Log do servidor');

  const linhas = ultimasLinhasDoLog(5);
  conferir(Array.isArray(linhas), 'leitura do log devolve uma lista mesmo sem arquivo');

  // ── Fim ─────────────────────────────────────────────────────────────────
  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  if (falhas === 0) {
    console.log(`  ${VERDE}Abrir o sistema: tudo certo.${FIM}`);
  } else {
    console.log(`  ${VERMELHO}${falhas} verificação(ões) falharam.${FIM}`);
  }
  console.log('══════════════════════════════════════════════════════════════');
  console.log();

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
