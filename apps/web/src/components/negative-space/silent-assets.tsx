"use client";

import type { Signals } from "@ledger/claims/model";
import { useState } from "react";
import { int } from "@/lib/format";
import { cn } from "@/lib/utils";

type Silent = Signals["negativeSpace"]["silentAssets"];

// The assets behind the empty rows, one square each, critical ones in red. Names on request.
export function SilentAssets({ assets, quarters }: { assets: Silent; quarters: string }) {
  const [names, setNames] = useState(false);
  const critical = assets.filter((s) => s.criticality === "critical").length;
  return (
    <section className="mt-6" data-testid="silent-assets">
      <div className="flex items-center justify-between gap-8">
        <h2 className="font-serif text-[18px] leading-none text-ink">
          <span className="num text-gap">{int(assets.length)}</span> assets raised nothing across {quarters},{" "}
          <span className="num text-gap">{int(critical)}</span> of them critical
        </h2>
        <button
          type="button"
          onClick={() => setNames(!names)}
          className="text-[12.5px] leading-none text-ink underline decoration-rule underline-offset-[3px] hover:decoration-ink"
          data-testid="silent-assets-toggle"
        >
          {names ? "Hide the names" : `Show all ${int(assets.length)} names`}
        </button>
      </div>
      {names ? (
        <ul className="mt-3 grid grid-cols-8 gap-x-6 gap-y-[6px] border-t border-rule pt-3">
          {assets.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-2 border-b border-rule-soft pb-[5px]">
              <span className="num truncate text-[12.5px] leading-none text-ink">{s.hostname}</span>
              <span className={cn("text-[10.5px] leading-none", s.criticality === "critical" ? "text-gap" : "text-ink-3")}>{s.criticality}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-[5px]" aria-label={`${assets.length} silent assets`}>
          {assets.map((s, i) => (
            <li
              key={s.id}
              title={`${s.hostname}, ${s.criticality}`}
              className={cn("anim-appear size-[14px] border-[1.5px]", s.criticality === "critical" ? "border-gap bg-gap-tint" : "border-ink-4 bg-paper-sheet")}
              style={{ animationDelay: `${900 + i * 18}ms` }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
