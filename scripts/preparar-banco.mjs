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
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AMARELO = '\x1b[33m';
const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

const tolerante = process.argv.includes('--tolerante');

function rodarPrisma(args) {
  const resultado = spawnSync('npx', ['prisma', ...args], {
    cwd: RAIZ,
    stdio: 'inherit',
    shell: process.platform === 'win32',
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
