import type { RecordInput } from "@ledger/submission";
import { addDays, type Quarter } from "./calendar";
import type { Inventory } from "./inventory";
import type { Rng } from "./rng";

type LogSourceRow = RecordInput<"log_sources">;
type HuntRow = RecordInput<"threat_hunts">;

// Log sources and how many days each one reported this quarter. `outagesWanted` sources
// go dark for a week or more, and a few others miss a single day.
export function logSourceDays(root: Rng, inventory: Inventory, days: number, outagesWanted: number): LogSourceRow[] {
  const telemetry = root.fork("telemetry");
  const outages = new Set<string>();
  const outageable = inventory.sources.filter((s) => !s.aggregate);
  while (outages.size < Math.min(outagesWanted, outageable.length)) outages.add(telemetry.pick(outageable).id);
  return inventory.sources.map((s) => {
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
}

const HYPOTHESES: [string, string][] = [
  ["Dormant admin accounts reused after 90 days", "T1078.002"],
  ["Living-off-the-land binaries on jump hosts", "T1218"],
  ["DNS tunnelling from server VLANs", "T1071.004"],
  ["Unsigned drivers loaded on engineering workstations", "T1014"],
  ["Beacon-like periodicity in proxy logs", "T1071.001"],
  ["Persistence through WMI event subscriptions", "T1546.003"],
];

// Threat hunts, whether or not the CSE hands over the log.
export function threatHunts(root: Rng, quarter: Quarter, days: number, perQuarter: number, short: string, qtag: string): HuntRow[] {
  const hunting = root.fork("hunts");
  const threat_hunts: HuntRow[] = [];
  for (let i = 0; i < perQuarter; i++) {
    const [hypothesis, technique] = HYPOTHESES[(i + hunting.int(0, HYPOTHESES.length - 1)) % HYPOTHESES.length]!;
    threat_hunts.push({
      id: `${short}-${qtag}-H${String(i + 1).padStart(2, "0")}`,
      started_on: addDays(quarter.start, Math.floor(((i + 0.5) * days) / perQuarter)),
      hypothesis,
      technique,
      outcome: hunting.weighted(["no_finding", "finding_raised", "detection_improved"] as const, (o) => (o === "no_finding" ? 5 : 2)),
    });
  }
  return threat_hunts;
}
