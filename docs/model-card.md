# Model and hardware card

## Models

SOC Claim Ledger uses no machine-learning model, no LLM and no hosted service.
Every finding comes from a versioned, deterministic rule or statistic.

| Detector | Version | Kind |
|---|---|---|
| Claim versus evidence | 1.0.0 | Exact query per questionnaire metric, fixed tolerances |
| SLA bunching | 1.0.0 | Five-minute histogram, the bucket under the SLA against the hour before it |
| Templated notes | 1.1.0 | Cosine similarity over term frequencies, single-link clusters |
| Negative space | 1.1.0 | Sector-peer median rate per asset times inventory, over ATT&CK v19.2 tactics |
| Weekend coverage | 1.0.0 | Ratio of median acknowledgement times |
| Repeat without remediation | 1.0.0 | Distinct-week count with automation share |

Templated notes moved from 1.0.0 to 1.1.0 after examiners confirmed only 11% of 1.0.0's flags, and the calibration screen shows the effect.

## Data

Twelve simulated CSEs across six sectors, four quarterly submissions each, 1.1 million alerts and 19 thousand cases.
No real organisation, person or record appears anywhere.

## Hardware

| | Target, to benchmark | Prototype run |
|---|---|---|
| CPU | 8 cores | Laptop, 12 cores |
| Memory | 16 GB, 32 GB for large batches | 16 GB |
| Disk | 20 GB free | Under 1 GB with the image |
| GPU | None | None |
| Network | None | None |

The full analysis of all 48 submissions used 9.7 seconds of processor time in the demo build, measured while other jobs loaded the machine.
Earlier wall-clock runs on the same machine took between 7 and 14 seconds.
The Portfolio screen shows processor time rather than wall-clock time, so other programs cannot inflate it.
The portfolio screen shows the time of the latest run.
