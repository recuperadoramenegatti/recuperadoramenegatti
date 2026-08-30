/**
 * Teste de ponta a ponta contra o banco real: cria um cliente e uma OS pela
 * mesma camada de serviço que a interface usa, confere o que foi gravado e
 * apaga tudo no fim. Rode com: npx tsx scripts/smoke-os.ts
 */
import { prisma } from '@/lib/prisma';
import { criarOS, mudarStatusOS, registrarHorasRealizadas, duplicarOS } from '@/lib/ordens';
import { schemaOrdemServico } from '@/lib/validacoes';
import { getContextoCalculo, margemContribuicaoOS, precoPraticado } from '@/lib/calculos';
import { calcularDRE } from '@/lib/dre';
import { calcularAlertas } from '@/lib/alertas';
import { formatarMoeda, formatarPercentual, periodoAtual } from '@/lib/formatacao';

let falhas = 0;
function checar(rotulo: string, condicao: boolean, detalhe = ''): void {
  if (!condicao) falhas += 1;
  console.log(`  ${condicao ? '✓' : '✗'} ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main(): Promise<void> {
  const ctx = await getContextoCalculo();
  const torno = ctx.centros.find((c) => c.slug === 'torno');
  const solda = ctx.centros.find((c) => c.slug === 'solda');
  if (!torno || !solda) throw new Error('Centros de custo do seed não encontrados.');

  console.log('\n── Criando cliente e OS de teste ──────────────────────────');

  const cliente = await prisma.cliente.create({
    data: { codigo: `TESTE-${Date.now()}`, nome: 'Cliente de Teste (apagar)', cidade: 'Teste' },
  });

  const dados = schemaOrdemServico.parse({
    clienteId: cliente.id,
    tipo: 'recuperacao',
    descricao: 'Recuperação de eixo — teste automatizado',
    tempos: [
      { centroId: torno.id, horas: 3 },
      { centroId: solda.id, horas: 2 },
    ],
    horasSetup: 0.5,
    custoMateriais: 400,
    markupMateriais: 20,
    custoConsumiveis: 80,
    custoFerramentas: 40,
    insumosExtras: [{ nome: 'Frete', valor: 60 }],
    margemDesejada: 30,
    precoPecaNova: 5000,
    descontoTolerado: 40,
  });

  const { id, numero, resultado } = await criarOS(dados, 'teste@menegatti');
  console.log(`  OS ${numero} criada.`);

  const custoEsperado =
    3 * torno.custoHora + 2 * solda.custoHora + 0.5 * ctx.derivados.custoHoraSetup + 480 + 80 + 40 + 60;

  console.log('\n── Conferindo o que foi gravado ───────────────────────────');
  const gravada = await prisma.ordemServico.findUniqueOrThrow({
    where: { id },
    include: { itens: true },
  });

  checar(
    'custo gravado bate com o calculado',
    Math.abs(gravada.custoTotalCalc - custoEsperado) < 0.05,
    `${formatarMoeda(gravada.custoTotalCalc)} vs ${formatarMoeda(custoEsperado)}`,
  );
  checar(
    'preço sugerido gravado bate com o retornado',
    Math.abs(gravada.precoSugerido - resultado.precoSugerido) < 0.01,
    formatarMoeda(gravada.precoSugerido),
  );
  checar(
    'margem gravada é a de contribuição (30%)',
    Math.abs((gravada.margemReal ?? 0) - 30) < 0.05,
    formatarPercentual(gravada.margemReal ?? 0),
  );
  checar('horas estimadas somam 5,5h', Math.abs(gravada.horasEstimadas - 5.5) < 0.01);
  checar('dois itens de centro gravados', gravada.itens.length === 2);
  checar(
    'snapshot das taxas gravado em cada item',
    gravada.itens.every((i) => i.thhUsado > 0 && i.cfrUsado > 0),
    `THH ${formatarMoeda(gravada.itens[0]?.thhUsado ?? 0)}`,
  );
  checar(
    'margem recalculada da OS gravada = 30%',
    Math.abs(margemContribuicaoOS({ ...gravada, descricao: gravada.descricao }, ctx.parametros.aliquotaImpostos) - 30) < 0.05,
  );

  console.log('\n── Fluxo de status ────────────────────────────────────────');
  await mudarStatusOS(id, 'finalizado', 'teste@menegatti');
  const finalizada = await prisma.ordemServico.findUniqueOrThrow({ where: { id } });
  checar('status finalizado carimba dataFinalizacao', finalizada.dataFinalizacao !== null);

  await mudarStatusOS(id, 'pago', 'teste@menegatti');
  const paga = await prisma.ordemServico.findUniqueOrThrow({ where: { id } });
  checar(
    'pular para pago preenche faturamento e recebimento',
    paga.dataFaturamento !== null && paga.dataRecebimento !== null,
  );

  console.log('\n── Horas realizadas ───────────────────────────────────────');
  const { horasRealizadas, desvioPct } = await registrarHorasRealizadas(
    id,
    [
      { centroId: torno.id, horasRealizadas: 4 },
      { centroId: solda.id, horasRealizadas: 2 },
    ],
    0.5,
    null,
    'teste@menegatti',
  );
  checar('total realizado = 6,5h', Math.abs(horasRealizadas - 6.5) < 0.01);
  checar(
    'desvio de +18,2% detectado',
    Math.abs(desvioPct - 18.2) < 0.2,
    formatarPercentual(desvioPct),
  );

  console.log('\n── DRE reconhece a receita ────────────────────────────────');
  const dre = await calcularDRE(periodoAtual());
  const preco = precoPraticado(paga);
  checar(
    'receita bruta inclui a OS',
    dre.receitaBruta >= preco - 0.01,
    formatarMoeda(dre.receitaBruta),
  );
  checar(
    'deduções batem com a alíquota',
    Math.abs(dre.deducoes - dre.receitaBruta * (ctx.parametros.aliquotaImpostos / 100)) < 1,
    formatarMoeda(dre.deducoes),
  );
  checar(
    'linhas do DRE somam até o lucro líquido',
    Math.abs(dre.ebitda - dre.depreciacao - dre.ebit) < 0.02,
  );

  console.log('\n── Duplicação e alertas ───────────────────────────────────');
  const copia = await duplicarOS(id, 'teste@menegatti');
  const duplicada = await prisma.ordemServico.findUniqueOrThrow({
    where: { id: copia.id },
    include: { itens: true },
  });
  checar('cópia nasce como orçamento', duplicada.status === 'orcado');
  checar('cópia recebe número próprio', duplicada.numero !== numero, duplicada.numero);
  checar('cópia preserva os itens', duplicada.itens.length === 2);

  const alertas = await calcularAlertas(periodoAtual(), ctx);
  checar('motor de alertas roda sem erro', Array.isArray(alertas), `${alertas.length} alerta(s)`);
  checar(
    'alerta de desvio orçado × realizado disparou',
    alertas.some((a) => a.regra === 'desvio_orcado_realizado'),
  );
  checar(
    'alerta de provisão de manutenção disparou (provisão em R$ 0)',
    alertas.some((a) => a.regra === 'sem_provisao_manutencao'),
  );

  console.log('\n── Limpando ───────────────────────────────────────────────');
  await prisma.ordemServico.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  const sobrou = await prisma.ordemServico.count({ where: { clienteId: cliente.id } });
  checar('dados de teste removidos', sobrou === 0);

  console.log(`\n${'═'.repeat(62)}`);
  console.log(falhas === 0 ? '  Tudo certo.' : `  ${falhas} verificação(ões) falharam.`);
  console.log(`${'═'.repeat(62)}\n`);
  process.exit(falhas > 0 ? 1 : 0);
}

main()
  .catch((erro: unknown) => {
    console.error('\n✗ Falha no teste:', erro);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
