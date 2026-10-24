# Shortcuts for the deploy scripts. Day-to-day work uses pnpm, see the README.

.PHONY: image offline-test usb

image:
	docker build -t soc-claim-ledger:0.1 .

offline-test:
	sh deploy/offline-test.sh

usb:
	sh deploy/offline-bundle.sh
