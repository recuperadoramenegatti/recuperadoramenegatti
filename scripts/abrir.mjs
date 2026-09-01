/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ABRIR O SISTEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * É o que acontece quando o dono clica no atalho da área de trabalho:
 *
 *   1. Se o servidor já está no ar, só abre o navegador.
 *   2. Se não está, sobe o servidor em segundo plano, espera ficar pronto
 *      e então abre o navegador.
 *   3. Se o servidor não subir, mostra o MOTIVO — as últimas linhas do log
 *      do servidor — em vez de um erro genérico ou de uma janela que some.
 *
 * Por que isto é um script Node e não um .bat:
 *
 * A versão anterior era um laço em batch com `goto` e `call`. O cmd.exe lê
 * arquivo .bat por posição de byte e recalcula essa posição a cada desvio,
 * assumindo 2 bytes por quebra de linha. Num arquivo salvo com quebra de
 * linha do Unix a conta erra, a execução volta no meio de uma linha, e o
 * resultado foi o sistema morrendo com "30 foi inesperado neste momento" —
 * uma mensagem que não diz nada para quem só queria abrir o programa.
 *
 * O .gitattributes deste repositório passou a forçar CRLF nos .bat, o que
 * corrige a causa. Mas a lição maior é que lógica com laço, condicional e
 * espera não pertence a um arquivo .bat: aqui ela roda no mesmo Node que o
 * sistema já usa, é igual em Windows, Linux e macOS, e é testável.
 *
 * Uso: node scripts/abrir.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_LOGS = path.join(RAIZ, 'logs');
const ARQUIVO_LOG = path.join(PASTA_LOGS, 'servidor.log');
const ARQUIVO_PID = path.join(PASTA_LOGS, 'servidor.pid');

/** Quanto esperamos o servidor ficar de pé antes de desistir. */
const LIMITE_ESPERA_MS = 90_000;
const INTERVALO_TENTATIVA_MS = 1_000;

const VERDE = '\x1b[32m';
const AMARELO = '\x1b[33m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

export function porta() {
  const bruta = process.env.PORT?.trim();
  const numero = Number(bruta);
  return Number.isInteger(numero) && numero > 0 && numero < 65536 ? numero : 3000;
}

/**
 * O servidor está respondendo?
 *
 * Qualquer resposta HTTP serve — inclusive 302 ou 404. O que importa é ter
 * alguém escutando a porta e falando HTTP; o código de status é problema da
 * aplicação, não do "está no ar".
 */
export function servidorNoAr(porta, timeoutMs = 2_000) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: porta, path: '/login', timeout: timeoutMs },
      (res) => {
        res.resume(); // descarta o corpo, libera o socket
        resolve(true);
      },
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** Espera o servidor responder, com limite. Devolve true se ficou pronto. */
export async function esperarServidor(porta, limiteMs = LIMITE_ESPERA_MS, aoTentar) {
  const prazo = Date.now() + limiteMs;
  let tentativa = 0;

  while (Date.now() < prazo) {
    tentativa += 1;
    if (await servidorNoAr(porta)) return true;
    aoTentar?.(tentativa);
    await new Promise((r) => setTimeout(r, INTERVALO_TENTATIVA_MS));
  }

  // Uma última chance: o laço pode ter estourado o prazo durante a espera.
  return servidorNoAr(porta);
}

/**
 * Sobe o servidor em segundo plano.
 *
 * Chama o binário do Next direto pelo Node, sem passar por `npm` nem por um
 * shell: não há aspas para escapar, não há npm.cmd para localizar, e o
 * comportamento é idêntico nos três sistemas operacionais.
 *
 * A saída vai para logs/servidor.log. É o que permite dizer ao dono o que
 * realmente aconteceu quando algo falha, em vez de "não abriu".
 */
export function subirServidor(porta) {
  const binarioNext = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');

  if (!fs.existsSync(binarioNext)) {
    throw new Error(
      'O Next.js não está instalado nesta pasta (node_modules incompleto). ' +
        'Rode a instalação novamente.',
    );
  }

  fs.mkdirSync(PASTA_LOGS, { recursive: true });

  // Recomeça o log a cada subida: o que interessa é a tentativa atual.
  const cabecalho = `\n===== ${new Date().toISOString()} — subindo na porta ${porta} =====\n`;
  fs.writeFileSync(ARQUIVO_LOG, cabecalho);
  const log = fs.openSync(ARQUIVO_LOG, 'a');

  // -H 0.0.0.0 deixa o sistema alcançável de outro computador da oficina.
  // O login continua sendo exigido — abrir na rede não dá acesso livre.
  const filho = spawn(
    process.execPath,
    [binarioNext, 'start', '-H', '0.0.0.0', '-p', String(porta)],
    {
      cwd: RAIZ,
      detached: true,
      stdio: ['ignore', log, log],
      windowsHide: true,
      env: { ...process.env, PORT: String(porta) },
    },
  );

  // O servidor roda oculto — então guardamos o PID para que parar.mjs
  // consiga encerrá-lo depois. Sem isto, a única saída seria o gerenciador
  // de tarefas, o que não é resposta para quem não é técnico.
  try {
    fs.writeFileSync(ARQUIVO_PID, String(filho.pid));
  } catch {
    // Não conseguir anotar o PID não é motivo para não subir o sistema.
  }

  // unref: o servidor continua vivo depois que este script termina. É o que
  // faz o atalho poder fechar sem derrubar o sistema junto.
  filho.unref();
  return filho;
}

