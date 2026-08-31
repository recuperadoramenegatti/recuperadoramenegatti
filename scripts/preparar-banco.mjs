/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PREPARO DO BANCO DE DADOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cria as tabelas (`prisma db push`) e carrega os parâmetros da Menegatti
 * (`prisma db seed`). Os dois passos são idempotentes: rodar de novo não
 * apaga nada nem sobrescreve senha trocada.
 *
 * Existe em dois modos, porque "falhar" significa coisas diferentes em cada
 * lugar:
 *
 *   ESTRITO (instalação na máquina da empresa)
 *     Sem banco não há sistema. Se falhar, a instalação precisa parar e
 *     dizer o motivo — instalar pela metade é pior que não instalar.
 *
 *   TOLERANTE (build da Vercel, com --tolerante)
 *     O build acontece numa máquina descartável, antes de o site existir.
 *     Se o DATABASE_URL ainda não foi configurado, o certo é AVISAR e deixar
 *     o build terminar: o site sobe e explica ao dono o que falta configurar.
 *     Derrubar o build aqui foi o que impediu a publicação na Vercel — o
 *     erro era `Environment variable not found: DATABASE_URL`, e quem estava
 *     publicando não tinha como saber que faltava criar um Postgres.
 *
 * Uso:
 *   node scripts/preparar-banco.mjs              (estrito)
 *   node scripts/preparar-banco.mjs --tolerante  (build)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AMARELO = '\x1b[33m';
const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

const tolerante = process.argv.includes('--tolerante');

/**
 * Carrega o .env, como o Prisma e o Next fazem por conta própria.
 *
 * Um script Node comum NÃO lê .env sozinho. Sem isto, a checagem abaixo
 * olharia para um `process.env.DATABASE_URL` vazio mesmo com o .env
 * preenchido, e a instalação na máquina da empresa pararia dizendo que
 * falta configurar o banco — com o banco configurado.
 *
 * Variáveis já presentes no ambiente têm prioridade sobre o arquivo, que é
 * como o dotenv se comporta: na Vercel, o painel manda; na máquina da
 * empresa, o arquivo.
 */
function carregarEnv() {
  const caminho = path.join(RAIZ, '.env');
  if (!fs.existsSync(caminho)) return;

  for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const limpa = linha.trim();
    if (limpa === '' || limpa.startsWith('#')) continue;

    const separador = limpa.indexOf('=');
    if (separador <= 0) continue;

    const chave = limpa.slice(0, separador).trim();
    if (chave in process.env) continue; // ambiente vence o arquivo

    let valor = limpa.slice(separador + 1).trim();
    // Tira as aspas externas, se houver: DATABASE_URL="file:./x.db"
    if (
      (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
      (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
    ) {
      valor = valor.slice(1, -1);
    }

    process.env[chave] = valor;
  }
}

carregarEnv();

/**
 * Chama o Prisma que está instalado nesta pasta, pelo Node, direto.
 *
 * Não é `npx` de propósito. O PATH de um script Node não inclui
 * `node_modules/.bin`, então o `npx` não acharia o Prisma local e cairia no
 * seu comportamento de último recurso: BAIXAR o pacote da internet. Num
 * build de servidor isso significa depender da rede num passo que não
 * deveria depender, e ainda arriscar rodar uma versão do CLI diferente da
 * que gerou o client — duas formas de o build falhar por motivo nenhum.
 *
 * Chamando `node node_modules/prisma/build/index.js` não há busca em PATH,
 * não há download e a versão é exatamente a do package-lock.
 */
function rodarPrisma(args) {
  const cli = path.join(RAIZ, 'node_modules', 'prisma', 'build', 'index.js');

  if (!fs.existsSync(cli)) {
    return {
      ok: false,
      motivo: 'o Prisma não está instalado nesta pasta (node_modules incompleto)',
    };
  }

  // `prisma db seed` executa o comando configurado no package.json —
  // "tsx prisma/seed.ts" — procurando `tsx` no PATH. Como o PATH de um
  // script Node não inclui node_modules/.bin, sem isto o seed morre com
  // "spawn tsx ENOENT" e a instalação para no passo do banco.
  const binLocal = path.join(RAIZ, 'node_modules', '.bin');
  const PATH = [binLocal, process.env.PATH ?? ''].join(path.delimiter);

  const resultado = spawnSync(process.execPath, [cli, ...args], {
    cwd: RAIZ,
    stdio: 'inherit',
    env: { ...process.env, PATH, Path: PATH },
  });

  if (resultado.error) return { ok: false, motivo: resultado.error.message };
  if (resultado.status !== 0) return { ok: false, motivo: `código ${resultado.status}` };
  return { ok: true };
}

/**
 * O DATABASE_URL aponta para um banco que faz sentido para este provider?
 *
 * Um erro fácil de cometer e difícil de diagnosticar: configurar a Vercel
 * (que usa Postgres) com a URL de SQLite que veio do .env.example.
 */
function conferirUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { valida: false, motivo: 'DATABASE_URL não está definida' };

  const naVercel = process.env.VERCEL === '1';
  const ehSqlite = url.startsWith('file:');

  if (naVercel && ehSqlite) {
    return {
      valida: false,
      motivo:
        'DATABASE_URL aponta para um arquivo SQLite (file:...), mas a Vercel ' +
        'roda em servidor sem disco permanente e precisa de Postgres',
    };
  }

  if (!naVercel && !ehSqlite && !url.startsWith('postgres')) {
    return { valida: false, motivo: `DATABASE_URL não é reconhecida: "${url.slice(0, 20)}..."` };
  }

  return { valida: true };
}

