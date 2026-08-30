#!/usr/bin/env bash
# Sobe o sistema. Use quando a inicialização automática não estiver ativa.
set -uo pipefail
cd "$(dirname "$0")"

if [ ! -d ".next" ]; then
  printf '\n  O sistema ainda não foi instalado nesta pasta.\n'
  printf '  Rode ./instalar.sh primeiro.\n\n'
  exit 1
fi

# Porta configurável: 3000 é o padrão, mas pode estar ocupada por outro
# programa. Basta rodar  PORT=3001 ./iniciar.sh
export PORT="${PORT:-3000}"

node scripts/rede.mjs "$PORT"
exec npm run start:rede
