import type { Signals } from "@ledger/claims/model";
import type { GridCell } from "@ledger/detect";
import type { CSSProperties } from "react";
import { int } from "@/lib/format";
import { cn } from "@/lib/utils";

type Result = Signals["negativeSpace"];

export const CLASS_LABEL: Record<string, string> = {
  datacentre: "Data centre",
  dmz: "DMZ",
  endpoint: "Endpoint",
  cloud: "Cloud",
  ot: "OT",
};

// Short column heads, full tactic names in the title attribute.
const SHORT: Record<string, string> = {
  "Initial Access": "Initial access",
  Execution: "Execution",
  Persistence: "Persistence",
  "Privilege Escalation": "Privilege esc.",
  Stealth: "Stealth",
  "Defense Impairment": "Defense impairment",
  "Credential Access": "Credential access",
  Discovery: "Discovery",
  "Lateral Movement": "Lateral movement",
  Collection: "Collection",
  "Command and Control": "Command and control",
  Exfiltration: "Exfiltration",
  Impact: "Impact",
  "Impair Process Control": "Impair process control",
};

// The grid fills in column by column. Every cell the peers expect to hold alerts first
// shows that expectation, then what the entity's records hold. Where they hold nothing,
// the cell flips to a hatched red zero.
const WAVE_COL_MS = 45;
const WAVE_ROW_MS = 25;
export const FLIP_AT_MS = 1900;
const FLIP_STEP_MS = 230;

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function Cell({ c, wave, flip }: { c: GridCell; wave: number; flip: number }) {
  const expected = c.expected === null ? null : Math.round(c.expected);
  if (c.state === "uncovered") return <div className="h-full" title="No detection rule covers this cell" />;
  if (c.state === "quiet") {
    return (
      <div className="anim-appear flex h-full flex-col items-center justify-center gap-1" style={delay(wave)} title="Nothing expected here">
        <span className="num text-[15px] leading-none text-ink-4">0</span>
      </div>
    );
  }
  if (c.state === "negative_space") {
    return (
      <div className="relative h-full" data-state="negative_space">
        <div className="anim-appear absolute inset-0 flex flex-col items-center justify-center gap-[6px] border border-dashed border-ink-3" style={delay(wave)}>
          <span className="text-[10.5px] leading-none tracking-[0.08em] text-ink-3 uppercase">expected</span>
          <span className="num text-[18px] leading-none text-ink-2">{int(expected ?? 0)}</span>
        </div>
        <div className="anim-flip hatch-gap-soft absolute inset-0 flex flex-col items-center justify-center gap-[6px] border-2 border-gap" style={delay(flip)} data-flip>
          <span className="num text-[24px] leading-none font-semibold text-gap">0</span>
          <span className="num bg-paper-sheet px-1 text-[11px] leading-none font-medium text-gap">exp {int(expected ?? 0)}</span>
        </div>
      </div>
    );
  }
  const ratio = expected ? c.observed / expected : 1;
  const strength = Math.min(1, Math.log10(1 + c.observed) / 4);
  return (
    <div
      className={cn("anim-appear flex h-full flex-col items-center justify-center gap-[7px]", c.state === "thin" && "border border-dashed border-gap")}
      style={{ ...delay(wave), background: `color-mix(in srgb, var(--evidence) ${Math.round(5 + strength * 22)}%, var(--paper-sheet))` }}
    >
      <span className="num text-[17px] leading-none font-medium text-evidence">{int(c.observed)}</span>
      <span className="num text-[10.5px] leading-none text-ink-3">
        {expected === null ? "no peer" : c.state === "thin" ? `${Math.round(ratio * 100)}% of exp` : `exp ${int(expected)}`}
      </span>
    </div>
  );
}

export function NegativeSpaceGrid({ result }: { result: Result }) {
  const categories = result.rows[0]?.cells.map((c) => c.category) ?? [];
  const order = new Map<string, number>();
  for (const r of result.rows) for (const c of r.cells) if (c.state === "negative_space") order.set(`${r.assetClass}|${c.category}`, order.size);
  return (
    <div data-testid="negative-space-grid">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `200px repeat(${categories.length}, minmax(0, 1fr))` }}>
        <div className="flex items-end pb-2">
          <span className="label-caps">Asset class</span>
        </div>
        {categories.map((cat) => (
          <div key={cat} className="flex items-end justify-center pb-2 text-center" title={cat}>
            <span className="text-[11.5px] leading-[1.2] font-medium text-ink-2">{SHORT[cat] ?? cat}</span>
          </div>
        ))}
        {result.rows.map((row, ri) => {
          const dark = row.cells.some((c) => c.state === "negative_space");
          return (
            <div key={row.assetClass} className="contents">
              <div
                className={cn("flex flex-col justify-center gap-[6px] border-l-[3px] py-2 pl-3", dark ? "border-gap" : "border-transparent")}
                data-testid={`grid-row-${row.assetClass}`}
              >
                <span className={cn("font-serif text-[19px] leading-none", dark ? "text-gap" : "text-ink")}>{CLASS_LABEL[row.assetClass]}</span>
                <span className="num text-[12px] leading-none text-ink-2">
                  {int(row.assets)} assets{row.critical ? `, ${int(row.critical)} critical` : ""}
                </span>
              </div>
              {row.cells.map((c, ci) => (
                <div key={c.category} className="h-[78px] border border-rule-soft bg-paper-sheet" data-testid={`cell-${row.assetClass}-${c.category}`}>
                  <Cell
                    c={c}
                    wave={120 + ci * WAVE_COL_MS + ri * WAVE_ROW_MS}
                    flip={FLIP_AT_MS + FLIP_STEP_MS * (order.get(`${row.assetClass}|${c.category}`) ?? 0)}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
