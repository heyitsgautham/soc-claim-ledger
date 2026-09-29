import { DETECTOR_IDS, DETECTORS, type DetectorId, versionFor } from "@ledger/detect";
import type { AuditEntry, Calibration, CalibrationCell, Verdict } from "./types";

// Calibration: how often examiners confirmed what each detector flagged. A verdict counts
// for every detector the tool had attached to the record, and "cannot tell" counts as
// reviewed but in neither direction.

export interface CycleRef {
  id: string;
  label: string;
}

function tally(verdicts: Verdict[]) {
  const confirmed = verdicts.filter((v) => v.verdict === "issue_confirmed").length;
  const rejected = verdicts.filter((v) => v.verdict === "no_issue").length;
  const unsure = verdicts.length - confirmed - rejected;
  return { reviewed: verdicts.length, confirmed, rejected, unsure, precision: confirmed + rejected ? confirmed / (confirmed + rejected) : null };
}

// Confirmed share for a detector from every verdict recorded before `cycle`.
// The most recent version wins once it has ten verdicts behind it.
export function priorPrecision(verdicts: readonly Verdict[], detector: DetectorId, cycle: string): number | null {
  const prior = verdicts.filter((v) => v.cycle < cycle && v.detectors.some((d) => d.id === detector));
  if (!prior.length) return null;
  const version = versionFor(detector, cycle).version;
  const same = prior.filter((v) => v.detectors.some((d) => d.id === detector && d.version === version));
  return tally(same.length >= 10 ? same : prior).precision;
}

export function calibrate(verdicts: readonly Verdict[], cycles: CycleRef[], extraAudit: AuditEntry[] = []): Calibration {
  const rows = DETECTOR_IDS.map((id) => {
    const cells: CalibrationCell[] = cycles.map((c) => {
      const vs = verdicts.filter((v) => v.cycle === c.id && v.detectors.some((d) => d.id === id));
      return { cycle: c.id, version: versionFor(id, c.id).version, ...tally(vs) };
    });
    const all = tally(verdicts.filter((v) => v.detectors.some((d) => d.id === id)));
    return { detector: DETECTORS[id], cells, pooled: { reviewed: all.reviewed, confirmed: all.confirmed, rejected: all.rejected, precision: all.precision } };
  });

  const controls = cycles.map((c) => {
    const vs = verdicts.filter((v) => v.cycle === c.id && v.pick !== "finding");
    return { cycle: c.id, reviewed: vs.length, issues: vs.filter((v) => v.verdict === "issue_confirmed").length };
  });

  const audit: AuditEntry[] = [...extraAudit];
  for (const v of verdicts) {
    audit.push({
      at: v.recordedAt,
      actor: v.examiner,
      action: "verdict_recorded",
      subject: `${v.entity} ${v.recordId}`,
      detail: `${v.verdict.replace("_", " ")}${v.blind ? ", blind" : ""}, ${v.detectors.length ? `${v.detectors.length} detector${v.detectors.length > 1 ? "s" : ""}` : `${v.pick} pick`}`,
    });
  }
  for (const id of DETECTOR_IDS) {
    for (const ver of DETECTORS[id].versions) {
      const cycle = cycles.find((c) => c.id === ver.from);
      audit.push({ at: `${cycleStartIso(ver.from)}T09:00:00+05:30`, actor: "SYSTEM", action: "detector_released", subject: `${id} ${ver.version}`, detail: ver.change + (cycle ? `, first used in ${cycle.label}` : "") });
    }
  }
  audit.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.subject < b.subject ? -1 : 1));

  return { cycles, rows, controls, verdicts: verdicts.length, audit };
}

// An assessment cycle is run after the quarter's submission arrives. FY26-Q2 covers July
// to September 2025 and its submission lands in October, so the cycle opens in November.
export function cycleStartIso(cycle: string): string {
  const m = /^FY(\d{2})-Q([1-4])$/.exec(cycle);
  if (!m) return "2026-01-01";
  const fy = 2000 + Number(m[1]);
  const q = Number(m[2]);
  // Q1 is April to June of fy-1, so its cycle opens in August of fy-1.
  const month = [8, 11, 2, 5][q - 1]!;
  const year = q <= 2 ? fy - 1 : fy;
  return `${year}-${String(month).padStart(2, "0")}-03`;
}
