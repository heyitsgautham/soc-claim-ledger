import type { ClaimEvaluation, Measure } from "@ledger/claims/model";
import { durationShort, int } from "./format";

// Each ledger row draws its claim and its evidence on the claim's own number line:
// 0 to 100 for a percentage, 0 to the inventory size for "38 of 38", 0 to a little
// past the SLA for a time. The red bar is the distance between the two marks.

export interface Track {
  max: number;
  attested: number;
  recomputed: number | null;
  startLabel: string;
  endLabel: string;
  reference: { at: number; label: string } | null;
}

function niceCeil(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step) * step);
}

function onAxis(m: Measure, unit: "percent" | "fraction" | "minutes" | "count"): number {
  switch (m.kind) {
    case "percent":
      return m.value;
    case "fraction":
      return unit === "fraction" ? m.numerator : (m.numerator / m.denominator) * 100;
    case "duration":
      return m.seconds / 60;
    case "count":
      return m.value;
  }
}

export function track(e: ClaimEvaluation): Track {
  const a = e.claim.attested;
  const r = e.recomputed;

  if (a.kind === "fraction") {
    const sameBase = !r || (r.kind === "fraction" && r.denominator === a.denominator);
    if (sameBase) {
      return {
        max: a.denominator,
        attested: a.numerator,
        recomputed: r ? onAxis(r, "fraction") : null,
        startLabel: "0",
        endLabel: int(a.denominator),
        reference: null,
      };
    }
    return { max: 100, attested: onAxis(a, "percent"), recomputed: onAxis(r!, "percent"), startLabel: "0%", endLabel: "100%", reference: null };
  }

  if (a.kind === "percent") {
    return { max: 100, attested: a.value, recomputed: r ? onAxis(r, "percent") : null, startLabel: "0%", endLabel: "100%", reference: null };
  }

  if (a.kind === "duration") {
    const att = a.seconds / 60;
    const rec = r ? onAxis(r, "minutes") : null;
    const ref = e.reference && e.reference.measure.kind === "duration" ? e.reference.measure.seconds / 60 : null;
    const top = Math.max(att, rec ?? 0, ref ?? 0) * 1.12;
    const step = top > 180 ? 60 : top > 60 ? 30 : top > 20 ? 10 : 5;
    const max = niceCeil(top, step);
    return {
      max,
      attested: att,
      recomputed: rec,
      startLabel: "0",
      endLabel: durationShort(max),
      reference: ref !== null && e.reference ? { at: ref, label: `${e.reference.label} ${durationShort(ref)}` } : null,
    };
  }

  const rec = r ? onAxis(r, "count") : null;
  const max = niceCeil(Math.max(a.value, rec ?? 0) * 1.25, a.value > 20 ? 10 : 2);
  return { max, attested: a.value, recomputed: rec, startLabel: "0", endLabel: int(max), reference: null };
}

export function pct(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
}
