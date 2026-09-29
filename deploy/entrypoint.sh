#!/bin/sh
# Starts the API on 8157 and the web app on 3157. Both listen on this container only.
set -eu
cd /app
apps/api/.venv/bin/python -m ledger_api ingest
apps/api/.venv/bin/python -m ledger_api serve --host 0.0.0.0 --port 8157 &
exec pnpm --filter @ledger/web exec next start --hostname 0.0.0.0 --port 3157
