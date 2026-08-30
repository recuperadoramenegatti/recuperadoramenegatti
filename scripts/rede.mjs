/**
 * Mostra em quais endereços o sistema pode ser aberto.
 *
 * A Menegatti tem o escritório e o chão de fábrica. Se o sistema roda num
 * computador e alguém precisa consultá-lo de outro, a pergunta prática é
 * "o que eu digito no navegador?" — e a resposta não é `localhost`.
 *
 * Uso: node scripts/rede.mjs [porta] [--instalado]
 *
 * Sem `--instalado`, o texto assume que o servidor está subindo agora.
 * Com ele, apenas informa onde o sistema poderá ser aberto — porque ao fim
 * da instalação nada está no ar ainda, e anunciar "em execução" ali seria
 * mentira.
 */
import os from 'node:os';

const argumentos = process.argv.slice(2);
const apenasInstalado = argumentos.includes('--instalado');
const porta = argumentos.find((a) => !a.startsWith('--')) ?? process.env.PORT ?? '3000';

const AMARELO = '\x1b[33m';
const CIANO = '\x1b[36m';
const CINZA = '\x1b[90m';
const NEGRITO = '\x1b[1m';
const FIM = '\x1b[0m';

/** Endereços IPv4 das placas de rede reais, ignorando loopback e virtuais. */
function enderecosDaRede() {
  const encontrados = [];
  for (const [nome, enderecos] of Object.entries(os.networkInterfaces())) {
    for (const endereco of enderecos ?? []) {
      if (endereco.family !== 'IPv4' || endereco.internal) continue;
      // Placas virtuais (Docker, WSL, VPN) não servem para a rede da oficina.
      if (/^(docker|veth|br-|virbr|vEthernet|VMware|VirtualBox)/i.test(nome)) continue;
      encontrados.push({ nome, endereco: endereco.address });
    }
  }
  return encontrados;
}

console.log('');
console.log(
  `  ${NEGRITO}${apenasInstalado ? 'Onde abrir o sistema' : 'Sistema Menegatti em execução'}${FIM}`,
);
console.log('');
console.log(`  Neste computador:      ${CIANO}${NEGRITO}http://localhost:${porta}${FIM}`);

const rede = enderecosDaRede();
if (rede.length > 0) {
  console.log('');
  console.log(`  De outro computador da oficina:`);
  for (const { nome, endereco } of rede) {
    console.log(`    ${CIANO}http://${endereco}:${porta}${FIM}  ${CINZA}(${nome})${FIM}`);
  }
} else {
  console.log('');
  console.log(`  ${AMARELO}Sem rede local detectada${FIM} — acessível apenas neste computador.`);
}

console.log('');
console.log(`  ${CINZA}Usuário: admin${FIM}`);
if (!apenasInstalado) {
  console.log(`  ${CINZA}Para encerrar, feche esta janela.${FIM}`);
}
console.log('');
