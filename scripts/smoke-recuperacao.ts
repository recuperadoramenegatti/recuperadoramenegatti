/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TESTE — RECUPERAÇÃO DE SENHA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este caminho é o último recurso do dono da empresa: se ele falhar, a saída
 * é editar o banco à mão. Então ele precisa de teste — e teste que cubra o
 * lado chato, não só o feliz: código errado tem de ser recusado, código usado
 * tem de deixar de valer, e o formato digitado no papel (com hífen, sem
 * hífen, em minúscula) tem de ser aceito.
 *
 * Uso: npm run smoke:recuperacao
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { CREDENCIAL_INICIAL } from '../src/lib/constants';
import {
  CHAVE_CODIGO,
  gerarCodigo,
  normalizarCodigo,
  conferirCodigo,
  renovarCodigo,
  garantirCodigo,
  recuperarSenha,
} from '../src/lib/recuperacao';

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

async function main(): Promise<void> {
  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Recuperação de senha');
  console.log('══════════════════════════════════════════════════════════════');

  // Guarda o estado atual para devolver no fim.
  const codigoOriginal = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CODIGO } });
  const usuarioOriginal = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!usuarioOriginal) {
    console.log(`  ${VERMELHO}✗${FIM} Nenhum usuário no banco — rode o seed antes.`);
    process.exit(1);
  }

  const senhaOriginalHash = usuarioOriginal.password;

  // ── Formato do código ───────────────────────────────────────────────────
  titulo('Formato do código');

  const codigo = gerarCodigo();
  conferir(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(codigo), 'formato ABCD-EFGH-JKLM-NPQR', codigo);
  conferir(
    !/[OIS015]/.test(codigo.replace(/-/g, '')),
    'sem caracteres que se confundem à mão (O/0, I/1, S/5)',
  );

  const cem = new Set(Array.from({ length: 100 }, () => gerarCodigo()));
  conferir(cem.size === 100, 'cem códigos seguidos saem todos diferentes', `${cem.size}/100`);

  // ── Tolerância ao que a pessoa digita ───────────────────────────────────
  titulo('Tolerância ao que a pessoa digita');

  const alvo = normalizarCodigo('ABCD-EFGH-JKLM-NPQR');
  conferir(normalizarCodigo('abcd-efgh-jklm-npqr') === alvo, 'aceita minúsculas');
  conferir(normalizarCodigo('ABCDEFGHJKLMNPQR') === alvo, 'aceita sem hífen');
  conferir(normalizarCodigo('ABCD EFGH JKLM NPQR') === alvo, 'aceita com espaços');
  conferir(normalizarCodigo('  ABCD-EFGH-JKLM-NPQR  ') === alvo, 'aceita com espaços em volta');

  // ── Conferência ─────────────────────────────────────────────────────────
  titulo('Conferência do código');

  const codigoValido = await renovarCodigo();
  conferir(
    (await conferirCodigo(codigoValido)) === 'valido_guardado',
    'o código recém-gerado é aceito',
  );
  conferir(
    (await conferirCodigo(codigoValido.toLowerCase().replace(/-/g, ''))) === 'valido_guardado',
    'aceito também digitado torto (minúsculo, sem hífen)',
  );
  conferir((await conferirCodigo('ZZZZ-ZZZZ-ZZZZ-ZZZZ')) === 'invalido', 'código errado é recusado');
  conferir((await conferirCodigo('')) === 'invalido', 'código vazio é recusado');

  // ── Código mestre do ambiente ───────────────────────────────────────────
  titulo('Código mestre do ambiente');

  process.env.CODIGO_RECUPERACAO = 'MESTRE-DA-CASA-2026';
  conferir(
    (await conferirCodigo('MESTRE-DA-CASA-2026')) === 'valido_mestre',
    'o código do ambiente é aceito',
  );
  conferir(
    (await conferirCodigo('mestredacasa2026')) === 'valido_mestre',
    'aceito sem hífen e em minúsculas',
  );
  conferir(
    (await conferirCodigo('MESTRE-ERRADO-9999')) === 'invalido',
    'mestre errado não passa',
  );

  process.env.CODIGO_RECUPERACAO = 'curto';
  conferir(
    (await conferirCodigo('curto')) === 'invalido',
    'mestre curto demais é ignorado (evita segredo fraco)',
  );
  delete process.env.CODIGO_RECUPERACAO;

  // ── Troca de senha de verdade ───────────────────────────────────────────
  titulo('Troca de senha');

  const codigoParaUsar = await renovarCodigo();
  const NOVA = 'SenhaDeTeste!2026';

  const resultado = await recuperarSenha(codigoParaUsar, NOVA);
  conferir(resultado.trocada, 'a senha foi trocada com código válido');
  conferir(Boolean(resultado.codigoNovo), 'um código novo foi devolvido para anotar');

  const usuarioDepois = await prisma.user.findUnique({ where: { id: usuarioOriginal.id } });
  conferir(
    await bcrypt.compare(NOVA, usuarioDepois?.password ?? ''),
    'a senha nova realmente entra',
  );
  conferir(
    !(await bcrypt.compare(CREDENCIAL_INICIAL.senha, usuarioDepois?.password ?? '')),
    'a senha antiga deixou de valer',
  );

  // ── O código usado não serve duas vezes ─────────────────────────────────
  titulo('Código usado não serve de novo');

  conferir(
    (await conferirCodigo(codigoParaUsar)) === 'invalido',
    'o código já usado foi invalidado',
  );
  conferir(
    (await conferirCodigo(resultado.codigoNovo ?? '')) === 'valido_guardado',
    'o código novo é o que passa a valer',
  );

  const semCodigo = await recuperarSenha(codigoParaUsar, 'OutraSenha!2026');
  conferir(!semCodigo.trocada, 'tentar de novo com o código velho não troca a senha');

  // ── garantirCodigo não atropela o que já existe ─────────────────────────
  titulo('Não atropela um código já anotado');

  const jaExistente = resultado.codigoNovo ?? '';
  const deveSerNulo = await garantirCodigo();
  conferir(deveSerNulo === null, 'com código existente, não gera outro');
  conferir(
    (await conferirCodigo(jaExistente)) === 'valido_guardado',
    'o código anotado continua valendo',
  );

  // ── Devolve o banco ao estado anterior ──────────────────────────────────
  titulo('Restaurando o estado do banco');

  await prisma.user.update({
    where: { id: usuarioOriginal.id },
    data: { password: senhaOriginalHash },
  });

  if (codigoOriginal) {
    await prisma.configuracao.update({
      where: { chave: CHAVE_CODIGO },
      data: { valor: codigoOriginal.valor },
    });
  } else {
    await prisma.configuracao.delete({ where: { chave: CHAVE_CODIGO } }).catch(() => undefined);
  }

  const restaurado = await prisma.user.findUnique({ where: { id: usuarioOriginal.id } });
  conferir(restaurado?.password === senhaOriginalHash, 'senha original devolvida');

  console.log();
  console.log('══════════════════════════════════════════════════════════════');
  if (falhas === 0) {
    console.log(`  ${VERDE}Recuperação de senha em ordem.${FIM}`);
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
