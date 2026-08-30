/**
 * Seed inicial da Recuperadora Menegatti.
 *
 * Cria: usuário admin, todos os parâmetros financeiros calibrados,
 * os 5 centros de custo e as despesas fixas recorrentes do mês corrente.
 *
 * É idempotente — pode rodar quantas vezes for necessário sem duplicar dados
 * nem sobrescrever valores que o usuário já ajustou na interface.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  PARAMETROS_DEFAULT,
  DESCRICOES_PARAMETROS,
  CENTROS_DEFAULT,
  CONFIGS_TEXTO,
  CREDENCIAL_INICIAL,
} from '../src/lib/constants';
import type { ParametrosBase } from '../src/types';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('→ Semeando o banco da Recuperadora Menegatti…\n');

  // ── Usuário administrador ──────────────────────────────────────────────
  const senhaHash = await bcrypt.hash(CREDENCIAL_INICIAL.senha, 12);
  const usuario = await prisma.user.upsert({
    where: { email: CREDENCIAL_INICIAL.email },
    update: {},
    create: {
      email: CREDENCIAL_INICIAL.email,
      password: senhaHash,
      name: CREDENCIAL_INICIAL.nome,
      role: 'admin',
    },
  });
  console.log(`  ✓ Usuário administrador: ${usuario.email}`);

  // ── Parâmetros financeiros ─────────────────────────────────────────────
  const chaves = Object.keys(PARAMETROS_DEFAULT) as Array<keyof ParametrosBase>;
  let novosParametros = 0;
  for (const chave of chaves) {
    const existente = await prisma.configuracao.findUnique({ where: { chave } });
    if (existente) continue;
    await prisma.configuracao.create({
      data: {
        chave,
        valor: String(PARAMETROS_DEFAULT[chave]),
        tipo: 'number',
        grupo: 'financeiro',
        descricao: DESCRICOES_PARAMETROS[chave],
      },
    });
    novosParametros += 1;
  }
  console.log(
    `  ✓ Parâmetros financeiros: ${novosParametros} criados, ${chaves.length - novosParametros} já existentes`,
  );

  // ── Configurações de texto (empresa, IA, aparência) ────────────────────
  let novasConfigs = 0;
  for (const cfg of CONFIGS_TEXTO) {
    const existente = await prisma.configuracao.findUnique({ where: { chave: cfg.chave } });
    if (existente) continue;
    await prisma.configuracao.create({
      data: {
        chave: cfg.chave,
        valor: cfg.valor,
        tipo: cfg.tipo,
        grupo: cfg.grupo,
        descricao: cfg.descricao,
      },
    });
    novasConfigs += 1;
  }
  console.log(`  ✓ Configurações gerais: ${novasConfigs} criadas`);

  // ── Centros de custo ───────────────────────────────────────────────────
  for (const centro of CENTROS_DEFAULT) {
    await prisma.centroCusto.upsert({
      where: { slug: centro.slug },
      update: {},
      create: {
        nome: centro.nome,
        slug: centro.slug,
        qtdMaquinas: centro.qtdMaquinas,
        qtdOperadores: centro.qtdOperadores,
        thmEstimado: centro.thmEstimado,
        ordem: centro.ordem,
        ativo: true,
      },
    });
  }
  console.log(`  ✓ Centros de custo: ${CENTROS_DEFAULT.length} configurados`);

  // ── Resumo das taxas calculadas ────────────────────────────────────────
  const p = PARAMETROS_DEFAULT;
  const folhaComEncargos = p.folhaBrutaMensal * p.multiplicadorEncargos;
  const horasDisponiveis = p.horasPorDia * p.diasUteisMes;
  const horasProdutivas = horasDisponiveis * (1 - p.ociosidadePct / 100);
  const totalHorasProdutivas = horasProdutivas * p.qtdOperadores;
  const thh = folhaComEncargos / p.qtdOperadores / horasProdutivas;
  const overhead = p.despesasAdministrativas + p.energiaEletrica + p.manutencaoPreventiva;
  const cfr = overhead / totalHorasProdutivas;

  const brl = (v: number): string =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  console.log('\n  ── Taxas resultantes ──────────────────────────────');
  console.log(`  Folha com encargos ......... ${brl(folhaComEncargos)}/mês`);
  console.log(`  Horas produtivas/operador .. ${horasProdutivas.toFixed(1)}h`);
  console.log(`  Total horas produtivas ..... ${totalHorasProdutivas.toFixed(0)}h/mês`);
  console.log(`  THH ........................ ${brl(thh)}/h`);
  console.log(`  CFR ........................ ${brl(cfr)}/h`);
  for (const c of CENTROS_DEFAULT) {
    const custoHora = thh + c.thmEstimado + cfr;
    console.log(`  ${c.nome.padEnd(20, '.')} ${brl(custoHora)}/h`);
  }
  console.log('  ───────────────────────────────────────────────────\n');

  if (p.manutencaoPreventiva === 0) {
    console.log(
      '  ⚠  Provisão para manutenção preventiva está em R$ 0,00.\n' +
        '     Ajuste em /configuracoes → Parâmetros Financeiros para evitar\n' +
        '     surpresas de caixa com quebra de máquina.\n',
    );
  }

  console.log('✓ Seed concluído.');
  console.log(
    `  Acesse com usuário "${CREDENCIAL_INICIAL.email}" e senha "${CREDENCIAL_INICIAL.senha}".`,
  );
  console.log('  Troque a senha em /configuracoes → Empresa.\n');
}

main()
  .catch((erro: unknown) => {
    console.error('✗ Falha no seed:', erro);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
