# Changelog

All notable changes to this project are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Coverage floors for the unit tests with c8 and for the API tests with pytest-cov.
- `pnpm coverage` and `pnpm audit:deps`.
- CI jobs for the dependency audit and a gitleaks secret scan.
- `apps/api/uv.lock`, so the API installs the same Python packages everywhere.
- `.env.example`, `CONTRIBUTING.md` and this changelog.

### Changed

- The Dockerfile moved from `deploy/` to the repository root.
- The README covers install, run, test, configuration and architecture.

### Security

- next 16.4.3, zod 4.6.7 and shadcn 4.22.1, with pnpm overrides for body-parser, source-map-js and undici.
- fastapi 0.162.0 with starlette 1.10.0, and pytest 9.1.1.

## 0.1.0 - 2026-09-29

### Added

- The submission contract with zod schemas and a SHA-256 checked loader.
- The claim ledger, which recomputes sixteen attested metrics from the records.
- Detectors for SLA bunching, pasted notes, negative space, weekend coverage and repeat alerts.
- The seeded SOC simulator and the claims writer.
- The FastAPI and DuckDB service with the SQL ledger and its parity test.
- The examiner screens, from the signed report to the exported report.
- One offline Docker image and a USB install.
