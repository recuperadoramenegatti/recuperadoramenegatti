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
import { garantirCodigo } from '../src/lib/recuperacao';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('→ Semeando o banco da Recuperadora Menegatti…\n');

  // ── Usuário administrador ──────────────────────────────────────────────
  //
  // Em condições normais o seed NÃO mexe em quem já existe: rodar de novo
  // não pode desfazer uma senha trocada pelo dono. Mas isso cria um beco sem
  // saída — num banco já criado, mudar as credenciais aqui não teria efeito
  // nenhum, e quem perdeu o acesso continuaria trancado do lado de fora.
  //
  // A variável REDEFINIR_ACESSO é a saída desse beco: quando presente, o seed
  // devolve o acesso às credenciais configuradas acima. É explícita e fica
  // sob controle de quem administra a hospedagem — e deve ser REMOVIDA depois
  // de usada, senão todo deploy futuro desfaz a senha que o dono escolher.
  const senhaHash = await bcrypt.hash(CREDENCIAL_INICIAL.senha, 12);
  const email = CREDENCIAL_INICIAL.email.trim().toLowerCase();
  const redefinir = Boolean(process.env.REDEFINIR_ACESSO?.trim());

  // Procura por qualquer usuário, não pelo e-mail configurado: se o cadastro
  // atual tiver outro e-mail (uma instalação antiga com "admin", por
  // exemplo), o certo é corrigi-lo — e não criar um segundo usuário ao lado.
  const existente = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!existente) {
    const criado = await prisma.user.create({
      data: { email, password: senhaHash, name: CREDENCIAL_INICIAL.nome, role: 'admin' },
    });
    console.log(`  ✓ Usuário administrador: ${criado.email}`);
  } else if (redefinir) {
    const atualizado = await prisma.user.update({
      where: { id: existente.id },
      data: { email, password: senhaHash, name: CREDENCIAL_INICIAL.nome, role: 'admin' },
    });
    console.log(`  ✓ Acesso REDEFINIDO: usuário "${atualizado.email}", senha reconfigurada.`);
    console.log('    Remova a variável REDEFINIR_ACESSO agora — enquanto ela existir,');
    console.log('    todo novo deploy vai desfazer a senha que você escolher.');
  } else {
    console.log(`  ✓ Usuário administrador já existe: ${existente.email} (mantido como está)`);
    if (existente.email !== email) {
      console.log(`    Atenção: o e-mail configurado é "${email}", mas o cadastro tem`);
      console.log(`    "${existente.email}". Use REDEFINIR_ACESSO=1 para alinhar os dois.`);
    }
  }

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

  // ── Código de recuperação ──────────────────────────────────────────────
  // Só é criado se ainda não existir: trocar o código de quem já anotou o
  // dele transformaria o papel guardado na gaveta em papel inútil.
  const codigoNovo = await garantirCodigo();

  console.log('✓ Seed concluído.');
  console.log(
    `  Acesse com usuário "${CREDENCIAL_INICIAL.email}" e senha "${CREDENCIAL_INICIAL.senha}".`,
  );
  console.log('  Troque a senha em /configuracoes → Empresa.\n');

  if (codigoNovo) {
    console.log('  ┌──────────────────────────────────────────────────────┐');
    console.log('  │  CÓDIGO DE RECUPERAÇÃO DE SENHA — ANOTE ESTE CÓDIGO  │');
    console.log('  ├──────────────────────────────────────────────────────┤');
    console.log(`  │            ${codigoNovo}                 │`);
    console.log('  └──────────────────────────────────────────────────────┘');
    console.log('    É com ele que se recupera o acesso caso a senha seja');
    console.log('    esquecida. Guarde fora do computador — num papel, na');
    console.log('    carteira, onde ficam os documentos da empresa.');
    console.log('    Esta é a única vez que ele aparece: o banco guarda só');
    console.log('    uma marca dele, não o código.\n');
  }
}

main()
  .catch((erro: unknown) => {
    console.error('✗ Falha no seed:', erro);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
