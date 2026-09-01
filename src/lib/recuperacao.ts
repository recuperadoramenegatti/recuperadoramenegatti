/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RECUPERAÇÃO DE SENHA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O sistema tem um usuário só e nenhum servidor de e-mail. O caminho clássico
 * de "enviamos um link para o seu e-mail" exigiria configurar um serviço de
 * envio — mais uma coisa para dar errado, e mais uma conta para o dono da
 * oficina administrar. Então a recuperação aqui é por CÓDIGO.
 *
 * São duas formas de recuperar, e a segunda existe porque a primeira depende
 * de o dono ter guardado um papel:
 *
 *   1. CÓDIGO GUARDADO — gerado no primeiro acesso, visível em
 *      Configurações → Segurança, para imprimir ou anotar. Fica no banco
 *      apenas como hash: quem abrir o banco não descobre o código.
 *
 *   2. CÓDIGO MESTRE — a variável de ambiente CODIGO_RECUPERACAO. Quem
 *      controla a hospedagem (o painel da Vercel, ou o arquivo .env na
 *      máquina da empresa) sempre consegue entrar, mesmo tendo perdido o
 *      papel. Sem isso, esquecer a senha significaria perder o sistema.
 *
 * Em ambos os casos, usar o código NÃO revela a senha antiga — ele autoriza
 * definir uma nova. E o código guardado é trocado a cada uso, para que um
 * papel achado na gaveta não sirva duas vezes.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { marcarSenhaComoDoDono } from '@/lib/senha-definida';

/** Chave do código de recuperação na tabela de configurações. */
export const CHAVE_CODIGO = 'codigoRecuperacaoHash';

/**
 * Alfabeto sem caracteres que se confundem à mão: nada de O/0, I/1, S/5.
 * O código existe para ser copiado de um papel, muitas vezes por quem está
 * com pressa e sem os óculos.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRTUVWXY2346789';
const GRUPOS = 4;
const TAMANHO_GRUPO = 4;

/** Gera um código no formato ABCD-EFGH-JKLM-NPQR. */
export function gerarCodigo(): string {
  const grupos: string[] = [];

  for (let g = 0; g < GRUPOS; g += 1) {
    let grupo = '';
    // randomInt é criptográfico — Math.random não serve para credencial.
    for (let c = 0; c < TAMANHO_GRUPO; c += 1) {
      grupo += ALFABETO[crypto.randomInt(0, ALFABETO.length)];
    }
    grupos.push(grupo);
  }

  return grupos.join('-');
}

/**
 * Normaliza o que a pessoa digitou.
 *
 * Aceita minúsculas, espaços no lugar dos hífens, hífens a mais ou a menos.
 * Quem copia de um papel não deve ser reprovado por causa de formatação.
 */
export function normalizarCodigo(bruto: string): string {
  return bruto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/** Compara dois códigos já normalizados, sem vazar tempo. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** O código mestre configurado no ambiente, se houver. */
export function codigoMestre(): string | null {
  const bruto = process.env.CODIGO_RECUPERACAO?.trim();
  if (!bruto) return null;

  const normalizado = normalizarCodigo(bruto);
  return normalizado.length >= 8 ? normalizado : null;
}

/**
 * Cria e guarda um código novo, devolvendo-o em texto claro.
 *
 * É a ÚNICA vez que o código existe legível: a partir daqui só o hash fica
 * guardado. Quem chamar precisa mostrá-lo a quem for anotar.
 */
export async function renovarCodigo(): Promise<string> {
  const codigo = gerarCodigo();
  const hash = await bcrypt.hash(normalizarCodigo(codigo), 12);

  await prisma.configuracao.upsert({
    where: { chave: CHAVE_CODIGO },
    update: { valor: hash },
    create: {
      chave: CHAVE_CODIGO,
      valor: hash,
      tipo: 'secret',
      grupo: 'empresa',
      descricao: 'Hash do código de recuperação de senha',
    },
  });

  return codigo;
}

/** Já existe um código guardado? */
export async function existeCodigo(): Promise<boolean> {
  const registro = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CODIGO } });
  return Boolean(registro?.valor);
}

/**
 * Garante que exista um código, sem trocar o que já estiver guardado.
 *
 * Devolve o código em texto apenas quando teve de criar um — trocar o código
 * de quem já anotou o dele seria transformar uma instalação que funcionava
 * num papel inútil na gaveta.
 */
export async function garantirCodigo(): Promise<string | null> {
  if (await existeCodigo()) return null;
  return renovarCodigo();
}

export type ResultadoConferencia = 'valido_mestre' | 'valido_guardado' | 'invalido';

/** O código informado autoriza a troca de senha? */
export async function conferirCodigo(informado: string): Promise<ResultadoConferencia> {
  const codigo = normalizarCodigo(informado);
  if (codigo.length === 0) return 'invalido';

  const mestre = codigoMestre();
  if (mestre && iguaisEmTempoConstante(codigo, mestre)) return 'valido_mestre';

  const registro = await prisma.configuracao.findUnique({ where: { chave: CHAVE_CODIGO } });
  if (!registro?.valor) return 'invalido';

  const confere = await bcrypt.compare(codigo, registro.valor);
  return confere ? 'valido_guardado' : 'invalido';
}

export interface ResultadoRecuperacao {
  trocada: boolean;
  /** Código novo, quando o usado foi o guardado (o mestre não é trocado). */
  codigoNovo: string | null;
}

/**
 * Troca a senha mediante código válido.
 *
 * O código guardado é renovado a cada uso; o mestre não, porque ele vive na
 * configuração da hospedagem e trocá-lo por baixo dos panos deixaria a
 * variável de ambiente mentindo.
 */
export async function recuperarSenha(
  codigoInformado: string,
  novaSenha: string,
): Promise<ResultadoRecuperacao> {
  const conferencia = await conferirCodigo(codigoInformado);
  if (conferencia === 'invalido') return { trocada: false, codigoNovo: null };

  const hash = await bcrypt.hash(novaSenha, 12);

  // Um usuário só neste sistema — mas atualizamos por papel de admin em vez
  // de assumir um e-mail fixo, para não quebrar se o cadastro mudar.
  const admin = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!admin) return { trocada: false, codigoNovo: null };

  await prisma.user.update({ where: { id: admin.id }, data: { password: hash } });

  // Recuperar a senha também é o dono escolhendo qual ela é.
  await marcarSenhaComoDoDono();

  await prisma.logAlteracao
    .create({
      data: {
        entidade: 'configuracao',
        entidadeId: admin.id,
        acao: 'atualizacao',
        descricao:
          conferencia === 'valido_mestre'
            ? 'Senha redefinida pelo código mestre do ambiente.'
            : 'Senha redefinida pelo código de recuperação.',
        usuario: admin.email,
      },
    })
    .catch(() => undefined); // registrar o log nunca pode impedir a recuperação

  const codigoNovo = conferencia === 'valido_guardado' ? await renovarCodigo() : null;
  return { trocada: true, codigoNovo };
}
