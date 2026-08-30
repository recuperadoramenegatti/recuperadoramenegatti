/**
 * Alterna o provedor do banco em prisma/schema.prisma entre "sqlite" e
 * "postgresql", no mesmo arquivo — sem manter dois schemas duplicados que
 * poderiam divergir a cada modelo novo.
 *
 * Detecção automática:
 *   - Na Vercel (variável VERCEL=1, definida por eles em toda build),
 *     o padrão é "postgresql". A Vercel roda funções serverless com
 *     sistema de arquivos somente leitura e efêmero — SQLite em arquivo
 *     não sobrevive entre requisições.
 *   - Em qualquer outro lugar (a máquina da empresa, este contêiner de
 *     desenvolvimento), o padrão é "sqlite" — um único arquivo, sem
 *     servidor externo, exatamente como a instalação local foi desenhada.
 *   - DATABASE_PROVIDER, se definida, tem prioridade sobre a detecção.
 *
 * Roda antes de `prisma generate` em todo `npm run build` e no
 * `postinstall`, então ninguém precisa lembrar de rodar isto à mão.
 *
 * Uso: node scripts/selecionar-schema.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');

const PROVEDORES_VALIDOS = ['sqlite', 'postgresql'];

/** Binários de query engine que a Lambda da Vercel precisa (Amazon Linux). */
const BINARY_TARGETS_VERCEL = '["native", "rhel-openssl-3.0.x"]';

function determinarProvedor() {
  const explicito = process.env.DATABASE_PROVIDER?.trim();
  if (explicito) {
    if (!PROVEDORES_VALIDOS.includes(explicito)) {
      console.error(
        `[schema] DATABASE_PROVIDER="${explicito}" inválido. Use "sqlite" ou "postgresql".`,
      );
      process.exit(1);
    }
    return explicito;
  }
  return process.env.VERCEL === '1' ? 'postgresql' : 'sqlite';
}

function main() {
  if (!fs.existsSync(CAMINHO_SCHEMA)) {
    console.error(`[schema] Arquivo não encontrado: ${CAMINHO_SCHEMA}`);
    process.exit(1);
  }

  const provedor = determinarProvedor();
  let schema = fs.readFileSync(CAMINHO_SCHEMA, 'utf8');
  let mudou = false;

  // ── provider do datasource ────────────────────────────────────────────
  const provedorAtual = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1];
  if (provedorAtual !== provedor) {
    schema = schema.replace(
      /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")(?:sqlite|postgresql)(")/s,
      `$1${provedor}$2`,
    );
    mudou = true;
  }

  // ── binaryTargets: só faz sentido para a Lambda da Vercel ─────────────
  const temBinaryTargets = /binaryTargets\s*=/.test(schema);

  if (provedor === 'postgresql' && !temBinaryTargets) {
    schema = schema.replace(
      /(generator\s+client\s*\{\s*\n\s*provider\s*=\s*"prisma-client-js"\s*\n)/,
      `$1  binaryTargets = ${BINARY_TARGETS_VERCEL}\n`,
    );
    mudou = true;
  } else if (provedor === 'sqlite' && temBinaryTargets) {
    schema = schema.replace(/\n\s*binaryTargets\s*=\s*\[[^\]]*\]/, '');
    mudou = true;
  }

  if (mudou) {
    fs.writeFileSync(CAMINHO_SCHEMA, schema);
    console.log(`[schema] banco de dados configurado para "${provedor}".`);
  } else {
    console.log(`[schema] já configurado para "${provedor}" — nada a fazer.`);
  }
}

main();
