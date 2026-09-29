import type { AssetClass, Disposition, Level, Priority, RecordInput } from "@ledger/submission";
import {
  addDays,
  DAY,
  HOLIDAYS,
  HOUR,
  istDate,
  istHour,
  istMidnight,
  istWeekday,
  MINUTE,
  type Quarter,
  quarterBounds,
  toIst,
} from "./calendar";
import { CLOSE_SLA_MINUTES, PLAYBOOKS, RULES, type RuleTemplate } from "./catalogue";
import { naturalNote, templatedNote } from "./notes";
import type { Inventory } from "./inventory";
import { behaviourIn, type EntityConfig, type Lognormal } from "./roster";
import { Rng } from "./rng";

// Runs one quarter of a CSE's SOC. Alerts arrive on a diurnal and weekday curve,
// L1 analysts on rotating shifts acknowledge them, P1 and some P2 and P3 detections
// become cases, cases escalate and close according to how this SOC actually works.
// Findings such as missing escalations or SLA bunching come out of that process.
// No row is ever written to make a finding appear.

type AlertRow = RecordInput<"alerts">;
type CaseRow = RecordInput<"cases">;
type EscalationRow = RecordInput<"escalations">;
type ShiftRow = RecordInput<"shifts">;
type LogSourceRow = RecordInput<"log_sources">;
type HuntRow = RecordInput<"threat_hunts">;
type RuleRow = RecordInput<"rules">;

// Hidden labels the simulator keeps about what its toggles did. A CSE never submits these.
// They exist so the simulated examiner can give verdicts with a ground truth behind them,
// and so validation can measure the detectors against it.
export type TruthLabel =
  | "skipped_l2"
  | "sla_forced_close"
  | "templated_note"
  | "weekend_understaffed"
  | "weekend_deferred"
  | "auto_close_repeat"
  | "ot_unenrolled";

export interface TruthRow {
  record: "case" | "alert" | "asset" | "shift";
  id: string;
  labels: TruthLabel[];
}

export interface QuarterOutput {
  alerts: AlertRow[];
  cases: CaseRow[];
  escalations: EscalationRow[];
  shifts: ShiftRow[];
  log_sources: LogSourceRow[];
  rules: RuleRow[];
  threat_hunts: HuntRow[];
  truth: TruthRow[];
}

// Relative alert volume by IST hour, and by weekday from Sunday.
const DIURNAL = [0.55, 0.5, 0.45, 0.45, 0.45, 0.5, 0.65, 0.85, 1.1, 1.35, 1.5, 1.55, 1.5, 1.45, 1.5, 1.5, 1.4, 1.25, 1.05, 0.9, 0.8, 0.7, 0.65, 0.6];
const WEEKDAY = [0.7, 1.08, 1.1, 1.1, 1.08, 1.05, 0.8];
const DIURNAL_MEAN = DIURNAL.reduce((a, b) => a + b, 0) / DIURNAL.length;
const WEEKDAY_MEAN = WEEKDAY.reduce((a, b) => a + b, 0) / WEEKDAY.length;

// Share of detections by priority. Bursts of P1 and P2 alerts lift their alert share
// to roughly 0.5% and 5%.
const PRIORITY_MIX: [Priority, number][] = [
  ["P1", 0.0042],
  ["P2", 0.044],
  ["P3", 0.24],
  ["P4", 1 - 0.0042 - 0.044 - 0.24],
];
const BURST_EXTRA: Record<Priority, number> = { P1: 0.3, P2: 0.2, P3: 0.08, P4: 0 };

const SHIFT_LENGTH = 8 * HOUR;
// Shifts run 06:00 to 14:00 (A), 14:00 to 22:00 (B) and 22:00 to 06:00 (C) IST.
// Rotation counts from this fixed anchor so teams keep their pattern across quarters.
const ROTATION_ANCHOR = istMidnight("2025-01-01") - 2 * HOUR;

interface Slot {
  start: number;
  end: number;
  rotation: number;
  row: ShiftRow;
  l1: string[];
  l2: string;
  l3: string;
}

interface Detection {
  at: number;
  priority: Priority;
  rule: RuleTemplate;
  assetId: string;
  size: number;
  storm: boolean;
  // Set on the weekly repeat of a recurring detection, counting from zero.
  repeat?: { occurrence: number; autoClose: boolean };
}

