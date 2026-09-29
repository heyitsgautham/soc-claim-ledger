"use client";

import type { EvidenceSection, Tone } from "@ledger/claims/model";
import { useEffect, useState } from "react";
import { int } from "@/lib/format";
import { cn } from "@/lib/utils";

type Breakdown = Extract<EvidenceSection, { type: "breakdown" }>;

// Where every record in the population went. Up to a few hundred records, one mark
// per record, like an examiner's tally. When the analysis kept the order the records
// arrived in, the marks land in that order, take their colour where they stand, and
// then sort into their parts. Beyond the limit, a proportional bar.

const UNIT_LIMIT = 160;
const GAP_SLOTS = 4;
const COLOUR_AT_MS = 2300;
const SORT_AT_MS = 3500;

const FILL: Record<Tone, string> = {
  evidence: "bg-evidence",
  gap: "bg-gap",
  gap_soft: "hatch-gap",
  muted: "bg-ink-4",
};

// Each section sorts once per page load. Opening it again shows it sorted.
const played = new Set<string>();

export function Tally({ section }: { section: Breakdown }) {
  const parts = section.parts.filter((p) => p.count > 0);
  const units = section.total <= UNIT_LIMIT;
  const seq = units && section.sequence?.length === section.total ? section.sequence : null;
  const [stage, setStage] = useState<0 | 1 | 2>(() => (seq && !played.has(section.id) ? 0 : 2));

  // Runs once, when the drawer first shows this section.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the sort plays once per section, on mount
  useEffect(() => {
    if (stage === 2) return;
    played.add(section.id);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage(2);
      return;
    }
    const a = window.setTimeout(() => setStage(1), COLOUR_AT_MS);
    const b = window.setTimeout(() => setStage(2), SORT_AT_MS);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);

  return (
    <figure className="flex flex-col gap-3" data-testid={`tally-${section.id}`} data-stage={stage}>
      <figcaption className="flex items-baseline justify-between gap-6">
        <span className="font-serif text-[16px] leading-none text-ink">{section.title}</span>
        <span className="text-[12.5px] leading-none text-ink-3">
          <span className="num text-ink-2">{int(section.total)}</span> {section.noun}
          {units && ", one mark each"}
        </span>
      </figcaption>

      {seq ? (
        <SortingMarks parts={parts} sequence={seq} total={section.total} stage={stage} />
      ) : units ? (
        <div className="flex h-[30px] items-stretch gap-[9px]" aria-hidden>
          {parts.map((p, gi) => (
            <div key={p.key} className="flex min-w-0 shrink items-stretch gap-[2px]">
              {Array.from({ length: p.count }, (_, i) => (
                <span
                  key={i}
                  className={cn("anim-rise-y w-[6px] min-w-[2px] shrink", FILL[p.tone])}
                  style={{ animationDelay: `${160 + gi * 90 + Math.min(i, 60) * 4}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[14px] gap-[3px]" aria-hidden>
          {parts.map((p) => (
            <span key={p.key} className={cn("h-full", FILL[p.tone])} style={{ flexGrow: p.count, flexBasis: 0 }} />
          ))}
        </div>
      )}

      <ul className={cn("flex flex-wrap gap-x-7 gap-y-1.5 transition-opacity duration-500", stage === 2 ? "opacity-100" : "opacity-0")}>
        {section.parts.map((p) => (
          <li key={p.key} className="flex items-baseline gap-2 text-[13px] leading-none text-ink-2">
            <span className={cn("inline-block size-[9px] translate-y-[0px] self-center", FILL[p.tone])} aria-hidden />
            <span className={cn("num text-[15px] font-semibold", p.tone === "gap" ? "text-gap" : p.tone === "evidence" ? "text-evidence" : "text-ink")}>
              {int(p.count)}
            </span>
            {p.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function SortingMarks({ parts, sequence, total, stage }: { parts: Breakdown["parts"]; sequence: string[]; total: number; stage: 0 | 1 | 2 }) {
  const slots = total + GAP_SLOTS * (parts.length - 1);
  const slot = 100 / slots;
  const start = new Map<string, number>();
  let at = 0;
  for (const p of parts) {
    start.set(p.key, at);
    at += p.count + GAP_SLOTS;
  }
  const tone = new Map(parts.map((p) => [p.key, p.tone]));
  const seen = new Map<string, number>();
  return (
    <div className="relative h-[30px]" aria-hidden data-testid="tally-marks">
      {sequence.map((key, k) => {
        const j = seen.get(key) ?? 0;
        seen.set(key, j + 1);
        const sorted = (start.get(key) ?? 0) + j;
        const arriving = (k * slots) / total;
        return (
          <span
            key={k}
            className={cn("anim-rise-y absolute inset-y-0", stage === 0 ? "bg-ink-4" : FILL[tone.get(key) ?? "muted"])}
            style={{
              left: `${(stage === 2 ? sorted : arriving) * slot}%`,
              width: `${slot * 0.72}%`,
              animationDelay: `${150 + k * 5}ms`,
              transition: `left 950ms cubic-bezier(0.65, 0, 0.25, 1) ${(k % 23) * 9}ms, background-color 420ms ease-out ${(k % 11) * 14}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
