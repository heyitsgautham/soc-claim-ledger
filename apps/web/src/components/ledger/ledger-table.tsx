"use client";

import { type ClaimEvaluation, SECTION_LABELS, type Status } from "@ledger/claims/model";
import { Check, ChevronRight } from "lucide-react";
import { FindingText } from "@/components/finding-text";
import { Quantity } from "@/components/quantity";
import { int, measure, parts, recomputed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GapTrack } from "./gap-track";
import { StatusMark } from "./status-mark";
import { vt } from "./transition";

// The ledger. Gaps first, then claims the submission cannot test, then claims that hold,
// each group in questionnaire order. Every row opens the records behind it.

const GROUPS: { status: Status; title: string; note: string }[] = [
  { status: "gap", title: "Gap", note: "The entity's own records contradict the claim." },
  {
    status: "insufficient_evidence",
    title: "Insufficient evidence",
    note: "The submission lacks the records to test it. A question for the entity, not a finding.",
  },
  { status: "holds", title: "Holds", note: "The records support the claim." },
];

// Laptop widths first, then the 1920 recording layout from 1680 up.
export const LEDGER_GRID =
  "grid grid-cols-[76px_minmax(0,1.2fr)_140px_minmax(250px,1fr)_172px_128px_14px] items-center gap-x-5 min-[1680px]:grid-cols-[80px_minmax(0,1.15fr)_170px_minmax(280px,1fr)_208px_150px_16px] min-[1680px]:gap-x-7";

const ROW_STAGGER_MS = 170;
const FIRST_BAR_MS = 450;

export function basis(e: ClaimEvaluation, withWindow = true): string {
  if (!e.population) return "";
  const { count, noun } = e.population;
  if (e.kind === "fraction") return withWindow && e.window.length > 1 ? `${noun}, ${e.window.length} quarters` : noun;
  if (e.kind === "duration") return `mean of ${int(count)} ${noun}`;
  if (e.matched !== null && e.kind !== "count") return `${int(e.matched)} of ${int(count)} ${noun}`;
  if (e.kind === "count" && e.matched !== null && e.matched !== count) return `${int(e.matched)} of ${int(count)} ${noun}`;
  return noun;
}

