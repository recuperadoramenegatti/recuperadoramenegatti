/**
 * Verificação do motor de cálculo contra os números calibrados
 * do diagnóstico financeiro da Recuperadora Menegatti.
 */
import { PARAMETROS_DEFAULT } from '@/lib/constants';
import {
  calcularCFR,
  calcularCustoOS,
  calcularDerivados,
  calcularPrecoSugerido,
  calcularTHH,
  calcularTotalHorasProdutivas,
  calcularComparativoPecaNova,
  precificarOS,
  calcularBreakEven,
  calcularNCG,
} from '@/lib/precificacao';
import type { ContextoCalculo } from '@/types';

let falhas = 0;
let passou = 0;

function verificar(rotulo: string, obtido: number, esperado: number, tolerancia = 0.01): void {
  const ok = Math.abs(obtido - esperado) <= tolerancia;
  if (ok) passou += 1;
  else falhas += 1;
  const marca = ok ? '  ✓' : '  ✗';
  console.log(
    `${marca} ${rotulo.padEnd(52, '.')} ${obtido.toFixed(2).padStart(12)}  (esperado ${esperado.toFixed(2)})`,
  );
}

function secao(titulo: string): void {
  console.log(`\n── ${titulo} ${'─'.repeat(Math.max(0, 62 - titulo.length))}`);
}

const p = PARAMETROS_DEFAULT;
const d = calcularDerivados(p);

secao('Taxas base');
verificar('Folha com encargos (R$/mês)', d.folhaComEncargos, 317900);
verificar('Horas disponíveis por operador', d.horasDisponiveisPorOperador, 184.8);
verificar('Horas produtivas por operador', d.horasProdutivasPorOperador, 147.84, 0.05);
verificar('Total de horas produtivas (h/mês)', calcularTotalHorasProdutivas(p), 2069.76, 0.5);
verificar('THH (R$/h)', calcularTHH(p), 153.59, 0.01);
verificar('Overhead indireto (R$/mês)', d.overheadIndiretoMensal, 50600);
verificar('CFR (R$/h)', calcularCFR(p), 24.45, 0.01);
verificar('Custo hora de setup (THH + CFR)', d.custoHoraSetup, 178.04, 0.01);

secao('Custo por hora de cada centro');
const centros: Array<[string, number, number]> = [
  ['Torno', 18.5, 196.54],
  ['Fresa', 22.0, 200.04],
  ['Solda', 12.0, 190.04],
  ['Montagem/Acabamento', 6.0, 184.04],
  ['Radial', 15.0, 193.04],
];
for (const [nome, thm, esperado] of centros) {
  verificar(`${nome} (THH + THM + CFR)`, d.thh + thm + d.cfr, esperado, 0.01);
}

// Contexto sintético para as OS de teste
const ctx: ContextoCalculo = {
  parametros: p,
  derivados: d,
  centros: centros.map(([nome, thm], i) => ({
    id: `centro-${i}`,
    nome,
    slug: nome.toLowerCase(),
    qtdMaquinas: 2,
    qtdOperadores: 2,
    thm,
    thh: d.thh,
    cfr: d.cfr,
    custoHora: d.thh + thm + d.cfr,
    ordem: i,
  })),
};

secao('OS simples: 2h de torno, sem setup nem insumos');
const os1 = calcularCustoOS(
  {
    tipo: 'fabricacao',
    horasSetup: 0,
    tempos: [{ centroId: 'centro-0', horas: 2 }],
    custoMateriais: 0,
    markupMateriais: 0,
    custoConsumiveis: 0,
    custoFerramentas: 0,
    insumosExtras: [],
    margemDesejada: 30,
  },
  ctx,
);
verificar('Custo total (2 × 196,54)', os1.custoTotal, 393.08, 0.02);
verificar('Mão de obra (2 × 153,59)', os1.custoMaoDeObra, 307.18, 0.02);
verificar('Máquina (2 × 18,50)', os1.custoMaquina, 37.0, 0.02);
verificar('Overhead (2 × 24,45)', os1.custoOverhead, 48.9, 0.02);
verificar('Soma das partes = total', os1.custoMaoDeObra + os1.custoMaquina + os1.custoOverhead, os1.custoTotal, 0.02);

secao('CFR cobrado uma única vez por hora');
const os2 = calcularCustoOS(
  {
    tipo: 'fabricacao',
    horasSetup: 1,
    tempos: [{ centroId: 'centro-0', horas: 2 }],
    custoMateriais: 0,
    markupMateriais: 0,
    custoConsumiveis: 0,
    custoFerramentas: 0,
    insumosExtras: [],
    margemDesejada: 30,
  },
  ctx,
);
verificar('Overhead de 3h (2 produção + 1 setup)', os2.custoOverhead, 3 * d.cfr, 0.02);
verificar('Custo do setup (1h × 178,04)', os2.custoSetup, d.custoHoraSetup, 0.02);
verificar('Custo total (393,08 + 178,04)', os2.custoTotal, 393.08 + 178.04, 0.03);

