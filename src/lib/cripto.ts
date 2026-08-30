/**
 * Cifra simétrica para segredos guardados no banco (hoje: a chave da API
 * da Anthropic).
 *
 * AES-256-GCM com chave derivada de NEXTAUTH_SECRET via scrypt. O GCM
 * autentica o texto cifrado, então uma adulteração no banco é detectada
 * na decifragem em vez de produzir lixo silencioso.
 *
 * Limite honesto do modelo: a chave de cifra deriva de uma variável de
 * ambiente que vive na mesma máquina que o banco. Isso protege contra o
 * vazamento do arquivo .db (backup, cópia, sincronização em nuvem), que é
 * o risco real aqui — não contra alguém com acesso total ao servidor.
 */

import crypto from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12;
const TAMANHO_SAL = 16;
const PREFIXO = 'enc:v1:';

function segredoBase(): string {
  const segredo = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!segredo) {
    throw new Error(
      'NEXTAUTH_SECRET não configurado — necessário para cifrar segredos. ' +
        'Defina-o no arquivo .env.',
    );
  }
  return segredo;
}

function derivarChave(sal: Buffer): Buffer {
  return crypto.scryptSync(segredoBase(), sal, 32);
}

/** Cifra um texto. Devolve `enc:v1:<sal>:<iv>:<tag>:<dados>` em base64. */
export function cifrar(texto: string): string {
  if (!texto) return '';
  const sal = crypto.randomBytes(TAMANHO_SAL);
  const iv = crypto.randomBytes(TAMANHO_IV);
  const cifra = crypto.createCipheriv(ALGORITMO, derivarChave(sal), iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();

  return [
    PREFIXO.slice(0, -1),
    sal.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    dados.toString('base64'),
  ].join(':');
}

/**
 * Decifra um valor produzido por `cifrar`.
 * Valores em texto puro (de instalações anteriores à cifragem) passam
 * intactos, para não quebrar bases existentes.
 */
export function decifrar(valor: string): string {
  if (!valor) return '';
  if (!valor.startsWith(PREFIXO)) return valor;

  try {
    const partes = valor.split(':');
    if (partes.length !== 6) return '';
    const [, , salB64, ivB64, tagB64, dadosB64] = partes;
    const sal = Buffer.from(salB64 ?? '', 'base64');
    const iv = Buffer.from(ivB64 ?? '', 'base64');
    const tag = Buffer.from(tagB64 ?? '', 'base64');
    const dados = Buffer.from(dadosB64 ?? '', 'base64');

    const decifra = crypto.createDecipheriv(ALGORITMO, derivarChave(sal), iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(dados), decifra.final()]).toString('utf8');
  } catch (erro) {
    console.error('[cripto] Falha ao decifrar segredo:', erro instanceof Error ? erro.message : erro);
    return '';
  }
}

export function estaCifrado(valor: string): boolean {
  return valor.startsWith(PREFIXO);
}

/** Mascara um segredo para exibição: `••••••••1a2b`. */
export function mascarar(valor: string): string {
  if (!valor) return '';
  return `••••••••${valor.slice(-4)}`;
}

/** Checksum SHA-256 em hexadecimal — usado pelo sistema de backup. */
export function checksum(dados: Buffer | string): string {
  return crypto.createHash('sha256').update(dados).digest('hex');
}
