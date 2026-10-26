import assert from "node:assert/strict";
import { test } from "vitest";
import { pct as clamp, track } from "../src/lib/scale";
import { count, frac, mins, pct, row } from "./fixtures";

test("a share sits on a 0 to 100 line", () => {
  const t = track(row(pct(100), pct(61)));
  assert.deepEqual(t, { max: 100, attested: 100, recomputed: 61, startLabel: "0%", endLabel: "100%", reference: null });
});

test("a fraction over the same inventory uses the inventory as the line", () => {
  const t = track(row(frac(38, 38), frac(0, 38)));
  assert.equal(t.max, 38);
  assert.equal(t.attested, 38);
  assert.equal(t.recomputed, 0);
  assert.equal(t.endLabel, "38");
});

test("a fraction over a different inventory falls back to percentages", () => {
  const t = track(row(frac(38, 38), frac(29, 58)));
  assert.equal(t.max, 100);
  assert.equal(t.attested, 100);
  assert.equal(t.recomputed, 50);
});

test("an untestable claim keeps its mark and has no evidence mark", () => {
  assert.equal(track(row(pct(95), null)).recomputed, null);
  assert.equal(track(row(frac(10, 12), null)).recomputed, null);
});

test("a time runs a little past the furthest of claim, evidence and SLA, on a round step", () => {
  const sla = { label: "SLA", measure: mins(60) };
  const t = track(row(mins(32), mins(60), { reference: sla }));
  // 60 m times 1.12 is 67 m, rounded up to the next 30 m step.
  assert.equal(t.max, 90);
  assert.equal(t.endLabel, "1 h 30");
  assert.deepEqual(t.reference, { at: 60, label: "SLA 1 h" });
  assert.equal(track(row(mins(4), mins(6))).max, 10);
  assert.equal(track(row(mins(200), mins(240))).max, 300);
});

test("a count leaves headroom above the larger figure", () => {
  const t = track(row(count(12), count(9)));
  assert.equal(t.max, 16);
  assert.equal(t.recomputed, 9);
  assert.equal(track(row(count(40), count(30))).max, 50);
});

test("positions clamp to the line", () => {
  assert.equal(clamp(50, 200), 25);
  assert.equal(clamp(-5, 100), 0);
  assert.equal(clamp(150, 100), 100);
  assert.equal(clamp(5, 0), 0);
});
