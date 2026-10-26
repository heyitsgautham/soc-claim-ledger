# Contributing

Thanks for looking.
This file covers setup, the checks a change has to pass, and how commits are written here.

## Set up

Follow Install in the README, then confirm the suite passes before you change anything.

```bash
pnpm bootstrap
git config core.hooksPath .githooks
pnpm test
```

## Where things go

| Change | Lives in | Tested in |
|---|---|---|
| A new export or schema field | `packages/submission/src` | `packages/submission/test` |
| A new attested metric | `packages/claims/src/catalogue.ts`, and `QUERIES` and `REQUIRES` in `apps/api/ledger_api/ledger.py` | `packages/claims/test`, and the parity tests in `apps/api/tests` |
| A new detector | `packages/detect/src`, registered in `registry.ts` | `packages/detect/test` |
| A new behaviour in the simulated SOC | `packages/simulate/src` | `packages/simulate/test` |
| A screen or component | `apps/web/src` | `apps/web/test`, server-rendered markup for display components and happy-dom with Testing Library for interactive ones, `apps/web/e2e/offline.test.ts` for screens |
| A web API route | `apps/web/src/app/api` | `apps/web/test/*-route.test.ts`, calling the handler directly |
| A new environment variable | wherever it is read | `.env.example`, which `scripts/env-example.test.ts` checks |
| An API route | `apps/api/ledger_api/app.py` | `apps/api/tests` |

A metric has two implementations on purpose, one in TypeScript and one in DuckDB SQL.
Add both, or the parity test fails.

## Before you push

Run `pnpm format` first, then what CI runs.

```bash
pnpm lint
pnpm test                          # fails below the floors in vitest.config.ts and apps/api/pyproject.toml
pnpm --filter @ledger/web build
pnpm typecheck
pnpm start & pnpm test:e2e          # stop the server afterwards
pnpm audit:deps
```

Nothing in the product may call the network.
The end-to-end test fails on any request that leaves the origin, so a new font, script or image must ship inside the repository.

## Commits

Each commit is one change with the tests that prove it.
Messages follow Conventional Commits, `type(scope): subject`, with a lowercase imperative subject under 72 characters.
Scopes in use are `api`, `claims`, `detect`, `simulate`, `submission`, `web`, `deploy`, `deps` and `repo`.
Put the reason for the change in the body, one sentence per line.

## Data

Every record in `data/` is synthetic and comes from `pnpm simulate`.
Never commit real SOC exports, and never commit anything under `data/`.
Display names stay in `apps/web/.env.local`, and the pre-commit hook refuses a commit that contains one.
