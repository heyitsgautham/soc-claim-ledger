# Validation plan

## What is measured in the prototype today

`pnpm test` checks that every run of the simulator is identical, that P-04's findings emerge from its toggles, that the clean control S-03 holds on every claim, and that a missing export turns a gap into insufficient evidence.
The API parity test recomputes the ledger in DuckDB SQL for all twelve entities and fails on any difference from the TypeScript engine.
The end-to-end test fails if any screen makes a request that leaves the machine.
Calibration shows detector precision against 309 simulated blind verdicts across three past cycles, with ground truth from the simulator's hidden labels.

## What the numbers do not show yet

Simulated examiners are right about 90% of the time by construction.
Their verdicts test the calibration machinery and not the detectors' real precision.
No real CSE data has been used, and none of the figures is a claim about any real entity.

## Plan with NCIIPC examiners

1. Seeded ground truth first. Run every detector against simulator scenarios with known labels, including benign controls such as maintenance windows, backup agents and noisy but reviewed hosts.
2. Two independent SOC practitioners review a blinded, mixed sample of records and entity-period findings, recording verdicts before seeing the tool's view.
3. Measure precision and recall of expert-confirmed weaknesses, unsupported conclusions, and examiner time at the same review budget.
4. Resolve disagreements between the two reviewers explicitly, with Cohen's kappa of 0.7 or above as the bar for a detector to be trusted.
5. Keep an untouched entity-period holdout for the final measurement.

Without the experts, only fixture checks are reported and expert equivalence is marked unvalidated.
