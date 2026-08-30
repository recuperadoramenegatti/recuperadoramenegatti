#!/usr/bin/env bash
#
# Instalação do sistema de gestão da Recuperadora Menegatti — Linux e macOS.
# Uso:  ./instalar.sh
#
set -uo pipefail
cd "$(dirname "$0")"

VERDE=$'\033[32m'; VERMELHO=$'\033[31m'; AMARELO=$'\033[33m'
NEGRITO=$'\033[1m'; CINZA=$'\033[90m'; FIM=$'\033[0m'

titulo() { printf '\n%s%s%s\n' "$NEGRITO" "$1" "$FIM"; }
passo()  { printf '\n  %s[%s]%s %s\n\n' "$CINZA" "$1" "$FIM" "$2"; }
ok()     { printf '  %s✓%s %s\n' "$VERDE" "$FIM" "$1"; }
falha()  { printf '  %s✗%s %s\n' "$VERMELHO" "$FIM" "$1"; }

abortar() {
  printf '\n%s════════════════════════════════════════════════════════%s\n' "$VERMELHO" "$FIM"
  falha "A instalação parou: $1"
  printf '\n  O que costuma resolver:\n'
  printf '    · conferir a conexão com a internet\n'
  printf '      %s(só a instalação precisa dela; o uso diário não)%s\n' "$CINZA" "$FIM"
  printf '    · conferir se há espaço em disco\n'
  printf '\n'
  exit 1
}

titulo "════════════════════════════════════════════════════════"
titulo "  RECUPERADORA MENEGATTI"
printf '  %sInstalação do sistema de gestão financeira%s\n' "$CINZA" "$FIM"
titulo "════════════════════════════════════════════════════════"

# ── Node.js ──────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  falha "O Node.js não está instalado neste computador."
  printf '\n    O sistema precisa dele para funcionar.\n'
  printf '    Instale a versão LTS a partir de %shttps://nodejs.org%s\n' "$CINZA" "$FIM"
  printf '    e rode este instalador novamente.\n\n'
  exit 1
fi

passo "1/5" "Instalando os componentes do sistema…"
npm install --no-audit --no-fund || abortar "não foi possível instalar os componentes."

passo "2/5" "Preparando a configuração…"
node scripts/preparar-ambiente.mjs || abortar "não foi possível preparar a configuração."

passo "3/5" "Criando o banco de dados…"
npm run setup || abortar "não foi possível criar o banco de dados."

passo "4/5" "Compilando o sistema… (etapa mais demorada)"
npm run build || abortar "a compilação falhou."

passo "5/5" "Configurando a inicialização automática…"
if command -v systemctl >/dev/null 2>&1 && [ -d "$HOME/.config" ]; then
  DESTINO="$HOME/.config/systemd/user"
  mkdir -p "$DESTINO"
  sed -e "s|__PASTA__|$(pwd)|g" \
      -e "s|__NODE__|$(command -v npm)|g" \
      scripts/linux/menegatti.service > "$DESTINO/menegatti.service"

  if systemctl --user daemon-reload 2>/dev/null &&
     systemctl --user enable menegatti.service 2>/dev/null; then
    ok "O sistema passa a iniciar sozinho com o computador."
    printf '    %sPara que suba mesmo sem login aberto:%s\n' "$CINZA" "$FIM"
    printf '    %ssudo loginctl enable-linger %s%s\n' "$CINZA" "$USER" "$FIM"
    systemctl --user restart menegatti.service 2>/dev/null || true
  else
    printf '  %s!%s systemd disponível, mas não foi possível habilitar o serviço.\n' "$AMARELO" "$FIM"
    printf '    O sistema funciona: use %s./iniciar.sh%s\n' "$CINZA" "$FIM"
  fi
else
  printf '  %s!%s Sem systemd — inicialização automática não configurada.\n' "$AMARELO" "$FIM"
  printf '    Para usar o sistema, rode %s./iniciar.sh%s\n' "$CINZA" "$FIM"
fi

printf '\n%s════════════════════════════════════════════════════════%s\n' "$VERDE" "$FIM"
printf '%s  INSTALAÇÃO CONCLUÍDA%s\n' "$NEGRITO" "$FIM"
printf '%s════════════════════════════════════════════════════════%s\n' "$VERDE" "$FIM"

node scripts/rede.mjs 3000 --instalado

printf '  %sSenha inicial: menegatti2024%s\n' "$CINZA" "$FIM"
printf '  %sTroque-a no primeiro acesso, em Configurações.%s\n\n' "$AMARELO" "$FIM"
