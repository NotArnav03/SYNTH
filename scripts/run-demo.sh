#!/usr/bin/env bash
# Fires the demo queries at a running router. Expects agents + router to
# already be up (run scripts/start-all.sh in another terminal first).

set -euo pipefail

cd "$(dirname "$0")/.."

ROUTER_URL="${ROUTER_URL:-http://localhost:3000}"

echo "[run-demo] router: ${ROUTER_URL}"
if ! curl -fsS "${ROUTER_URL}/health" > /dev/null 2>&1; then
  echo "[run-demo] router not reachable — start it first with scripts/start-all.sh" >&2
  exit 1
fi

exec npm run demo
