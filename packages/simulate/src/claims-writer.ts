import type { AttestedClaim, ClaimsFile } from "@ledger/claims";
import { isCriticalOt } from "@ledger/submission";
import type { Quarter } from "./calendar";
import type { Inventory } from "./inventory";
import type { EntityConfig } from "./roster";

// Writes the CSE's self-assessment and KPI report. It reads the entity's intended
// process and its own inventory, and nothing the simulation produced, the same way a
// CISO fills the questionnaire from the SOP and the asset register.

export function writeClaims(entity: EntityConfig, inventory: Inventory, quarter: Quarter): ClaimsFile {
  const i = entity.intended;
  const count = (pred: (a: Inventory["assets"][number]) => boolean) => inventory.assets.filter(pred).length;
  const all = (n: number) => ({ kind: "fraction" as const, numerator: n, denominator: n });
  const pct = (value: number) => ({ kind: "percent" as const, value });
  const minutes = (m: number) => ({ kind: "duration" as const, seconds: Math.round(m * 60) });

  const otCritical = count(isCriticalOt);
  const claims: AttestedClaim[] = [
    { ref: "1.1", section: "timeliness", metric: "p1_escalated_to_l2_within_30m", text: "Critical alerts reviewed by L2 within 30 minutes", attested: pct(i.p1EscalationWithin30Pct) },
    { ref: "1.2", section: "timeliness", metric: "p1_mean_time_to_close", text: "Mean time to triage a critical alert", attested: minutes(i.p1MeanCloseMin) },
    { ref: "1.3", section: "timeliness", metric: "p1_mean_time_to_acknowledge", text: "Mean time to acknowledge a critical alert", attested: minutes(i.p1MeanAckMin) },
    { ref: "1.4", section: "timeliness", metric: "p2_closed_within_sla", text: "High-severity cases closed within their SLA", attested: pct(i.p2WithinSlaPct) },
    { ref: "1.5", section: "timeliness", metric: "p2_mean_time_to_acknowledge", text: "Mean time to acknowledge a high-severity alert", attested: minutes(i.p2MeanAckMin) },
    { ref: "1.6", section: "timeliness", metric: "p3_acknowledged_within_4h", text: "Medium-severity alerts acknowledged within 4 hours", attested: pct(i.p3AckWithin4hPct) },
    // The questionnaire only asks about OT where the inventory lists critical OT assets.
    ...(otCritical > 0
      ? [{ ref: "2.1", section: "coverage", metric: "ot_critical_assets_monitored", text: "Critical OT assets under monitoring", attested: all(otCritical) } satisfies AttestedClaim]
      : []),
    { ref: "2.2", section: "coverage", metric: "log_sources_reporting_daily", text: "SIEM log sources reporting daily", attested: all(inventory.sources.length) },
    { ref: "2.3", section: "coverage", metric: "dmz_assets_monitored", text: "DMZ assets under monitoring", attested: all(count((a) => a.asset_class === "dmz")) },
    { ref: "2.4", section: "coverage", metric: "cloud_workloads_forwarding", text: "Cloud workloads forwarding logs to the SIEM", attested: all(count((a) => a.asset_class === "cloud")) },
    { ref: "3.1", section: "capability", metric: "threat_hunts_per_quarter", text: "Threat-hunting exercises this quarter", attested: { kind: "count", value: i.threatHuntsPerQuarter } },
    { ref: "3.2", section: "capability", metric: "p3_false_positive_share", text: "False positives among closed medium-severity cases, at most", attested: pct(i.p3FalsePositiveMaxPct) },
    { ref: "3.3", section: "capability", metric: "closed_cases_with_disposition", text: "Closed cases with a recorded disposition", attested: pct(i.dispositionPct) },
    { ref: "4.1", section: "staffing", metric: "shifts_with_three_l1", text: "Shifts with at least three L1 analysts on duty", attested: pct(i.shiftsWithThreeL1Pct) },
    { ref: "4.2", section: "staffing", metric: "shifts_with_l2_on_call", text: "Shifts with an L2 analyst on call", attested: pct(i.shiftsWithL2Pct) },
    { ref: "4.3", section: "staffing", metric: "l1_analysts_on_roster", text: "L1 analysts on the roster", attested: { kind: "count", value: entity.staffing.l1Teams * entity.staffing.l1PerTeam } },
  ];

  const short = entity.code.replace("-", "");
  return {
    schema_version: 1,
    entity: entity.code,
    quarter_id: quarter.id,
    document_id: `SA-${short}-${quarter.id.replace("-", "")}`,
    signed_by_role: "Chief Information Security Officer",
    signed_on: quarter.attestedOn,
    claims,
  };
}
