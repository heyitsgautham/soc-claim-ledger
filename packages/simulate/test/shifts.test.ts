import assert from "node:assert/strict";
import { test } from "vitest";
import { DAY, HOUR, istMidnight, QUARTERS, quarterBounds } from "../src/calendar";
import { buildInventory, entityByCode } from "../src/index";
import { behaviourIn } from "../src/roster";
import { rosterShifts, SHIFT_LENGTH } from "../src/shifts";

const q = QUARTERS.at(-1)!;
const { start, end, days } = quarterBounds(q);

function roster(code: string) {
  const e = entityByCode(code);
  return rosterShifts(buildInventory(e), e.staffing, behaviourIn(e, q.id).weekend, start, end);
}

test("shifts tile the quarter in eight-hour blocks, from the C shift the evening before", () => {
  const slots = roster("S-03");
  assert.equal(slots[0]!.start, istMidnight(q.start) - 2 * HOUR);
  assert.equal(slots[0]!.row.shift, "C");
  for (let i = 1; i < slots.length; i++) assert.equal(slots[i]!.start, slots[i - 1]!.end);
  assert.ok(slots.at(-1)!.end >= end);
  assert.equal(slots.length, days * 3 + 1);
  assert.ok(slots.every((s) => s.end - s.start === SHIFT_LENGTH));
});

test("each shift is A, B or C by its IST start hour, and named after its date", () => {
  for (const s of roster("S-03").slice(1, 4)) {
    assert.equal(s.row.id, `${s.row.date}-${s.row.shift}`);
  }
  const codes = roster("S-03")
    .slice(1, 4)
    .map((s) => s.row.shift);
  assert.deepEqual(codes, ["A", "B", "C"]);
});

test("every shift names an L2 and an L3 on call, and the full L1 team when staffed", () => {
  const e = entityByCode("S-03");
  for (const s of roster("S-03")) {
    assert.equal(s.row.l1_on_duty.length, e.staffing.l1PerTeam);
    assert.equal(s.row.l2_on_call, s.l2);
    assert.match(s.l2, /^L2-/);
    assert.match(s.l3, /^L3-/);
  }
});

test("an understaffed weekend leaves one L1 on the desk, weekdays keep the team", () => {
  const e = entityByCode("T-07");
  const slots = roster("T-07");
  const sat = istMidnight("2026-04-04") + 6 * HOUR;
  const mon = sat + 2 * DAY;
  assert.equal(slots.find((s) => s.start === sat)!.l1.length, 1);
  assert.equal(slots.find((s) => s.start === mon)!.l1.length, e.staffing.l1PerTeam);
});
