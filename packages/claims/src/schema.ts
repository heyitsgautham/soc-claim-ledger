import { z } from "zod";
import { SECTIONS } from "./labels";

export { SECTIONS, SECTION_LABELS, type Section } from "./labels";

// The claim side: the self-assessment and KPI report a CSE already submits each quarter.
// Items follow the sections a SOC self-assessment questionnaire has, and each item
// names the metric it attests, which is how a claim finds its query over the records.

export const METRICS = [
  "p1_escalated_to_l2_within_30m",
  "p1_mean_time_to_close",
  "p1_mean_time_to_acknowledge",
  "p2_closed_within_sla",
  "p2_mean_time_to_acknowledge",
  "p3_acknowledged_within_4h",
  "ot_critical_assets_monitored",
  "log_sources_reporting_daily",
  "dmz_assets_monitored",
  "cloud_workloads_forwarding",
  "threat_hunts_per_quarter",
  "p3_false_positive_share",
  "closed_cases_with_disposition",
  "shifts_with_three_l1",
  "shifts_with_l2_on_call",
  "l1_analysts_on_roster",
] as const;
export type Metric = (typeof METRICS)[number];

export const MeasureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("percent"), value: z.number().min(0).max(100) }),
  z.object({ kind: z.literal("duration"), seconds: z.number().min(0) }),
  z.object({ kind: z.literal("fraction"), numerator: z.number().int().min(0), denominator: z.number().int().min(1) }),
  z.object({ kind: z.literal("count"), value: z.number().int().min(0) }),
]);
export type Measure = z.output<typeof MeasureSchema>;
export type MeasureKind = Measure["kind"];

export const AttestedClaimSchema = z.object({
  // Questionnaire item number, section then item, 1.1 to 4.9.
  ref: z.string().regex(/^[1-4]\.\d{1,2}$/),
  section: z.enum(SECTIONS),
  text: z.string().min(1),
  metric: z.enum(METRICS),
  attested: MeasureSchema,
});
export type AttestedClaim = z.output<typeof AttestedClaimSchema>;

export const ClaimsFileSchema = z.object({
  schema_version: z.literal(1),
  entity: z.string().regex(/^[A-Z]-\d{2}$/),
  quarter_id: z.string().regex(/^FY\d{2}-Q[1-4]$/),
  document_id: z.string().min(1),
  signed_by_role: z.string().min(1),
  signed_on: z.iso.date(),
  claims: z.array(AttestedClaimSchema).min(1),
});
export type ClaimsFile = z.output<typeof ClaimsFileSchema>;

export const CLAIMS_FILE = "claims.json";
