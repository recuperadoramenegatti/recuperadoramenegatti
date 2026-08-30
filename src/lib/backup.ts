/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SISTEMA DE BACKUP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O dono da empresa não pode perder dados. Por isso o backup é redundante
 * de propósito — o mesmo conteúdo sai em três formatos independentes:
 *
 *   menegatti_data.json    → todos os registros, legível e restaurável
 *   menegatti_db.sqlite    → cópia binária do banco, restaurável por cópia
 *   menegatti_report.xlsx  → DRE, KPIs, OS e clientes, legível sem o sistema
 *   backup_metadata.json   → versão, data, totais e checksum de cada arquivo
 *
 * Se o JSON corromper, o SQLite salva. Se ambos falharem, o Excel ainda
 * permite reconstruir o histórico à mão. E o checksum denuncia corrupção
 * antes de a restauração encostar nos dados.
 *
 * A cópia do SQLite é feita com `VACUUM INTO`, que produz um arquivo
 * consistente mesmo com escritas em andamento — copiar o .db diretamente
 * poderia capturar um estado parcial.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import { prisma } from '@/lib/prisma';
import { checksum } from '@/lib/cripto';
import { gerarRelatorioExcel } from '@/lib/exportacao';
import { APP_VERSAO } from '@/lib/constants';
import { periodoAtual } from '@/lib/formatacao';
import { extrairMensagemErro } from '@/lib/utils';
import type { MetadadosBackup, PreviewBackup } from '@/types';

const MAX_INCREMENTAIS = 30;
const MAX_SEMANAIS = 12;

export type TipoBackup = 'manual' | 'automatico_incremental' | 'automatico_semanal';

const SUBPASTA: Record<TipoBackup, string> = {
  manual: 'manual',
  automatico_incremental: 'incremental',
  automatico_semanal: 'semanal',
};

function raizBackups(): string {
  const configurada = process.env.BACKUP_DIR ?? 'backups';
  return path.isAbsolute(configurada) ? configurada : path.join(process.cwd(), configurada);
}

