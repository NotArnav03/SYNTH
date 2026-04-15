#!/usr/bin/env bash
# Boots all four specialist agents, waits for their /health endpoints, then
# starts the router. Equivalent to `npm run start:all` but usable directly.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "[start-all] missing .env — run \`npm run setup:wallets\` first." >&2
  exit 1
fi

exec npm run start:all
