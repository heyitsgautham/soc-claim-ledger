import assert from "node:assert/strict";
import { test } from "vitest";
import { addDays, DAY, istDate, istHour, istMidnight, istWeekday, QUARTERS, quarterBounds, toIst } from "../src/calendar";
import { isWeekend } from "../src/shifts";

test("instants are written in IST with the offset, rounded to the second", () => {
  const ms = Date.UTC(2026, 3, 11, 20, 44, 7, 600);
  assert.equal(toIst(ms), "2026-04-12T02:14:08+05:30");
  assert.equal(istDate(ms), "2026-04-12");
  assert.equal(istHour(ms), 2);
  assert.equal(istWeekday(ms), 0);
  assert.equal(istMidnight("2026-04-12"), Date.UTC(2026, 3, 11, 18, 30));
});

test("the quarters run back to back with no gap or overlap, and are submitted after they end", () => {
  for (let i = 1; i < QUARTERS.length; i++) {
    assert.equal(QUARTERS[i]!.start, addDays(QUARTERS[i - 1]!.end, 1), QUARTERS[i]!.id);
  }
  for (const q of QUARTERS) {
    assert.ok(q.submittedOn > q.end && q.attestedOn < q.submittedOn, q.id);
    assert.match(q.id, /^FY\d{2}-Q[1-4]$/);
  }
});

test("a quarter's bounds cover every day from its first midnight to the midnight after its last", () => {
  const q1 = quarterBounds(QUARTERS.find((q) => q.id === "FY27-Q1")!);
  assert.equal(q1.days, 91);
  assert.equal(q1.start, istMidnight("2026-04-01"));
  assert.equal(q1.end - q1.start, 91 * DAY);
});

test("adding days crosses months and years", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("Saturday and Sunday in IST are the weekend, even when UTC still says Friday", () => {
  assert.equal(isWeekend(istMidnight("2026-04-04") + 60_000), true); // Saturday 00:01 IST, Friday in UTC
  assert.equal(isWeekend(istMidnight("2026-04-05")), true);
  assert.equal(isWeekend(istMidnight("2026-04-06")), false);
});
