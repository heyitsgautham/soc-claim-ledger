import assert from "node:assert/strict";
import { test } from "vitest";
import { NegativeSpaceGrid } from "@/components/negative-space/grid";
import { SilentAssets } from "@/components/negative-space/silent-assets";
import { entity, html, tag, text } from "./demo";

const ns = entity("P-04").signals.negativeSpace;

test("the grid has a row per asset class and a cell per category", () => {
  const out = html(<NegativeSpaceGrid result={ns} />);
  for (const r of ns.rows) {
    tag(out, `grid-row-${r.assetClass}`);
    for (const c of r.cells) tag(out, `cell-${r.assetClass}-${c.category}`);
  }
});

test("P-04's OT row is negative space, and the silent assets list its critical ones", () => {
  const ot = ns.rows.find((r) => r.assetClass === "ot")!;
  assert.ok(ot.cells.some((c) => c.state === "negative_space"));
  assert.ok(ns.silentAssets.length > 0);
  const critical = ns.silentAssets.filter((s) => s.criticality === "critical").length;
  const out = html(<SilentAssets assets={ns.silentAssets} quarters="Q4 FY26 and Q1 FY27" />);
  assert.match(out, new RegExp(`aria-label="${ns.silentAssets.length} silent assets"`));
  assert.ok(text(<SilentAssets assets={ns.silentAssets} quarters="Q4 FY26 and Q1 FY27" />).includes(String(critical)));
});
