/**
 * Verifica as tarefas automáticas — sobretudo a regra do backup semanal.
 * Rode com: npm run smoke:tarefas
 *
 * Trabalha sobre uma cópia descartável do banco.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const bancoTeste = path.join(os.tmpdir(), `menegatti-tarefas-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${bancoTeste}`;
process.env.BACKUP_DIR = path.join(os.tmpdir(), `menegatti-bkp-tarefas-${Date.now()}`);

let falhas = 0;
function checar(rotulo: string, condicao: boolean, detalhe = ''): void {
  if (!condicao) falhas += 1;
  console.log(`  ${condicao ? '✓' : '✗'} ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main(): Promise<void> {
  const { execSync } = await import('node:child_process');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env },
    stdio: 'pipe',
  });

  const { prisma } = await import('@/lib/prisma');
  const { verificarBackupSemanal } = await import('@/lib/backup');
  const { verificarInsightAutomatico } = await import('@/lib/ia');
  const { PARAMETROS_DEFAULT, CENTROS_DEFAULT } = await import('@/lib/constants');

  for (const [chave, valor] of Object.entries(PARAMETROS_DEFAULT)) {
    await prisma.configuracao.create({
      data: { chave, valor: String(valor), tipo: 'number', grupo: 'financeiro' },
    });
  }
  for (const c of CENTROS_DEFAULT) {
    await prisma.centroCusto.create({
      data: {
        nome: c.nome, slug: c.slug, qtdMaquinas: c.qtdMaquinas,
        qtdOperadores: c.qtdOperadores, thmEstimado: c.thmEstimado, ordem: c.ordem,
      },
    });
  }

  console.log('\n── Backup semanal ─────────────────────────────────────────');

  /*
   * A regra antiga exigia que fosse domingo. A oficina trabalha de segunda a
   * sábado: ninguém abre o sistema no dia em que ela está fechada, então o
   * backup semanal nunca dispararia.
   *
   * Rodar o teste "no dia de hoje" não provaria nada — se caísse num domingo,
   * passaria mesmo com o defeito. E falsear o relógio do JavaScript também
   * não serve, porque o `createdAt` dos registros vem do relógio do banco.
   *
   * Então a prova é estrutural: a implementação não pode consultar o dia da
   * semana. O comportamento no tempo é verificado logo abaixo, controlando o
   * `createdAt` diretamente.
   */
  const fonte = await fs.readFile(
    path.join(process.cwd(), 'src', 'lib', 'backup.ts'),
    'utf8',
  );
  const corpoDaFuncao = fonte.slice(
    fonte.indexOf('export async function verificarBackupSemanal'),
    fonte.indexOf('/** Histórico de backups'),
  );
  checar(
    'a regra não depende do dia da semana',
    !/getDay\(\)|getUTCDay\(\)/.test(corpoDaFuncao),
    'sem getDay() na função',
  );

  await verificarBackupSemanal();
  const apos1 = await prisma.backup.count({ where: { tipo: 'automatico_semanal' } });
  checar('dispara quando nunca houve backup semanal', apos1 === 1, `${apos1} backup(s)`);

  await verificarBackupSemanal();
  const apos2 = await prisma.backup.count({ where: { tipo: 'automatico_semanal' } });
  checar('não repete dentro da mesma semana', apos2 === 1, `${apos2} backup(s)`);

  // Envelhece o registro em 6 dias: ainda dentro da semana.
  const registro = await prisma.backup.findFirstOrThrow({
    where: { tipo: 'automatico_semanal' },
  });
  await prisma.backup.update({
    where: { id: registro.id },
    data: { createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
  });
  await verificarBackupSemanal();
  checar(
    'aos 6 dias ainda não dispara',
    (await prisma.backup.count({ where: { tipo: 'automatico_semanal' } })) === 1,
  );

  // Agora em 8 dias: a semana fechou.
  await prisma.backup.updateMany({
    where: { tipo: 'automatico_semanal' },
    data: { createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
  });
  await verificarBackupSemanal();
  const apos4 = await prisma.backup.count({ where: { tipo: 'automatico_semanal' } });
  checar('aos 8 dias dispara de novo', apos4 === 2, `${apos4} backup(s)`);

  console.log('\n── Parecer automático ─────────────────────────────────────');

  // Sem chave da Anthropic, deve simplesmente não fazer nada — sem lançar.
  let lancou = false;
  try {
    await verificarInsightAutomatico();
  } catch {
    lancou = true;
  }
  checar('sem chave de IA, não lança', !lancou);
  const insights = await prisma.insightIA.count();
  checar('sem chave de IA, não cria parecer', insights === 0);

  // Com a geração desligada, também não faz nada.
  await prisma.configuracao.create({
    data: { chave: 'iaGeracaoAutomatica', valor: 'false', tipo: 'boolean', grupo: 'ia' },
  });
  await verificarInsightAutomatico();
  checar('respeita o interruptor desligado', (await prisma.insightIA.count()) === 0);

  console.log('\n── Trava do agendador ─────────────────────────────────────');
  const { executarTarefasAutomaticas } = await import('@/lib/tarefas-automaticas');

  const antes = await prisma.backup.count({ where: { tipo: 'automatico_semanal' } });
  executarTarefasAutomaticas();
  executarTarefasAutomaticas();
  executarTarefasAutomaticas();
  await new Promise((r) => setTimeout(r, 2500));
  const depois = await prisma.backup.count({ where: { tipo: 'automatico_semanal' } });
  checar(
    'três chamadas seguidas não geram três backups',
    depois - antes <= 1,
    `${depois - antes} novo(s)`,
  );

  await prisma.$disconnect();
  console.log(`\n${'═'.repeat(62)}`);
  console.log(falhas === 0 ? '  Tarefas automáticas em ordem.' : `  ${falhas} falha(s).`);
  console.log(`${'═'.repeat(62)}\n`);
}

main()
  .catch((erro: unknown) => {
    console.error('\n✗ Falha:', erro);
    falhas += 1;
  })
  .finally(async () => {
    await fs.rm(bancoTeste, { force: true }).catch(() => undefined);
    await fs.rm(process.env.BACKUP_DIR ?? '', { recursive: true, force: true }).catch(() => undefined);
    process.exit(falhas > 0 ? 1 : 0);
  });
