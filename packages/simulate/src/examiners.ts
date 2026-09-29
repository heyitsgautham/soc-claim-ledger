import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { analyseCycle, cycleStartIso, VERDICT_HISTORY, type Verdict, type VerdictValue, Workspace } from "@ledger/claims";
import type { DetectorId } from "@ledger/detect";
import { submissionDir } from "@ledger/submission";
import { DAY, HOUR, istMidnight, MINUTE, QUARTERS, toIst } from "./calendar";
import { Rng } from "./rng";
import type { TruthLabel, TruthRow } from "./soc";
import { TRUTH_FILE } from "./writer";

// Examiner verdicts on past sample sheets, so calibration has history. For each past
// cycle the tool draws its sample sheets exactly as it would live, using only verdicts
// from earlier cycles, and a simulated examiner reviews each record blind. The examiner
// is right most of the time and knows only what the hidden ground truth says happened.

// A claim-gap record always shows the failure it was picked for, because the claim query
// is exact. The examiner is judging whether it matters, and mostly agrees.
const RELEVANT: Record<DetectorId, TruthLabel[] | "any" | "record"> = {
  "claim-gap": "record",
  "sla-bunching": ["sla_forced_close"],
  "templated-notes": ["templated_note"],
  "negative-space": ["ot_unenrolled"],
  "weekend-coverage": ["weekend_deferred", "weekend_understaffed"],
  "repeat-no-remediation": ["auto_close_repeat"],
};

const EXAMINERS = ["EX-01", "EX-02", "EX-03", "EX-04"];

function readTruth(dataDir: string, entity: string, quarter: string): Map<string, Set<TruthLabel>> {
  const dir = submissionDir(dataDir, entity, quarter);
  const rows = gunzipSync(readFileSync(path.join(dir, TRUTH_FILE)))
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as TruthRow);
  const labels = new Map<string, Set<TruthLabel>>();
  const add = (key: string, ls: TruthLabel[]) => {
    const cur = labels.get(key) ?? new Set();
    for (const l of ls) cur.add(l);
    labels.set(key, cur);
  };
  for (const r of rows) add(`${r.record}:${r.id}`, r.labels);
  return labels;
}

export function simulateExaminers(dataDir: string): Verdict[] {
  const ws = new Workspace(dataDir);
  const verdicts: Verdict[] = [];
  // The latest quarter is the live cycle. Its sheet waits for a real examiner.
  for (const quarter of QUARTERS.slice(0, -1)) {
    const cycle = quarter.id;
    const cycleStart = istMidnight(cycleStartIso(cycle));
    for (const analysis of analyseCycle(ws, cycle, verdicts)) {
      const truth = readTruth(dataDir, analysis.code, cycle);
      // Asset-level truth for repeats sits on the alerts. Lift it to the asset.
      const alerts = ws.submission(analysis.code, cycle).records.alerts ?? [];
      for (const a of alerts) {
        const l = truth.get(`alert:${a.id}`);
        if (!l) continue;
        const key = `asset:${a.asset_id}`;
        const cur = truth.get(key) ?? new Set();
        for (const x of l) cur.add(x);
        truth.set(key, cur);
      }
      const examiner = EXAMINERS[analysis.code.charCodeAt(0) % EXAMINERS.length]!;
      for (const item of analysis.samples.items) {
        const labels = truth.get(item.key) ?? new Set<TruthLabel>();
        const issue =
          item.pick === "finding"
            ? item.reasons.some((r) => {
                const rel = RELEVANT[r.detector.id];
                if (rel === "record") return true;
                return rel === "any" ? labels.size > 0 : rel.some((l) => labels.has(l));
              })
            : labels.size > 0;
        const rng = new Rng(`examiner/${analysis.code}/${cycle}/${item.key}`);
        const u = rng.next();
        const verdict: VerdictValue = issue
          ? u < 0.92
            ? "issue_confirmed"
            : u < 0.97
              ? "no_issue"
              : "cannot_tell"
          : u < 0.86
            ? "no_issue"
            : u < 0.93
              ? "issue_confirmed"
              : "cannot_tell";
        const at = cycleStart + rng.int(2, 20) * DAY + rng.int(10, 17) * HOUR + rng.int(0, 59) * MINUTE;
        verdicts.push({
          id: `V-${cycle}-${analysis.code}-${String(item.n).padStart(2, "0")}`,
          cycle,
          entity: analysis.code,
          itemKey: item.key,
          kind: item.kind,
          recordId: item.recordId,
          pick: item.pick,
          detectors: item.reasons.map((r) => r.detector).filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i),
          verdict,
          examiner,
          recordedAt: toIst(at),
          blind: true,
        });
      }
    }
  }
  verdicts.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : a.id < b.id ? -1 : 1));
  const file = path.join(dataDir, VERDICT_HISTORY);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${verdicts.map((v) => JSON.stringify(v)).join("\n")}\n`);
  return verdicts;
}
