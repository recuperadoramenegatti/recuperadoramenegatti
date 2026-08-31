/**
 * Desliga o sistema.
 *
 * O servidor roda oculto, sem janela — o que evita o dono fechar sem querer
 * a janela errada e derrubar tudo no meio de um orçamento. A contrapartida
 * é que precisa existir uma forma explícita de desligar, e é esta.
 *
 * Uso: node scripts/parar.mjs
 */
import { porta, servidorNoAr, pidDoServidor, esquecerPid } from './abrir.mjs';

const VERDE = '\x1b[32m';
const AMARELO = '\x1b[33m';
const CINZA = '\x1b[90m';
const FIM = '\x1b[0m';

/** Encerra o processo, primeiro com jeito, depois à força. */
async function encerrar(pid) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (erro) {
    // ESRCH = o processo já não existe. Qualquer outro erro importa.
    if (erro?.code === 'ESRCH') return true;
    throw erro;
  }

  // Dá até 10 segundos para o servidor fechar sozinho.
  for (let i = 0; i < 20; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(pid, 0); // sinal 0: só pergunta se ainda está vivo
    } catch {
      return true;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const p = porta();

  if (!(await servidorNoAr(p))) {
    console.log(`  ${AMARELO}!${FIM} O sistema já estava desligado.`);
    esquecerPid();
    return 0;
  }

  const pid = pidDoServidor();
  if (!pid) {
    console.log(`  ${AMARELO}!${FIM} O sistema está no ar, mas não foi este atalho que o ligou.`);
    console.log(`    ${CINZA}Feche pelo Gerenciador de Tarefas (processo "node") se precisar.${FIM}`);
    return 1;
  }

  console.log('  Desligando o sistema...');
  const encerrou = await encerrar(pid);
  esquecerPid();

  if (encerrou) {
    console.log(`  ${VERDE}✓${FIM} Sistema desligado.`);
    return 0;
  }

  console.log(`  ${AMARELO}!${FIM} Não foi possível encerrar o processo ${pid}.`);
  return 1;
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((erro) => {
    console.error(`  Erro ao desligar: ${erro?.message ?? erro}`);
    process.exit(1);
  });
