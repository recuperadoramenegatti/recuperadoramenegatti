/**
 * As credenciais iniciais, lidas da MESMA fonte que o sistema usa.
 *
 * Existem scripts em .mjs (instalador, verificações com navegador) que
 * precisam saber usuário e senha de fábrica. Repetir os valores neles foi o
 * que produziu instruções mentirosas: a senha mudou em src/lib/constants.ts e
 * o instalador continuou anunciando a antiga, mandando o dono da empresa
 * digitar algo que nunca ia funcionar.
 *
 * Como .mjs não importa .ts, lemos o arquivo e extraímos o bloco. É feio, mas
 * é uma fonte só — e falha alto se o formato mudar, em vez de devolver um
 * valor errado em silêncio.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FONTE = path.join(AQUI, '..', 'src', 'lib', 'constants.ts');

function extrair(bloco, campo) {
  const achado = bloco.match(new RegExp(`${campo}:\\s*'([^']*)'`));
  if (!achado) {
    throw new Error(
      `Não achei "${campo}" em CREDENCIAL_INICIAL (${FONTE}). ` +
        'Se o formato mudou, ajuste scripts/credencial-inicial.mjs.',
    );
  }
  return achado[1];
}

const codigo = fs.readFileSync(FONTE, 'utf8');
const bloco = codigo.match(/export const CREDENCIAL_INICIAL = \{([\s\S]*?)\}/);
if (!bloco) {
  throw new Error(`Não achei CREDENCIAL_INICIAL em ${FONTE}.`);
}

export const CREDENCIAL_INICIAL = {
  email: extrair(bloco[1], 'email'),
  senha: extrair(bloco[1], 'senha'),
  nome: extrair(bloco[1], 'nome'),
};