secao('Insumos com markup');
const os3 = calcularCustoOS(
  {
    tipo: 'fabricacao',
    horasSetup: 0,
    tempos: [{ centroId: 'centro-0', horas: 1 }],
    custoMateriais: 1000,
    markupMateriais: 20,
    custoConsumiveis: 50,
    custoFerramentas: 30,
    insumosExtras: [{ nome: 'Frete', valor: 120 }],
    margemDesejada: 30,
  },
  ctx,
);
verificar('Markup sobre materiais (20% de 1000)', os3.valorMarkupMateriais, 200);
verificar('Insumos totais (1000+200+50+30+120)', os3.custoInsumosTotal, 1400);
verificar('Custo total (196,54 + 1400)', os3.custoTotal, 1596.54, 0.02);

secao('Fórmula mestre de precificação');
const custoTeste = { ...os1, custoTotal: 1000 };
const preco = calcularPrecoSugerido(custoTeste, 30, 14.5, p);
verificar('Preço mínimo = 1000 ÷ (1 − 0,30)', preco.precoMinimo, 1428.57, 0.01);
verificar('Preço cliente = 1428,57 ÷ (1 − 0,145)', preco.precoSugerido, 1670.84, 0.02);
verificar('Impostos (14,5% de 1670,84)', preco.valorImpostos, 242.27, 0.02);
verificar('Lucro (preço − custo − impostos)', preco.lucroEstimado, 428.57, 0.03);
verificar('Margem bruta = (P − C) ÷ P', preco.margemReal, 40.15, 0.02);
verificar('Margem de contribuição = margem desejada', preco.margemContribuicao, 30.0, 0.02);

