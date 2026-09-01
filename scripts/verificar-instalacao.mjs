/**
 * Verifica uma instalação recém-feita, do ponto de vista de quem instalou.
 *
 * Não testa componentes isolados: abre o sistema no navegador, faz login com
 * a senha inicial, confere que os parâmetros calibrados vieram carregados,
 * orça um serviço, gera um backup e checa o acesso pela rede local.
 *
 * Uso: node scripts/verificar-instalacao.mjs [urlBase]
 */
import { chromium } from 'playwright';
import { CREDENCIAL_INICIAL } from './credencial-inicial.mjs';
const BASE = process.argv[2] ?? 'http://localhost:3000';
let falhas = 0;
const checar = (r, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✓' : '✗'} ${r}${d ? ` — ${d}` : ''}`); };

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));

console.log('\n── Primeiro acesso, como o dono faria ──');
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
checar('a raiz leva ao login', p.url().includes('/login'), p.url().replace(BASE, ''));

await p.fill('#email', CREDENCIAL_INICIAL.email);
await p.fill('#password', CREDENCIAL_INICIAL.senha);
await p.click('button[type="submit"]');
await p.waitForURL('**/dashboard', { timeout: 30000 });
checar('login com a senha inicial funciona', true);

console.log('\n── O sistema está utilizável de fábrica? ──');
const texto = (await p.evaluate(() => document.body.innerText)).replace(/\u00a0/g, ' ');
checar('dashboard carrega sem NaN', !/NaN|Infinity/.test(texto));
checar('alerta de provisão de manutenção aparece', texto.includes('manutenção'));

await p.goto(`${BASE}/orcamento`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
// Intl usa espaço não separável (U+00A0) entre "R$" e o número; sem
// normalizar, qualquer comparação com espaço comum falha por engano.
const orc = (await p.evaluate(() => document.body.innerText)).replace(/\u00a0/g, ' ');
checar('as taxas calibradas já vêm carregadas', orc.includes('R$ 196,54') && orc.includes('R$ 153,59'),
  'Torno R$ 196,54/h, THH R$ 153,59/h');
checar('os cinco centros de custo existem',
  ['Torno','Fresa','Solda','Montagem','Radial'].every((c) => orc.includes(c)));

// Orçar de verdade
const campo = p.locator('input[id^="centro-"]').first();
await campo.fill('4');
await p.waitForTimeout(900);
const preco = await p.locator('.gradient-text-sucesso, .gradient-text-hero, .gradient-text-alerta').first().textContent();
checar('o preço calcula ao digitar horas', /R\$\s*[\d.,]+/.test(preco ?? ''), preco?.trim());

console.log('\n── Backup numa instalação nova ──');
const r = await ctx.request.get(`${BASE}/api/backup/exportar`);
const b = await r.body();
checar('backup gera ZIP válido', r.status() === 200 && b.subarray(0, 2).toString() === 'PK',
  `${(b.length / 1024).toFixed(1)} KB`);

console.log('\n── Acesso pela rede da oficina ──');
const os = await import('node:os');
const ipLocal = Object.values(os.networkInterfaces())
  .flat()
  .find((e) => e && e.family === 'IPv4' && !e.internal)?.address;

if (ipLocal) {
  const porta = new URL(BASE).port || '3000';
  const rede = await ctx.request.get(`http://${ipLocal}:${porta}/login`);
  checar('responde no IP da rede local', rede.status() === 200, `${ipLocal} → HTTP ${rede.status()}`);
} else {
  console.log('  · sem rede local neste ambiente, verificação pulada');
}

checar('nenhum erro de página', erros.length === 0, erros.join(' | '));
await nav.close();
console.log(`\n${falhas === 0 ? '  Instalação limpa funcionando.' : `  ${falhas} falha(s).`}\n`);
process.exit(falhas > 0 ? 1 : 0);
