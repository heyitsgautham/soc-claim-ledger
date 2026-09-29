#!/bin/sh
# The network-off proof. Runs the image with networking removed altogether, waits for
# the app, then drives every screen from inside the container with the offline test,
# which fails on any request that leaves the origin. Nothing can reach the internet here.
set -eu
cd "$(dirname "$0")/.."
docker image inspect soc-claim-ledger:0.1 >/dev/null 2>&1 || docker build -f deploy/Dockerfile -t soc-claim-ledger:0.1 .
docker rm -f soc-claim-ledger-offline >/dev/null 2>&1 || true
docker run -d --name soc-claim-ledger-offline --network none soc-claim-ledger:0.1 >/dev/null
trap 'docker rm -f soc-claim-ledger-offline >/dev/null 2>&1 || true' EXIT
echo "network interfaces inside the container:"
docker exec soc-claim-ledger-offline sh -c 'ls /sys/class/net'
i=0
until docker exec soc-claim-ledger-offline curl -fsS http://127.0.0.1:3157/title >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -gt 60 ] && { docker logs soc-claim-ledger-offline; exit 1; }
  sleep 2
done
docker exec soc-claim-ledger-offline sh -c 'curl -fsS http://127.0.0.1:8157/health && echo'
docker exec -e LEDGER_URL=http://127.0.0.1:3157 soc-claim-ledger-offline pnpm test:e2e
echo "offline test passed with no network"
