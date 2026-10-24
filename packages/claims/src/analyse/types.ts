import type {
  ClosureHistogram,
  DetectorId,
  DetectorInfo,
  NegativeSpaceResult,
  RepeatSeries,
  TemplatedNotesResult,
  WeekendCoverageResult,
} from "@ledger/detect";
import type { AssetClass, Level, Sector } from "@ledger/submission/constants";
import type { Assessment } from "../evaluate";
import type { AssetEvidenceRow, CaseEvidenceRow, Finding, Subjects } from "../types";

// What the analysis writes for the interface to render. Everything here is plain JSON.

export interface DetectorRef {
  id: DetectorId;
  version: string;
}

// One finding for the supervisory report and the risk indicator.
export interface SupervisoryFinding {
  id: string;
  detector: DetectorRef;
  claimRef: string | null;
  title: string;
  statement: Finding;
  method: string;
  severity: number;
  // Share of this detector's past flags that examiners confirmed, from earlier cycles.
  precision: number | null;
  weight: number;
  subjects: Subjects;
}

export interface RepeatRow extends RepeatSeries {
  hostname: string;
  ruleName: string;
}

export interface Signals {
  bunching: (ClosureHistogram & { caseIds: string[] }) | null;
  templatedNotes: TemplatedNotesResult & { detector: DetectorRef };
  negativeSpace: NegativeSpaceResult & {
    detector: DetectorRef;
    window: string[];
    silentAssetIds: string[];
    silentAssets: { id: string; hostname: string; site: string; criticality: string; assetClass: AssetClass }[];
  };
  weekend: WeekendCoverageResult & { detector: DetectorRef };
  repeats: { detector: DetectorRef; series: RepeatRow[]; flagged: boolean };
}

export type SampleRecord = { kind: "case"; case: CaseEvidenceRow } | { kind: "asset"; asset: AssetEvidenceRow & { assetClass: AssetClass } };

export type SamplePick = "finding" | "counterexample" | "random";

export interface SampleReason {
  detector: DetectorRef;
  findingId: string | null;
  text: string;
}

export interface SampleItem {
  n: number;
  key: string;
  kind: "case" | "asset";
  recordId: string;
  title: string;
  subtitle: string;
  pick: SamplePick;
  reasons: SampleReason[];
  score: number;
  record: SampleRecord;
}

export interface SampleSheet {
  entity: string;
  cycle: string;
  seed: string;
  method: string;
  items: SampleItem[];
}

// The entity at a glance, for the picture that opens its submission: what it runs, who
// watches it, how many alerts the quarter raised, and one critical alert that went the
// way the SOP says, from alert to case to L2 to closure.
export interface Overview {
  estate: { assetClass: AssetClass; assets: number; critical: number; alerts: number }[];
  // OT assets by the site they sit at, the control centre and the substations.
  otSites: { site: string; assets: number }[];
  analysts: { level: Level; count: number }[];
  alerts: number;
  exemplar: CaseEvidenceRow | null;
}

export interface EntityAnalysis {
  code: string;
  cycle: string;
  cycleLabel: string;
  assessment: Assessment;
  overview: Overview;
  signals: Signals;
  findings: SupervisoryFinding[];
  risk: number;
  samples: SampleSheet;
}

export interface PortfolioEntry {
  rank: number;
  code: string;
  sector: Sector;
  description: string;
  sites: number;
  risk: number;
  previousRisk: number | null;
  trend: { cycle: string; label: string; risk: number }[];
  gaps: number;
  insufficient: number;
  holds: number;
  missingExports: string[];
  // Findings behind the risk indicator, most weighted first.
  findings: number;
  reasons: { detector: DetectorRef; title: string; statement: Finding; weight: number }[];
  signals: DetectorId[];
}

export interface Portfolio {
  cycle: string;
  cycleLabel: string;
  generatedFrom: { entities: number; submissions: number; alerts: number; cases: number };
  // Processor seconds this machine spent reading every submission and analysing every cycle.
  analysedInSeconds: number;
  entries: PortfolioEntry[];
}

export type VerdictValue = "issue_confirmed" | "no_issue" | "cannot_tell";

// An examiner's verdict on one sampled record, recorded before the tool's view was shown.
export interface Verdict {
  id: string;
  cycle: string;
  entity: string;
  itemKey: string;
  kind: "case" | "asset";
  recordId: string;
  pick: SamplePick;
  detectors: DetectorRef[];
  verdict: VerdictValue;
  examiner: string;
  recordedAt: string;
  blind: boolean;
}

export interface CalibrationCell {
  cycle: string;
  version: string;
  reviewed: number;
  confirmed: number;
  rejected: number;
  unsure: number;
  precision: number | null;
}

export interface CalibrationRow {
  detector: DetectorInfo;
  cells: CalibrationCell[];
  pooled: { reviewed: number; confirmed: number; rejected: number; precision: number | null };
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: "verdict_recorded" | "detector_released" | "assessment_run" | "report_exported";
  subject: string;
  detail: string;
}

export interface Calibration {
  cycles: { id: string; label: string }[];
  rows: CalibrationRow[];
  // Issues examiners found in counterexamples and random picks, which no detector flagged.
  controls: { cycle: string; reviewed: number; issues: number }[];
  verdicts: number;
  audit: AuditEntry[];
}
