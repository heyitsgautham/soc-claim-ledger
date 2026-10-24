import assert from "node:assert/strict";
import { test } from "node:test";
import type { Alert, Asset, AssetClass, Rule } from "@ledger/submission";
import { ALERT_CATEGORIES, type EstateWindow, negativeSpace } from "../src/index";

const HOUR = 3_600_000;

function assets(prefix: string, assetClass: AssetClass, count: number, critical = 0): Asset[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${assetClass}-${i}`,
    hostname: `${prefix}-${assetClass}-${i}`,
    asset_class: assetClass,
    site: "S-1",
    criticality: i < critical ? "critical" : "standard",
    log_source_id: null,
  })) as Asset[];
}

function rule(id: string, tactic: string, classes: AssetClass[]): Rule {
  return { id, name: id, technique: "T0800", tactic, priority: "P2", asset_classes: classes } as Rule;
}

// One alert per asset per hour, so none collapse in the per-hour dedupe.
function alerts(on: Asset[], ruleId: string, perAsset: number): Alert[] {
  return on.flatMap((a) =>
    Array.from({ length: perAsset }, (_, h) => ({
      id: `${a.id}-${ruleId}-${h}`,
      created_at: h * HOUR,
      rule_id: ruleId,
      priority: "P2",
      asset_id: a.id,
      acknowledged_at: null,
      acknowledged_by: null,
      case_id: null,
    })),
  ) as Alert[];
}

const OT = "Impair Process Control";
const otRule = rule("R-OT", OT, ["ot"]);

function peer(code: string, otAssets: number, perAsset: number): EstateWindow {
  const a = assets(code, "ot", otAssets);
  return { code, assets: a, alerts: alerts(a, "R-OT", perAsset), rules: [otRule] };
}

function cell(r: ReturnType<typeof negativeSpace>, assetClass: AssetClass, category: string) {
  return r.rows.find((row) => row.assetClass === assetClass)!.cells.find((c) => c.category === category)!;
}

test("covered OT assets with no alerts, where peers see plenty, are negative space", () => {
  const own = assets("P-04", "ot", 10, 4);
  const r = negativeSpace({ code: "P-04", assets: own, alerts: [], rules: [otRule] }, [peer("P-01", 5, 3), peer("P-02", 20, 3)], 5);
  const c = cell(r, "ot", OT);
  // Both peers see 3 alerts per OT asset, so 10 assets should show 30.
  assert.equal(c.expected, 30);
  assert.equal(c.observed, 0);
  assert.equal(c.covered, true);
  assert.equal(c.state, "negative_space");
  assert.equal(r.negativeCells, 1);
  assert.equal(r.flagged, true);
  const row = r.rows.find((x) => x.assetClass === "ot")!;
  assert.deepEqual([row.assets, row.critical, row.silentAssets], [10, 4, 10]);
});

test("a category no rule covers is uncovered, not negative space", () => {
  const r = negativeSpace({ code: "P-04", assets: assets("P-04", "ot", 10), alerts: [], rules: [otRule] }, [peer("P-01", 5, 3)], 5);
  assert.equal(cell(r, "ot", "Exfiltration").state, "uncovered");
  assert.equal(cell(r, "ot", "Exfiltration").covered, false);
});

test("a covered cell that peers barely see is quiet", () => {
  const r = negativeSpace({ code: "P-04", assets: assets("P-04", "ot", 2), alerts: [], rules: [otRule] }, [peer("P-01", 10, 1)], 5);
  assert.equal(cell(r, "ot", OT).expected, 2);
  assert.equal(cell(r, "ot", OT).state, "quiet");
  assert.equal(r.flagged, false);
});

test("a cell with alerts far under the peer rate is thin, and near it is observed", () => {
  const own = assets("P-04", "ot", 20);
  const thin = negativeSpace({ code: "P-04", assets: own, alerts: alerts(own.slice(0, 2), "R-OT", 1), rules: [otRule] }, [peer("P-01", 10, 3)], 5);
  assert.equal(cell(thin, "ot", OT).observed, 2);
  assert.equal(cell(thin, "ot", OT).state, "thin");
  assert.equal(thin.rows[0]!.silentAssets, 18);
  const fine = negativeSpace({ code: "P-04", assets: own, alerts: alerts(own, "R-OT", 2), rules: [otRule] }, [peer("P-01", 10, 3)], 5);
  assert.equal(cell(fine, "ot", OT).state, "observed");
});

test("a burst on one host in one hour counts once", () => {
  const own = assets("P-04", "ot", 1);
  const burst = Array.from({ length: 50 }, (_, i) => ({ ...alerts(own, "R-OT", 1)[0]!, id: `burst-${i}`, created_at: i * 1000 }));
  const r = negativeSpace({ code: "P-04", assets: own, alerts: burst, rules: [otRule] }, [], 5);
  assert.equal(cell(r, "ot", OT).observed, 1);
});

test("alerts on unknown assets or rules are ignored", () => {
  const own = assets("P-04", "ot", 1);
  const stray = [...alerts(own, "R-UNKNOWN", 3), ...alerts(assets("X", "ot", 1), "R-OT", 3)];
  const r = negativeSpace({ code: "P-04", assets: own, alerts: stray, rules: [otRule] }, [], 5);
  assert.equal(cell(r, "ot", OT).observed, 0);
  assert.equal(r.rows[0]!.silentAssets, 1);
});

test("without a peer that runs the class there is no expectation", () => {
  const r = negativeSpace({ code: "P-04", assets: assets("P-04", "ot", 10), alerts: [], rules: [otRule] }, [peer("P-01", 0, 0)], 5);
  assert.equal(cell(r, "ot", OT).expected, null);
  assert.equal(cell(r, "ot", OT).state, "quiet");
});

test("the grid has one row per class the entity runs and a cell per category", () => {
  const own = [...assets("P-04", "ot", 3), ...assets("P-04", "endpoint", 7)];
  const r = negativeSpace({ code: "P-04", assets: own, alerts: [], rules: [otRule] }, [peer("P-01", 4, 1)], 5);
  assert.deepEqual(
    r.rows.map((x) => x.assetClass),
    ["endpoint", "ot"],
  );
  assert.equal(r.rows[0]!.cells.length, ALERT_CATEGORIES.length);
  assert.deepEqual(r.peers, [{ code: "P-01", assets: { ot: 4 } }]);
  assert.equal(r.minExpected, 5);
});
