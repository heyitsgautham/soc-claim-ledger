import { createHash } from "node:crypto";
import { DETECTORS } from "@ledger/detect";
import { type Case, SEVERITY } from "@ledger/submission";
import { Indexed } from "../context";
import type { AssetEvidenceRow } from "../types";
import type { SampleItem, SampleReason, SampleRecord, SampleSheet, SupervisoryFinding } from "./types";
import type { Workspace } from "./workspace";

// The sample sheet examiners review blind, drawn from one entity's findings for one cycle.

function hashOrder(seed: string, id: string): string {
  return createHash("sha256").update(`${seed}/${id}`).digest("hex");
}

function reasonText(f: SupervisoryFinding): string {
  if (f.detector.id === "claim-gap") return `Behind the gap on claim ${f.claimRef}`;
  return DETECTORS[f.detector.id].title;
}

// The sample sheet. Greedy over findings, strongest first, so every finding is looked at
// before any gets a second record, with one counterexample that meets the claims and one
// reproducible random pick held back so examiners also see what the tool did not flag.
export function drawSamples(ws: Workspace, entity: string, cycle: string, findings: readonly SupervisoryFinding[], size = 10): SampleSheet {
  const [sub] = ws.window(entity, cycle, 1);
  const ix = new Indexed(sub!);
  const seed = `sample/${entity}/${cycle}`;
  const byKey = new Map<string, { kind: "case" | "asset"; id: string; reasons: SampleReason[]; score: number }>();
  const add = (kind: "case" | "asset", id: string, f: SupervisoryFinding) => {
    const key = `${kind}:${id}`;
    const cur = byKey.get(key) ?? { kind, id, reasons: [], score: 0 };
    if (!cur.reasons.some((r) => r.findingId === f.id)) {
      cur.reasons.push({ detector: f.detector, findingId: f.id, text: reasonText(f) });
      cur.score += f.weight;
    }
    byKey.set(key, cur);
  };
  for (const f of findings) {
    for (const id of f.subjects.cases) add("case", id, f);
    for (const id of f.subjects.assets) add("asset", id, f);
  }

  const reserved = findings.length ? 2 : 4;
  const picked: string[] = [];
  const covered = new Set<string>();
  const signatures = new Set<string>();
  const signature = (key: string) =>
    byKey
      .get(key)!
      .reasons.map((r) => r.findingId)
      .sort()
      .join("+");
  // Each round gives every finding one more record. Within a finding, a record that brings
  // an uncovered finding wins, then one whose combination of reasons is new, then the
  // strongest, so the sheet shows the different ways the findings show up.
  let progress = true;
  while (picked.length < size - reserved && progress) {
    progress = false;
    for (const f of findings) {
      if (picked.length >= size - reserved) break;
      const candidates = [...f.subjects.cases.map((id) => `case:${id}`), ...f.subjects.assets.map((id) => `asset:${id}`)].filter((k) => !picked.includes(k));
      if (!candidates.length) continue;
      const rank = (k: string): [number, number, number, string] => {
        const c = byKey.get(k)!;
        const novel = c.reasons.filter((r) => r.findingId && !covered.has(r.findingId)).length;
        return [novel, signatures.has(signature(k)) ? 0 : 1, c.score, hashOrder(seed, k)];
      };
      candidates.sort((a, b) => {
        const x = rank(a);
        const y = rank(b);
        return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || (x[3] < y[3] ? -1 : 1);
      });
      const next = candidates[0]!;
      picked.push(next);
      signatures.add(signature(next));
      for (const r of byKey.get(next)!.reasons) if (r.findingId) covered.add(r.findingId);
      progress = true;
    }
  }

  const cases = sub!.records.cases ?? [];
  const closed = cases.filter((c) => c.closed_at !== null && !picked.includes(`case:${c.id}`));
  const escalatedFast = closed.filter((c) => {
    if (c.priority !== "P1") return false;
    const r = ix.caseRow(c);
    return r.escalatedAfterMin !== null && r.escalatedAfterMin <= 30 && (r.closedAfterMin ?? Infinity) < c.sla_close_minutes - 15;
  });
  const order = (list: Case[]) => [...list].sort((a, b) => (hashOrder(seed, a.id) < hashOrder(seed, b.id) ? -1 : 1));
  const counter = order(escalatedFast.length ? escalatedFast : closed.filter((c) => c.priority !== "P4"));
  const random = order(closed);
  const extras: { key: string; pick: "counterexample" | "random" }[] = [];
  for (let i = 0; i < reserved; i++) {
    const pool = i % 2 === 0 ? counter : random;
    const c = pool.find((x) => !picked.includes(`case:${x.id}`) && !extras.some((e) => e.key === `case:${x.id}`));
    if (c) extras.push({ key: `case:${c.id}`, pick: i % 2 === 0 ? "counterexample" : "random" });
  }

  const alertCount = new Map<string, number>();
  for (const s of ws.window(entity, cycle, 2)) for (const a of s.records.alerts ?? []) alertCount.set(a.asset_id, (alertCount.get(a.asset_id) ?? 0) + 1);
  const sources = new Map((sub!.records.log_sources ?? []).map((s) => [s.id, s]));

  const record = (kind: "case" | "asset", id: string): { record: SampleRecord; title: string; subtitle: string } => {
    if (kind === "case") {
      const c = cases.find((x) => x.id === id)!;
      const row = ix.caseRow(c);
      return {
        record: { kind: "case", case: row },
        title: row.ruleName,
        subtitle: `${SEVERITY[row.priority][0]!.toUpperCase()}${SEVERITY[row.priority].slice(1)} alert on ${row.assetHostname}`,
      };
    }
    const a = ix.asset(id)!;
    const src = a.log_source_id ? sources.get(a.log_source_id) : undefined;
    const asset: AssetEvidenceRow & { assetClass: typeof a.asset_class } = {
      assetId: a.id,
      hostname: a.hostname,
      site: a.site,
      criticality: a.criticality,
      alerts: alertCount.get(a.id) ?? 0,
      logSource: src?.name ?? null,
      daysReporting: src?.days_reporting ?? null,
      daysExpected: src?.days_expected ?? null,
      assetClass: a.asset_class,
    };
    return {
      record: { kind: "asset", asset },
      title: a.hostname,
      subtitle: `${a.criticality} ${a.asset_class === "ot" ? "OT" : a.asset_class} asset at ${a.site}`,
    };
  };

  const items: SampleItem[] = [];
  for (const key of picked) {
    const c = byKey.get(key)!;
    items.push({ n: 0, key, kind: c.kind, recordId: c.id, pick: "finding", reasons: c.reasons, score: c.score, ...record(c.kind, c.id) });
  }
  for (const e of extras) {
    const [kind, id] = e.key.split(":") as ["case", string];
    items.push({
      n: 0,
      key: e.key,
      kind,
      recordId: id,
      pick: e.pick,
      reasons: [],
      score: 0,
      ...record(kind, id),
    });
  }
  items.forEach((it, i) => {
    it.n = i + 1;
  });

  return {
    entity,
    cycle,
    seed,
    method:
      "Greedy over findings, strongest first, so each finding contributes a record before any contributes a second. Two places are held for a counterexample that meets the claims and a reproducible random pick, so the review also measures what the tool misses. A targeted review sample, not a prevalence estimate.",
    items,
  };
}
