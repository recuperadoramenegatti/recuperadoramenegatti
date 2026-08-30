'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  HardDriveDownload,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, extrairMensagemErro } from '@/lib/utils';
import { formatarDataHora, formatarTamanhoArquivo, formatarTempoRelativo } from '@/lib/formatacao';
import type { PreviewBackup } from '@/types';

export interface RegistroBackup {
  id: string;
  tipo: string;
  filename: string;
  tamanhoBytes: number;
  status: string;
  createdAt: string;
  disponivel: boolean;
}

const ROTULO_TIPO: Record<string, string> = {
  manual: 'Manual',
  automatico_incremental: 'Incremental',
  automatico_semanal: 'Semanal',
};

export function AbaBackup({
  backups,
  ultimoBackup,
  horasDesdeUltimo,
  alerta,
}: {
  backups: RegistroBackup[];
  ultimoBackup: string | null;
  horasDesdeUltimo: number | null;
  alerta: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [exportando, setExportando] = React.useState(false);

  const exportar = async (): Promise<void> => {
    setExportando(true);
    toast.info('Gerando backup completo… isso pode levar alguns segundos.');
    try {
      const resposta = await fetch('/api/backup/exportar');
      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível gerar o backup.',
        );
      }

      const blob = await resposta.blob();
      const cabecalho = resposta.headers.get('Content-Disposition') ?? '';
      const nome =
        /filename="([^"]+)"/.exec(cabecalho)?.[1] ??
        `menegatti_backup_${new Date().toISOString().slice(0, 10)}.zip`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Backup baixado e arquivado no histórico.');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-card',
          alerta
            ? 'border-amber-500/30 bg-amber-500/[0.07]'
            : 'border-emerald-500/25 bg-emerald-500/[0.05]',
        )}
      >
        <div className="flex items-start gap-3">
          {alerta ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          )}
          <div>
            <h3 className="font-semibold">
              {ultimoBackup
                ? `Último backup ${formatarTempoRelativo(ultimoBackup)}`
                : 'Nenhum backup gerado ainda'}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {alerta
                ? 'Faça um backup completo agora e guarde o arquivo fora desta máquina — pen drive, e-mail ou nuvem.'
                : `Backup em dia. ${ultimoBackup ? formatarDataHora(ultimoBackup) : ''}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void exportar()} carregando={exportando}>
            {!exportando ? <HardDriveDownload className="h-4 w-4" /> : null}
            Exportar backup completo
          </Button>
          <ModalRestaurar onRestaurado={() => router.refresh()} />
        </div>
      </div>

      {/* O que vai no ZIP */}
      <section className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <FileArchive className="h-4 w-4 text-primary" aria-hidden />
          O que vai dentro do arquivo
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Três formatos independentes do mesmo conteúdo. Se um corromper, os outros salvam.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <ItemConteudo
            nome="menegatti_data.json"
            descricao="Todos os registros em texto legível. É por ele que a restauração acontece."
          />
          <ItemConteudo
            nome="menegatti_db.sqlite"
            descricao="Cópia consistente do banco, feita com VACUUM INTO. Restaurável por simples cópia de arquivo."
          />
          <ItemConteudo
            nome="menegatti_report.xlsx"
            descricao="DRE, KPIs, OS e clientes dos últimos 12 meses. Abre no Excel sem precisar do sistema."
          />
          <ItemConteudo
            nome="backup_metadata.json"
            descricao="Versão, data, totais por tabela e checksum de cada arquivo — é o que denuncia corrupção antes da restauração."
          />
        </ul>
      </section>

      {/* Backups automáticos */}
      <section className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
        <h3 className="text-sm font-semibold tracking-tight">Backups automáticos</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Rodam sozinhos, em disco local. Nunca impedem você de salvar uma OS: se um backup falhar,
          o erro fica registrado e o trabalho continua.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3.5">
            <p className="text-sm font-medium">Incremental</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A cada OS salva, no máximo um por hora. Mantém os 30 mais recentes.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3.5">
            <p className="text-sm font-medium">Semanal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Todo domingo, no primeiro acesso do dia. Mantém os 12 mais recentes.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <p className="text-xs leading-relaxed">
            Os backups automáticos ficam no <strong>mesmo computador</strong> que o banco. Eles
            protegem contra exclusão acidental e erro de operação, mas não contra perda da máquina.
            Baixe o backup completo periodicamente e guarde a cópia em outro lugar.
          </p>
        </div>
      </section>

      {/* Histórico */}
      <section className="overflow-hidden rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] shadow-card backdrop-blur-sm">
        <header className="p-5 pb-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Archive className="h-4 w-4 text-primary" aria-hidden />
            Histórico de backups
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Últimos {backups.length} arquivos gerados.
          </p>
        </header>

        {backups.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-foreground">
            Nenhum backup registrado ainda. Gere o primeiro agora.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-[var(--borda-1)]">
                  <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Arquivo
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Tamanho
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Gerado em
                  </th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.id}
                    className="border-b border-[var(--borda-0)] transition-colors hover:bg-[var(--superficie-2)]"
                  >
                    <td className="px-5 py-2.5 font-mono text-xs">{backup.filename}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={backup.tipo === 'manual' ? 'default' : 'secondary'}>
                        {ROTULO_TIPO[backup.tipo] ?? backup.tipo}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatarTamanhoArquivo(backup.tamanhoBytes)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {formatarDataHora(backup.createdAt)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {backup.status === 'erro' ? (
                        <Badge variant="destructive">Falhou</Badge>
                      ) : backup.disponivel ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/api/backup/baixar/${backup.id}`} download>
                            <Download className="h-3.5 w-3.5" />
                            Baixar
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Arquivo removido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ItemConteudo({ nome, descricao }: { nome: string; descricao: string }): React.JSX.Element {
  return (
    <li className="rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-3.5">
      <p className="font-mono text-xs font-medium text-primary">{nome}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
    </li>
  );
}

