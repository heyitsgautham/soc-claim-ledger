# Analytics methodology

## Claims and the claim-to-query mapping

Each CSE submits a self-assessment in four sections, timeliness, coverage, capability and staffing.
Every questionnaire item names the metric it attests, and `packages/claims/src/catalogue.ts` maps each metric to one query over the entity's own records.
The query states its method in plain words, lists the exports it needs, and carries a rule id and version.

| Kind | Tolerance before a difference is a gap |
|---|---|
| Share or fraction | 2 percentage points |
| Mean time | 10% of the attested value |
| Count | Must match |

A claim is a gap when the records fall short of it beyond tolerance, and holds otherwise.
A claim is insufficient evidence when an export it needs is missing or declared incomplete, when the lookback needs more quarters than were submitted, or when the population is empty.
Insufficient evidence is a statement about the submission, never about the SOC.

## Severity and SLAs

Alerts carry a severity, critical, high, medium or low, which the exports code as P1 to P4.
Every critical alert opens a triage case, and a case becomes an incident only on a true-positive verdict, so the screens say "critical alert" and keep "incident" for confirmed ones.
The simulated SOP sets these targets.

| Severity | Acknowledge | Escalate to L2 | Close the case |
|---|---|---|---|
| Critical | 5 minutes | 30 minutes | 1 hour |
| High | 15 minutes | when needed | 8 hours |
| Medium | 4 hours | rarely | 24 hours |

They sit inside common managed-SOC practice, which acknowledges critical alerts in 5 to 15 minutes, reaches a triage verdict and escalates in 15 to 30 minutes, triages high-severity alerts in about an hour, medium in 4 hours and low in 24 hours.
The one-hour close for a critical alert's triage is the lenient end of that range.
Those ranges come from vendor pages, so they are cited as common practice and not as a standard: [Q-Sec](https://q-sec.com/soc-knowledge-base/socaas-sla-metrics-benchmarks-reporting), [Atlas Systems](https://www.atlassystems.com/blog/sla-severity-levels) and [SOC Authority](https://socauthority.com/blog/soc-alert-triage-process/).

Nine of the sixteen claims carry the published obligation they report against, and the evidence drawer shows it beside the figure.

| Obligation | Clause | Claims |
|---|---|---|
| NCIIPC Guidelines for the Protection of NCII, v2.0 | OC2 8.2.3(a), escalation matrix | 1.1 |
| NCIIPC Guidelines v2.0, and for power entities CEA Guidelines 2021 | 6.3.6 and Article 5(b), a 24x7x365 security division | 4.1, 4.2 |
| Protected System Rules, 2018 | Rule 4(2)(j), SLAs shared with NCIIPC | 1.2, 1.4 |
| CEA Cyber Security in Power Sector Guidelines, 2021 | Article 5(c)(3), IDS and IPS in IT and OT | 2.1, power entities |
| CERT-In Directions, 28 April 2022 | Direction (iv), logs of all ICT systems | 2.1 to 2.4 |

Each clause was read in the issuer's own text, and `docs/research.md` quotes it.

## Detectors

| Detector | Question | Flag |
|---|---|---|
| SLA bunching | Do closures pile into the last minutes before the SLA? | The last 5-minute bucket before the SLA holds at least 8 closures and 3 times the average of the buckets before it in the hour |
| Templated notes | Are closure notes one paragraph with the hostname changed? | Five or more notes at cosine similarity 0.95 or above, over whitespace tokens |
| Negative space | Which asset class and ATT&CK tactic should show alerts and shows none? | Expected at least 3 alerts from sector peers' median rate per asset times the inventory, observed none |
| Weekend coverage | Does acknowledgement slow down at weekends? | Weekend median wait at least twice the weekday median, over 30 or more alerts |
| Repeat without remediation | Does one asset raise the same alert week after week, closed by automation, with no case? | Six or more distinct weeks, half or more closed by automation, no case on that asset and rule |

Negative space counts alerts once per asset, rule and hour, so a storm on one host does not set a class's expectation.
Its columns follow MITRE ATT&CK v19.2, where Defense Evasion became Stealth and Defense Impairment, plus Impair Process Control from ATT&CK for ICS for the OT rules.

## Findings and the supervisory risk indicator

Every gap and every flagged detector becomes a finding with a severity between 0 and 1.
Severity is stakes times extent.
Stakes say what rides on the finding, 1 for a claim about critical alerts or critical assets, 0.75 for high-severity, 0.5 for medium-severity and routine capability claims, and between 0.7 and 0.9 for the behavioural detectors.
Extent for a claim gap counts how many tolerances past the claim the records are, as 1 − e^(−tolerances / 4.5), so shares, times and counts compare on one footing.
P-04's escalation claim misses by 39 points against a 2-point tolerance, 19.6 tolerances, for a severity of 0.99.
The report lists findings most severe first.
A finding's weight in the risk indicator is its severity times the share of that detector's earlier flags that examiners confirmed.
The indicator is 100 × (1 − e^(−Σ weight / 2)), which rises quickly for the first findings and flattens after.
Earlier quarters are re-run with the current detectors and calibration, so the trend compares like with like.

## Sample sheet

Ten records per entity and cycle.
Greedy over findings in order of weight, each round gives every finding one more record, preferring a record that covers an uncovered finding and then one with a new combination of reasons.
Two places are held for a counterexample that meets the claims and a random pick seeded by entity and cycle.
It is a targeted review sample and not a prevalence estimate.

## Calibration

The examiner records a verdict before the tool's reasons are shown.
A verdict counts toward every detector that had flagged the record.
Precision is confirmed over confirmed plus rejected, and cannot-tell counts as reviewed only.
Issues found in counterexamples and random picks are the tool's measured miss.

## Synthetic data

The simulator runs a SOC rather than sampling rows.
Alerts arrive on a diurnal and weekday curve, L1 analysts on rotating shifts acknowledge them through a queue, and cases escalate and close under priority SLAs.
Behaviour toggles produce the findings as emergent behaviour, and the claims file is written from the intended process only.
The simulator keeps hidden ground truth labels beside each submission for validation, and no submission includes them.
