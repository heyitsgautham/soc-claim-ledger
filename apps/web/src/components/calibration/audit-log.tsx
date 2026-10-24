import type { AuditEntry } from "@ledger/claims/model";
import { cn } from "@/lib/utils";

const ACTION: Record<AuditEntry["action"], string> = {
  verdict_recorded: "Verdict",
  detector_released: "Release",
  assessment_run: "Assessment",
  report_exported: "Report",
};

// Append-only. Newest first.
export function AuditLog({ entries, highlightSince }: { entries: AuditEntry[]; highlightSince: string | null }) {
  return (
    <section aria-label="Audit log" data-testid="audit-log" className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-serif text-[18px] leading-none text-ink">Audit log</h2>
        <span className="text-[12px] text-ink-3">append-only, newest first</span>
      </div>
      <ol className="border-t border-ink">
        {entries.map((e, i) => {
          const fresh = highlightSince !== null && e.at >= highlightSince && e.actor !== "SYSTEM";
          return (
            <li
              key={`${e.at}-${i}`}
              className={cn(
                "grid grid-cols-[112px_62px_76px_minmax(0,1fr)] items-baseline gap-x-3 border-b border-rule-soft py-[7px]",
                fresh && "anim-settle bg-paper-deep",
              )}
            >
              <span className="num text-[11.5px] leading-none text-ink-3">{e.at.slice(0, 16).replace("T", " ")}</span>
              <span className="num text-[11.5px] leading-none text-ink-2">{e.actor}</span>
              <span
                className={cn(
                  "text-[11px] leading-none font-medium tracking-[0.08em] uppercase",
                  e.action === "detector_released" ? "text-evidence" : "text-ink-2",
                )}
              >
                {ACTION[e.action]}
              </span>
              <span className="min-w-0 truncate text-[12.5px] leading-none text-ink">
                <span className="num">{e.subject}</span> <span className="text-ink-2">{e.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