secao('Semáforo de margem');
const classificacoes: Array<[number, string]> = [
  [8, 'critica'],
  [14.9, 'critica'],
  [15, 'baixa'],
  [22, 'baixa'],
  [23, 'boa'],
  [29.9, 'boa'],
  [30, 'excelente'],
  [45, 'excelente'],
];
for (const [margem, esperado] of classificacoes) {
  const obtido = calcularPrecoSugerido({ ...os1, custoTotal: 1000 }, margem, 14.5, p).classificacao;
  const ok = obtido === esperado;
  if (ok) passou += 1;
  else falhas += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} margem ${String(margem).padStart(5)}% → ${obtido.padEnd(12)} (esperado ${esperado})`);
}

secao('Comparativo com peça nova');
const casos: Array<[number, number, string]> = [
  [1000, 3000, 'adequado'],  // 33% da peça nova, economia de 67%
  [2400, 3000, 'proximo'],   // 80% da peça nova — acima do limiar de 75%
  [3100, 3000, 'inviavel'],  // custa mais que a peça nova
  [2000, 3000, 'proximo'],   // 67% da nova, economia de 33% < alvo de 40%
];
for (const [precoRec, precoNova, esperado] of casos) {
  const c = calcularComparativoPecaNova(precoRec, precoNova, 40, p);
  const ok = c?.status === esperado;
  if (ok) passou += 1;
  else falhas += 1;
  console.log(
    `${ok ? '  ✓' : '  ✗'} R$ ${String(precoRec).padStart(5)} vs R$ ${precoNova} → ` +
      `${(c?.status ?? 'nulo').padEnd(12)} (esperado ${esperado})`,
  );
}
const semReferencia = calcularComparativoPecaNova(1000, null, 40, p);
const okNulo = semReferencia === null;
if (okNulo) passou += 1;
else falhas += 1;
console.log(`${okNulo ? '  ✓' : '  ✗'} sem preço de peça nova → null`);

secao('Precificação ponta a ponta (recuperação)');
const completo = precificarOS(
  {
    tipo: 'recuperacao',
    horasSetup: 0.5,
    tempos: [
      { centroId: 'centro-0', horas: 3 },
      { centroId: 'centro-2', horas: 2 },
    ],
    custoMateriais: 400,
    markupMateriais: 20,
    custoConsumiveis: 80,
    custoFerramentas: 40,
    insumosExtras: [],
    margemDesejada: 30,
    precoPecaNova: 5000,
    descontoTolerado: 40,
  },
  ctx,
);
const custoEsperado = 3 * 196.54 + 2 * 190.04 + 0.5 * 178.04 + 400 + 80 + 80 + 40;
verificar('Custo total da OS', completo.custo.custoTotal, custoEsperado, 0.05);
verificar('Total de horas (3 + 2 + 0,5)', completo.custo.horasTotais, 5.5);
verificar('Margem de contribuição = desejada', completo.margemContribuicao, 30, 0.05);
const okComparativo = completo.comparativoPecaNova !== null;
if (okComparativo) passou += 1;
else falhas += 1;
console.log(`${okComparativo ? '  ✓' : '  ✗'} comparativo com peça nova presente na recuperação`);

const fabricacao = precificarOS(
  {
    tipo: 'fabricacao',
    horasSetup: 0.5,
    tempos: [{ centroId: 'centro-0', horas: 3 }],
    custoMateriais: 0,
    markupMateriais: 20,
    custoConsumiveis: 0,
    custoFerramentas: 0,
    insumosExtras: [],
    margemDesejada: 30,
    precoPecaNova: 5000,
  },
  ctx,
);
const okSemComparativo = fabricacao.comparativoPecaNova === null;
if (okSemComparativo) passou += 1;
else falhas += 1;
console.log(`${okSemComparativo ? '  ✓' : '  ✗'} fabricação não gera comparativo (mesmo com preço informado)`);

secao('Ponto de equilíbrio (EBITDA = 0)');
// A mão de obra é custo fixo neste modelo — já está dentro dos custos fixos,
// então o denominador só desconta os insumos. Com 15% de insumos sobre a
// receita líquida, sobram 85%.
const custosFixosEsperados = 317900 + 50600;
const be = calcularBreakEven(p, 85, 380000);
verificar('Custos fixos mensais (folha + overhead)', be.custosFixosMensais, custosFixosEsperados);
const peLiquido = custosFixosEsperados / 0.85;
const peBruto = peLiquido / (1 - 0.145);
verificar('PE em receita líquida (368.500 ÷ 0,85)', peLiquido, 433529.41, 1);
verificar('PE em faturamento bruto (÷ 0,855)', be.pontoEquilibrioReceita, peBruto, 1);
verificar('Índice de cobertura (380k ÷ PE)', be.indiceCobertura, 380000 / peBruto, 0.01);

// Sem insumos, o PE é o piso: apenas os custos fixos, brutos de imposto.
const bePiso = calcularBreakEven(p, 0, 380000);
verificar(
  'PE sem insumos = custos fixos ÷ 0,855',
  bePiso.pontoEquilibrioReceita,
  custosFixosEsperados / 0.855,
  1,
);

// A folha não pode ser contada duas vezes: com margem de contribuição de 30%
// (que já é líquida de mão de obra) o PE dispararia para mais de R$ 1,4 mi.
const okSemDuplaContagem = be.pontoEquilibrioReceita < 700000;
if (okSemDuplaContagem) passou += 1;
else falhas += 1;
console.log(
  `${okSemDuplaContagem ? '  ✓' : '  ✗'} folha não é contada duas vezes ` +
    `(PE de ${be.pontoEquilibrioReceita.toFixed(0)}, não ~1.4 mi)`,
);

const ncg = calcularNCG(45, 30, 380000 / 30);
verificar('NCG = (45 − 30) × faturamento diário', ncg.ncg, 15 * (380000 / 30), 1);
verificar('Ciclo financeiro', ncg.cicloFinanceiro, 15);

secao('Robustez com entradas degeneradas');
const zerado = precificarOS(
  {
    tipo: 'fabricacao',
    horasSetup: 0,
    tempos: [],
    custoMateriais: 0,
    markupMateriais: 0,
    custoConsumiveis: 0,
    custoFerramentas: 0,
    insumosExtras: [],
    margemDesejada: 30,
  },
  ctx,
);
const finito =
  Number.isFinite(zerado.precoFinal) &&
  Number.isFinite(zerado.margemContribuicao) &&
  Number.isFinite(zerado.horasEquilibrio);
if (finito) passou += 1;
else falhas += 1;
console.log(`${finito ? '  ✓' : '  ✗'} OS totalmente zerada não produz NaN nem Infinity`);

const centroInexistente = calcularCustoOS(
  {
    tipo: 'fabricacao',
    horasSetup: 0,
    tempos: [{ centroId: 'nao-existe', horas: 5 }],
    custoMateriais: 0,
    markupMateriais: 0,
    custoConsumiveis: 0,
    custoFerramentas: 0,
    insumosExtras: [],
    margemDesejada: 30,
  },
  ctx,
);
const ignorou = centroInexistente.custoTotal === 0 && centroInexistente.horasProducao === 0;
if (ignorou) passou += 1;
else falhas += 1;
console.log(`${ignorou ? '  ✓' : '  ✗'} centro inexistente é ignorado em vez de quebrar`);

console.log(`\n${'═'.repeat(70)}`);
console.log(`  ${passou} verificações passaram, ${falhas} falharam.`);
console.log(`${'═'.repeat(70)}\n`);
process.exit(falhas > 0 ? 1 : 0);
