import assert from "node:assert/strict";
import { test } from "vitest";
import { day, duration, durationShort, int, istShort, measure, parts, period, plural, recomputed, variance, varianceParts } from "../src/lib/format";
import { count, frac, mins, pct, row } from "./fixtures";

test("integers group the Indian way and round", () => {
  assert.equal(int(1234567.4), "12,34,567");
  assert.equal(int(999), "999");
});

test("durations read in the largest sensible unit", () => {
  assert.equal(duration(130 * 60), "2 h 10 m");
  assert.equal(duration(45 * 60), "45 m");
  assert.equal(duration(216), "3 m 36 s");
  assert.equal(duration(180), "3 m");
  assert.equal(duration(-90), "1 m 30 s");
  assert.equal(durationShort(0), "0");
  assert.equal(durationShort(30), "30 m");
  assert.equal(durationShort(240), "4 h");
  assert.equal(durationShort(270), "4 h 30");
});

test("each measure kind formats in its own unit", () => {
  assert.equal(measure(pct(61.4)), "61%");
  assert.equal(measure(pct(61.44), 1), "61.4%");
  assert.equal(measure(mins(32)), "32 m");
  assert.equal(measure(frac(0, 38)), "0 of 38");
  assert.equal(measure(count(1200)), "1,200");
});

test("a recomputed share gets a decimal only when rounding would hide the gap", () => {
  assert.equal(recomputed(row(pct(100), pct(99.6))), "99.6%");
  assert.equal(recomputed(row(pct(100), pct(61))), "61%");
  assert.equal(recomputed(row(pct(95), pct(95))), "95%");
  assert.equal(recomputed(row(pct(95), null)), "");
});

test("the variance is signed and in the claim's unit", () => {
  assert.equal(variance(row(pct(100), pct(61))), "−39 pts");
  assert.equal(variance(row(pct(90), pct(90.4))), "+0.4 pts");
  assert.equal(variance(row(pct(90), pct(90))), "±0.0 pts");
  assert.equal(variance(row(mins(32), mins(60))), "+28 m");
  assert.equal(variance(row(frac(38, 38), frac(0, 38), { population: { count: 38, noun: "critical OT assets" } })), "−38 assets");
  assert.equal(variance(row(count(12), count(9))), "−3");
  assert.equal(variance(row(pct(100), mins(5))), "");
  assert.equal(variance(row(pct(100), null)), "");
});

test("dates and times come out in IST whatever the machine's zone", () => {
  // 2026-04-11T20:44:00Z is 12 Apr 02:14 in IST.
  assert.equal(istShort(Date.UTC(2026, 3, 11, 20, 44)), "12 Apr 02:14");
  assert.equal(day("2026-07-14"), "14 Jul 2026");
  assert.equal(period("2026-04-01", "2026-06-30"), "1 Apr to 30 Jun 2026");
  assert.equal(period("2025-12-01", "2026-02-28"), "1 Dec 2025 to 28 Feb 2026");
});

test("plural picks the noun by count", () => {
  assert.equal(plural(1, "alert"), "1 alert");
  assert.equal(plural(3, "alert"), "3 alerts");
  assert.equal(plural(2, "analysis", "analyses"), "2 analyses");
});

test("parts split numerals from units for each measure kind", () => {
  assert.deepEqual(parts("61%", pct(61)), [
    { text: "61", unit: false },
    { text: "%", unit: true },
  ]);
  assert.deepEqual(
    parts("", mins(130)).map((p) => p.text),
    ["2", "h", "10", "m"],
  );
  assert.deepEqual(
    parts("", frac(0, 38)).map((p) => p.text),
    ["0", "of", "38"],
  );
  assert.deepEqual(parts("", count(7)), [{ text: "7", unit: false }]);
});

test("variance parts carry the sign on the first numeral", () => {
  assert.deepEqual(varianceParts(row(pct(100), pct(61))), [
    { text: "−39", unit: false },
    { text: "pts", unit: true },
  ]);
  assert.deepEqual(
    varianceParts(row(mins(32), mins(134))).map((p) => p.text),
    ["+1", "h", "42", "m"],
  );
  assert.deepEqual(varianceParts(row(pct(100), null)), []);
});
