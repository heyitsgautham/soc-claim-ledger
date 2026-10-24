import type { ClosureHistogram, NoteCluster } from "@ledger/detect";
import type { AssetClass, Disposition, ExportName, Level, Priority } from "@ledger/submission";
import type { AttestedClaim, Measure, MeasureKind } from "./schema";

export type Direction = "higher_is_better" | "lower_is_better";

// A gap is a claim the records contradict beyond tolerance.
// Insufficient evidence means this submission cannot settle the claim either way,
// which is a statement about the submission and never about the entity's SOC.
export type Status = "gap" | "holds" | "insufficient_evidence";

export type Tolerance =
  | { kind: "points"; value: number } // percentage points, for percents and fractions
  | { kind: "relative"; value: number } // share of the attested value, for durations and counts
  | { kind: "exact" };

export type Tone = "evidence" | "gap" | "gap_soft" | "muted";

export type InsufficientReason =
  | { kind: "missing_export"; exports: ExportName[]; quarters: string[] }
  | { kind: "partial_export"; exports: ExportName[]; quarters: string[] }
  | { kind: "short_window"; needed: number; available: number }
  | { kind: "empty_population"; noun: string };

export interface BreakdownPart {
  key: string;
  label: string;
  count: number;
  tone: Tone;
}

export interface ChainStep {
  from: Level;
  to: Level;
  afterMin: number;
  by: string;
  reason: string;
}

export interface CaseEvidenceRow {
  caseId: string;
  priority: Priority;
  firstAlertAt: number | null;
  alertCount: number;
  openedAt: number;
  ruleName: string;
  technique: string;
  assetHostname: string;
  assetClass: AssetClass;
  owner: string;
  escalatedAfterMin: number | null;
  escalatedTo: Level | null;
  closedAfterMin: number | null;
  closedBy: string | null;
  slaMin: number;
  disposition: Disposition | null;
  playbook: string | null;
  chain: ChainStep[];
  note: string;
}

export interface AssetEvidenceRow {
  assetId: string;
  hostname: string;
  site: string;
  criticality: string;
  alerts: number;
  logSource: string | null;
  daysReporting: number | null;
  daysExpected: number | null;
}

export interface SourceEvidenceRow {
  id: string;
  name: string;
  kind: string;
  daysReporting: number;
  daysExpected: number;
}

export interface TimelineMarker {
  label: string;
  minutes: number;
  tone: Tone;
}

export type EvidenceSection =
  | { type: "breakdown"; id: string; title: string; noun: string; total: number; parts: BreakdownPart[]; sequence?: string[] }
  | { type: "histogram"; id: string; title: string; note: string; histogram: ClosureHistogram }
  | { type: "cases"; id: string; title: string; tab?: string; rows: CaseEvidenceRow[]; timelineMinutes: number; markers: TimelineMarker[] }
  | { type: "assets"; id: string; title: string; tab?: string; rows: AssetEvidenceRow[] }
  | { type: "sources"; id: string; title: string; tab?: string; rows: SourceEvidenceRow[] }
  | {
      type: "notes";
      id: string;
      title: string;
      tab?: string;
      threshold: number;
      compared: number;
      detector: { id: string; version: string };
      cluster: NoteCluster;
    };

// Records a finding points at, which the sample sheet draws from.
export interface Subjects {
  cases: string[];
  assets: string[];
}

export interface Reference {
  label: string;
  measure: Measure;
}

export interface ExportUsed {
  name: ExportName;
  quarter: string;
  rows: number;
  sha256: string;
  declaredComplete: boolean;
}

// A one-sentence reading of what the records show. Numbers stay numbers so the
// interface can set them in the numeric face.
export type Finding = (string | number)[];

// The published obligation a claim reports against, so the examiner sees why the figure
// matters and not only whether it holds. Sources and clauses are listed in docs/research.md.
export interface Basis {
  source: string;
  clause: string;
  // A plain paraphrase of the clause, not a quotation.
  says: string;
}

export interface ClaimEvaluation {
  claim: AttestedClaim;
  basis: Basis[];
  status: Status;
  direction: Direction;
  tolerance: Tolerance;
  kind: MeasureKind;
  recomputed: Measure | null;
  // What the recomputed figure was counted over, and how many met the claim.
  population: { count: number; noun: string } | null;
  matched: number | null;
  reference: Reference | null;
  finding: Finding | null;
  reason: InsufficientReason | null;
  // How far the records fall short of the claim, as a share of the claim's scale.
  // Zero when the records meet or beat the claim.
  shortfall: number;
  // How far past the claim the records are, in tolerances. Zero when the claim holds.
  excess: number;
  // What rides on the claim, from the catalogue. 1 for P1 incidents and critical assets.
  stakes: number;
  rule: { id: string; version: string };
  method: string;
  window: string[];
  exportsUsed: ExportUsed[];
  evidence: EvidenceSection[];
  subjects: Subjects;
}
