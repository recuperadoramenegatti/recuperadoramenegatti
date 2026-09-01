/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TESTE — O ACESSO SE RESTAURA, MAS A SENHA DO DONO É INTOCÁVEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Duas regras que parecem opostas, e que precisam valer ao mesmo tempo:
 *
 *   A) Enquanto ninguém trocou a senha pela tela, publicar de novo devolve o
 *      acesso às credenciais configuradas. É o que tira do beco sem saída
 *      quem perdeu o acesso — a situação que custou dias ao dono da empresa.
 *
 *   B) Depois que o dono troca a senha, NENHUMA publicação futura a desfaz.
 *      Sem isso, a "autocura" viraria uma armadilha pior que o problema.
 *
 * A marca `senhaDefinidaPeloDono` separa os dois casos. Este teste existe
 * para que ninguém, no futuro, "simplifique" essa lógica e reintroduza um
 * dos dois desastres.
 *
 * Uso: npm run smoke:autocura
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CREDENCIAL_INICIAL } from '../src/lib/constants';
import { CHAVE_SENHA_DEFINIDA, marcarSenhaComoDoDono } from '../src/lib/senha-definida';

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

/** Reproduz a decisão que o seed toma sobre realinhar (ou não) o acesso. */
async function seedRealinhariaOAcesso(): Promise<boolean> {
  const marca = await prisma.configuracao.findUnique({ where: { chave: CHAVE_SENHA_DEFINIDA } });
  const donoDefiniu = marca?.valor === 'true';
  return !donoDefiniu || Boolean(process.env.REDEFINIR_ACESSO?.trim());
}

async function main(): Promise<void> {
  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Autocura do acesso × senha do dono');
  console.log('══════════════════════════════════════════════════════════════');

  const usuario = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!usuario) {
    console.log(`  ${VERMELHO}✗${FIM} Nenhum usuário no banco — rode o seed antes.`);
    process.exit(1);
  }

  const estadoUsuario = { email: usuario.email, password: usuario.password, name: usuario.name };
  const marcaOriginal = await prisma.configuracao.findUnique({
    where: { chave: CHAVE_SENHA_DEFINIDA },
  });

  // ── A) Instalação onde ninguém trocou a senha ───────────────────────────
  titulo('A) Sem troca consciente, o acesso se restaura');

  await prisma.configuracao.deleteMany({ where: { chave: CHAVE_SENHA_DEFINIDA } });
  conferir(
    await seedRealinhariaOAcesso(),
    'sem a marca, a publicação realinha o acesso',
    'tira do beco sem saída',
  );

  // ── B) O dono troca a senha ─────────────────────────────────────────────
  titulo('B) Depois da troca pelo dono, a senha é intocável');

  await marcarSenhaComoDoDono();
  const marcaGravada = await prisma.configuracao.findUnique({
    where: { chave: CHAVE_SENHA_DEFINIDA },
  });
  conferir(marcaGravada?.valor === 'true', 'a marca foi gravada ao trocar a senha');
  conferir(
    !(await seedRealinhariaOAcesso()),
    'com a marca, a publicação NÃO mexe na senha',
    'a senha do dono sobrevive a todo deploy',
  );

  // Chamar de novo não pode duplicar nem quebrar (upsert).
  await marcarSenhaComoDoDono();
  const quantas = await prisma.configuracao.count({ where: { chave: CHAVE_SENHA_DEFINIDA } });
  conferir(quantas === 1, 'marcar de novo não duplica o registro', `${quantas} registro(s)`);

  // ── C) A saída de emergência continua existindo ─────────────────────────
  titulo('C) REDEFINIR_ACESSO ainda vence a marca, se for preciso');

  process.env.REDEFINIR_ACESSO = '1';
  conferir(
    await seedRealinhariaOAcesso(),
    'com a variável, o acesso é realinhado mesmo com a marca',
    'última saída de emergência',
  );
  delete process.env.REDEFINIR_ACESSO;

  conferir(
    !(await seedRealinhariaOAcesso()),
    'removida a variável, a senha do dono volta a ser respeitada',
  );

  // ── D) As credenciais configuradas são utilizáveis ──────────────────────
  titulo('D) As credenciais configuradas funcionam de fato');

  const hash = await bcrypt.hash(CREDENCIAL_INICIAL.senha, 12);
  conferir(
    await bcrypt.compare(CREDENCIAL_INICIAL.senha, hash),
    'a senha configurada gera hash conferível',
    CREDENCIAL_INICIAL.senha,
  );
  conferir(
    CREDENCIAL_INICIAL.email === CREDENCIAL_INICIAL.email.toLowerCase(),
    'o usuário configurado está em minúsculas (senão o login nunca acha)',
    CREDENCIAL_INICIAL.email,
  );

  // ── Restaura ────────────────────────────────────────────────────────────
  titulo('Restaurando o banco');

  await prisma.user.update({ where: { id: usuario.id }, data: estadoUsuario });
  await prisma.configuracao.deleteMany({ where: { chave: CHAVE_SENHA_DEFINIDA } });
  if (marcaOriginal) {
    await prisma.configuracao.create({
      data: {
        chave: marcaOriginal.chave,
        valor: marcaOriginal.valor,
        tipo: marcaOriginal.tipo,
        grupo: marcaOriginal.grupo,
        descricao: marcaOriginal.descricao,
      },
    });
  }
  const devolvido = await prisma.user.findUnique({ where: { id: usuario.id } });
  conferir(devolvido?.password === estadoUsuario.password, 'estado original devolvido');

  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  if (falhas === 0) {
    console.log(`  ${VERDE}Autocura do acesso em ordem.${FIM}`);
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
