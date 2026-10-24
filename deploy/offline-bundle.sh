#!/bin/sh
# Builds the image and writes everything an air-gapped install needs to dist/usb:
# the saved image, its SHA-256, and the install script. Copy dist/usb to a USB drive.
set -eu
cd "$(dirname "$0")/.."
docker build -t soc-claim-ledger:0.1 .
mkdir -p dist/usb/deploy
docker save soc-claim-ledger:0.1 -o dist/usb/soc-claim-ledger-0.1.tar
(cd dist/usb && shasum -a 256 soc-claim-ledger-0.1.tar > soc-claim-ledger-0.1.tar.sha256)
cp deploy/usb-install.sh dist/usb/deploy/usb-install.sh
echo "wrote dist/usb, $(du -sh dist/usb | cut -f1)"
