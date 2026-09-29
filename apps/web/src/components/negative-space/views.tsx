"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

// Negative space two ways. The estate first, where a silent part is plain to anyone, then
// the grid by ATT&CK tactic, which is how an examiner checks what exactly is missing.
export function NegativeSpaceViews({ estate, grid }: { estate: ReactNode; grid: ReactNode }) {
  const [view, setView] = useState<"estate" | "grid">("estate");
  return (
    <section data-testid="negative-space-views" data-view={view}>
      <div className="mb-4 flex items-center gap-1 border-b border-rule" role="tablist" aria-label="View">
        {(
          [
            ["estate", "The estate"],
            ["grid", "By ATT&CK tactic"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            data-testid={`view-${id}`}
            onClick={() => setView(id)}
            className={cn(
              "-mb-px border-b-2 px-3 pb-[9px] font-serif text-[16px] leading-none transition-colors first:pl-0",
              view === id ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "estate" ? estate : grid}
    </section>
  );
}
