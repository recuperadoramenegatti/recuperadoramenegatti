/**
 * Prepara o arquivo .env da instalação.
 *
 * Chamado pelos instaladores de cada sistema. A lógica delicada — gerar o
 * segredo de sessão, não sobrescrever uma instalação existente — fica aqui,
 * num só lugar, em vez de duplicada em batch e shell.
 *
 * Uso: node scripts/preparar-ambiente.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_ENV = path.join(RAIZ, '.env');
const CAMINHO_EXEMPLO = path.join(RAIZ, '.env.example');

const VERDE = '\x1b[32m';
const AMARELO = '\x1b[33m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

function ok(msg) {
  console.log(`  ${VERDE}✓${FIM} ${msg}`);
}
function aviso(msg) {
  console.log(`  ${AMARELO}!${FIM} ${msg}`);
}
function erro(msg) {
  console.log(`  ${VERMELHO}✗${FIM} ${msg}`);
}

/** Segredo de 32 bytes com gerador criptográfico — não `Math.random`. */
function gerarSegredo() {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Grava o mesmo segredo em NEXTAUTH_SECRET e AUTH_SECRET.
 *
 * As âncoras de início e fim de linha não são decoração: "AUTH_SECRET" é
 * sufixo de "NEXTAUTH_SECRET". Sem elas, a segunda substituição casa dentro
 * da primeira linha e a linha do AUTH_SECRET fica com o valor de exemplo —
 * um segredo público servindo de chave criptográfica.
 */
function aplicarSegredo(conteudo, segredo) {
  return conteudo
    .replace(/^NEXTAUTH_SECRET=".*"$/m, `NEXTAUTH_SECRET="${segredo}"`)
    .replace(/^AUTH_SECRET=".*"$/m, `AUTH_SECRET="${segredo}"`);
}

// ── Versão do Node ────────────────────────────────────────────────────────
const versaoMinima = 20;
const versaoAtual = Number(process.versions.node.split('.')[0]);

if (versaoAtual < versaoMinima) {
  erro(
    `Node.js ${process.versions.node} é antigo demais. ` +
      `O sistema precisa da versão ${versaoMinima} ou superior.`,
  );
  console.log(`    Baixe em ${CINZA}https://nodejs.org${FIM} e rode o instalador de novo.`);
  process.exit(1);
}
ok(`Node.js ${process.versions.node}`);

// ── Arquivo .env ──────────────────────────────────────────────────────────
if (fs.existsSync(CAMINHO_ENV)) {
  const conteudo = fs.readFileSync(CAMINHO_ENV, 'utf8');
  const temSegredoReal =
    /^NEXTAUTH_SECRET="(?!troque-este-valor)[^"]{20,}"$/m.test(conteudo) &&
    /^AUTH_SECRET="(?!troque-este-valor)[^"]{20,}"$/m.test(conteudo);

  if (temSegredoReal) {
    ok('Configuração já existe — mantida como está.');
    aviso('Nenhum dado foi tocado. Para recomeçar do zero, apague o arquivo .env.');
    process.exit(0);
  }

  // .env existe mas com o segredo de exemplo: completa sem perder o resto.
  const segredo = gerarSegredo();
  fs.writeFileSync(CAMINHO_ENV, aplicarSegredo(conteudo, segredo));
  ok('Segredo de sessão gerado no .env existente.');
  process.exit(0);
}

if (!fs.existsSync(CAMINHO_EXEMPLO)) {
  erro('Arquivo .env.example não encontrado. A pasta do sistema está incompleta.');
  process.exit(1);
}

const segredo = gerarSegredo();
const conteudo = aplicarSegredo(fs.readFileSync(CAMINHO_EXEMPLO, 'utf8'), segredo);

fs.writeFileSync(CAMINHO_ENV, conteudo, { mode: 0o600 });
ok('Arquivo de configuração criado com um segredo de sessão exclusivo.');
console.log(
  `    ${CINZA}Esse segredo protege as sessões e cifra a chave da API. ` +
    `Ele fica só nesta máquina.${FIM}`,
);
