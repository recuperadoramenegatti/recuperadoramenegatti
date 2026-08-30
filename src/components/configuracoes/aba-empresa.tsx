'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, KeyRound, Save, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/comum/logo';
import { extrairMensagemErro } from '@/lib/utils';

const TAMANHO_MAX_LOGO = 512 * 1024; // 512 KB

const CAMPOS: Array<{ chave: string; rotulo: string; placeholder: string; tipo?: string }> = [
  { chave: 'empresaNome', rotulo: 'Nome / Razão social', placeholder: 'Recuperadora Menegatti' },
  { chave: 'empresaCnpj', rotulo: 'CNPJ', placeholder: '00.000.000/0001-00' },
  { chave: 'empresaSetor', rotulo: 'Setor de atuação', placeholder: 'Usinagem, Solda, Caldeiraria…' },
  { chave: 'empresaTelefone', rotulo: 'Telefone / WhatsApp', placeholder: '(00) 00000-0000' },
  { chave: 'empresaEmail', rotulo: 'E-mail', placeholder: 'contato@empresa.com.br', tipo: 'email' },
  { chave: 'empresaEndereco', rotulo: 'Endereço', placeholder: 'Rua, número, bairro, cidade / UF' },
];

export function AbaEmpresa({ gerais }: { gerais: Record<string, string> }): React.JSX.Element {
  const router = useRouter();
  const [valores, setValores] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS.map((c) => [c.chave, gerais[c.chave] ?? ''])),
  );
  const [logo, setLogo] = React.useState(gerais.empresaLogo ?? '');
  const [salvando, setSalvando] = React.useState(false);
  const inputLogo = React.useRef<HTMLInputElement>(null);

  const enviarLogo = (arquivo: File): void => {
    if (!arquivo.type.startsWith('image/')) {
      toast.error('O logo precisa ser uma imagem (PNG, JPG ou SVG).');
      return;
    }
    if (arquivo.size > TAMANHO_MAX_LOGO) {
      toast.error('A imagem passa de 512 KB. Reduza o arquivo antes de enviar.');
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === 'string') {
        setLogo(leitor.result);
        toast.success('Logo carregado. Salve para aplicar.');
      }
    };
    leitor.onerror = () => toast.error('Não foi possível ler o arquivo.');
    leitor.readAsDataURL(arquivo);
  };

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    try {
      const resposta = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: { ...valores, empresaLogo: logo } }),
      });
      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível salvar os dados da empresa.',
        );
      }
      toast.success('Dados da empresa salvos.');
      router.refresh();
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Building2 className="h-4 w-4 text-primary" aria-hidden />
          Identificação da empresa
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Estes dados aparecem no cabeçalho dos orçamentos em PDF.
        </p>

        <div className="mt-4 space-y-4">
          {CAMPOS.map((campo) => (
            <div key={campo.chave} className="space-y-1.5">
              <Label htmlFor={campo.chave}>{campo.rotulo}</Label>
              <Input
                id={campo.chave}
                type={campo.tipo ?? 'text'}
                value={valores[campo.chave] ?? ''}
                onChange={(e) =>
                  setValores((atual) => ({ ...atual, [campo.chave]: e.target.value }))
                }
                placeholder={campo.placeholder}
              />
            </div>
          ))}

          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-4 rounded-xl border border-[var(--borda-1)] bg-[var(--superficie-2)] p-4">
              <Logo tamanho={56} src={logo || undefined} />
              <div className="min-w-0 flex-1">
                <input
                  ref={inputLogo}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    if (arquivo) enviarLogo(arquivo);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => inputLogo.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {logo ? 'Trocar logo' : 'Enviar logo'}
                  </Button>
                  {logo ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setLogo('')}
                      className="text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                      Remover
                    </Button>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  PNG, JPG, SVG ou WebP, até 512 KB. Sem logo, o sistema usa a marca padrão.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button onClick={() => void salvar()} carregando={salvando} className="mt-5 w-full">
          {!salvando ? <Save className="h-4 w-4" /> : null}
          Salvar dados da empresa
        </Button>
      </section>

      <TrocarSenha />
    </div>
  );
}

function TrocarSenha(): React.JSX.Element {
  const [senhaAtual, setSenhaAtual] = React.useState('');
  const [novaSenha, setNovaSenha] = React.useState('');
  const [confirmar, setConfirmar] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  const forca = React.useMemo(() => {
    if (novaSenha.length === 0) return null;
    let pontos = 0;
    if (novaSenha.length >= 8) pontos += 1;
    if (novaSenha.length >= 12) pontos += 1;
    if (/[a-z]/.test(novaSenha) && /[A-Z]/.test(novaSenha)) pontos += 1;
    if (/\d/.test(novaSenha)) pontos += 1;
    if (/[^A-Za-z0-9]/.test(novaSenha)) pontos += 1;
    if (pontos <= 2) return { rotulo: 'Fraca', cor: 'text-red-400', largura: 33 };
    if (pontos <= 3) return { rotulo: 'Razoável', cor: 'text-amber-400', largura: 66 };
    return { rotulo: 'Forte', cor: 'text-emerald-400', largura: 100 };
  }, [novaSenha]);

  const trocar = async (): Promise<void> => {
    if (novaSenha !== confirmar) {
      toast.error('As senhas não conferem.');
      return;
    }
    if (novaSenha.length < 8) {
      toast.error('A nova senha precisa de ao menos 8 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      const resposta = await fetch('/api/configuracoes/senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha, confirmarSenha: confirmar }),
      });

      const corpo: unknown = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          typeof corpo === 'object' && corpo !== null && 'erro' in corpo
            ? String((corpo as { erro: unknown }).erro)
            : 'Não foi possível trocar a senha.',
        );
      }

      toast.success('Senha alterada. Use a nova no próximo acesso.');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmar('');
    } catch (erro) {
      toast.error(extrairMensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="h-fit rounded-2xl border border-[var(--borda-1)] bg-[var(--superficie-1)] p-5 shadow-card backdrop-blur-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden />
        Credenciais de acesso
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Troque a senha inicial assim que possível. Ela protege todos os dados financeiros da
        empresa.
      </p>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="senha-atual">Senha atual</Label>
          <Input
            id="senha-atual"
            type="password"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
          {forca ? (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--superficie-4)]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    forca.largura === 100
                      ? 'bg-gradient-sucesso'
                      : forca.largura === 66
                        ? 'bg-gradient-hero'
                        : 'bg-gradient-alerta'
                  }`}
                  style={{ width: `${forca.largura}%` }}
                />
              </div>
              <span className={`text-[11px] font-medium ${forca.cor}`}>{forca.rotulo}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
          <Input
            id="confirmar-senha"
            type="password"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
          {confirmar && novaSenha !== confirmar ? (
            <p className="text-xs text-red-400">As senhas não conferem.</p>
          ) : null}
        </div>
      </div>

      <Button
        onClick={() => void trocar()}
        carregando={salvando}
        disabled={!senhaAtual || !novaSenha || !confirmar}
        className="mt-5 w-full"
      >
        {!salvando ? <KeyRound className="h-4 w-4" /> : null}
        Trocar senha
      </Button>
    </section>
  );
}
