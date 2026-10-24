import type { RecordInput } from "@ledger/submission";
import { HOUR, istDate, istHour, istMidnight, istWeekday, toIst } from "./calendar";
import type { Inventory } from "./inventory";
import type { EntityConfig } from "./roster";

type ShiftRow = RecordInput<"shifts">;

export const SHIFT_LENGTH = 8 * HOUR;
// Shifts run 06:00 to 14:00 (A), 14:00 to 22:00 (B) and 22:00 to 06:00 (C) IST.
// Rotation counts from this fixed anchor so teams keep their pattern across quarters.
const ROTATION_ANCHOR = istMidnight("2025-01-01") - 2 * HOUR;

export interface Slot {
  start: number;
  end: number;
  rotation: number;
  row: ShiftRow;
  l1: string[];
  l2: string;
  l3: string;
}

export function isWeekend(ms: number): boolean {
  const d = istWeekday(ms);
  return d === 0 || d === 6;
}

// The L1 teams, L2 and L3 on call for every shift overlapping the quarter, from the
// C shift that starts at 22:00 the evening before. An understaffed weekend leaves only
// part of the rostered team on the desk.
export function rosterShifts(
  inventory: Inventory,
  staffing: EntityConfig["staffing"],
  weekend: EntityConfig["behaviour"]["weekend"],
  start: number,
  end: number,
): Slot[] {
  const l1 = inventory.analysts.filter((a) => a.level === "L1").map((a) => a.id);
  const l2 = inventory.analysts.filter((a) => a.level === "L2").map((a) => a.id);
  const l3 = inventory.analysts.filter((a) => a.level === "L3").map((a) => a.id);
  const { l1Teams, l1PerTeam } = staffing;
  const slots: Slot[] = [];
  for (let s = start - 2 * HOUR; s < end; s += SHIFT_LENGTH) {
    const rotation = Math.round((s - ROTATION_ANCHOR) / SHIFT_LENGTH);
    const team = rotation % l1Teams;
    const rostered = l1.slice(team * l1PerTeam, team * l1PerTeam + l1PerTeam);
    const weekendShort = weekend !== null && isWeekend(s);
    const onDuty = weekendShort ? rostered.slice(0, weekend!.l1OnDuty) : rostered;
    const hour = istHour(s);
    const code = hour === 6 ? "A" : hour === 14 ? "B" : "C";
    const date = istDate(s);
    const slot: Slot = {
      start: s,
      end: s + SHIFT_LENGTH,
      rotation,
      l1: onDuty,
      l2: l2[rotation % l2.length] as string,
      l3: l3[Math.floor(rotation / 3) % l3.length] as string,
      row: {
        id: `${date}-${code}`,
        date,
        shift: code,
        starts_at: toIst(s),
        ends_at: toIst(s + SHIFT_LENGTH),
        l1_on_duty: onDuty,
        l2_on_call: null,
        l3_on_call: null,
      },
    };
    slot.row.l2_on_call = slot.l2;
    slot.row.l3_on_call = slot.l3;
    slots.push(slot);
  }
  return slots;
}
