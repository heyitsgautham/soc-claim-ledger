<h1 align="center">SOC Claim Ledger</h1>

<p align="center">What a critical-sector entity signs about its SOC, checked line by line against its own records.</p>

<p align="center"><img src="docs/hero.png" alt="P-04's signed self-assessment after the check: 12 lines hold, 1 cannot be tested, and 3 are struck through with the recomputed figures beside them" width="100%"></p>

Every quarter, a critical-sector entity sends NCIIPC a signed self-assessment of its SOC, and the SOC's own alert and case records.
The ledger recomputes every attested figure from those records, opens each broken claim onto the alerts behind it, and finds what should be in the records and is not.
It runs on one machine, with no network, no cloud and no hosted model.

| P-04, one quarter | Attested | Its own records |
|---|---|---|
| Critical alerts reviewed by L2 within 30 minutes | 100% | 61% |
| Mean time to triage a critical alert | 32 m | 60 m |
| Critical OT assets under monitoring | 38 of 38 | 0 of 38 |

A third of P-04's critical alerts close in the last 5 minutes before their 60-minute deadline, and 12 of its closure notes are one pasted paragraph.
Synthetic data from a simulated SOC. A working prototype, not deployed at NCIIPC.

## Run it

```bash
pnpm bootstrap   # the workspace and the API's virtualenv
pnpm demo        # simulate, analyse, build, and serve on http://localhost:3157
```

Offline, `docker compose up` runs the same thing, and `make offline-test` runs the demo with networking removed.
Names for the demo video are local settings in `apps/web/.env.local`, which git ignores, so run `git config core.hooksPath .githooks` once per clone.

## Inside

```
apps/web/            Next.js app, every screen, self-hosted fonts, no request leaves the machine
apps/api/            FastAPI over DuckDB and Parquet, the same ledger recomputed in SQL
packages/claims/     each attested figure mapped to a query over the records, findings, risk, sampling
packages/detect/     SLA bunching, pasted notes, negative space, weekend coverage, repeat alerts
packages/simulate/   a seeded SOC: analysts, shifts, queues, SLAs and the habits behind each finding
packages/submission/ the submission contract, schemas and SHA-256 checked loader
deploy/              one Docker image and a USB install for an air-gapped machine
recording/           the scripted demo take and its voiceover
```

[Architecture](docs/architecture.pdf) · [Methodology](docs/methodology.md) · [Validation](docs/validation.md) · [Requirements](docs/requirements.md) · [Research](docs/research.md)

<sub>MIT licensed. Team 1, Saveetha Engineering College.</sub>
