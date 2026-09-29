// Time for the simulation runs in epoch milliseconds and is written out in IST,
// the zone every CSE's SOC reports in.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const IST_OFFSET = 330 * MINUTE;

export interface Quarter {
  id: string; // FY27-Q1
  label: string; // Q1 FY27
  start: string; // first day, inclusive
  end: string; // last day, inclusive
  submittedOn: string;
  attestedOn: string;
}

// Indian financial-year quarters. The latest submission in the demo is Q1 FY27,
// April to June 2026, received in July, which is where an assessment in September 2026 would be looking.
export const QUARTERS: readonly Quarter[] = [
  { id: "FY26-Q2", label: "Q2 FY26", start: "2025-07-01", end: "2025-09-30", submittedOn: "2025-10-15", attestedOn: "2025-10-14" },
  { id: "FY26-Q3", label: "Q3 FY26", start: "2025-10-01", end: "2025-12-31", submittedOn: "2026-01-15", attestedOn: "2026-01-14" },
  { id: "FY26-Q4", label: "Q4 FY26", start: "2026-01-01", end: "2026-03-31", submittedOn: "2026-04-15", attestedOn: "2026-04-14" },
  { id: "FY27-Q1", label: "Q1 FY27", start: "2026-04-01", end: "2026-06-30", submittedOn: "2026-07-15", attestedOn: "2026-07-14" },
];

// Public holidays inside the demo window. Alert volume from user endpoints drops on these days.
export const HOLIDAYS = new Set([
  "2025-08-15",
  "2025-10-02",
  "2025-10-20",
  "2025-12-25",
  "2026-01-26",
  "2026-03-04",
  "2026-04-03",
  "2026-04-14",
  "2026-05-01",
]);

export function istMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00+05:30`);
}

export function quarterBounds(q: Quarter): { start: number; end: number; days: number } {
  const start = istMidnight(q.start);
  const end = istMidnight(q.end) + DAY;
  return { start, end, days: Math.round((end - start) / DAY) };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

// 2026-04-12T02:14:07+05:30
export function toIst(ms: number): string {
  const d = new Date(Math.round(ms / 1000) * 1000 + IST_OFFSET);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:30`
  );
}

export function istDate(ms: number): string {
  return toIst(ms).slice(0, 10);
}

export function istHour(ms: number): number {
  return new Date(ms + IST_OFFSET).getUTCHours();
}

// 0 is Sunday.
export function istWeekday(ms: number): number {
  return new Date(ms + IST_OFFSET).getUTCDay();
}

export function addDays(date: string, days: number): string {
  return istDate(istMidnight(date) + days * DAY + 12 * HOUR);
}
