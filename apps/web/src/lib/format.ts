import type { ClaimEvaluation, Measure } from "@ledger/claims/model";

// Formatting that gives the same string on the server and in the browser, whatever
// the machine's locale or time zone. Times are always IST, the zone CSEs report in.

const MINUS = "−";
const IST_OFFSET_MS = 330 * 60_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const grouping = new Intl.NumberFormat("en-IN");

export function int(n: number): string {
  return grouping.format(Math.round(n));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 2 h 10 m, 45 m, 3 m 36 s
export function duration(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  if (s >= 3600) {
    const m = Math.round(s / 60);
    return `${Math.floor(m / 60)} h ${pad(m % 60)} m`;
  }
  if (s >= 600) return `${Math.round(s / 60)} m`;
  const rest = s % 60;
  return rest ? `${Math.floor(s / 60)} m ${pad(rest)} s` : `${Math.floor(s / 60)} m`;
}

// Short form for axis labels: 0, 30 m, 4 h, 4 h 30.
export function durationShort(minutes: number): string {
  if (minutes === 0) return "0";
  if (minutes < 60) return `${minutes} m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

function percentText(value: number, decimals: number): string {
  return `${value.toFixed(decimals)}%`;
}

export function measure(m: Measure, decimals = 0): string {
  switch (m.kind) {
    case "percent":
      return percentText(m.value, decimals);
    case "duration":
      return duration(m.seconds);
    case "fraction":
      return `${int(m.numerator)} of ${int(m.denominator)}`;
    case "count":
      return int(m.value);
  }
}

// The recomputed figure, with one decimal only where rounding would make it read
// the same as the attested figure when it is not.
export function recomputed(e: ClaimEvaluation): string {
  if (!e.recomputed) return "";
  if (e.recomputed.kind === "percent" && e.claim.attested.kind === "percent") {
    const whole = measure(e.recomputed, 0);
    const differs = Math.abs(e.recomputed.value - e.claim.attested.value) > 1e-9;
    return differs && whole === measure(e.claim.attested, 0) ? measure(e.recomputed, 1) : whole;
  }
  return measure(e.recomputed);
}

// The signed difference between evidence and claim, in the claim's own unit.
export function variance(e: ClaimEvaluation): string {
  if (!e.recomputed) return "";
  const a = e.claim.attested;
  const r = e.recomputed;
  const sign = (d: number) => (d > 0 ? "+" : d < 0 ? MINUS : "±");
  if (a.kind === "percent" && r.kind === "percent") {
    const d = r.value - a.value;
    const rounded = Math.abs(d) >= 1 ? Math.round(Math.abs(d)).toString() : Math.abs(d).toFixed(1);
    return `${sign(d)}${rounded} pts`;
  }
  if (a.kind === "duration" && r.kind === "duration") {
    const d = r.seconds - a.seconds;
    return `${sign(d)}${duration(d)}`;
  }
  if (a.kind === "fraction" && r.kind === "fraction") {
    const d = r.numerator - a.numerator;
    const noun = e.population?.noun.split(" ").pop() ?? "";
    return `${sign(d)}${int(Math.abs(d))} ${noun}`.trim();
  }
  if (a.kind === "count" && r.kind === "count") {
    const d = r.value - a.value;
    return `${sign(d)}${int(Math.abs(d))}`;
  }
  return "";
}

function istParts(ms: number) {
  const d = new Date(ms + IST_OFFSET_MS);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

// 12 Apr 02:14
export function istShort(ms: number): string {
  const p = istParts(ms);
  return `${pad(p.d)} ${MONTHS[p.mo]} ${pad(p.h)}:${pad(p.mi)}`;
}

// 2026-07-14 to 14 Jul 2026
export function day(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// 1 Apr to 30 Jun 2026
export function period(start: string, end: string): string {
  const [y1, m1, d1] = start.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = end.split("-").map(Number) as [number, number, number];
  return y1 === y2 ? `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]} ${y2}` : `${day(start)} to ${day(end)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${int(n)} ${n === 1 ? one : many}`;
}

// A measure split into numerals and units, so the interface can set numerals large in
// the numeric face and units small beside them: 2 h 10 m reads as 2h 10m, not 2 h 10 m.
export type Part = { text: string; unit: boolean };

function durationParts(seconds: number): Part[] {
  const s = Math.round(Math.abs(seconds));
  const n = (text: string | number): Part => ({ text: String(text), unit: false });
  const u = (text: string): Part => ({ text, unit: true });
  if (s >= 3600) {
    const m = Math.round(s / 60);
    return [n(Math.floor(m / 60)), u("h"), n(pad(m % 60)), u("m")];
  }
  if (s >= 600) return [n(Math.round(s / 60)), u("m")];
  const rest = s % 60;
  return rest ? [n(Math.floor(s / 60)), u("m"), n(pad(rest)), u("s")] : [n(Math.floor(s / 60)), u("m")];
}

export function parts(text: string, m: Measure): Part[] {
  switch (m.kind) {
    case "percent":
      return [
        { text: text.replace("%", ""), unit: false },
        { text: "%", unit: true },
      ];
    case "duration":
      return durationParts(m.seconds);
    case "fraction":
      return [
        { text: int(m.numerator), unit: false },
        { text: "of", unit: true },
        { text: int(m.denominator), unit: false },
      ];
    case "count":
      return [{ text: int(m.value), unit: false }];
  }
}

// The variance as parts, with the sign on the first numeral: -39 pts, +1 h 42 m.
export function varianceParts(e: ClaimEvaluation): Part[] {
  const text = variance(e);
  if (!text) return [];
  const a = e.claim.attested;
  const r = e.recomputed;
  if (a.kind === "duration" && r?.kind === "duration") {
    const out = durationParts(r.seconds - a.seconds);
    const first = out[0];
    if (first) out[0] = { text: `${text.charAt(0)}${first.text}`, unit: false };
    return out;
  }
  const [num, ...rest] = text.split(" ");
  return [{ text: num ?? text, unit: false }, ...(rest.length ? [{ text: rest.join(" "), unit: true }] : [])];
}
