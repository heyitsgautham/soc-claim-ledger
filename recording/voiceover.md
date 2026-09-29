# SOC Claim Ledger demo voiceover

Read over `recording/out/demo.mp4`, which runs 1:58.5.
230 spoken words in 118.5 seconds, 116 words a minute over the whole cut.
The busiest line runs at 120 words a minute and the slowest at 111, with numbers counted as they are said.
Every number in a line is on screen while the line plays, read from the same analysis the screen renders.

## How to record

1. Record one file per line, in a quiet room, about a hand's width from the microphone.
   Leave half a second of silence before and after each line.
2. Read calmly. Every line fits its window at a relaxed pace, so there is never a reason to hurry.
3. Save the files into `recording/vo/` with the names in the table, as .wav, .m4a, .mp3 or .aiff.
4. Run `pnpm mux`. It places each line at its scene start, warns if a line runs past its window, evens out the loudness and writes `recording/out/demo-final.mp4`.

Say the names this way.

- P-04 as P zero four.
- NCIIPC letter by letter, N C I I P C.
- SOC as sock.

## Lines

| File | Start | End | On screen | Line to read | Words | Pace |
|---|---|---|---|---|---|---|
| `01-world` | 0:00 | 0:16.5 | P-04 as a picture: its data centre, DMZ, endpoints and cloud, one square per asset, its OT substations below, and the SOC with its analysts. Alerts flow in as dots, and one critical alert is followed from alert to case to L2 to closure. Lower third with SOC Claim Ledger, NTRO and NCIIPC, Team 1 | This is P-04. It runs part of India's power grid. Its security team, the SOC, watches every alert its systems raise, and escalates the serious ones to a senior analyst. | 32 | 116 |
| `02-check` | 0:16.5 | 0:34.5 | The quarter's submission is sent to NCIIPC in two halves, the signed report and the records. The report grows out of the folder. Click Check: a rule sweeps down it, 12 lines go quiet, 1 turns dashed, 3 are struck through with the recomputed figure in red, and the report becomes the ledger | Each quarter, it sends NCIIPC a signed report, and its own records. SOC Claim Ledger checks every line against those records. Twelve claims hold. One cannot be tested. Three do not. | 36 | 120 |
| `03-gap` | 0:34.5 | 0:53 | Click row 1.1. The drawer opens: attested 100%, recomputed 61%. 138 marks, one per critical alert, colour and sort, 47 red with no escalation record, and the closure histogram rises. Edit zoom on the spike, 33% in the last 5 minutes before the SLA | It signed that every critical alert is escalated within 30 minutes. Its records say 61 percent. Forty-seven have no escalation record. And 33 percent close in the last 5 minutes before the deadline. | 36 | 117 |
| `04-notes` | 0:53 | 1:03 | Open the 12 templated notes. The closure notes lie on one another, blurred where the hostnames differ, then register into one crisp paragraph. Edit zoom | Twelve of those closure notes, laid on top of one another, are the same paragraph. Only the hostname changes. | 19 | 114 |
| `05-negative-space` | 1:03 | 1:18.5 | Negative space for P-04, drawn as the estate: IT lit by alerts, the OT substations outlined in red and silent, about 3,483 alerts expected. Ring on the OT row, then the grid by ATT&CK tactic, where the OT row flips to red zeros | Negative space is what should be there, and is not. P-04's grid control systems should have raised about 3,483 alerts. They raised none. | 30 | 116 |
| `06-portfolio` | 1:18.5 | 1:29.5 | Portfolio. 12 entities glide from filing order into risk order. 6 have findings, P-04 and T-07 first, and the clean ones hold on every claim. Ring on the headline | The same checks run across all 12 entities, so examiners know where to start, and which ones hold on every claim. | 21 | 115 |
| `07-samples` | 1:29.5 | 1:41 | Sample sheet, 10 records for manual review with the tool's reasons hidden. Open record 01, confirm the issue, and the tool's reasons are revealed | Examiners already read samples by hand. SOC Claim Ledger picks the 10 most worth reading, and shows why only after the examiner decides. | 23 | 120 |
| `08-method` | 1:41 | 1:52 | How we built it: one card per source the team read, each with its clause, and the synthetic data counts | We built it from the statement and the rules these sectors follow, read them ourselves, and spoke with a SOC analyst. | 21 | 115 |
| `09-end-card` | 1:52 | 1:58.5 | End card, SOC Claim Ledger, NTRO and NCIIPC, Team 1, working prototype on synthetic data | A working prototype on synthetic data, by Team 1, Saveetha Engineering College. | 12 | 111 |

Generated from `recording/storyboard.ts` by `pnpm record` and `pnpm voiceover`. Edit the storyboard, not this file.
