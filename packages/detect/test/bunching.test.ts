import assert from "node:assert/strict";
import { test } from "vitest";
import { BUNCHING_DETECTOR, closureHistogram } from "../src/index";

test("closures fall into five-minute buckets up to twice the SLA, the rest into one overflow bar", () => {
  const h = closureHistogram([0, 4.9, 5, 59.9, 119.9, 120, 500], 60);
  assert.equal(h.buckets.length, 24);
  assert.deepEqual(h.buckets[0], { start: 0, end: 5, count: 2 });
  assert.equal(h.buckets[1]!.count, 1);
  assert.equal(h.buckets[11]!.count, 1);
  assert.equal(h.buckets[23]!.count, 1);
  assert.deepEqual(h.overflow, { start: 120, count: 2 });
  assert.equal(h.total, 7);
  assert.equal(h.detector, BUNCHING_DETECTOR);
});

test("a negative time to close, from clock skew, counts in the first bucket", () => {
  assert.equal(closureHistogram([-3, 1], 60).buckets[0]!.count, 2);
});

test("an SLA that does not fall on a bucket edge is refused", () => {
  assert.throws(() => closureHistogram([10], 62), /the SLA must fall on a bucket edge/);
  assert.equal(closureHistogram([10], 62, { bucketMinutes: 2 }).bucketMinutes, 2);
});

test("the last bucket is compared with the mean of the hour before it", () => {
  const before = Array.from({ length: 12 }, (_, i) => 175 + i * 5 + 1); // one closure per bucket in the hour before 235
  const h = closureHistogram([...before.slice(0, 11), ...Array(9).fill(237)], 240);
  assert.equal(h.bunching.bucket.start, 235);
  assert.equal(h.bunching.baselinePerBucket, 11 / 12);
  assert.ok(Math.abs(h.bunching.ratio! - 9 / (11 / 12)) < 1e-9);
  assert.equal(h.bunching.share, 9 / 20);
  assert.equal(h.bunching.flagged, true);
});

test("with nothing in the hour before, a pile at the SLA is flagged on its count alone", () => {
  const h = closureHistogram(Array(8).fill(58), 60);
  assert.equal(h.bunching.ratio, null);
  assert.equal(h.bunching.flagged, true);
  assert.equal(closureHistogram(Array(7).fill(58), 60).bunching.flagged, false);
});

test("the thresholds are options, so a stricter version can be calibrated", () => {
  const xs = [...Array.from({ length: 12 }, (_, i) => i * 5 + 1), ...Array(10).fill(57)];
  assert.equal(closureHistogram(xs, 60).bunching.flagged, true);
  assert.equal(closureHistogram(xs, 60, { minRatio: 20 }).bunching.flagged, false);
  assert.equal(closureHistogram(xs, 60, { minCount: 12 }).bunching.flagged, false);
  assert.equal(closureHistogram(xs, 60, { tailMinutes: 30 }).buckets.length, 18);
});

test("no closures at all is an empty, unflagged histogram", () => {
  const h = closureHistogram([], 60);
  assert.equal(h.total, 0);
  assert.equal(h.bunching.share, 0);
  assert.equal(h.bunching.flagged, false);
});
