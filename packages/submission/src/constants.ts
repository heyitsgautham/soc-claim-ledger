// Enumerations and labels shared by the schema, the analytics and the interface.
// No zod and no node built-ins here, so browser code can import this module.

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
// What the codes mean on screen. P1 is an alert's severity, not a confirmed incident:
// every critical alert opens a triage case, and only a true-positive verdict makes it one.
export const SEVERITY: Record<(typeof PRIORITIES)[number], string> = { P1: "critical", P2: "high-severity", P3: "medium-severity", P4: "low-severity" };
export const ASSET_CLASSES = ["datacentre", "dmz", "ot", "endpoint", "cloud"] as const;
export const LEVELS = ["L1", "L2", "L3"] as const;
export const CRITICALITIES = ["critical", "high", "standard"] as const;
export const SHIFT_CODES = ["A", "B", "C"] as const;

// SOC disposition codes, in the vocabulary common SOC playbooks use at closure.
export const DISPOSITIONS = ["true_positive_contained", "true_positive_remediated", "benign_positive", "false_positive", "duplicate", "inconclusive"] as const;

export const HUNT_OUTCOMES = ["no_finding", "finding_raised", "detection_improved"] as const;

// The record exports a submission can carry.
// A submission that leaves one out is not the same as a submission with zero rows in it,
// and the claims layer reports the first as insufficient evidence.
export const EXPORT_NAMES = ["alerts", "cases", "escalations", "assets", "log_sources", "rules", "analysts", "shifts", "threat_hunts"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type AssetClass = (typeof ASSET_CLASSES)[number];
export type Level = (typeof LEVELS)[number];
export type Disposition = (typeof DISPOSITIONS)[number];
export type ExportName = (typeof EXPORT_NAMES)[number];

export const SECTORS = {
  power_energy: "Power & Energy",
  bfsi: "Banking, Financial Services & Insurance",
  telecom: "Telecom",
  transport: "Transport",
  government: "Government",
  strategic_public: "Strategic & Public Enterprises",
} as const;

export type Sector = keyof typeof SECTORS;
