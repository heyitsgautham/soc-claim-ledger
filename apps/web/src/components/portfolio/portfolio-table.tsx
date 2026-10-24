"use client";

import type { Portfolio, PortfolioEntry } from "@ledger/claims/model";
import { DETECTORS } from "@ledger/detect";
import type { Sector } from "@ledger/submission/constants";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { Sparkline } from "@/components/sparkline";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-[36px_284px_160px_146px_140px_minmax(0,1fr)_16px] items-center gap-x-7";

const SECTOR_SHORT: Record<Sector, string> = {
  power_energy: "Power & Energy",
  bfsi: "BFSI",
  telecom: "Telecom",
  transport: "Transport",
  government: "Government",
  strategic_public: "Strategic & Public",
};
const ATTENTION = 50;

// The rows arrive in the order the submissions are filed, by entity code, then glide into
// the order the risk indicator sets. The DOM is always in rank order; only transforms move.
const HOLD_MS = 900;
const GLIDE_MS = 1100;
const RANKED_AT_MS = HOLD_MS + GLIDE_MS;

export function PortfolioTable({ portfolio: p }: { portfolio: Portfolio }) {
  const list = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const ol = list.current;
    if (!ol) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ol.dataset.pf = "done";
      return;
    }
    const rows = [...ol.children] as HTMLElement[];
    const slots = rows.map((r) => r.getBoundingClientRect().top);
    const filed = [...p.entries].sort((a, b) => (a.code < b.code ? -1 : 1)).map((e) => e.code);
    const moves = rows.map((row, i) => {
      const dy = slots[filed.indexOf(row.dataset.code ?? "")]! - slots[i]!;
      return row.animate(
        [
          { transform: `translateY(${dy}px)`, offset: 0 },
          { transform: `translateY(${dy}px)`, offset: HOLD_MS / RANKED_AT_MS, easing: "cubic-bezier(0.65, 0, 0.25, 1)" },
          { transform: "none", offset: 1 },
        ],
        { duration: RANKED_AT_MS, fill: "both" },
      );
    });
    ol.dataset.pf = "run";
    return () => {
      for (const m of moves) m.cancel();
    };
  }, [p.entries]);

  return (
    <section aria-label="Attention order" data-testid="portfolio">
      <div className={cn(GRID, "double-rule pb-[9px]")}>
        <span className="label-caps">Order</span>
        <span className="label-caps">Entity</span>
        <span className="label-caps">Supervisory risk</span>
        <span className="label-caps">Last four quarters</span>
        <span className="label-caps">Ledger</span>
        <span className="label-caps">Leading finding</span>
        <span />
      </div>
      <ol ref={list} data-pf="pending" className="portfolio-rows">
        {p.entries.map((e, i) => (
          <Row key={e.code} e={e} i={i} />
        ))}
      </ol>
      <p className="mt-3 text-[12.5px] leading-snug text-ink-3">
        The indicator adds each finding&apos;s severity, weighted by how often examiners confirmed that detector in earlier cycles, on a curve from 0 to 100.
        Earlier submissions are re-run with today&apos;s detectors, so the trend compares like with like.
      </p>
    </section>
  );
}

function Row({ e, i }: { e: PortfolioEntry; i: number }) {
  const delta = e.previousRisk === null ? null : e.risk - e.previousRisk;
  const hot = e.risk >= ATTENTION;
  const lead = e.reasons[0];
  const more = e.findings - 1;
  return (
    <li className="border-b border-rule bg-paper" data-code={e.code} data-testid={`portfolio-row-${e.code}`}>
      <Link href={`/entities/${e.code}`} className={cn(GRID, "group/row min-h-[64px] py-[9px] transition-colors hover:bg-paper-deep")}>
        <span className="num anim-appear text-[14px] leading-none text-ink-3" style={{ animationDelay: `${RANKED_AT_MS + i * 30}ms` }}>
          {String(e.rank).padStart(2, "0")}
        </span>
        <span className="flex min-w-0 items-center gap-4">
          <span className="num w-[72px] shrink-0 text-[22px] leading-none font-medium whitespace-nowrap text-ink">{e.code}</span>
          <span className="flex min-w-0 flex-col gap-[4px]">
            <span className="truncate text-[13px] leading-none text-ink">{SECTOR_SHORT[e.sector]}</span>
            <span className="truncate text-[12px] leading-none text-ink-3">{e.description}</span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className={cn("num w-[36px] text-right text-[24px] leading-none font-semibold", hot ? "text-gap" : e.risk ? "text-ink" : "text-ink-4")}>
            {e.risk}
          </span>
          <span className="relative h-[8px] flex-1 bg-rule-soft">
            <span
              className={cn("anim-draw-x absolute inset-y-0 left-0 origin-left", hot ? "bg-gap" : "bg-ink-2")}
              style={{ width: `${e.risk}%`, animationDelay: `${RANKED_AT_MS - 200 + i * 45}ms` }}
            />
          </span>
        </span>
        <span className="flex items-center gap-3">
          <Sparkline values={e.trend.map((t) => t.risk)} width={96} tone={hot ? "gap" : "ink"} />
          <span className={cn("text-[12px] leading-none whitespace-nowrap", delta && delta > 0 ? "text-gap" : "text-ink-3")}>
            {delta === null || delta === 0 ? "steady" : <span className="num">{`${delta > 0 ? "+" : "−"}${Math.abs(delta)}`}</span>}
          </span>
        </span>
        <span className="flex flex-col gap-[5px] text-[12.5px] leading-none text-ink-2">
          <span>
            <span className={cn("num text-[14px] font-semibold", e.gaps ? "text-gap" : "text-ink-3")}>{e.gaps}</span> gap{e.gaps === 1 ? "" : "s"}
            <span className="text-ink-4"> · </span>
            <span className="num text-ink">{e.holds}</span> hold
          </span>
          {e.insufficient > 0 && (
            <span className="self-start border border-dashed border-ink-3 px-[5px] py-[3px] text-[11px] text-ink-2">
              <span className="num">{e.insufficient}</span> insufficient evidence
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-[5px]">
          {lead ? (
            <>
              <span className="text-[10.5px] font-medium tracking-[0.08em] text-ink-3 uppercase">{DETECTORS[lead.detector.id].title}</span>
              <span className={cn("line-clamp-2 text-[13.5px] leading-tight", hot ? "text-ink" : "text-ink-2")}>
                {lead.title}
                {more > 0 && (
                  <span className="text-ink-3">
                    {" "}
                    · <span className="num">{more}</span> more
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-[13px] leading-snug text-ink-3">
              {e.missingExports.length
                ? `No finding. The ${e.missingExports.join(", ").replace(/_/g, " ")} export is missing, so ${e.insufficient} claim${e.insufficient === 1 ? " was" : "s were"} not tested.`
                : "Clean. Every tested claim holds and no detector fired."}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 text-ink-4 group-hover/row:text-ink" aria-hidden />
      </Link>
    </li>
  );
}