export function LedgerTable({
  evaluations,
  selected,
  onOpen,
  introDelayMs = 0,
}: {
  evaluations: ClaimEvaluation[];
  selected: string | null;
  onOpen: (ref: string) => void;
  // Holds the bars back while the claims arrive from the signed report.
  introDelayMs?: number;
}) {
  let gapIndex = 0;
  return (
    <section aria-label="Claim-versus-evidence ledger" data-testid="ledger">
      <div className={cn(LEDGER_GRID, "double-rule pb-[9px]")}>
        <span className="label-caps">Item</span>
        <span className="label-caps">Claim, as attested</span>
        <span className="label-caps text-right">Attested</span>
        <span className="label-caps text-center">Gap, on the claim&apos;s own scale</span>
        <span className="label-caps">Recomputed</span>
        <span className="label-caps">Finding</span>
        <span />
      </div>

      {GROUPS.map((group) => {
        const rows = evaluations.filter((e) => e.status === group.status);
        if (!rows.length) return null;
        const major = group.status !== "holds";
        return (
          <div key={group.status} data-testid={`ledger-group-${group.status}`}>
            <div className="flex items-baseline gap-3 border-b border-ink/70 pt-5 pb-[7px]">
              <h3 className={cn("font-serif text-[17px] leading-none font-medium", group.status === "gap" ? "text-gap" : "text-ink")}>
                {group.title}
              </h3>
              <span className="num text-[13px] leading-none text-ink-3">{rows.length}</span>
              <span className="text-[12.5px] leading-none text-ink-3">{group.note}</span>
            </div>
            {major ? (
              <ul>
                {rows.map((e) => {
                  const delay = e.status === "gap" ? introDelayMs + FIRST_BAR_MS + gapIndex++ * ROW_STAGGER_MS : 0;
                  return <LedgerRow key={e.claim.ref} evaluation={e} delayMs={delay} selected={selected === e.claim.ref} onOpen={onOpen} />;
                })}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-10 min-[1680px]:grid-cols-3 min-[1680px]:gap-x-12">
                {rows.map((e) => (
                  <HoldRow key={e.claim.ref} evaluation={e} selected={selected === e.claim.ref} onOpen={onOpen} />
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className={cn("mt-0 flex items-baseline justify-between border-t-[3px] border-double border-ink pt-3 text-[12.5px] text-ink-3")}>
        <span>
          <span className="num text-ink-2">{evaluations.length}</span> attested figures ·{" "}
          <span className="num text-gap">{evaluations.filter((e) => e.status === "gap").length}</span> gaps ·{" "}
          <span className="num text-ink-2">{evaluations.filter((e) => e.status === "insufficient_evidence").length}</span> insufficient evidence ·{" "}
          <span className="num text-ink-2">{evaluations.filter((e) => e.status === "holds").length}</span> hold
        </span>
        <span>Tolerance 2 points on shares, 10% on times, exact on counts</span>
      </div>
    </section>
  );
}

function HoldRow({ evaluation: e, selected, onOpen }: { evaluation: ClaimEvaluation; selected: boolean; onOpen: (ref: string) => void }) {
  return (
    <li className="border-b border-rule">
      <button
        type="button"
        data-testid={`ledger-row-${e.claim.ref}`}
        aria-pressed={selected}
        onClick={() => onOpen(e.claim.ref)}
        className={cn(
          "group/row grid h-[40px] w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)_auto_18px] items-center gap-x-3 text-left transition-colors hover:bg-paper-deep",
          selected && "bg-paper-deep",
        )}
      >
        <span className="num text-[12.5px] leading-none text-ink-3">{e.claim.ref}</span>
        <span className="truncate font-serif text-[15px] leading-none text-ink">
          <span className="inline-block max-w-full">
            {e.claim.text}
          </span>
        </span>
        <span className="flex items-baseline gap-2 text-[15px] leading-none whitespace-nowrap">
          <span className="inline-block">
            <Quantity parts={parts(measure(e.claim.attested), e.claim.attested)} className="font-medium text-ink" unitClassName="text-[0.78em] text-ink-2" />
          </span>
          <span className="text-[11px] text-ink-4">against</span>
          <span className="inline-block">
            <Quantity parts={parts(recomputed(e), e.recomputed!)} className="font-semibold text-evidence" unitClassName="text-[0.78em]" />
          </span>
        </span>
        <Check className="size-[14px] text-ink-3" strokeWidth={2.25} aria-label="Holds" />
      </button>
    </li>
  );
}

function LedgerRow({
  evaluation: e,
  delayMs,
  selected,
  onOpen,
}: {
  evaluation: ClaimEvaluation;
  delayMs: number;
  selected: boolean;
  onOpen: (ref: string) => void;
}) {
  const isGap = e.status === "gap";
  const untestable = e.status === "insufficient_evidence";
  const major = true;
  return (
    <li className="border-b border-rule last:border-b-0">
      <button
        type="button"
        data-testid={`ledger-row-${e.claim.ref}`}
        aria-label={`${e.claim.text}. Attested ${measure(e.claim.attested)}. ${untestable ? "Cannot be recomputed" : `Recomputed ${recomputed(e)}`}. Open evidence.`}
        aria-pressed={selected}
        onClick={() => onOpen(e.claim.ref)}
        className={cn(
          LEDGER_GRID,
          "group/row relative w-full cursor-pointer text-left outline-none transition-colors duration-150 hover:bg-paper-deep focus-visible:bg-paper-deep",
          "min-h-[88px] py-[13px]",
          selected && "bg-paper-deep",
        )}
      >
        {/* selection rule in the margin */}
        <span
          className={cn(
            "absolute top-0 bottom-0 -left-4 w-[3px] transition-opacity",
            isGap ? "bg-gap" : "bg-ink",
            selected ? "opacity-100" : "opacity-0",
          )}
        />

        <span className={cn("flex flex-col gap-[5px]", major ? "self-start pt-[3px]" : "self-center")}>
          <span className={cn("num leading-none font-medium text-ink-2", major ? "text-[14px]" : "text-[13px]")}>{e.claim.ref}</span>
          {major && <span className="text-[10px] leading-none font-medium tracking-[0.12em] text-ink-3 uppercase">{SECTION_LABELS[e.claim.section]}</span>}
        </span>

        <span className="flex min-w-0 flex-col gap-[6px]">
          <span className={cn("font-serif leading-[1.25] text-ink", major ? "text-[18px] min-[1680px]:text-[20px]" : "text-[15px] min-[1680px]:text-[15.5px]")}>
            <span className="inline-block" style={vt("text", e.claim.ref)}>
              {e.claim.text}
            </span>
          </span>
          {isGap && e.finding && (
            <span className="text-[13px] leading-[1.35] text-ink-2 min-[1680px]:text-[13.5px]">
              <FindingText finding={e.finding} numberClassName="text-gap" />
            </span>
          )}
        </span>

        <span className={cn("text-right leading-none font-medium text-ink", major ? "text-[27px] min-[1680px]:text-[30px]" : "text-[17px]")}>
          <span className="inline-block" style={vt("att", e.claim.ref)}>
            <Quantity parts={parts(measure(e.claim.attested), e.claim.attested)} unitClassName={cn("text-ink-2", !major && "text-[0.74em]")} />
          </span>
        </span>

        <GapTrack evaluation={e} major={major} delayMs={delayMs} />

        <span className="flex min-w-0 flex-col gap-[6px]">
          {untestable ? (
            <span className={cn("leading-none text-ink-3", major ? "text-[17px]" : "text-[14px]")}>
              <span className="inline-block" style={vt("rec", e.claim.ref)}>
                Not recomputed
              </span>
            </span>
          ) : (
            <span className={cn("leading-none font-semibold text-evidence", major ? "text-[27px] min-[1680px]:text-[30px]" : "text-[17px]")}>
              <span className="inline-block" style={vt("rec", e.claim.ref)}>
                <Quantity parts={parts(recomputed(e), e.recomputed!)} unitClassName={major ? undefined : "text-[0.74em]"} />
              </span>
            </span>
          )}
          <span className={cn("line-clamp-2 leading-tight text-ink-3", major ? "text-[12.5px]" : "text-[11.5px]")}>
            {untestable ? "Request the missing records" : basis(e)}
          </span>
        </span>

        <span>
          <StatusMark status={e.status} />
        </span>

        <span className="relative flex items-center justify-end">
          <span
            className={cn(
              "pointer-events-none absolute right-[22px] text-[12px] leading-none whitespace-nowrap text-ink-2 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100",
              selected && "opacity-100",
            )}
          >
            Evidence
          </span>
          <ChevronRight
            className={cn("size-4 transition-colors", selected ? "text-ink" : "text-ink-4 group-hover/row:text-ink")}
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </button>
    </li>
  );
}
