#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  Gera o instalador Windows de um clique (MenegattiERP-Setup.exe)
# ═══════════════════════════════════════════════════════════════════════════
#
# Empacota o código-fonte já commitado (via `git archive`, então arquivos
# fora do git — .env, node_modules, backups/ — nunca entram) junto com um
# Node.js portátil para Windows. O resultado é um único .exe: quem for
# instalar o sistema baixa esse arquivo, dá dois cliques e segue o
# assistente — sem precisar instalar Node.js separadamente.
#
# Isto roda na máquina de quem PREPARA o instalador (ex.: este ambiente de
# desenvolvimento), nunca na máquina de quem vai USAR o sistema.
#
# Requisitos aqui: makensis (`apt install nsis` no Debian/Ubuntu), curl,
# unzip, sha256sum, git, node.
#
# Uso: ./installer/windows/gerar-instalador.sh [versão-do-node-portátil]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$RAIZ/installer/windows"
BUILD="$DIR/build"
NODE_VERSAO="${1:-24.20.0}"
NODE_ZIP="node-v${NODE_VERSAO}-win-x64.zip"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSAO}/${NODE_ZIP}"

comando_existe() { command -v "$1" >/dev/null 2>&1; }

for cmd in makensis git curl unzip sha256sum node; do
  comando_existe "$cmd" || { echo "Falta o comando '$cmd'. Instale antes de continuar." >&2; exit 1; }
done

echo "== 1/6 · Limpando build anterior =="
rm -rf "$BUILD/app" "$BUILD/node-runtime"
mkdir -p "$BUILD/app" "$BUILD/cache" "$DIR/dist"

echo "== 2/6 · Empacotando o código-fonte (git archive HEAD) =="
# Só entra o que está commitado — garante que .env, node_modules, backups/
# e qualquer coisa fora do git nunca vão parar dentro do instalador.
git -C "$RAIZ" archive HEAD | tar -x -C "$BUILD/app"

# ── Quebras de linha: não é detalhe cosmético ─────────────────────────────
# O cmd.exe lê .bat por posição de byte e recalcula essa posição a cada
# goto/call assumindo 2 bytes por quebra de linha. Um .bat com quebra de
# linha do Unix faz a conta errar e a execução voltar no meio de uma linha —
# foi assim que o sistema chegou na empresa morrendo com
# "30 foi inesperado neste momento".
#
# O .gitattributes já cuida disso no git; esta conversão é o cinto de
# segurança para o caso de o arquivo chegar aqui de outro jeito.
echo "         convertendo .bat/.ps1 para CRLF"
find "$BUILD/app" \( -name '*.bat' -o -name '*.cmd' -o -name '*.ps1' \) -type f -print0 |
  while IFS= read -r -d '' arquivo; do
    sed -i 's/\r$//; s/$/\r/' "$arquivo"
  done

# Conferência: nenhum arquivo executável do Windows pode sair daqui com LF.
faltando=$(find "$BUILD/app" \( -name '*.bat' -o -name '*.ps1' \) -type f -exec sh -c \
  'file "$1" | grep -q CRLF || echo "$1"' _ {} \;)
if [ -n "$faltando" ]; then
  echo "ERRO: estes arquivos do Windows ficaram sem CRLF:" >&2
  echo "$faltando" >&2
  exit 1
fi

echo "== 3/6 · Baixando o Node.js portátil para Windows (v$NODE_VERSAO) =="
CACHE_ZIP="$BUILD/cache/$NODE_ZIP"
if [ ! -f "$CACHE_ZIP" ]; then
  curl -sL -o "$CACHE_ZIP" "$NODE_URL"
fi

echo "== 4/6 · Conferindo o checksum oficial do Node.js =="
CHECKSUM_ESPERADO=$(curl -s "https://nodejs.org/dist/v${NODE_VERSAO}/SHASUMS256.txt" | grep " ${NODE_ZIP}\$" | cut -d' ' -f1)
if [ -z "$CHECKSUM_ESPERADO" ]; then
  echo "Não foi possível obter o checksum oficial do Node.js $NODE_VERSAO em nodejs.org." >&2
  exit 1
fi
echo "$CHECKSUM_ESPERADO  $CACHE_ZIP" | sha256sum -c -

echo "== 5/6 · Extraindo o Node.js portátil =="
unzip -q "$CACHE_ZIP" -d "$BUILD"
mv "$BUILD/node-v${NODE_VERSAO}-win-x64" "$BUILD/node-runtime"

echo "== 6/6 · Compilando o instalador com makensis =="
VERSAO_APP="$(node -p "require('$RAIZ/package.json').version")"
makensis "-DVERSAO=$VERSAO_APP" "$DIR/menegatti.nsi"

echo
echo "Pronto: $DIR/dist/MenegattiERP-Setup.exe"
