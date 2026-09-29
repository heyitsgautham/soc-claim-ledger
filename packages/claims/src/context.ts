import type { Alert, Asset, Case, Escalation, ExportName, RecordOf, Rule, Submission } from "@ledger/submission";
import type { CaseEvidenceRow } from "./types";

// Lookups the claim queries share, built once per submission.

export class Indexed {
  private rulesById?: Map<string, Rule>;
  private assetsById?: Map<string, Asset>;
  private escalationsByCase?: Map<string, Escalation[]>;
  private firstAlertByCase?: Map<string, Alert>;

  constructor(readonly submission: Submission) {}

  get quarter(): string {
    return this.submission.manifest.quarter.id;
  }

  has(name: ExportName): boolean {
    return this.submission.records[name] !== undefined;
  }

  // Claim queries only run after the evaluator has checked their required exports,
  // so a missing export here is a bug in a metric definition, not a data problem.
  records<N extends ExportName>(name: N): RecordOf<N>[] {
    const rows = this.submission.records[name] as RecordOf<N>[] | undefined;
    if (!rows) throw new Error(`metric read ${name} from ${this.submission.dir} without declaring it as required`);
    return rows;
  }

  rule(id: string): Rule | undefined {
    this.rulesById ??= new Map(this.records("rules").map((r) => [r.id, r]));
    return this.rulesById.get(id);
  }

  asset(id: string): Asset | undefined {
    this.assetsById ??= new Map(this.records("assets").map((a) => [a.id, a]));
    return this.assetsById.get(id);
  }

  escalations(caseId: string): Escalation[] {
    if (!this.escalationsByCase) {
      this.escalationsByCase = new Map();
      for (const e of this.records("escalations")) {
        const list = this.escalationsByCase.get(e.case_id) ?? [];
        list.push(e);
        this.escalationsByCase.set(e.case_id, list);
      }
    }
    return this.escalationsByCase.get(caseId) ?? [];
  }

  firstAlert(caseId: string): Alert | undefined {
    if (!this.has("alerts")) return undefined;
    if (!this.firstAlertByCase) {
      this.firstAlertByCase = new Map();
      for (const a of this.records("alerts")) {
        if (!a.case_id) continue;
        const cur = this.firstAlertByCase.get(a.case_id);
        if (!cur || a.created_at < cur.created_at) this.firstAlertByCase.set(a.case_id, a);
      }
    }
    return this.firstAlertByCase.get(caseId);
  }

  // The first hand-off from L1 to L2 on a case, if there was one.
  firstL2Escalation(caseId: string): Escalation | undefined {
    return this.escalations(caseId)
      .filter((e) => e.from_level === "L1" && e.to_level === "L2")
      .sort((a, b) => a.escalated_at - b.escalated_at)[0];
  }

  caseRow(c: Case): CaseEvidenceRow {
    const rule = this.rule(c.rule_id);
    const asset = this.asset(c.asset_id);
    const esc = this.has("escalations") ? this.firstL2Escalation(c.id) : undefined;
    const chain = this.has("escalations")
      ? this.escalations(c.id)
          .slice()
          .sort((a, b) => a.escalated_at - b.escalated_at)
          .map((e) => ({ from: e.from_level, to: e.to_level, afterMin: minutesBetween(c.opened_at, e.escalated_at), by: e.escalated_by, reason: e.reason }))
      : [];
    return {
      caseId: c.id,
      priority: c.priority,
      firstAlertAt: this.firstAlert(c.id)?.created_at ?? null,
      alertCount: c.alert_count,
      openedAt: c.opened_at,
      ruleName: rule?.name ?? c.rule_id,
      technique: rule?.technique ?? "",
      assetHostname: asset?.hostname ?? c.asset_id,
      assetClass: asset?.asset_class ?? "endpoint",
      owner: c.owner,
      escalatedAfterMin: esc ? minutesBetween(c.opened_at, esc.escalated_at) : null,
      escalatedTo: esc ? esc.to_level : null,
      closedAfterMin: c.closed_at === null ? null : minutesBetween(c.opened_at, c.closed_at),
      closedBy: c.closed_by,
      slaMin: c.sla_close_minutes,
      disposition: c.disposition,
      playbook: c.playbook_id,
      chain,
      note: c.note,
    };
  }
}

export function minutesBetween(from: number, to: number): number {
  return (to - from) / 60_000;
}

export function mean(values: readonly number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// The most common value, for picking the SLA when a population mixes them.
export function mode(values: readonly number[]): number | undefined {
  const counts = new Map<number, number>();
  let best: number | undefined;
  let bestCount = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestCount || (n === bestCount && best !== undefined && v < best)) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}