async function garantirPasta(caminho: string): Promise<void> {
  await fs.mkdir(caminho, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════
//  COLETA DOS DADOS
// ═══════════════════════════════════════════════════════════════════════════

export interface DadosBackup {
  versao: string;
  geradoEm: string;
  usuarios: unknown[];
  configuracoes: unknown[];
  clientes: unknown[];
  centrosCusto: unknown[];
  ordensServico: unknown[];
  itensCentro: unknown[];
  lancamentos: unknown[];
  insights: unknown[];
  logs: unknown[];
}

/** Lê todas as tabelas. A ordem importa na restauração (chaves estrangeiras). */
export async function coletarDados(): Promise<DadosBackup> {
  const [
    usuarios,
    configuracoes,
    clientes,
    centrosCusto,
    ordensServico,
    itensCentro,
    lancamentos,
    insights,
    logs,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.configuracao.findMany(),
    prisma.cliente.findMany(),
    prisma.centroCusto.findMany(),
    prisma.ordemServico.findMany(),
    prisma.oSItemCentro.findMany(),
    prisma.lancamentoFinanceiro.findMany(),
    prisma.insightIA.findMany(),
    prisma.logAlteracao.findMany({ orderBy: { createdAt: 'desc' }, take: 5000 }),
  ]);

  return {
    versao: APP_VERSAO,
    geradoEm: new Date().toISOString(),
    usuarios,
    configuracoes,
    clientes,
    centrosCusto,
    ordensServico,
    itensCentro,
    lancamentos,
    insights,
    logs,
  };
}

function totaisDe(dados: DadosBackup): Record<string, number> {
  return {
    usuarios: dados.usuarios.length,
    configuracoes: dados.configuracoes.length,
    clientes: dados.clientes.length,
    centrosCusto: dados.centrosCusto.length,
    ordensServico: dados.ordensServico.length,
    itensCentro: dados.itensCentro.length,
    lancamentos: dados.lancamentos.length,
    insights: dados.insights.length,
    logs: dados.logs.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  CÓPIA DO BANCO SQLITE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Copia o banco com `VACUUM INTO`, garantindo um snapshot consistente.
 * Se falhar (permissão, disco), devolve `null` — o backup segue com o JSON
 * e o Excel, e a limitação é registrada nos metadados.
 */
async function copiarBancoSqlite(): Promise<Buffer | null> {
  const destino = path.join(os.tmpdir(), `menegatti-snapshot-${Date.now()}.sqlite`);
  try {
    // O caminho vem de nós, não do usuário — mas é interpolado numa
    // instrução SQL, então escapamos as aspas simples por precaução.
    const destinoEscapado = destino.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${destinoEscapado}'`);
    const buffer = await fs.readFile(destino);
    return buffer;
  } catch (erro) {
    console.error('[backup] Falha ao copiar o SQLite:', extrairMensagemErro(erro));
    return null;
  } finally {
    await fs.rm(destino, { force: true }).catch(() => undefined);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  GERAÇÃO DO ZIP
// ═══════════════════════════════════════════════════════════════════════════

export interface BackupGerado {
  buffer: Buffer;
  filename: string;
  metadados: MetadadosBackup;
}

/** Monta o ZIP completo do backup. */
export async function gerarBackupZip(tipo: TipoBackup = 'manual'): Promise<BackupGerado> {
  const dados = await coletarDados();
  const zip = new JSZip();
  const arquivos: MetadadosBackup['arquivos'] = [];

  // 1. JSON de dados
  const jsonBuffer = Buffer.from(JSON.stringify(dados, null, 2), 'utf8');
  zip.file('menegatti_data.json', jsonBuffer);
  arquivos.push({
    nome: 'menegatti_data.json',
    checksum: checksum(jsonBuffer),
    tamanho: jsonBuffer.length,
  });

  // 2. Cópia do banco
  const sqlite = await copiarBancoSqlite();
  if (sqlite) {
    zip.file('menegatti_db.sqlite', sqlite);
    arquivos.push({
      nome: 'menegatti_db.sqlite',
      checksum: checksum(sqlite),
      tamanho: sqlite.length,
    });
  }

  // 3. Relatório em Excel — se falhar, o backup dos dados não pode ser perdido.
  try {
    const excel = await gerarRelatorioExcel(periodoAtual(), 12);
    zip.file('menegatti_report.xlsx', excel);
    arquivos.push({
      nome: 'menegatti_report.xlsx',
      checksum: checksum(excel),
      tamanho: excel.length,
    });
  } catch (erro) {
    console.error('[backup] Falha ao gerar o relatório Excel:', extrairMensagemErro(erro));
  }

  // 4. Metadados
  const metadados: MetadadosBackup = {
    versaoApp: APP_VERSAO,
    geradoEm: dados.geradoEm,
    tipo,
    totais: totaisDe(dados),
    arquivos,
    checksumGeral: checksum(arquivos.map((a) => a.checksum).join('|')),
  };
  zip.file('backup_metadata.json', JSON.stringify(metadados, null, 2));

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const data = new Date();
  const carimbo = `${data.toISOString().slice(0, 10)}_${String(data.getHours()).padStart(2, '0')}${String(data.getMinutes()).padStart(2, '0')}`;
  const sufixo = tipo === 'manual' ? '' : `_${SUBPASTA[tipo]}`;

  return {
    buffer,
    filename: `menegatti_backup_${carimbo}${sufixo}.zip`,
    metadados,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  PERSISTÊNCIA LOCAL E ROTAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

/** Grava o backup em disco e registra na tabela `Backup`. */
export async function salvarBackupLocal(
  backup: BackupGerado,
  tipo: TipoBackup,
): Promise<{ caminho: string; id: string }> {
  const pasta = path.join(raizBackups(), SUBPASTA[tipo]);
  await garantirPasta(pasta);

  const caminho = path.join(pasta, backup.filename);
  await fs.writeFile(caminho, backup.buffer);

  const registro = await prisma.backup.create({
    data: {
      tipo,
      filename: backup.filename,
      caminho,
      tamanhoBytes: backup.buffer.length,
      checksum: backup.metadados.checksumGeral,
      status: 'concluido',
      detalhes: JSON.stringify(backup.metadados.totais),
    },
    select: { id: true },
  });

  await rotacionar(tipo);
  return { caminho, id: registro.id };
}

/** Mantém apenas os N backups mais recentes de cada tipo (FIFO). */
async function rotacionar(tipo: TipoBackup): Promise<void> {
  const limite =
    tipo === 'automatico_incremental'
      ? MAX_INCREMENTAIS
      : tipo === 'automatico_semanal'
        ? MAX_SEMANAIS
        : MAX_INCREMENTAIS;

  try {
    const antigos = await prisma.backup.findMany({
      where: { tipo },
      orderBy: { createdAt: 'desc' },
      skip: limite,
      select: { id: true, caminho: true },
    });

    for (const antigo of antigos) {
      if (antigo.caminho) await fs.rm(antigo.caminho, { force: true }).catch(() => undefined);
      await prisma.backup.delete({ where: { id: antigo.id } }).catch(() => undefined);
    }
  } catch (erro) {
    console.error('[backup] Falha ao rotacionar backups:', extrairMensagemErro(erro));
  }
}

/**
 * Backup incremental, disparado a cada OS salva.
 *
 * Nunca lança: uma falha de backup não pode impedir o usuário de salvar
 * uma OS. O erro é registrado e a tabela `Backup` guarda o status "erro"
 * para que a tela de backups mostre o problema.
 *
 * Um backup por hora, no máximo — 200 OS/mês não precisam de 200 ZIPs.
 */
export async function agendarBackupIncremental(): Promise<void> {
  try {
    const ultimo = await prisma.backup.findFirst({
      where: { tipo: 'automatico_incremental' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (ultimo && Date.now() - ultimo.createdAt.getTime() < 60 * 60 * 1000) return;

    const backup = await gerarBackupZip('automatico_incremental');
    await salvarBackupLocal(backup, 'automatico_incremental');
  } catch (erro) {
    console.error('[backup] Backup incremental falhou:', extrairMensagemErro(erro));
    await prisma.backup
      .create({
        data: {
          tipo: 'automatico_incremental',
          filename: '—',
          tamanhoBytes: 0,
          checksum: '',
          status: 'erro',
          detalhes: extrairMensagemErro(erro),
        },
      })
      .catch(() => undefined);
  }
}

/**
 * Backup semanal completo.
 *
 * A regra é "faz sete dias desde o último", não "é domingo". A jornada da
 * Menegatti é de segunda a sábado: uma regra amarrada ao domingo nunca
 * dispararia, porque ninguém abre o sistema no dia em que a oficina está
 * fechada. Assim o backup acontece no primeiro acesso depois de completada
 * a semana, seja ele numa terça ou num sábado.
 */
export async function verificarBackupSemanal(): Promise<void> {
  try {
    const ultimoSemanal = await prisma.backup.findFirst({
      where: { tipo: 'automatico_semanal', status: 'concluido' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const UMA_SEMANA = 7 * 24 * 60 * 60 * 1000;
    if (ultimoSemanal && Date.now() - ultimoSemanal.createdAt.getTime() < UMA_SEMANA) return;

    const backup = await gerarBackupZip('automatico_semanal');
    await salvarBackupLocal(backup, 'automatico_semanal');
    console.info('[backup] Backup semanal automático concluído.');
  } catch (erro) {
    console.error('[backup] Backup semanal falhou:', extrairMensagemErro(erro));
  }
}

/** Histórico de backups, para a tela de gestão. */
export async function listarBackups(limite = 30): Promise<
  Array<{
    id: string;
    tipo: string;
    filename: string;
    tamanhoBytes: number;
    status: string;
    createdAt: Date;
    disponivel: boolean;
  }>
> {
  const registros = await prisma.backup.findMany({
    orderBy: { createdAt: 'desc' },
    take: limite,
  });

  return Promise.all(
    registros.map(async (r) => ({
      id: r.id,
      tipo: r.tipo,
      filename: r.filename,
      tamanhoBytes: r.tamanhoBytes,
      status: r.status,
      createdAt: r.createdAt,
      disponivel: r.caminho
        ? await fs
            .access(r.caminho)
            .then(() => true)
            .catch(() => false)
        : false,
    })),
  );
}

/** Lê um backup do disco para download. */
export async function lerBackupSalvo(id: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const registro = await prisma.backup.findUnique({ where: { id } });
  if (!registro?.caminho) return null;
  try {
    const buffer = await fs.readFile(registro.caminho);
    return { buffer, filename: registro.filename };
  } catch (erro) {
    console.error('[backup] Arquivo indisponível:', extrairMensagemErro(erro));
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  VALIDAÇÃO E RESTAURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function comoArray(valor: unknown): Record<string, unknown>[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(ehRegistro);
}

/** Converte campos de data do JSON de volta para `Date`. */
function reviverDatas<T extends Record<string, unknown>>(registro: T): T {
  const saida: Record<string, unknown> = { ...registro };
  for (const [chave, valor] of Object.entries(saida)) {
    const ehCampoData =
      chave.startsWith('data') || chave === 'createdAt' || chave === 'updatedAt';
    if (ehCampoData && typeof valor === 'string') {
      const d = new Date(valor);
      saida[chave] = Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return saida as T;
}

/**
 * Valida um ZIP de backup antes de deixá-lo encostar nos dados:
 * estrutura, checksums e presença das tabelas essenciais.
 */
export async function validarBackup(buffer: Buffer): Promise<PreviewBackup> {
  const erros: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return {
      valido: false,
      erros: ['O arquivo não é um ZIP válido. Envie o .zip gerado pelo próprio sistema.'],
      metadados: null,
      totais: {},
    };
  }

  const arquivoDados = zip.file('menegatti_data.json');
  if (!arquivoDados) {
    return {
      valido: false,
      erros: ['O backup não contém "menegatti_data.json" — arquivo essencial para restaurar.'],
      metadados: null,
      totais: {},
    };
  }

  // Metadados e checksum
  let metadados: MetadadosBackup | null = null;
  const arquivoMeta = zip.file('backup_metadata.json');
  if (arquivoMeta) {
    try {
      const parsed: unknown = JSON.parse(await arquivoMeta.async('string'));
      if (ehRegistro(parsed)) metadados = parsed as unknown as MetadadosBackup;
    } catch {
      erros.push('Metadados ilegíveis — o backup será validado apenas pelo conteúdo.');
    }
  } else {
    erros.push('Backup sem metadados (versão antiga ou arquivo editado à mão).');
  }

  const bufferDados = await arquivoDados.async('nodebuffer');
  const checksumCalculado = checksum(bufferDados);

  if (metadados?.arquivos) {
    const esperado = metadados.arquivos.find((a) => a.nome === 'menegatti_data.json');
    if (esperado && esperado.checksum !== checksumCalculado) {
      return {
        valido: false,
        erros: [
          'Checksum não confere: o arquivo de dados foi alterado ou corrompeu desde a geração ' +
            'do backup. Restaurar a partir dele pode gravar dados inconsistentes.',
        ],
        metadados,
        totais: metadados.totais ?? {},
      };
    }
  }

  // Conteúdo
  let dados: unknown;
  try {
    dados = JSON.parse(bufferDados.toString('utf8'));
  } catch {
    return {
      valido: false,
      erros: ['O arquivo de dados não é um JSON válido.'],
      metadados,
      totais: {},
    };
  }

  if (!ehRegistro(dados)) {
    return { valido: false, erros: ['Formato de dados inesperado.'], metadados, totais: {} };
  }

  const totais: Record<string, number> = {
    usuarios: comoArray(dados.usuarios).length,
    configuracoes: comoArray(dados.configuracoes).length,
    clientes: comoArray(dados.clientes).length,
    centrosCusto: comoArray(dados.centrosCusto).length,
    ordensServico: comoArray(dados.ordensServico).length,
    itensCentro: comoArray(dados.itensCentro).length,
    lancamentos: comoArray(dados.lancamentos).length,
    insights: comoArray(dados.insights).length,
  };

  if (totais.configuracoes === 0 && totais.clientes === 0 && totais.ordensServico === 0) {
    erros.push('O backup não contém nenhum dado — nada seria restaurado.');
    return { valido: false, erros, metadados, totais };
  }

  return { valido: true, erros, metadados, totais };
}

export interface ResultadoRestauracao {
  modo: 'substituir' | 'mesclar';
  importados: Record<string, number>;
  ignorados: Record<string, number>;
  backupSeguranca: string | null;
}

/**
 * Restaura um backup.
 *
 * • `substituir` — apaga os dados atuais e grava os do backup.
 * • `mesclar`    — mantém tudo o que existe e insere apenas o que falta.
 *
 * Em ambos os modos um backup de segurança do estado atual é gerado ANTES
 * de qualquer escrita: se a restauração for um engano, o caminho de volta
 * existe.
 */
export async function restaurarBackup(
  buffer: Buffer,
  modo: 'substituir' | 'mesclar',
): Promise<ResultadoRestauracao> {
  const validacao = await validarBackup(buffer);
  if (!validacao.valido) {
    throw new Error(`Backup inválido: ${validacao.erros.join(' ')}`);
  }

  // Rede de segurança antes de tocar nos dados.
  let backupSeguranca: string | null = null;
  try {
    const seguranca = await gerarBackupZip('manual');
    const salvo = await salvarBackupLocal(seguranca, 'manual');
    backupSeguranca = salvo.caminho;
  } catch (erro) {
    console.error('[backup] Não foi possível criar o backup de segurança:', extrairMensagemErro(erro));
    if (modo === 'substituir') {
      throw new Error(
        'Não foi possível criar o backup de segurança do estado atual. ' +
          'A restauração em modo "substituir" foi cancelada para não arriscar os dados existentes.',
      );
    }
  }

  const zip = await JSZip.loadAsync(buffer);
  const arquivoDados = zip.file('menegatti_data.json');
  if (!arquivoDados) throw new Error('Arquivo de dados ausente no backup.');
  const dados = JSON.parse(await arquivoDados.async('string')) as Record<string, unknown>;

  const importados: Record<string, number> = {};
  const ignorados: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      if (modo === 'substituir') {
        // Ordem inversa das dependências.
        await tx.logAlteracao.deleteMany();
        await tx.oSItemCentro.deleteMany();
        await tx.lancamentoFinanceiro.deleteMany();
        await tx.ordemServico.deleteMany();
        await tx.cliente.deleteMany();
        await tx.centroCusto.deleteMany();
        await tx.insightIA.deleteMany();
        await tx.configuracao.deleteMany();
        await tx.user.deleteMany();
      }

      /**
       * Insere uma tabela.
       *
       * No modo "mesclar", registros já existentes são detectados por uma
       * consulta explícita e simplesmente pulados. Deixar o banco lançar a
       * violação de chave única também funcionaria, mas usar exceção para
       * um caminho esperado enche o log de erro com algo que não é erro.
       */
      const inserir = async <T extends Record<string, unknown>>(
        nome: string,
        registros: T[],
        existe: (registro: T) => Promise<boolean>,
        criar: (registro: T) => Promise<unknown>,
      ): Promise<void> => {
        let ok = 0;
        let pulados = 0;

        for (const bruto of registros) {
          const registro = reviverDatas(bruto);
          try {
            if (modo === 'mesclar' && (await existe(registro))) {
              pulados += 1;
              continue;
            }
            await criar(registro);
            ok += 1;
          } catch (erro) {
            // Registro malformado no backup: pula sem derrubar a restauração
            // inteira — importar 99% é melhor que importar nada.
            console.error(
              `[backup] Registro ignorado em "${nome}":`,
              extrairMensagemErro(erro),
            );
            pulados += 1;
          }
        }

        importados[nome] = ok;
        ignorados[nome] = pulados;
      };

      const id = (r: Record<string, unknown>): string => String(r.id ?? '');

      await inserir(
        'usuarios',
        comoArray(dados.usuarios),
        async (r) => (await tx.user.count({ where: { email: String(r.email) } })) > 0,
        (r) => tx.user.create({ data: r as never }),
      );

      await inserir(
        'configuracoes',
        comoArray(dados.configuracoes),
        async () => false, // configurações usam upsert e sempre valem a escrita
        (r) =>
          modo === 'substituir'
            ? tx.configuracao.create({ data: r as never })
            : tx.configuracao.upsert({
                where: { chave: String(r.chave) },
                update: { valor: String(r.valor) },
                create: r as never,
              }),
      );

      await inserir(
        'centrosCusto',
        comoArray(dados.centrosCusto),
        async (r) => (await tx.centroCusto.count({ where: { slug: String(r.slug) } })) > 0,
        (r) => tx.centroCusto.create({ data: r as never }),
      );

      await inserir(
        'clientes',
        comoArray(dados.clientes),
        async (r) => (await tx.cliente.count({ where: { id: id(r) } })) > 0,
        (r) => tx.cliente.create({ data: r as never }),
      );

      await inserir(
        'ordensServico',
        comoArray(dados.ordensServico),
        async (r) => (await tx.ordemServico.count({ where: { numero: String(r.numero) } })) > 0,
        (r) => tx.ordemServico.create({ data: r as never }),
      );

      await inserir(
        'itensCentro',
        comoArray(dados.itensCentro),
        async (r) => (await tx.oSItemCentro.count({ where: { id: id(r) } })) > 0,
        (r) => tx.oSItemCentro.create({ data: r as never }),
      );

      await inserir(
        'lancamentos',
        comoArray(dados.lancamentos),
        async (r) => (await tx.lancamentoFinanceiro.count({ where: { id: id(r) } })) > 0,
        (r) => tx.lancamentoFinanceiro.create({ data: r as never }),
      );

      await inserir(
        'insights',
        comoArray(dados.insights),
        async (r) => (await tx.insightIA.count({ where: { id: id(r) } })) > 0,
        (r) => tx.insightIA.create({ data: r as never }),
      );
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  return { modo, importados, ignorados, backupSeguranca };
}

/** Data do último backup completo bem-sucedido. */
export async function ultimoBackup(): Promise<Date | null> {
  try {
    const registro = await prisma.backup.findFirst({
      where: { status: 'concluido' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return registro?.createdAt ?? null;
  } catch {
    return null;
  }
}
