/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TESTE — O DIAGNÓSTICO ACERTA O MOTIVO, NÃO SÓ "DEU ERRO"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A tela de configuração pendente só ajuda se souber QUAL é o problema. Em
 * produção ela errou: o valor de DATABASE_URL era um arquivo SQLite num
 * servidor Postgres, e a tela disse "não foi possível falar com o banco" —
 * verdade, e inútil. O dono precisava ler "troque o valor da variável".
 *
 * A causa foi depender de VERCEL=1, que só chega à execução se o projeto
 * expuser as variáveis de sistema. Agora o motivo vem da mensagem do Prisma,
 * que é a mesma em qualquer hospedagem.
 *
 * Uso: npx tsx scripts/smoke-diagnostico.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SCHEMA = path.join(RAIZ, 'prisma', 'schema.prisma');

const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

let falhas = 0;

function conferir(condicao: boolean, descricao: string, detalhe = ''): void {
  const marca = condicao ? `${VERDE}✓${FIM}` : `${VERMELHO}✗${FIM}`;
  if (!condicao) falhas += 1;
  console.log(`  ${marca} ${descricao}${detalhe ? ` ${CINZA}— ${detalhe}${FIM}` : ''}`);
}

/**
 * Pergunta o motivo a um processo separado, com o ambiente que queremos
 * testar. Precisa ser outro processo: o cliente do Prisma lê a URL na hora
 * de carregar, então mudar process.env aqui não teria efeito.
 */
function motivoCom(env: Record<string, string>): string {
  const r = spawnSync(
    path.join(RAIZ, 'node_modules', '.bin', 'tsx'),
    [path.join(RAIZ, 'scripts', '.perguntar-motivo.ts')],
    { cwd: RAIZ, env: { ...process.env, ...env }, encoding: 'utf8' },
  );
  const saida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return saida.match(/MOTIVO=(\S+)/)?.[1] ?? `sem-resposta(${saida.slice(-160)})`;
}

console.log();
console.log('══════════════════════════════════════════════════════════════');
console.log('  Diagnóstico do banco: o motivo certo, não só "deu erro"');
console.log('══════════════════════════════════════════════════════════════');
console.log();

const schemaOriginal = fs.readFileSync(SCHEMA, 'utf8');

try {
  // ── A) Variável ausente ────────────────────────────────────────────────
  conferir(motivoCom({ DATABASE_URL: '' }) === 'sem_url', 'sem DATABASE_URL → sem_url');

  // ── B) O caso de produção: schema Postgres, valor SQLite ───────────────
  // Sem VERCEL=1 no ambiente — é exatamente essa a situação que enganava o
  // diagnóstico antigo. O motivo tem de sair certo mesmo assim.
  fs.writeFileSync(SCHEMA, schemaOriginal.replace('provider = "sqlite"', 'provider = "postgresql"'));
  spawnSync(process.execPath, [path.join(RAIZ, 'node_modules', 'prisma', 'build', 'index.js'), 'generate'], {
    cwd: RAIZ,
    encoding: 'utf8',
  });

  const semVercel = motivoCom({ DATABASE_URL: 'file:./menegatti.db' });
  conferir(
    semVercel === 'url_incompativel',
    'schema Postgres + valor "file:" → url_incompativel',
    `sem VERCEL definida, veio "${semVercel}"`,
  );

  const comVercel = motivoCom({ DATABASE_URL: 'file:./menegatti.db', VERCEL: '1' });
  conferir(comVercel === 'url_incompativel', 'o mesmo com VERCEL=1', `veio "${comVercel}"`);

  // ── C) Postgres inexistente é falha de conexão, não de valor ───────────
  const inalcancavel = motivoCom({
    DATABASE_URL: 'postgresql://u:p@127.0.0.1:1/naoexiste?connect_timeout=2',
  });
  conferir(
    inalcancavel === 'sem_conexao',
    'Postgres inalcançável → sem_conexao (e não url_incompativel)',
    `veio "${inalcancavel}"`,
  );
} finally {
  fs.writeFileSync(SCHEMA, schemaOriginal);
  spawnSync(process.execPath, [path.join(RAIZ, 'node_modules', 'prisma', 'build', 'index.js'), 'generate'], {
    cwd: RAIZ,
    encoding: 'utf8',
  });
  console.log(`  ${CINZA}(schema e cliente do Prisma restaurados)${FIM}`);
}

console.log();
console.log('══════════════════════════════════════════════════════════════');
console.log(
  falhas === 0
    ? `  ${VERDE}Diagnóstico em ordem.${FIM}`
    : `  ${VERMELHO}${falhas} verificação(ões) falharam.${FIM}`,
);
console.log('══════════════════════════════════════════════════════════════');
console.log();

process.exit(falhas === 0 ? 0 : 1);
