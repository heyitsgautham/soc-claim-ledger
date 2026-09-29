import type { Alert, Asset, AssetClass, Rule } from "@ledger/submission";
import { classCounts } from "@ledger/submission/inventory";

// Negative space: what should be in the data and is not. For each asset class and alert
// category the grid expects a count, from the entity's own inventory and rule coverage
// and from the rate its sector peers see per asset. A cell that should have alerts and
// has none is the finding.

export const ALERT_CATEGORIES = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Stealth",
  "Defense Impairment",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
  "Impair Process Control",
] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const GRID_CLASSES: AssetClass[] = ["datacentre", "dmz", "endpoint", "cloud", "ot"];

export interface EstateWindow {
  code: string;
  assets: Asset[];
  alerts: Alert[]; // every alert across the window
  rules: Rule[];
}

export type CellState = "observed" | "thin" | "negative_space" | "quiet" | "uncovered";

export interface GridCell {
  assetClass: AssetClass;
  category: AlertCategory;
  observed: number;
  expected: number | null;
  peerRates: { code: string; perAsset: number }[];
  covered: boolean;
  state: CellState;
}

export interface GridRow {
  assetClass: AssetClass;
  assets: number;
  critical: number;
  silentAssets: number;
  cells: GridCell[];
}

export interface NegativeSpaceResult {
  peers: { code: string; assets: Partial<Record<AssetClass, number>> }[];
  minExpected: number;
  rows: GridRow[];
  negativeCells: number;
  flagged: boolean;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function counts(e: EstateWindow) {
  const byAsset = new Map(e.assets.map((a) => [a.id, a]));
  const byRule = new Map(e.rules.map((r) => [r.id, r]));
  // Alerts count once per asset, rule and hour, so a storm or a burst on one host does
  // not set the expectation for a whole class.
  const cell = new Map<string, number>();
  const alerting = new Set<string>();
  const seen = new Set<string>();
  for (const al of e.alerts) {
    const a = byAsset.get(al.asset_id);
    const r = byRule.get(al.rule_id);
    if (!a || !r) continue;
    alerting.add(a.id);
    const dedupe = `${al.asset_id}|${al.rule_id}|${Math.floor(al.created_at / 3_600_000)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const k = `${a.asset_class}|${r.tactic}`;
    cell.set(k, (cell.get(k) ?? 0) + 1);
  }
  const classSize = new Map<AssetClass, number>();
  for (const a of e.assets) classSize.set(a.asset_class, (classSize.get(a.asset_class) ?? 0) + 1);
  return { cell, alerting, classSize };
}

export function negativeSpace(entity: EstateWindow, peers: EstateWindow[], minExpected: number): NegativeSpaceResult {
  const own = counts(entity);
  const peerCounts = peers.map((p) => ({ code: p.code, ...counts(p) }));
  const covered = new Set<string>();
  for (const r of entity.rules) for (const c of r.asset_classes) covered.add(`${c}|${r.tactic}`);

  const rows: GridRow[] = [];
  const inventory = classCounts(entity.assets);
  let negativeCells = 0;
  for (const assetClass of GRID_CLASSES) {
    const size = inventory[assetClass].total;
    if (!size) continue;
    const cells: GridCell[] = ALERT_CATEGORIES.map((category) => {
      const k = `${assetClass}|${category}`;
      const observed = own.cell.get(k) ?? 0;
      const peerRates = peerCounts
        .filter((p) => (p.classSize.get(assetClass) ?? 0) > 0)
        .map((p) => ({ code: p.code, perAsset: (p.cell.get(k) ?? 0) / p.classSize.get(assetClass)! }));
      const expected = peerRates.length ? median(peerRates.map((p) => p.perAsset)) * size : null;
      const isCovered = covered.has(k);
      let state: CellState;
      if (!isCovered && observed === 0) state = "uncovered";
      else if (observed === 0) state = expected !== null && expected >= minExpected ? "negative_space" : "quiet";
      else state = expected !== null && expected >= 10 && observed < expected * 0.25 ? "thin" : "observed";
      if (state === "negative_space") negativeCells++;
      return { assetClass, category, observed, expected, peerRates, covered: isCovered, state };
    });
    const silentAssets = entity.assets.filter((a) => a.asset_class === assetClass && !own.alerting.has(a.id)).length;
    rows.push({ assetClass, assets: size, critical: inventory[assetClass].critical, silentAssets, cells });
  }

  return {
    peers: peerCounts.map((p) => ({ code: p.code, assets: Object.fromEntries(p.classSize) as Partial<Record<AssetClass, number>> })),
    minExpected,
    rows,
    negativeCells,
    flagged: negativeCells > 0,
  };
}
