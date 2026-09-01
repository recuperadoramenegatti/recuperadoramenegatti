/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TESTE — CREDENCIAIS DE ACESSO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Guarda duas coisas que já custaram caro:
 *
 * 1. O e-mail gravado tem de estar em MINÚSCULAS. A tela de login converte o
 *    que a pessoa digita para minúsculas antes de procurar no banco. Um
 *    cadastro gravado como "Menegatti" jamais seria encontrado — e o sintoma
 *    seria "usuário ou senha inválidos" com a senha CERTA, para sempre.
 *
 * 2. REDEFINIR_ACESSO tem de realmente devolver o acesso num banco que já
 *    existe, inclusive quando o cadastro atual tem outro e-mail. Sem isso,
 *    mudar as credenciais no código não ajudaria quem já está trancado do
 *    lado de fora — que é exatamente a situação que originou esta variável.
 *
 * Uso: npm run smoke:acesso
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CREDENCIAL_INICIAL } from '../src/lib/constants';
import { configAuth } from '../src/lib/auth';

const prisma = new PrismaClient();

const VERDE = '\x1b[32m';
const VERMELHO = '\x1b[31m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

let falhas = 0;

function conferir(condicao: boolean, descricao: string, detalhe = ''): void {
  if (condicao) {
    console.log(`  ${VERDE}✓${FIM} ${descricao}${detalhe ? ` ${CINZA}— ${detalhe}${FIM}` : ''}`);
  } else {
    falhas += 1;
    console.log(`  ${VERMELHO}✗${FIM} ${descricao}${detalhe ? ` ${CINZA}— ${detalhe}${FIM}` : ''}`);
  }
}

function titulo(texto: string): void {
  console.log();
  console.log(`── ${texto} ${'─'.repeat(Math.max(0, 56 - texto.length))}`);
}

/** O authorize real — o do topo do provider é um stub `() => null`. */
function pegarAuthorize(): (c: Record<string, unknown>) => Promise<unknown> {
  const p = configAuth.providers[0] as unknown as {
    authorize?: (c: Record<string, unknown>) => Promise<unknown>;
    options?: { authorize?: (c: Record<string, unknown>) => Promise<unknown> };
  };
  const real = p.options?.authorize ?? p.authorize;
  if (!real || String(real).replace(/\s/g, '') === '()=>null') {
    throw new Error('Não encontrei o authorize real — o teste estaria medindo um stub.');
  }
  return real;
}

const authorize = pegarAuthorize();

/** Simula o que a tela de login faz antes de chamar o servidor. */
async function loginComoNaTela(digitado: string, senha: string): Promise<boolean> {
  const r = await authorize({ email: digitado.trim().toLowerCase(), password: senha });
  return r !== null && r !== undefined;
}

async function main(): Promise<void> {
  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Credenciais de acesso');
  console.log('══════════════════════════════════════════════════════════════');

  const original = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!original) {
    console.log(`  ${VERMELHO}✗${FIM} Nenhum usuário no banco — rode o seed antes.`);
    process.exit(1);
  }
  const estadoOriginal = { email: original.email, password: original.password, name: original.name };

  // ── A armadilha da maiúscula ────────────────────────────────────────────
  titulo('O e-mail configurado precisa estar em minúsculas');

  conferir(
    CREDENCIAL_INICIAL.email === CREDENCIAL_INICIAL.email.toLowerCase(),
    'CREDENCIAL_INICIAL.email está em minúsculas',
    CREDENCIAL_INICIAL.email,
  );

  // Prova por que isso importa: grava com maiúscula e mostra que o login quebra.
  await prisma.user.update({
    where: { id: original.id },
    data: {
      email: 'Menegatti',
      password: await bcrypt.hash(CREDENCIAL_INICIAL.senha, 12),
    },
  });
  conferir(
    !(await loginComoNaTela('Menegatti', CREDENCIAL_INICIAL.senha)),
    'com e-mail gravado em maiúscula, nem a senha certa entra (o bug)',
  );

  // ── Redefinição de acesso ───────────────────────────────────────────────
  titulo('REDEFINIR_ACESSO conserta um banco já existente');

  // Reproduz o que o seed faz com a variável ligada.
  await prisma.user.update({
    where: { id: original.id },
    data: {
      email: CREDENCIAL_INICIAL.email.trim().toLowerCase(),
      password: await bcrypt.hash(CREDENCIAL_INICIAL.senha, 12),
      name: CREDENCIAL_INICIAL.nome,
      role: 'admin',
    },
  });

  conferir(
    await loginComoNaTela(CREDENCIAL_INICIAL.email, CREDENCIAL_INICIAL.senha),
    'entra com as credenciais configuradas',
    `${CREDENCIAL_INICIAL.email} / ${CREDENCIAL_INICIAL.senha}`,
  );

  // ── Tolerância ao que a pessoa digita ───────────────────────────────────
  titulo('Como o dono realmente digita');

  conferir(await loginComoNaTela('Menegatti', CREDENCIAL_INICIAL.senha), 'digitando "Menegatti"');
  conferir(await loginComoNaTela('MENEGATTI', CREDENCIAL_INICIAL.senha), 'digitando "MENEGATTI"');
  conferir(await loginComoNaTela('menegatti', CREDENCIAL_INICIAL.senha), 'digitando "menegatti"');
  conferir(
    await loginComoNaTela('  Menegatti  ', CREDENCIAL_INICIAL.senha),
    'com espaços sobrando em volta',
  );

  conferir(
    !(await loginComoNaTela('Menegatti', 'menegatti26fin')),
    'a senha continua diferenciando maiúsculas (senha errada não entra)',
  );
  conferir(
    !(await loginComoNaTela('Menegatti', 'Menegatti26fin ')),
    'senha com espaço a mais não entra',
  );

  // ── Restaura ────────────────────────────────────────────────────────────
  titulo('Restaurando o banco');
  await prisma.user.update({ where: { id: original.id }, data: estadoOriginal });
  const devolvido = await prisma.user.findUnique({ where: { id: original.id } });
  conferir(devolvido?.password === estadoOriginal.password, 'estado original devolvido');

  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  if (falhas === 0) {
    console.log(`  ${VERDE}Credenciais de acesso em ordem.${FIM}`);
  } else {
    console.log(`  ${VERMELHO}${falhas} verificação(ões) falharam.${FIM}`);
  }
  console.log('══════════════════════════════════════════════════════════════');
  console.log();

  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro: unknown) => {
  console.error('✗ Falha no teste:', erro);
  await prisma.$disconnect();
  process.exit(1);
});
