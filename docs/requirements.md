# Requirements traceability

Every requirement in the problem statement, the screen that meets it, and the code behind it.
Paths are relative to the repository root.
The same list, without code paths, is the Method and sources screen at `/method`.

## Functional requirements

| # | Statement | Screen | Code |
|---|---|---|---|
| 1 | Ingest structured data from multiple CSEs | Submission, the quarter's signed report and records in two halves, and every screen after it for the 12 entities | `packages/submission/src/files.ts`, `apps/api/ledger_api/ingest.py` |
| 2 | Support common formats such as CSV, JSON, database exports and APIs | Newline-delimited JSON in both engines, CSV in the API's Parquet ingest. Database exports and APIs are not built | `packages/submission/src/files.ts`, `reader()` in `apps/api/ledger_api/ingest.py`, `test_a_csv_export_ingests_like_its_json_twin` |
| 3 | Analyse large datasets across entities and periods | Portfolio, 48 submissions and about 1.1 million alerts | `packages/claims/src/analyse/run.ts`, `apps/api/ledger_api/ledger.py` |
| 4 | Indicators of detection, investigation and escalation weaknesses | Ledger | `packages/claims/src/catalogue.ts`, `packages/claims/src/evaluate.ts` |
| 5 | Detect potential execution gaps | Ledger, evidence drawer | `packages/claims/src/evaluate.ts`, `apps/web/src/components/ledger/` |
| 6 | Detect potential negative space | Negative space | `packages/detect/src/negative-space.ts`, `apps/web/src/components/negative-space/` |
| 7 | Anomalies, outliers and suspicious operational patterns | Evidence drawer, portfolio | `packages/detect/src/bunching.ts`, `templated-notes.ts`, `coverage.ts` |
| 8 | Peer comparison and benchmarking across entities | Negative space, where sector peers set each expectation | `packages/detect/src/negative-space.ts` |
| 9 | Entity-level supervisory risk indicators | Portfolio | `packages/claims/src/analyse/analyse.ts` |
| 10 | Prioritise entities, controls, processes and alert samples | Portfolio, sample sheet | `packages/claims/src/analyse/analyse.ts`, `apps/web/src/components/samples/` |
| 11 | Clear rationale for findings | Evidence drawer, "How this was recomputed" | `packages/claims/src/catalogue.ts` |
| 12 | Present supporting evidence | Evidence drawer, the cases, notes and assets behind each gap | `apps/web/src/components/evidence/` |
| 13 | Traceability and auditability | SHA-256 per export, rule id and version per finding, audit log | `packages/submission/src/files.ts`, `packages/detect/src/registry.ts`, `apps/web/src/components/calibration/audit-log.tsx` |
| 14 | Let supervisors understand why an entity was flagged | Portfolio leading finding, the clause behind a claim | `packages/claims/src/analyse/run.ts`, `BASIS` in `packages/claims/src/catalogue.ts` |
| 15 | Supervisory dashboards and reports | Report, PDF rendered on this machine | `apps/web/src/components/report/`, `apps/web/src/app/api/report/[code]/route.ts` |
| 16 | Trend analysis across entities and time | Portfolio, four quarters per entity | `packages/claims/src/analyse/run.ts` |
| 17 | Drill-down from findings to evidence | Ledger row to evidence drawer to one case's chain | `apps/web/src/components/evidence/record-tables.tsx` |

## Deployment requirements

| Statement | How SOC Claim Ledger meets it | Proof |
|---|---|---|
| Operate fully offline and air-gapped | No part of the product calls a network | `apps/web/e2e/offline.test.ts`, `make offline-test` |
| No Internet connectivity | Fonts and assets are bundled, Next.js telemetry is off | `apps/web/src/app/layout.tsx`, `Dockerfile` |
| No cloud services or SaaS platforms | One Docker image, or a USB install | `Dockerfile`, `deploy/usb-install.sh` |
| No externally hosted AI models or APIs | No model at all, every finding comes from a versioned rule | `docs/model-card.md` |
| Local deployment and local data processing | DuckDB and Parquet on the examiner's machine | `apps/api/ledger_api/` |

Where AI or ML is proposed the statement asks for architecture, hardware, training, updates, explainability and audit.
SOC Claim Ledger proposes none, so `docs/model-card.md` states the hardware and the rule-update mechanism instead.

## Deliverables

| Statement | Where |
|---|---|
| Solution architecture | `docs/architecture.pdf`, two pages |
| Functional design | This file and the screens in `README.md` |
| Analytics methodology | `docs/methodology.md` |
| Data requirements | `packages/submission/src/schema.ts`, the submission contract |
| Tool or prototype | This repository |
| Infrastructure requirements | `docs/model-card.md` |
| Validation methodology | `docs/validation.md` |
| Deployment and operational requirements | `docs/architecture.md`, `deploy/` |
| Research behind it | `docs/research.md` |

## Illustrative use cases

| Statement | Where SOC Claim Ledger shows it |
|---|---|
| High-severity alerts closed unusually quickly | SLA bunching in the evidence drawer |
| Repeated alerts on the same asset without remediation | Repeat without remediation, G-01 |
| Critical alerts closed without escalation | Claim 1.1, P-04 |
| Critical systems with little or no telemetry | Claim 2.1 and negative space, P-04 |
| Significant deviations from peers | Negative space expectations from sector peers |
| Missing monitoring coverage for critical environments | Negative space, the OT row |
| Repetitive investigation patterns | Templated notes, P-04 and B-02 |
| Behaviour that satisfies metrics without managing risk | SLA bunching, P-04 |
| Workloads inconsistent with expected activity | Weekend coverage, T-07 |
