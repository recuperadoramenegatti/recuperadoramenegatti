/**
 * Confere que nenhum rótulo de eixo é cortado.
 *
 * Existe por causa de um defeito real: a faixa do eixo Y era estreita demais
 * e cortava o primeiro caractere do rótulo — que, em valores negativos, é o
 * sinal de menos. Um déficit de R$ 395,9 mil aparecia como superávit.
 *
 * Uso: node scripts/verificar-eixos.mjs [urlBase]
 */
import { chromium } from 'playwright';
import { CREDENCIAL_INICIAL } from './credencial-inicial.mjs';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const ROTAS = [
  ['/dashboard', 'Faturamento × meta'],
  ['/financeiro/dre', 'Da receita ao lucro'],
  ['/financeiro/fluxo-caixa', 'Saldo de caixa dia a dia'],
  ['/indicadores', 'Evolução de 12 meses'],
];

let falhas = 0;

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();

await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await p.fill('#email', CREDENCIAL_INICIAL.email);
await p.fill('#password', CREDENCIAL_INICIAL.senha);
await p.click('button[type="submit"]');
await p.waitForURL('**/dashboard', { timeout: 30000 });

for (const [rota, titulo] of ROTAS) {
  await p.goto(`${BASE}${rota}`, { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(1800);

  const problemas = await p.evaluate(() => {
    const saida = [];
    for (const svg of document.querySelectorAll('.recharts-wrapper svg')) {
      const limiteEsquerdo = svg.getBoundingClientRect().left;
      for (const texto of svg.querySelectorAll(
        '.recharts-yAxis .recharts-cartesian-axis-tick-value',
      )) {
        const caixa = texto.getBoundingClientRect();
        // Uma folga de 1px absorve o arredondamento do layout.
        if (caixa.left < limiteEsquerdo - 1) {
          saida.push({
            rotulo: texto.textContent ?? '',
            transbordo: Math.round(limiteEsquerdo - caixa.left),
          });
        }
      }
    }
    return saida;
  });

  if (problemas.length === 0) {
    console.log(`  ✓ ${titulo.padEnd(28)} nenhum rótulo cortado`);
  } else {
    falhas += problemas.length;
    console.log(`  ✗ ${titulo.padEnd(28)} ${problemas.length} rótulo(s) cortado(s):`);
    for (const x of problemas) console.log(`      "${x.rotulo}" transborda ${x.transbordo}px`);
  }
}

await nav.close();
console.log(`\n${falhas === 0 ? '  Eixos íntegros.' : `  ${falhas} rótulo(s) cortado(s).`}\n`);
process.exit(falhas > 0 ? 1 : 0);
