/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  INSTALAÇÃO DO SISTEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Roda os passos da instalação e — o que mais importa quando algo dá errado —
 * diz em português qual passo falhou e o que costuma resolver.
 *
 * Estava em .bat, com `goto :falhou` e blocos entre parênteses. Isso já
 * quebrou de forma silenciosa na máquina do dono (ver scripts/abrir.mjs),
 * então a lógica veio para cá: mesmo Node que o sistema já usa, mesmo
 * comportamento nos três sistemas operacionais, e testável.
 *
 * Uso: node scripts/instalar.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDENCIAL_INICIAL } from './credencial-inicial.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VERDE = '\x1b[32m';
const AMARELO = '\x1b[33m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const NEGRITO = '\x1b[1m';
const FIM = '\x1b[0m';

const VERSAO_MINIMA_NODE = 20;

/**
 * Executa um comando mostrando a saída ao vivo.
 *
 * `shell: false` de propósito: sem shell não há aspas para escapar nem
 * diferença de comportamento entre cmd.exe e bash — a maior fonte de bug
 * dos instaladores anteriores.
 */
function rodar(comando, args, { cwd = RAIZ } = {}) {
  const resultado = spawnSync(comando, args, {
    cwd,
    stdio: 'inherit',
    // No Windows, npm é um .cmd e precisa do shell para ser localizado.
    // Para o Node em si (o caso comum aqui) seguimos sem shell.
    shell: process.platform === 'win32' && !comando.endsWith('.exe'),
  });

  if (resultado.error) {
    return { ok: false, motivo: resultado.error.message };
  }
  if (resultado.status !== 0) {
    return { ok: false, motivo: `terminou com código ${resultado.status}` };
  }
  return { ok: true };
}

/** Caminho do npm que acompanha o Node que está rodando este script. */
function comandoNpm() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function cabecalho() {
  console.log();
  console.log('  ============================================================');
  console.log(`    ${NEGRITO}RECUPERADORA MENEGATTI${FIM}`);
  console.log('    Instalacao do sistema de gestao financeira');
  console.log('  ============================================================');
  console.log();
}

function falhar(passo, motivo) {
  console.log();
  console.log('  ============================================================');
  console.log(`    ${VERMELHO}A INSTALACAO FALHOU${FIM}`);
  console.log('  ============================================================');
  console.log();
  console.log(`    Passo que falhou: ${NEGRITO}${passo}${FIM}`);
  console.log(`    Motivo: ${motivo}`);
  console.log();
  console.log(`    ${AMARELO}O que costuma resolver:${FIM}`);
  console.log('      - Conferir se este computador esta conectado a internet');
  console.log('        (so a instalacao precisa dela; o uso diario nao)');
  console.log('      - Rodar o instalador de novo: nao estraga nada, e ele');
  console.log('        continua de onde parou');
  console.log('      - Rodar como administrador, se o erro falar em permissao');
  console.log();
  console.log('    As mensagens em vermelho logo acima dizem o motivo exato.');
  console.log();
  return 1;
}

async function main() {
  cabecalho();

  // ── 0. Versão do Node ───────────────────────────────────────────────────
  const versaoNode = Number(process.versions.node.split('.')[0]);
  if (versaoNode < VERSAO_MINIMA_NODE) {
    return falhar(
      'verificacao do Node.js',
      `Node.js ${process.versions.node} e antigo demais (precisa da versao ${VERSAO_MINIMA_NODE} ou superior).`,
    );
  }
  console.log(`  ${VERDE}✓${FIM} Node.js ${process.versions.node}`);

  // ── 1. Dependências ─────────────────────────────────────────────────────
  console.log();
  console.log(`  ${NEGRITO}[1/5]${FIM} Instalando os componentes do sistema...`);
  console.log(`        ${CINZA}(pode levar alguns minutos na primeira vez)${FIM}`);
  console.log();

  const deps = rodar(comandoNpm(), ['install', '--no-audit', '--no-fund']);
  if (!deps.ok) return falhar('instalacao dos componentes (npm install)', deps.motivo);

  // ── 2. Configuração ─────────────────────────────────────────────────────
  console.log();
  console.log(`  ${NEGRITO}[2/5]${FIM} Preparando a configuracao...`);

  const env = rodar(process.execPath, [path.join(RAIZ, 'scripts', 'preparar-ambiente.mjs')]);
  if (!env.ok) return falhar('preparacao do arquivo de configuracao', env.motivo);

  // ── 3. Banco ────────────────────────────────────────────────────────────
  console.log();
  console.log(`  ${NEGRITO}[3/5]${FIM} Criando o banco de dados...`);

  const banco = rodar(comandoNpm(), ['run', 'setup']);
  if (!banco.ok) return falhar('criacao do banco de dados', banco.motivo);

  // ── 4. Compilação ───────────────────────────────────────────────────────
  console.log();
  console.log(`  ${NEGRITO}[4/5]${FIM} Compilando o sistema...`);
  console.log(`        ${CINZA}(esta e a etapa mais demorada)${FIM}`);
  console.log();

  const build = rodar(comandoNpm(), ['run', 'build']);
  if (!build.ok) return falhar('compilacao do sistema (npm run build)', build.motivo);

  // A compilação precisa ter deixado a pasta .next; sem ela o atalho não
  // abre nada — exatamente o sintoma que trouxe o usuário de volta.
  if (!fs.existsSync(path.join(RAIZ, '.next'))) {
    return falhar(
      'compilacao do sistema',
      'a compilacao terminou sem erro, mas a pasta .next nao foi criada.',
    );
  }

  // ── 5. Atalhos (só Windows; falhar aqui não invalida a instalação) ──────
  console.log();
  console.log(`  ${NEGRITO}[5/5]${FIM} Criando os atalhos...`);

  if (process.platform === 'win32') {
    const atalhos = rodar('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(RAIZ, 'scripts', 'windows', 'criar-atalhos.ps1'),
    ]);
    if (!atalhos.ok) {
      console.log(`  ${AMARELO}!${FIM} Nao foi possivel criar os atalhos automaticamente.`);
      console.log(`    ${CINZA}O sistema funciona: use o arquivo abrir.bat desta pasta.${FIM}`);
    }
  } else {
    console.log(`  ${CINZA}(atalhos automaticos so no Windows)${FIM}`);
  }

  // ── Fim ─────────────────────────────────────────────────────────────────
  console.log();
  console.log('  ============================================================');
  console.log(`    ${VERDE}${NEGRITO}INSTALACAO CONCLUIDA${FIM}`);
  console.log('  ============================================================');
  console.log();
  console.log(`    Usuario: ${CREDENCIAL_INICIAL.email}`);
  console.log(`    Senha:   ${CREDENCIAL_INICIAL.senha}`);
  console.log();
  console.log(`    ${AMARELO}TROQUE A SENHA no primeiro acesso, em Configuracoes.${FIM}`);
  console.log();
  console.log('  ============================================================');
  console.log();
  console.log('    Abrindo o sistema agora...');
  console.log();

  // Abrir faz parte da instalação: quem instalou espera ver o sistema, não
  // uma janela que fecha. Chamamos as mesmas funções do atalho — um caminho
  // de código só, testado uma vez só.
  const { porta, servidorNoAr, subirServidor, esperarServidor, abrirNavegador } =
    await import('./abrir.mjs');

  const p = porta();
  if (!(await servidorNoAr(p))) {
    subirServidor(p);
    await esperarServidor(p);
  }
  abrirNavegador(`http://localhost:${p}`);

  return 0;
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((erro) => {
    console.error();
    console.error(`  ${VERMELHO}Erro inesperado na instalacao:${FIM}`);
    console.error(`    ${erro?.stack ?? erro}`);
    process.exit(1);
  });