/** Fluxo de restauração: validar → conferir o preview → confirmar. */
function ModalRestaurar({ onRestaurado }: { onRestaurado: () => void }): React.JSX.Element {
  const [aberto, setAberto] = React.useState(false);
  const [arquivo, setArquivo] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<PreviewBackup | null>(null);
  const [modo, setModo] = React.useState<'mesclar' | 'substituir'>('mesclar');
  const [processando, setProcessando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const limpar = (): void => {
    setArquivo(null);
    setPreview(null);
    setModo('mesclar');
  };

  const validar = async (selecionado: File): Promise<void> => {
    setArquivo(selecionado);
    setPreview(null);
    setProcessando(true);

    try {
      const formulario = new FormData();
      formulario.append('arquivo', selecionado);
      formulario.append('acao', 'validar');

      const resposta = await fetch('/api/backup/importar', { method: 'POST', body: formulario });
      const corpo: unknown = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível validar o arquivo.',
        );
      }

      const dados = (corpo as { dados: { preview: PreviewBackup } }).dados;
      setPreview(dados.preview);

      if (!dados.preview.valido) toast.error('O arquivo não passou na validação.');
      else toast.success('Arquivo válido. Confira os dados antes de restaurar.');
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
      setArquivo(null);
    } finally {
      setProcessando(false);
    }
  };

  const restaurar = async (): Promise<void> => {
    if (!arquivo || !preview?.valido) return;
    setProcessando(true);

    try {
      const formulario = new FormData();
      formulario.append('arquivo', arquivo);
      formulario.append('acao', 'restaurar');
      formulario.append('modo', modo);

      const resposta = await fetch('/api/backup/importar', { method: 'POST', body: formulario });
      const corpo: unknown = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'A restauração falhou.',
        );
      }

      const dados = (corpo as {
        dados: { resultado: { importados: Record<string, number> } };
      }).dados;
      const total = Object.values(dados.resultado.importados).reduce((a, b) => a + b, 0);

      toast.success(`Backup restaurado: ${total} registros importados.`);
      setAberto(false);
      limpar();
      onRestaurado();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setAberto(true)}>
        <Upload className="h-4 w-4" />
        Restaurar backup
      </Button>

      <Dialog
        open={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) limpar();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Restaurar backup</DialogTitle>
            <DialogDescription>
              O arquivo é validado antes de encostar nos dados. Um backup de segurança do estado
              atual é gerado automaticamente antes de qualquer escrita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const selecionado = e.target.files?.[0];
                if (selecionado) void validar(selecionado);
                e.target.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={processando}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--borda-2)] px-6 py-8 transition-colors hover:border-[var(--borda-2)] hover:bg-[var(--superficie-2)] disabled:opacity-50"
            >
              <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">
                {arquivo ? arquivo.name : 'Selecionar arquivo .zip'}
              </span>
              <span className="text-xs text-muted-foreground">
                {arquivo
                  ? formatarTamanhoArquivo(arquivo.size)
                  : 'Use o ZIP gerado por este sistema'}
              </span>
            </button>

            {preview ? (
              <div
                className={cn(
                  'rounded-xl border p-4',
                  preview.valido
                    ? 'border-emerald-500/25 bg-emerald-500/[0.05]'
                    : 'border-red-500/25 bg-red-500/[0.07]',
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  {preview.valido ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden />
                      Arquivo válido
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-400" aria-hidden />
                      Arquivo rejeitado
                    </>
                  )}
                </p>

                {preview.metadados ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gerado em {formatarDataHora(preview.metadados.geradoEm)} · versão{' '}
                    {preview.metadados.versaoApp}
                  </p>
                ) : null}

                {preview.erros.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {preview.erros.map((mensagem) => (
                      <li key={mensagem} className="text-xs text-red-300">
                        {mensagem}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {preview.valido ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--borda-1)] pt-3 text-xs">
                    {Object.entries(preview.totais)
                      .filter(([, quantidade]) => quantidade > 0)
                      .map(([tabela, quantidade]) => (
                        <div key={tabela} className="flex justify-between gap-2">
                          <dt className="capitalize text-muted-foreground">{tabela}</dt>
                          <dd className="tabular-nums">{quantidade}</dd>
                        </div>
                      ))}
                  </dl>
                ) : null}
              </div>
            ) : null}

            {preview?.valido ? (
              <fieldset className="space-y-2">
                <legend className="label-caps mb-2">Como importar</legend>

                <OpcaoModo
                  valor="mesclar"
                  selecionado={modo}
                  onSelect={setModo}
                  titulo="Mesclar"
                  descricao="Mantém tudo o que existe hoje e insere apenas o que falta. Escolha segura."
                />
                <OpcaoModo
                  valor="substituir"
                  selecionado={modo}
                  onSelect={setModo}
                  titulo="Substituir"
                  descricao="Apaga os dados atuais e grava os do backup. Use apenas ao migrar de máquina ou recuperar de uma perda."
                  perigoso
                />
              </fieldset>
            ) : null}

            {modo === 'substituir' && preview?.valido ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
                <p className="text-xs leading-relaxed text-red-200">
                  Isso apagará todos os dados atuais. Um backup de segurança do estado de agora é
                  gerado antes — e a restauração é cancelada se esse backup não puder ser criado.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setAberto(false)} type="button">
              Cancelar
            </Button>
            <Button
              onClick={() => void restaurar()}
              carregando={processando}
              disabled={!preview?.valido}
              variant={modo === 'substituir' ? 'destructive' : 'default'}
              type="button"
            >
              {modo === 'substituir' ? 'Substituir tudo' : 'Mesclar dados'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OpcaoModo({
  valor,
  selecionado,
  onSelect,
  titulo,
  descricao,
  perigoso = false,
}: {
  valor: 'mesclar' | 'substituir';
  selecionado: string;
  onSelect: (v: 'mesclar' | 'substituir') => void;
  titulo: string;
  descricao: string;
  perigoso?: boolean;
}): React.JSX.Element {
  const ativo = selecionado === valor;
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
        ativo
          ? perigoso
            ? 'border-red-500/40 bg-red-500/[0.07]'
            : 'border-primary/40 bg-primary/[0.06]'
          : 'border-[var(--borda-1)] bg-[var(--superficie-2)] hover:border-[var(--borda-2)]',
      )}
    >
      <input
        type="radio"
        name="modo-restauracao"
        value={valor}
        checked={ativo}
        onChange={() => onSelect(valor)}
        className="mt-1 accent-amber-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {descricao}
        </span>
      </span>
    </label>
  );
}