function avisarEContinuar(motivo) {
  console.log();
  console.log(`  ${AMARELO}!${FIM} Banco de dados ainda não configurado — ${motivo}.`);
  console.log();
  console.log(`    ${CINZA}O site vai subir mesmo assim e mostrar a tela de configuração,${FIM}`);
  console.log(`    ${CINZA}explicando o que falta. Nada foi perdido.${FIM}`);
  console.log();
  console.log('    Para configurar na Vercel:');
  console.log(`      1. Painel do projeto -> aba ${CINZA}Storage${FIM} -> Create Database -> Postgres`);
  console.log(`      2. Settings -> Environment Variables -> confira que existe ${CINZA}DATABASE_URL${FIM}`);
  console.log('      3. Redeploy');
  console.log();
  console.log(`    ${CINZA}Passo a passo completo em docs/DEPLOY_VERCEL.md${FIM}`);
  console.log();
}

function main() {
  const { valida, motivo } = conferirUrl();

  if (!valida) {
    if (tolerante) {
      avisarEContinuar(motivo);
      return 0; // build segue
    }
    console.error();
    console.error(`  ${VERMELHO}✗${FIM} Não é possível preparar o banco: ${motivo}.`);
    console.error();
    return 1;
  }

  const push = rodarPrisma(['db', 'push']);
  if (!push.ok) {
    if (tolerante) {
      avisarEContinuar(`não foi possível criar as tabelas (${push.motivo})`);
      return 0;
    }
    console.error(`  ${VERMELHO}✗${FIM} Falha ao criar as tabelas: ${push.motivo}`);
    return 1;
  }

  const seed = rodarPrisma(['db', 'seed']);
  if (!seed.ok) {
    if (tolerante) {
      avisarEContinuar(`não foi possível carregar os parâmetros iniciais (${seed.motivo})`);
      return 0;
    }
    console.error(`  ${VERMELHO}✗${FIM} Falha ao carregar os parâmetros: ${seed.motivo}`);
    return 1;
  }

  console.log(`  ${VERDE}✓${FIM} Banco de dados pronto.`);
  return 0;
}

process.exit(main());