interface Candidates {
  ids: string[];
  cumulative: number[];
}

function isWeekend(ms: number): boolean {
  const d = istWeekday(ms);
  return d === 0 || d === 6;
}

// 09:00 IST on the Monday after a weekend moment.
function mondayMorning(ms: number): number {
  const d = istWeekday(ms);
  const daysAhead = d === 6 ? 2 : 1;
  return istMidnight(istDate(ms)) + daysAhead * DAY + 9 * HOUR;
}

function isNight(ms: number): boolean {
  const h = istHour(ms);
  return h >= 22 || h < 6;
}

function sample(rng: Rng, dist: Lognormal): number {
  return rng.lognormal(dist.medianMin, dist.sigma);
}

function pickDisposition(rng: Rng, table: [Disposition, number][]): Disposition {
  return rng.weighted(table, ([, w]) => w)[0];
}

export function simulateQuarter(entity: EntityConfig, inventory: Inventory, quarter: Quarter): QuarterOutput {
  const root = new Rng(`${entity.seed}/${quarter.id}`);
  const behaviour = behaviourIn(entity, quarter.id);
  const { start, end, days } = quarterBounds(quarter);
  const short = inventory.short;
  const qtag = quarter.id.replace("FY", "").replace("-", ""); // 27Q1

  // Shifts overlapping the quarter, from the C shift that starts at 22:00 the evening before.
  const l1 = inventory.analysts.filter((a) => a.level === "L1").map((a) => a.id);
  const l2 = inventory.analysts.filter((a) => a.level === "L2").map((a) => a.id);
  const l3 = inventory.analysts.filter((a) => a.level === "L3").map((a) => a.id);
  const { l1Teams, l1PerTeam } = entity.staffing;
  const slots: Slot[] = [];
  for (let s = start - 2 * HOUR; s < end; s += SHIFT_LENGTH) {
    const rotation = Math.round((s - ROTATION_ANCHOR) / SHIFT_LENGTH);
    const team = rotation % l1Teams;
    const rostered = l1.slice(team * l1PerTeam, team * l1PerTeam + l1PerTeam);
    const weekendShort = behaviour.weekend !== null && isWeekend(s);
    const onDuty = weekendShort ? rostered.slice(0, behaviour.weekend!.l1OnDuty) : rostered;
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
  const truth: TruthRow[] = [];
  for (const slot of slots) {
    if (behaviour.weekend && isWeekend(slot.start)) truth.push({ record: "shift", id: slot.row.id, labels: ["weekend_understaffed"] });
  }
  for (const a of inventory.assets) {
    if (a.asset_class === "ot" && a.log_source_id === null) truth.push({ record: "asset", id: a.id, labels: ["ot_unenrolled"] });
  }

  const slotAt = (ms: number): Slot => {
    const i = Math.floor((ms - slots[0]!.start) / SHIFT_LENGTH);
    return slots[Math.max(0, Math.min(slots.length - 1, i))]!;
  };

  // Which assets each rule can fire on. A rule only sees assets a log source watches,
  // so OT rules go silent when the OT sensors were never enrolled.
  const monitored = inventory.assets.filter((a) => a.log_source_id !== null);
  const candidates = new Map<string, Candidates>();
  for (const rule of RULES) {
    const ids: string[] = [];
    const cumulative: number[] = [];
    let total = 0;
    for (const asset of monitored) {
      if (!rule.asset_classes.includes(asset.asset_class as AssetClass)) continue;
      total += inventory.noise.get(asset.id) ?? 1;
      ids.push(asset.id);
      cumulative.push(total);
    }
    if (ids.length) candidates.set(rule.id, { ids, cumulative });
  }
  const liveRules = RULES.filter((r) => candidates.has(r.id));
  const rulesByPriority = new Map<Priority, RuleTemplate[]>();
  for (const [p] of PRIORITY_MIX) rulesByPriority.set(p, liveRules.filter((r) => r.priority === p));

  const pickAsset = (rng: Rng, rule: RuleTemplate): string => {
    const c = candidates.get(rule.id)!;
    const target = rng.next() * c.cumulative[c.cumulative.length - 1]!;
    let lo = 0;
    let hi = c.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (c.cumulative[mid]! > target) hi = mid;
      else lo = mid + 1;
    }
    return c.ids[lo]!;
  };

  // Detections, hour by hour.
  const arrivals = root.fork("arrivals");
  const detections: Detection[] = [];
  const detectionsPerDay = entity.alertsPerDay / 1.06;
  for (let d = 0; d < days; d++) {
    const date = addDays(quarter.start, d);
    const holiday = HOLIDAYS.has(date) ? 0.72 : 1;
    for (let h = 0; h < 24; h++) {
      const hourStart = start + d * DAY + h * HOUR;
      const weekday = istWeekday(hourStart);
      const lambda = (detectionsPerDay / 24) * (DIURNAL[h]! / DIURNAL_MEAN) * (WEEKDAY[weekday]! / WEEKDAY_MEAN) * holiday;
      const n = arrivals.poisson(lambda);
      for (let k = 0; k < n; k++) {
        const priority = arrivals.weighted(PRIORITY_MIX, ([, w]) => w)[0];
        const pool = rulesByPriority.get(priority)!;
        const rule = arrivals.weighted(pool, (r) => r.weight);
        detections.push({
          at: hourStart + arrivals.next() * HOUR,
          priority,
          rule,
          assetId: pickAsset(arrivals, rule),
          size: 1 + arrivals.poisson(BURST_EXTRA[priority]),
          storm: false,
        });
      }
    }
  }

  // One dedupe storm a quarter: a service account with an expired password trips the
  // failed-logon rule thousands of times in a morning, and the SOC bulk-acknowledges it.
  const stormRng = root.fork("storm");
  const stormRule = RULES.find((r) => r.id === "R-4001")!;
  const stormAsset = pickAsset(stormRng, stormRule);
  const stormStart = start + stormRng.int(10, days - 10) * DAY + 9 * HOUR;
  const stormSize = stormRng.int(2200, 2800);
  for (let i = 0; i < stormSize; i++) {
    detections.push({ at: stormStart + stormRng.next() * 5 * HOUR, priority: "P4", rule: stormRule, assetId: stormAsset, size: 1, storm: true });
  }

  // Recurring detections. The same host trips the same rule about once a week.
  const rec = behaviour.recurring;
  if (rec && rec.assets > 0) {
    const rr = root.fork("recurring");
    const rule = RULES.find((r) => r.id === "R-3002")!;
    const hosts = new Set<string>();
    while (hosts.size < rec.assets) hosts.add(pickAsset(rr, rule));
    for (const assetId of hosts) {
      const firstDay = rr.int(0, 6);
      const hour = rr.int(9, 17);
      const weeks = Math.floor((days - firstDay) / 7);
      // A working SOC opens a case on the third repeat and the host stops alerting.
      const occurrences = rec.autoClose ? weeks : Math.min(weeks, 3);
      for (let k = 0; k < occurrences; k++) {
        detections.push({
          at: start + (firstDay + 7 * k) * DAY + hour * HOUR + rr.uniform(0, 50) * MINUTE,
          priority: "P3",
          rule,
          assetId,
          size: 1,
          storm: false,
          repeat: { occurrence: k, autoClose: rec.autoClose },
        });
      }
    }
  }
  detections.sort((a, b) => a.at - b.at);

  // Alerts. Each detection is a burst of one or more alerts on the same asset and rule.
  interface Pending {
    row: AlertRow;
    at: number;
    detection: number;
    index: number;
  }
  const pending: Pending[] = [];
  const burst = root.fork("bursts");
  detections.forEach((det, i) => {
    let t = det.at;
    for (let j = 0; j < det.size; j++) {
      if (j > 0) t += burst.exponential(2.5) * MINUTE;
      pending.push({
        at: t,
        detection: i,
        index: j,
        row: {
          id: "",
          created_at: "",
          rule_id: det.rule.id,
          priority: det.priority,
          asset_id: det.assetId,
          acknowledged_at: null,
          acknowledged_by: null,
          case_id: null,
        },
      });
    }
  });
  pending.sort((a, b) => a.at - b.at || a.detection - b.detection || a.index - b.index);

  // Acknowledgement. P1 and P2 interrupt whoever is on shift. P3 and P4 wait in a
  // first-in queue for the next free L1. Storm alerts are bulk-acknowledged every half hour.
  const desk = root.fork("desk");
  const freeAt = new Map<string, number>();
  const firstAck = new Map<number, { at: number; by: string }>();
  const serviceMin: Record<Priority, Lognormal> = {
    P1: { medianMin: 14, sigma: 0.4 },
    P2: { medianMin: 11, sigma: 0.4 },
    P3: { medianMin: 4, sigma: 0.5 },
    P4: { medianMin: 1.1, sigma: 0.5 },
  };
  const queueAck = (arrival: number, service: number): { at: number; by: string } => {
    let t = arrival;
    for (;;) {
      const slot = slotAt(t);
      let best = "";
      let bestAt = Infinity;
      for (const a of slot.l1) {
        const at = Math.max(freeAt.get(a) ?? 0, slot.start, t);
        if (at < bestAt) {
          bestAt = at;
          best = a;
        }
      }
      if (bestAt < slot.end || slot === slots[slots.length - 1]) {
        const at = bestAt + desk.exponential(0.6) * MINUTE;
        freeAt.set(best, at + service * MINUTE);
        return { at, by: best };
      }
      t = slot.end;
    }
  };

  let seq = 0;
  for (const p of pending) {
    seq++;
    p.row.id = `${short}-${qtag}-A${String(seq).padStart(6, "0")}`;
    p.row.created_at = toIst(p.at);
    const det = detections[p.detection]!;
    const pr = det.priority;
    let ack: { at: number; by: string } | null;

    if (det.repeat?.autoClose) {
      ack = { at: p.at + desk.uniform(20, 90) * 1000, by: "SOAR-AUTOCLOSE" };
      truth.push({ record: "alert", id: p.row.id, labels: ["auto_close_repeat"] });
    } else if (det.storm) {
      const slot = slotAt(p.at);
      const bulk = Math.ceil((p.at - stormStart) / (30 * MINUTE)) * 30 * MINUTE + stormStart + 4 * MINUTE;
      ack = { at: bulk, by: slot.l1[0]! };
    } else if (pr === "P1" || pr === "P2") {
      const lead = firstAck.get(p.detection);
      if (lead) {
        ack = { at: Math.max(p.at, lead.at) + desk.uniform(0.3, 2) * MINUTE, by: lead.by };
      } else {
        const mean = pr === "P1" ? entity.handling.p1AckMeanMin : entity.handling.p2AckMeanMin;
        const weekendSlow = behaviour.weekend && isWeekend(p.at) ? behaviour.weekend.ackMultiplier : 1;
        const at = p.at + (0.4 + desk.exponential(mean)) * (isNight(p.at) ? 1.2 : 1) * weekendSlow * MINUTE;
        const by = desk.pick(slotAt(at).l1);
        freeAt.set(by, Math.max(freeAt.get(by) ?? 0, at) + sample(desk, serviceMin[pr]) * MINUTE);
        ack = { at, by };
      }
    } else if (pr === "P4" && desk.chance(0.035)) {
      ack = null; // auto-suppressed by a tuning rule, never touched by an analyst
    } else {
      ack = queueAck(p.at, sample(desk, serviceMin[pr]));
    }

    if (ack) {
      p.row.acknowledged_at = toIst(ack.at);
      p.row.acknowledged_by = ack.by;
      if (p.index === 0) firstAck.set(p.detection, ack);
    }
  }

  // Cases and escalations.
  const work = root.fork("cases");
  const cases: CaseRow[] = [];
  const escalations: EscalationRow[] = [];
  const caseByDetection = new Map<number, string>();
  const b = behaviour;
  const h = entity.handling;

  const escalate = (caseId: string, from: Level, to: Level, at: number, by: string, reason: string) => {
    escalations.push({
      id: `${short}-${qtag}-E${String(escalations.length + 1).padStart(4, "0")}`,
      case_id: caseId,
      from_level: from,
      to_level: to,
      escalated_at: toIst(at),
      escalated_by: by,
      reason,
    });
  };

  const opened = detections
    .map((det, i) => ({ det, i, ack: firstAck.get(i) }))
    .filter((x): x is { det: Detection; i: number; ack: { at: number; by: string } } => !!x.ack && !x.det.storm)
    .filter(({ det }) => {
      if (det.repeat) return !det.repeat.autoClose && det.repeat.occurrence === 2;
      if (det.priority === "P1") return true;
      if (det.priority === "P2") return work.chance(h.p2CaseRate);
      if (det.priority === "P3") return work.chance(h.p3CaseRate);
      return false;
    })
    .sort((a, b2) => a.ack.at - b2.ack.at);

  for (const { det, i, ack } of opened) {
    const id = `${short}-${qtag}-C${String(cases.length + 1).padStart(4, "0")}`;
    caseByDetection.set(i, id);
    const sla = CLOSE_SLA_MINUTES[det.priority];
    const openedAt = ack.at;
    let closeMin: number;
    let closedBy = ack.by;
    let disposition: Disposition;
    // Each case draws from its own stream, so a tuning change that alters one case's
    // path never reshuffles the cases after it.
    const r = work.fork(id);
    const labels: TruthLabel[] = [];
    let escalatedAt: number | null = null;

    if (det.priority === "P1") {
      const triage = sample(r, h.p1Triage) * (isNight(openedAt) ? 1.35 : 1);
      const skipped = r.chance(b.skipL2OnP1);
      let toL3 = 0;
      if (skipped) labels.push("skipped_l2");
      if (!skipped) {
        escalatedAt = openedAt + triage * MINUTE;
        const oncall = slotAt(escalatedAt).l2;
        escalate(id, "L1", "L2", escalatedAt, ack.by, `Critical alert triaged, handed to L2 per ${PLAYBOOKS[det.rule.tactic]}`);
        closedBy = oncall;
        if (r.chance(0.2)) {
          toL3 = escalatedAt + r.lognormal(14, 0.4) * MINUTE;
          escalate(id, "L2", "L3", toL3, oncall, "Suspected compromise, forensic acquisition requested");
        }
      }
      closeMin = Math.max(sample(r, escalatedAt ? h.p1CloseEscalated : h.p1CloseL1Only), triage + 10, toL3 ? (toL3 - openedAt) / MINUTE + 5 : 0);
      if (b.closeAtSlaMinus && closeMin >= sla - 5) {
        const p = escalatedAt ? b.closeAtSlaMinus.escalated : b.closeAtSlaMinus.notEscalated;
        if (r.chance(p)) {
          closeMin = sla - r.triangular(0.2, 1.7, 4.9);
          labels.push("sla_forced_close");
        }
      }
      disposition = escalatedAt
        ? pickDisposition(r, [["true_positive_contained", 50], ["true_positive_remediated", 15], ["benign_positive", 22], ["false_positive", 13]])
        : pickDisposition(r, [["false_positive", 42], ["benign_positive", 38], ["inconclusive", 20]]);
    } else if (det.priority === "P2") {
      closeMin = sample(r, h.p2Close);
      if (r.chance(h.p2EscalationRate)) {
        const at = openedAt + r.lognormal(25, 0.6) * MINUTE;
        escalatedAt = at;
        const oncall = slotAt(at).l2;
        escalate(id, "L1", "L2", at, ack.by, "Needs host containment decision");
        closedBy = oncall;
        closeMin = Math.max(closeMin, (at - openedAt) / MINUTE + 15);
      }
      disposition = pickDisposition(r, [["true_positive_contained", 35], ["benign_positive", 30], ["false_positive", 30], ["duplicate", 5]]);
    } else if (det.repeat) {
      // The third weekly repeat on the same host. The analyst opens a case and has it reimaged.
      closeMin = sample(r, { medianMin: 900, sigma: 0.4 });
      disposition = "true_positive_remediated";
    } else {
      closeMin = sample(r, h.p3Close);
      if (r.chance(0.05)) {
        const at = openedAt + r.lognormal(60, 0.6) * MINUTE;
        escalate(id, "L1", "L2", at, ack.by, "Pattern across hosts, L2 review");
        closedBy = slotAt(at).l2;
        closeMin = Math.max(closeMin, (at - openedAt) / MINUTE + 20);
      }
      disposition = pickDisposition(r, [["false_positive", 34], ["benign_positive", 40], ["true_positive_contained", 18], ["duplicate", 8]]);
    }

    // Weekend cases wait for the Monday morning shift when the desk is unstaffed.
    if (b.weekend && isWeekend(openedAt)) {
      const wr = r.fork("weekend");
      if (wr.chance(b.weekend.deferToMonday)) {
        const monday = (mondayMorning(openedAt) - openedAt) / MINUTE + wr.lognormal(50, 0.5);
        if (monday > closeMin) {
          closeMin = monday;
          labels.push("weekend_deferred");
        }
      }
    }

    // The closure note, from its own stream so notes never move the numbers above.
    const nr = r.fork("note");
    const host = inventory.assets.find((a) => a.id === det.assetId)?.hostname ?? det.assetId;
    const tn = b.templatedNotes;
    const pasted =
      tn !== null &&
      nr.chance(tn.probability) &&
      (tn.scope === "p1_unescalated" ? det.priority === "P1" && escalatedAt === null : tn.analysts.includes(closedBy));
    if (pasted) labels.push("templated_note");
    const note = det.repeat
      ? `Third weekly ${det.rule.name.toLowerCase()} on ${host}. Raised with desktop support, host reimaged and the download source blocked at the proxy.`
      : pasted
        ? templatedNote(host)
        : naturalNote(nr, det.rule, host, disposition);
    if (labels.length) truth.push({ record: "case", id, labels });

    cases.push({
      id,
      priority: det.priority,
      opened_at: toIst(openedAt),
      rule_id: det.rule.id,
      asset_id: det.assetId,
      alert_count: det.size,
      owner: ack.by,
      playbook_id: PLAYBOOKS[det.rule.tactic] ?? null,
      sla_close_minutes: sla,
      closed_at: toIst(openedAt + closeMin * MINUTE),
      closed_by: closedBy,
      disposition: r.chance(h.missingDispositionRate) ? null : disposition,
      note,
    });
  }

  for (const p of pending) p.row.case_id = caseByDetection.get(p.detection) ?? null;
  escalations.sort((a, b2) => (a.escalated_at < b2.escalated_at ? -1 : a.escalated_at > b2.escalated_at ? 1 : 0));

  // Log sources and how many days each one reported this quarter.
  const telemetry = root.fork("telemetry");
  const outages = new Set<string>();
  const outageable = inventory.sources.filter((s) => !s.aggregate);
  while (outages.size < Math.min(h.logSourceOutages, outageable.length)) outages.add(telemetry.pick(outageable).id);
  const log_sources: LogSourceRow[] = inventory.sources.map((s) => {
    const full = days;
    let reporting = full;
    if (outages.has(s.id)) reporting = full - telemetry.int(6, 22);
    else if (telemetry.chance(0.08)) reporting = full - 1;
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      asset_class: s.asset_class,
      onboarded_on: s.onboarded_on,
      days_expected: full,
      days_reporting: reporting,
    };
  });

  // Threat hunts, whether or not the CSE hands over the log.
  const hunting = root.fork("hunts");
  const hypotheses: [string, string][] = [
    ["Dormant admin accounts reused after 90 days", "T1078.002"],
    ["Living-off-the-land binaries on jump hosts", "T1218"],
    ["DNS tunnelling from server VLANs", "T1071.004"],
    ["Unsigned drivers loaded on engineering workstations", "T1014"],
    ["Beacon-like periodicity in proxy logs", "T1071.001"],
    ["Persistence through WMI event subscriptions", "T1546.003"],
  ];
  const threat_hunts: HuntRow[] = [];
  for (let i = 0; i < b.threatHuntsPerQuarter; i++) {
    const [hypothesis, technique] = hypotheses[(i + hunting.int(0, hypotheses.length - 1)) % hypotheses.length]!;
    threat_hunts.push({
      id: `${short}-${qtag}-H${String(i + 1).padStart(2, "0")}`,
      started_on: addDays(quarter.start, Math.floor(((i + 0.5) * days) / b.threatHuntsPerQuarter)),
      hypothesis,
      technique,
      outcome: hunting.weighted(["no_finding", "finding_raised", "detection_improved"] as const, (o) => (o === "no_finding" ? 5 : 2)),
    });
  }

  return {
    alerts: pending.map((p) => p.row),
    cases,
    escalations,
    shifts: slots.map((s) => s.row),
    log_sources,
    rules: RULES.map(({ weight: _w, ...rule }) => rule),
    threat_hunts,
    truth,
  };
}
