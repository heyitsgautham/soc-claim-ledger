import type { Calibration } from "@ledger/claims/model";
import { cn } from "@/lib/utils";

// Detector precision against examiner verdicts, cycle by cycle, with the version that
// ran in each cycle. A version change shows as a new tag, so the effect of a release on
// precision can be read off the row.

function pct(p: number | null): string {
  return p === null ? "" : `${Math.round(p * 100)}`;
}

export function CalibrationTable({ calibration: c, current }: { calibration: Calibration; current: string }) {
  const cols = `minmax(0,1.3fr) repeat(${c.cycles.length}, minmax(118px, 0.5fr)) 150px`;
  return (
    <section aria-label="Detector precision" data-testid="calibration-table">
      <div className="double-rule grid items-end gap-x-6 pb-[9px]" style={{ gridTemplateColumns: cols }}>
        <span className="label-caps">Detector</span>
        {c.cycles.map((cy) => (
          <span key={cy.id} className="label-caps">
            {cy.label}
            {cy.id === current && <span className="text-ink-2">, in progress</span>}
          </span>
        ))}
        <span className="label-caps text-right">All cycles</span>
      </div>
      <ol>
        {c.rows.map((r) => (
          <li key={r.detector.id} className="grid min-h-[74px] items-center gap-x-6 border-b border-rule py-[10px]" style={{ gridTemplateColumns: cols }}>
            <span className="flex min-w-0 flex-col gap-[5px]">
              <span className="font-serif text-[17px] leading-tight text-ink">{r.detector.title}</span>
              <span className="truncate text-[12px] leading-snug text-ink-3">{r.detector.question}</span>
            </span>
            {r.cells.map((cell, i) => {
              const changed = i > 0 && r.cells[i - 1]!.version !== cell.version;
              const low = cell.precision !== null && cell.precision < 0.5;
              return (
                <span key={cell.cycle} className="flex flex-col gap-[6px]" data-testid={`precision-${r.detector.id}-${cell.cycle}`}>
                  <span className="flex items-baseline gap-[3px]">
                    {cell.precision === null ? (
                      <span className="text-[13px] leading-none text-ink-4">{cell.cycle === current ? "awaiting verdicts" : "not flagged"}</span>
                    ) : (
                      <>
                        <span className={cn("num text-[24px] leading-none font-semibold", low ? "text-gap" : "text-ink")}>{pct(cell.precision)}</span>
                        <span className="text-[12px] text-ink-3">%</span>
                      </>
                    )}
                  </span>
                  <span className="relative h-[4px] w-full max-w-[110px] bg-rule-soft" aria-hidden>
                    {cell.precision !== null && (
                      <span className={cn("absolute inset-y-0 left-0", low ? "bg-gap" : "bg-evidence")} style={{ width: `${cell.precision * 100}%` }} />
                    )}
                  </span>
                  <span className="num flex items-center gap-2 text-[11px] leading-none text-ink-3">
                    <span className={cn(changed && "border border-ink px-[3px] py-[1px] text-ink")}>v{cell.version}</span>
                    {cell.reviewed > 0 && <span>n {cell.reviewed}</span>}
                  </span>
                </span>
              );
            })}
            <span className="flex flex-col items-end gap-[5px]">
              <span className="num text-[20px] leading-none text-ink">{r.pooled.precision === null ? "" : `${pct(r.pooled.precision)}%`}</span>
              <span className="num text-[11px] leading-none text-ink-3">
                {r.pooled.confirmed} of {r.pooled.confirmed + r.pooled.rejected} confirmed
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