/** PID do servidor que subimos, se ainda houver um anotado. */
export function pidDoServidor() {
  try {
    const pid = Number(fs.readFileSync(ARQUIVO_PID, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Esquece o PID anotado (o processo não existe mais). */
export function esquecerPid() {
  try {
    fs.rmSync(ARQUIVO_PID, { force: true });
  } catch {
    /* nada a fazer */
  }
}

/** Abre o navegador padrão do sistema no endereço. */
export function abrirNavegador(url) {
  const comandos = {
    win32: ['cmd', ['/c', 'start', '', url]],
    darwin: ['open', [url]],
  };
  const [comando, args] = comandos[process.platform] ?? ['xdg-open', [url]];

  try {
    spawn(comando, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  } catch {
    return false;
  }
}

/** Últimas linhas do log do servidor — o motivo real de uma falha. */
export function ultimasLinhasDoLog(quantas = 25) {
  try {
    const conteudo = fs.readFileSync(ARQUIVO_LOG, 'utf8');
    const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim() !== '');
    return linhas.slice(-quantas);
  } catch {
    return [];
  }
}

async function main() {
  const p = porta();
  const endereco = `http://localhost:${p}`;

  // O atalho da área de trabalho abre o navegador; o da inicialização do
  // Windows só liga o servidor e sai de cena. Mesmo caminho de código,
  // testado uma vez só.
  const semNavegador = process.argv.includes('--sem-navegador');
  const abrir = () => {
    if (semNavegador) return;
    abrirNavegador(endereco);
  };

  // ── 1. Já está no ar? ───────────────────────────────────────────────────
  if (await servidorNoAr(p)) {
    console.log(`  ${VERDE}✓${FIM} O sistema já está ligado.${semNavegador ? '' : ' Abrindo o navegador...'}`);
    abrir();
    return 0;
  }

  // ── 2. Está instalado? ──────────────────────────────────────────────────
  if (!fs.existsSync(path.join(RAIZ, '.next'))) {
    console.log();
    console.log(`  ${VERMELHO}✗${FIM} O sistema ainda não foi instalado nesta pasta.`);
    console.log('    Rode o instalador antes de usar este atalho.');
    console.log();
    return 1;
  }

  // ── 3. Sobe o servidor ──────────────────────────────────────────────────
  console.log();
  console.log('  Ligando o sistema, aguarde...');

  try {
    subirServidor(p);
  } catch (erro) {
    console.log();
    console.log(`  ${VERMELHO}✗${FIM} ${erro.message}`);
    console.log();
    return 1;
  }

  const pronto = await esperarServidor(p, LIMITE_ESPERA_MS, (tentativa) => {
    if (tentativa % 5 === 0) {
      process.stdout.write(`  ${CINZA}ainda ligando... (${tentativa}s)${FIM}\n`);
    }
  });

  // ── 4. Deu certo? ───────────────────────────────────────────────────────
  if (pronto) {
    console.log(`  ${VERDE}✓${FIM} Sistema no ar.${semNavegador ? '' : ' Abrindo o navegador...'}`);
    abrir();
    return 0;
  }

  console.log();
  console.log(`  ${VERMELHO}✗${FIM} O sistema não conseguiu iniciar.`);
  console.log();

  const linhas = ultimasLinhasDoLog();
  if (linhas.length > 0) {
    console.log(`  ${AMARELO}Últimas mensagens do servidor:${FIM}`);
    console.log(`  ${CINZA}${'─'.repeat(60)}${FIM}`);
    for (const linha of linhas) console.log(`  ${linha}`);
    console.log(`  ${CINZA}${'─'.repeat(60)}${FIM}`);
    console.log();
    console.log(`  O log completo está em: ${CINZA}${ARQUIVO_LOG}${FIM}`);
  } else {
    console.log(`  Não houve nem log do servidor — o Node.js pode não estar`);
    console.log(`  funcionando nesta pasta. Rode o instalador novamente.`);
  }

  console.log();
  console.log(`  ${AMARELO}O que costuma resolver:${FIM}`);
  console.log('    - A porta pode estar ocupada por outro programa.');
  console.log(`      Tente outra: feche esta janela e rode  ${CINZA}PORT=3001${FIM} antes de abrir.`);
  console.log('    - Rodar o instalador de novo (não perde dados).');
  console.log();
  return 1;
}

// Só executa quando chamado direto — permite importar as funções nos testes.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((codigo) => process.exit(codigo))
    .catch((erro) => {
      console.error(`  ${VERMELHO}✗${FIM} Erro inesperado ao abrir o sistema:`);
      console.error(`    ${erro?.message ?? erro}`);
      process.exit(1);
    });
}
