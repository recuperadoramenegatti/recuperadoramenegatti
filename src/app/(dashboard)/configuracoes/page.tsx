import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { AbaEmpresa } from '@/components/configuracoes/aba-empresa';
import { AbaParametros } from '@/components/configuracoes/aba-parametros';
import { AbaCentros } from '@/components/configuracoes/aba-centros';
import { AbaIA } from '@/components/configuracoes/aba-ia';
import { AbaBackup, type RegistroBackup } from '@/components/configuracoes/aba-backup';
import { AbaAparencia } from '@/components/configuracoes/aba-aparencia';
import { NavegacaoAbas } from '@/components/configuracoes/navegacao-abas';
import { PageHeader } from '@/components/comum/page-header';
import { Button } from '@/components/ui/button';
import { SkeletonKPI } from '@/components/ui/skeleton';
import { prisma } from '@/lib/prisma';
import { calcularDerivados, getConfigs, getContextoCalculo } from '@/lib/calculos';
import { decifrar, mascarar } from '@/lib/cripto';
import { historicoUsoIA } from '@/lib/ia';
import { listarBackups, ultimoBackup } from '@/lib/backup';

export const metadata: Metadata = { title: 'Configurações' };
export const dynamic = 'force-dynamic';

const ABAS = [
  { id: 'empresa', rotulo: 'Empresa' },
  { id: 'parametros', rotulo: 'Parâmetros financeiros' },
  { id: 'centros', rotulo: 'Centros de custo' },
  { id: 'clientes', rotulo: 'Clientes' },
  { id: 'ia', rotulo: 'Integração de IA' },
  { id: 'backup', rotulo: 'Backup e segurança' },
  { id: 'aparencia', rotulo: 'Aparência' },
] as const;

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PaginaConfiguracoes({ searchParams }: Props): React.JSX.Element {
  const bruto = searchParams.aba;
  const solicitada = Array.isArray(bruto) ? bruto[0] : bruto;
  const aba = ABAS.some((a) => a.id === solicitada) ? (solicitada as string) : 'empresa';

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Configurações"
        descricao="Tudo o que o sistema calcula parte destes valores. Alterá-los recalcula o sistema inteiro."
      />

      <NavegacaoAbas abas={[...ABAS]} ativa={aba} />

      <Suspense key={aba} fallback={<EsqueletoConfiguracoes />}>
        <ConteudoAba aba={aba} />
      </Suspense>
    </div>
  );
}

async function ConteudoAba({ aba }: { aba: string }): Promise<React.JSX.Element> {
  if (aba === 'clientes') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-card backdrop-blur-sm">
        <h3 className="text-sm font-semibold">A carteira de clientes tem tela própria</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Cadastro, edição e métricas de rentabilidade por cliente ficam em Clientes, com histórico
          de OS e classificação automática.
        </p>
        <Button asChild className="mt-4">
          <Link href="/clientes">
            <ExternalLink className="h-4 w-4" />
            Abrir Clientes
          </Link>
        </Button>
      </div>
    );
  }

  if (aba === 'parametros' || aba === 'centros') {
    const ctx = await getContextoCalculo();

    if (aba === 'centros') {
      const todos = await prisma.centroCusto.findMany({
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      });
      const derivados = calcularDerivados(ctx.parametros);

      return (
        <AbaCentros
          derivados={derivados}
          centros={todos.map((c) => ({
            id: c.id,
            nome: c.nome,
            slug: c.slug,
            qtdMaquinas: c.qtdMaquinas,
            qtdOperadores: c.qtdOperadores,
            thm: c.thmEstimado,
            thh: derivados.thh,
            cfr: derivados.cfr,
            custoHora: derivados.thh + c.thmEstimado + derivados.cfr,
            ordem: c.ordem,
            ativo: c.ativo,
          }))}
        />
      );
    }

    return <AbaParametros parametros={ctx.parametros} centros={ctx.centros} />;
  }

  if (aba === 'ia') {
    const [gerais, uso] = await Promise.all([
      getConfigs(['anthropicApiKey', 'anthropicModelo', 'iaGeracaoAutomatica']),
      historicoUsoIA(),
    ]);

    // A chave nunca sai do servidor — só os quatro últimos caracteres.
    const emClaro = decifrar(gerais.anthropicApiKey ?? '');
    const seguros: Record<string, string> = {
      ...gerais,
      anthropicApiKey: emClaro ? mascarar(emClaro) : '',
      anthropicApiKeyConfigurada: emClaro ? 'true' : 'false',
    };

    return (
      <AbaIA
        gerais={seguros}
        uso={{
          ...uso,
          ultimaGeracao: uso.ultimaGeracao ? uso.ultimaGeracao.toISOString() : null,
        }}
      />
    );
  }

  if (aba === 'backup') {
    const [backups, ultimo] = await Promise.all([listarBackups(30), ultimoBackup()]);
    const horasDesdeUltimo = ultimo
      ? Math.floor((Date.now() - ultimo.getTime()) / (60 * 60 * 1000))
      : null;

    const registros: RegistroBackup[] = backups.map((b) => ({
      id: b.id,
      tipo: b.tipo,
      filename: b.filename,
      tamanhoBytes: b.tamanhoBytes,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      disponivel: b.disponivel,
    }));

    return (
      <AbaBackup
        backups={registros}
        ultimoBackup={ultimo ? ultimo.toISOString() : null}
        horasDesdeUltimo={horasDesdeUltimo}
        alerta={horasDesdeUltimo === null || horasDesdeUltimo > 24 * 7}
      />
    );
  }

  const gerais = await getConfigs([
    'empresaNome',
    'empresaCnpj',
    'empresaEndereco',
    'empresaTelefone',
    'empresaEmail',
    'empresaLogo',
    'empresaSetor',
    'aparenciaDensidade',
    'aparenciaTema',
  ]);

  if (aba === 'aparencia') return <AbaAparencia gerais={gerais} />;

  return <AbaEmpresa gerais={gerais} />;
}

function EsqueletoConfiguracoes(): React.JSX.Element {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SkeletonKPI />
      <SkeletonKPI />
      <SkeletonKPI />
      <SkeletonKPI />
    </div>
  );
}
