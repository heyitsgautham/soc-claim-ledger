import type { ClaimEvaluation, Measure } from "@ledger/claims/model";

// A ledger row with only the fields the formatting and scale code reads.
export function row(attested: Measure, recomputed: Measure | null, extra: Partial<ClaimEvaluation> = {}): ClaimEvaluation {
  return { claim: { attested }, recomputed, population: null, reference: null, ...extra } as unknown as ClaimEvaluation;
}

export const pct = (value: number): Measure => ({ kind: "percent", value });
export const mins = (m: number): Measure => ({ kind: "duration", seconds: m * 60 });
export const frac = (numerator: number, denominator: number): Measure => ({ kind: "fraction", numerator, denominator });
export const count = (value: number): Measure => ({ kind: "count", value });
