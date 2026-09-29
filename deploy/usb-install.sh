#!/bin/sh
# Run from the SOC Claim Ledger USB drive on the examiner's machine. Checks the image against its
# SHA-256, loads it into Docker and starts SOC Claim Ledger on http://127.0.0.1:3157. No network.
set -eu
drive="$(cd "$(dirname "$0")/.." && pwd)"
cd "$drive"
shasum -a 256 -c soc-claim-ledger-0.1.tar.sha256
docker load -i soc-claim-ledger-0.1.tar
docker rm -f soc-claim-ledger >/dev/null 2>&1 || true
docker run -d --name soc-claim-ledger --restart unless-stopped -p 127.0.0.1:3157:3157 soc-claim-ledger:0.1
echo "SOC Claim Ledger is starting on http://127.0.0.1:3157"
