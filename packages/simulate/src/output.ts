import type { RecordInput } from "@ledger/submission";

// What one simulated quarter produces: the exports a CSE submits, and the hidden truth
// about how they came about.

type AlertRow = RecordInput<"alerts">;
type CaseRow = RecordInput<"cases">;
type EscalationRow = RecordInput<"escalations">;
type ShiftRow = RecordInput<"shifts">;
type LogSourceRow = RecordInput<"log_sources">;
type HuntRow = RecordInput<"threat_hunts">;
type RuleRow = RecordInput<"rules">;

// Hidden labels the simulator keeps about what its toggles did. A CSE never submits these.
// They exist so the simulated examiner can give verdicts with a ground truth behind them,
// and so validation can measure the detectors against it.
export type TruthLabel =
  | "skipped_l2"
  | "sla_forced_close"
  | "templated_note"
  | "weekend_understaffed"
  | "weekend_deferred"
  | "auto_close_repeat"
  | "ot_unenrolled";

export interface TruthRow {
  record: "case" | "alert" | "asset" | "shift";
  id: string;
  labels: TruthLabel[];
}

export interface QuarterOutput {
  alerts: AlertRow[];
  cases: CaseRow[];
  escalations: EscalationRow[];
  shifts: ShiftRow[];
  log_sources: LogSourceRow[];
  rules: RuleRow[];
  threat_hunts: HuntRow[];
  truth: TruthRow[];
}
