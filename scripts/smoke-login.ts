/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TESTE — LOGIN NÃO PODE TRANCAR QUEM SABE A SENHA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Existe por causa de um caso real: o dono da empresa errou a senha algumas
 * vezes, depois passou a digitar a senha CERTA — e continuou recebendo
 * "usuário ou senha inválidos". A causa era o freio anti-adivinhação, que
 * bloqueava por 15 minutos e checava o bloqueio ANTES de conferir a senha.
 * Nem a senha certa passava, e cada tentativa reiniciava a contagem.
 *
 * O freio virou espera progressiva. Este teste guarda a propriedade que
 * importa: DEPOIS DE MUITOS ERROS, A SENHA CERTA AINDA ENTRA.
 *
 * Uso: npm run smoke:login
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
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

/**
 * Chama o `authorize` do provider de credenciais, como o NextAuth faria.
 *
 * A função real fica em `options.authorize`: o NextAuth coloca um stub
 * `() => null` no nível de cima do objeto do provider. Chamar o stub faz o
 * teste "passar" nas verificações negativas e falhar nas positivas — um
 * teste que parece rigoroso e não testa nada. Por isso a busca começa por
 * `options` e o teste aborta se não encontrar a função de verdade.
 */
function pegarAuthorize(): (c: Record<string, unknown>) => Promise<unknown> {
  const provider = configAuth.providers[0] as unknown as {
    authorize?: (c: Record<string, unknown>) => Promise<unknown>;
    options?: { authorize?: (c: Record<string, unknown>) => Promise<unknown> };
  };

  const real = provider.options?.authorize ?? provider.authorize;

  if (!real || String(real).replace(/\s/g, '') === '()=>null') {
    throw new Error(
      'Não encontrei o authorize real do provider — o teste estaria medindo um stub.',
    );
  }

  return real;
}

const authorize = pegarAuthorize();

async function tentarLogin(email: string, password: string): Promise<boolean> {
  const resultado = await authorize({ email, password });
  return resultado !== null && resultado !== undefined;
}

async function main(): Promise<void> {
  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Login — o freio não pode trancar quem sabe a senha');
  console.log('══════════════════════════════════════════════════════════════');

  const usuario = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!usuario) {
    console.log(`  ${VERMELHO}✗${FIM} Nenhum usuário no banco — rode o seed antes.`);
    process.exit(1);
  }

  const hashOriginal = usuario.password;
  const SENHA = 'SenhaDeTesteDeLogin2026';
  await prisma.user.update({
    where: { id: usuario.id },
    data: { password: await bcrypt.hash(SENHA, 12) },
  });

  const email = usuario.email;

  // ── Caminho básico ──────────────────────────────────────────────────────
  titulo('Caminho básico');

  conferir(await tentarLogin(email, SENHA), 'senha certa entra');
  conferir(!(await tentarLogin(email, 'senha-errada-qualquer')), 'senha errada não entra');
  conferir(!(await tentarLogin('nao-existe', SENHA)), 'usuário inexistente não entra');

  // ── O caso que trancou o dono ───────────────────────────────────────────
  titulo('Depois de MUITOS erros, a senha certa ainda entra');

  const ERROS = 12; // bem acima do antigo limite de 5
  for (let i = 0; i < ERROS; i += 1) {
    await tentarLogin(email, `chute-numero-${i}`);
  }
  console.log(`  ${CINZA}(${ERROS} tentativas erradas seguidas registradas)${FIM}`);

  const inicio = Date.now();
  const entrou = await tentarLogin(email, SENHA);
  const demorou = Date.now() - inicio;

  conferir(entrou, 'a senha CERTA entra mesmo depois de 12 erros seguidos');
  conferir(
    demorou < 30_000,
    'e entra em tempo razoável, sem bloqueio de 15 minutos',
    `${demorou}ms`,
  );

  // ── A espera existe, para quem está chutando ────────────────────────────
  titulo('O freio continua existindo para quem chuta');

  const inicioErro = Date.now();
  await tentarLogin(email, 'mais-um-chute');
  const demoraErro = Date.now() - inicioErro;

  conferir(
    demoraErro >= 500,
    'tentativa errada é penalizada com espera',
    `${demoraErro}ms`,
  );
  conferir(demoraErro <= 15_000, 'mas a espera tem teto, não cresce sem limite', `${demoraErro}ms`);

  // ── Restaura ────────────────────────────────────────────────────────────
  titulo('Restaurando o banco');
  await prisma.user.update({ where: { id: usuario.id }, data: { password: hashOriginal } });
  const conferencia = await prisma.user.findUnique({ where: { id: usuario.id } });
  conferir(conferencia?.password === hashOriginal, 'senha original devolvida');

  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  if (falhas === 0) {
    console.log(`  ${VERDE}Login em ordem.${FIM}`);
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
