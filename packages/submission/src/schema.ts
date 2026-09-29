import { z } from "zod";
import {
  ASSET_CLASSES,
  CRITICALITIES,
  DISPOSITIONS,
  EXPORT_NAMES,
  type ExportName,
  HUNT_OUTCOMES,
  LEVELS,
  PRIORITIES,
  type Sector,
  SECTORS,
  SHIFT_CODES,
} from "./constants";

// The contract for one quarterly submission from a CSE.
// Every file a CSE hands over is validated against these schemas at load time,
// so the analytics never run on a record they have not checked.

// Timestamps travel as ISO 8601 with an explicit offset and become epoch milliseconds on load.
const instant = z.iso.datetime({ offset: true }).transform((s) => Date.parse(s));
const day = z.iso.date();
const id = z.string().min(1);

export const AlertSchema = z.object({
  id,
  created_at: instant,
  rule_id: id,
  priority: z.enum(PRIORITIES),
  asset_id: id,
  acknowledged_at: instant.nullable(),
  acknowledged_by: id.nullable(),
  case_id: id.nullable(),
});

export const CaseSchema = z.object({
  id,
  priority: z.enum(PRIORITIES),
  opened_at: instant,
  rule_id: id,
  asset_id: id,
  alert_count: z.number().int().min(1),
  owner: id,
  playbook_id: id.nullable(),
  sla_close_minutes: z.number().int().positive(),
  closed_at: instant.nullable(),
  closed_by: id.nullable(),
  disposition: z.enum(DISPOSITIONS).nullable(),
  // The investigation note written at closure.
  note: z.string(),
});

export const EscalationSchema = z.object({
  id,
  case_id: id,
  from_level: z.enum(LEVELS),
  to_level: z.enum(LEVELS),
  escalated_at: instant,
  escalated_by: id,
  reason: z.string().min(1),
});

export const AssetSchema = z.object({
  id,
  hostname: id,
  asset_class: z.enum(ASSET_CLASSES),
  site: id,
  criticality: z.enum(CRITICALITIES),
  log_source_id: id.nullable(),
});

export const LogSourceSchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.string().min(1),
  asset_class: z.enum(ASSET_CLASSES),
  onboarded_on: day,
  days_expected: z.number().int().min(1),
  days_reporting: z.number().int().min(0),
});

export const RuleSchema = z.object({
  id,
  name: z.string().min(1),
  technique: z.string().regex(/^T\d{4}(\.\d{3})?$/),
  tactic: z.string().min(1),
  priority: z.enum(PRIORITIES),
  asset_classes: z.array(z.enum(ASSET_CLASSES)).min(1),
});

export const AnalystSchema = z.object({
  id,
  level: z.enum(LEVELS),
  joined_on: day,
});

export const ShiftSchema = z.object({
  id,
  date: day,
  shift: z.enum(SHIFT_CODES),
  starts_at: instant,
  ends_at: instant,
  l1_on_duty: z.array(id),
  l2_on_call: id.nullable(),
  l3_on_call: id.nullable(),
});

export const ThreatHuntSchema = z.object({
  id,
  started_on: day,
  hypothesis: z.string().min(1),
  technique: z.string().regex(/^T\d{4}(\.\d{3})?$/),
  outcome: z.enum(HUNT_OUTCOMES),
});

export const RECORD_SCHEMAS = {
  alerts: AlertSchema,
  cases: CaseSchema,
  escalations: EscalationSchema,
  assets: AssetSchema,
  log_sources: LogSourceSchema,
  rules: RuleSchema,
  analysts: AnalystSchema,
  shifts: ShiftSchema,
  threat_hunts: ThreatHuntSchema,
} as const satisfies Record<ExportName, z.ZodType>;

export type Alert = z.output<typeof AlertSchema>;
export type Case = z.output<typeof CaseSchema>;
export type Escalation = z.output<typeof EscalationSchema>;
export type Asset = z.output<typeof AssetSchema>;
export type LogSource = z.output<typeof LogSourceSchema>;
export type Rule = z.output<typeof RuleSchema>;
export type Analyst = z.output<typeof AnalystSchema>;
export type Shift = z.output<typeof ShiftSchema>;
export type ThreatHunt = z.output<typeof ThreatHuntSchema>;

// What the simulator writes before serialisation, with timestamps still as ISO strings.
export type RecordInput<N extends ExportName> = z.input<(typeof RECORD_SCHEMAS)[N]>;
export type RecordOf<N extends ExportName> = z.output<(typeof RECORD_SCHEMAS)[N]>;

export const ExportEntrySchema = z.object({
  file: z.string().min(1),
  rows: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  declared_complete: z.boolean(),
});

export const ManifestSchema = z.object({
  schema_version: z.literal(1),
  entity: z.object({
    code: z.string().regex(/^[A-Z]-\d{2}$/),
    sector: z.enum(Object.keys(SECTORS) as [Sector, ...Sector[]]),
    description: z.string().min(1),
    sites: z.number().int().min(1),
  }),
  quarter: z.object({
    id: z.string().regex(/^FY\d{2}-Q[1-4]$/),
    label: z.string().min(1),
    start: day,
    end: day,
  }),
  submitted_on: day,
  exports: z.partialRecord(z.enum(EXPORT_NAMES), ExportEntrySchema),
});

export type Manifest = z.output<typeof ManifestSchema>;
export type ExportEntry = z.output<typeof ExportEntrySchema>;
