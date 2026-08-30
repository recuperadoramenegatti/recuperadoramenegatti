/**
 * Teste real do sistema de backup: gera o ZIP, valida, apaga os dados,
 * restaura e confere que tudo voltou. Rode com: npm run smoke:backup
 *
 * Trabalha sobre uma cópia descartável do banco — a variável DATABASE_URL é
 * apontada para um arquivo temporário ANTES de o Prisma ser carregado, para
 * que o banco de trabalho nunca corra risco.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const bancoTeste = path.join(os.tmpdir(), `menegatti-teste-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${bancoTeste}`;
process.env.BACKUP_DIR = path.join(os.tmpdir(), `menegatti-backups-${Date.now()}`);

let falhas = 0;
function checar(rotulo: string, condicao: boolean, detalhe = ''): void {
  if (!condicao) falhas += 1;
  console.log(`  ${condicao ? '✓' : '✗'} ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main(): Promise<void> {
  // Imports dinâmicos: só depois de DATABASE_URL apontar para a cópia.
  const { execSync } = await import('node:child_process');
  console.log('\n── Preparando banco de teste isolado ──────────────────────');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env },
    stdio: 'pipe',
  });
  console.log(`  banco: ${bancoTeste}`);

  const { prisma } = await import('@/lib/prisma');
  const { gerarBackupZip, validarBackup, restaurarBackup } = await import('@/lib/backup');
  const { CENTROS_DEFAULT, PARAMETROS_DEFAULT } = await import('@/lib/constants');

  // ── Popular com dados conhecidos ────────────────────────────────────
  console.log('\n── Populando com dados de teste ───────────────────────────');

  await prisma.user.create({
    data: { email: 'admin', password: 'hash-fake', name: 'Administrador' },
  });

  for (const [chave, valor] of Object.entries(PARAMETROS_DEFAULT)) {
    await prisma.configuracao.create({
      data: { chave, valor: String(valor), tipo: 'number', grupo: 'financeiro' },
    });
  }

  const centros = [];
  for (const c of CENTROS_DEFAULT) {
    centros.push(
      await prisma.centroCusto.create({
        data: {
          nome: c.nome,
          slug: c.slug,
          qtdMaquinas: c.qtdMaquinas,
          qtdOperadores: c.qtdOperadores,
          thmEstimado: c.thmEstimado,
          ordem: c.ordem,
        },
      }),
    );
  }

  const cliente = await prisma.cliente.create({
    data: { codigo: 'CLI-0001', nome: 'Transportes Teste Ltda', cidade: 'Bauru', estado: 'SP' },
  });

  const torno = centros[0]!;
  for (let i = 1; i <= 3; i += 1) {
    await prisma.ordemServico.create({
      data: {
        numero: `OS-2026-000${i}`,
        clienteId: cliente.id,
        tipo: 'recuperacao',
        descricao: `Recuperação de teste ${i}`,
        margemDesejada: 30,
        custoTotalCalc: 1000 * i,
        precoMinimoCalc: 1428.57 * i,
        precoSugerido: 1670.84 * i,
        margemReal: 30,
        aliquotaUsada: 14.5,
        horasEstimadas: 5 * i,
        precoPecaNova: 5000 * i,
        dataFinalizacao: new Date(),
        dataFaturamento: new Date(),
        status: 'faturado',
        itens: {
          create: [
            {
              centroId: torno.id,
              horasEstimadas: 5 * i,
              thhUsado: 153.59,
              thmUsado: 18.5,
              cfrUsado: 24.45,
              custoCalculado: 982.7 * i,
            },
          ],
        },
      },
    });
  }

  await prisma.lancamentoFinanceiro.create({
    data: {
      tipo: 'despesa',
      categoria: 'admin',
      descricao: 'Lançamento de teste',
      valor: 1234.56,
      data: new Date(),
    },
  });

  await prisma.insightIA.create({
    data: {
      periodo: '2026-08',
      dadosSnapshot: '{"faturamento":5012.52}',
      analiseGerada: '{"resumo_executivo":"Teste"}',
      modeloUsado: 'claude-sonnet-4-5',
      tokensUsados: 1500,
    },
  });

  const antes = {
    usuarios: await prisma.user.count(),
    configuracoes: await prisma.configuracao.count(),
    clientes: await prisma.cliente.count(),
    centros: await prisma.centroCusto.count(),
    ordens: await prisma.ordemServico.count(),
    itens: await prisma.oSItemCentro.count(),
    lancamentos: await prisma.lancamentoFinanceiro.count(),
    insights: await prisma.insightIA.count(),
  };
  console.log(`  ${Object.entries(antes).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // ── Exportar ────────────────────────────────────────────────────────
  console.log('\n── Gerando o backup ───────────────────────────────────────');
  const backup = await gerarBackupZip('manual');
  console.log(`  ${backup.filename} · ${(backup.buffer.length / 1024).toFixed(1)} KB`);

  const nomes = backup.metadados.arquivos.map((a) => a.nome);
  checar('contém menegatti_data.json', nomes.includes('menegatti_data.json'));
  checar('contém menegatti_db.sqlite', nomes.includes('menegatti_db.sqlite'));
  checar('contém menegatti_report.xlsx', nomes.includes('menegatti_report.xlsx'));
  checar('metadados trazem checksum geral', backup.metadados.checksumGeral.length === 64);
  checar(
    'totais dos metadados batem com o banco',
    backup.metadados.totais.ordensServico === antes.ordens &&
      backup.metadados.totais.clientes === antes.clientes,
    `${backup.metadados.totais.ordensServico} OS, ${backup.metadados.totais.clientes} clientes`,
  );

  // ── Validar ─────────────────────────────────────────────────────────
  console.log('\n── Validando o arquivo ────────────────────────────────────');
  const preview = await validarBackup(backup.buffer);
  checar('backup íntegro é aceito', preview.valido);
  checar(
    'preview conta as OS corretamente',
    preview.totais.ordensServico === antes.ordens,
    `${preview.totais.ordensServico}`,
  );

  // Corrompe um byte no meio do arquivo de dados
  const JSZip = (await import('jszip')).default;
  const zipCorrompido = await JSZip.loadAsync(backup.buffer);
  const dadosOriginais = await zipCorrompido.file('menegatti_data.json')!.async('string');
  zipCorrompido.file('menegatti_data.json', dadosOriginais.replace('Transportes Teste', 'ADULTERADO'));
  const bufferCorrompido = await zipCorrompido.generateAsync({ type: 'nodebuffer' });

  const previewCorrompido = await validarBackup(bufferCorrompido);
  checar(
    'backup adulterado é REJEITADO pelo checksum',
    !previewCorrompido.valido,
    previewCorrompido.erros[0]?.slice(0, 60),
  );

  const previewLixo = await validarBackup(Buffer.from('isto não é um zip'));
  checar('arquivo que não é ZIP é rejeitado', !previewLixo.valido);

  // ── Apagar tudo e restaurar ─────────────────────────────────────────
  console.log('\n── Apagando todos os dados ────────────────────────────────');
  await prisma.oSItemCentro.deleteMany();
  await prisma.lancamentoFinanceiro.deleteMany();
  await prisma.ordemServico.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.centroCusto.deleteMany();
  await prisma.insightIA.deleteMany();
  await prisma.configuracao.deleteMany();
  await prisma.user.deleteMany();

  const zerado = await prisma.ordemServico.count();
  checar('banco realmente esvaziado', zerado === 0);

  console.log('\n── Restaurando (modo substituir) ──────────────────────────');
  const resultado = await restaurarBackup(backup.buffer, 'substituir');
  console.log(
    `  importados: ${Object.entries(resultado.importados)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}`,
  );

  const depois = {
    usuarios: await prisma.user.count(),
    configuracoes: await prisma.configuracao.count(),
    clientes: await prisma.cliente.count(),
    centros: await prisma.centroCusto.count(),
    ordens: await prisma.ordemServico.count(),
    itens: await prisma.oSItemCentro.count(),
    lancamentos: await prisma.lancamentoFinanceiro.count(),
    insights: await prisma.insightIA.count(),
  };

  for (const chave of Object.keys(antes) as Array<keyof typeof antes>) {
    checar(
      `${chave} restaurados`,
      depois[chave] === antes[chave],
      `${depois[chave]} de ${antes[chave]}`,
    );
  }

  // ── Conferir o conteúdo, não só a contagem ──────────────────────────
  console.log('\n── Conferindo o conteúdo restaurado ───────────────────────');
  const os2 = await prisma.ordemServico.findUnique({
    where: { numero: 'OS-2026-0002' },
    include: { itens: true, cliente: true },
  });

  checar('OS-2026-0002 existe', os2 !== null);
  checar('custo preservado', os2?.custoTotalCalc === 2000, String(os2?.custoTotalCalc));
  checar('preço preservado', Math.abs((os2?.precoSugerido ?? 0) - 3341.68) < 0.01);
  checar('vínculo com o cliente preservado', os2?.cliente.nome === 'Transportes Teste Ltda');
  checar('itens de centro preservados', os2?.itens.length === 1);
  checar(
    'snapshot das taxas preservado',
    os2?.itens[0]?.thhUsado === 153.59 && os2?.itens[0]?.cfrUsado === 24.45,
  );
  checar(
    'datas voltaram como Date, não string',
    os2?.dataFaturamento instanceof Date,
    String(os2?.dataFaturamento?.constructor.name),
  );

  const folha = await prisma.configuracao.findUnique({ where: { chave: 'folhaBrutaMensal' } });
  checar('parâmetros financeiros preservados', folha?.valor === '170000', folha?.valor);

  // ── Modo mesclar não duplica ────────────────────────────────────────
  console.log('\n── Restaurando de novo (modo mesclar) ─────────────────────');
  await restaurarBackup(backup.buffer, 'mesclar');
  const aposMesclar = await prisma.ordemServico.count();
  checar(
    'mesclar sobre dados idênticos não duplica',
    aposMesclar === antes.ordens,
    `${aposMesclar} OS`,
  );

  await prisma.$disconnect();

  console.log(`\n${'═'.repeat(62)}`);
  console.log(falhas === 0 ? '  Backup íntegro de ponta a ponta.' : `  ${falhas} falha(s).`);
  console.log(`${'═'.repeat(62)}\n`);
}

main()
  .catch((erro: unknown) => {
    console.error('\n✗ Falha no teste de backup:', erro);
    falhas += 1;
  })
  .finally(async () => {
    await fs.rm(bancoTeste, { force: true }).catch(() => undefined);
    await fs
      .rm(process.env.BACKUP_DIR ?? '', { recursive: true, force: true })
      .catch(() => undefined);
    process.exit(falhas > 0 ? 1 : 0);
  });
