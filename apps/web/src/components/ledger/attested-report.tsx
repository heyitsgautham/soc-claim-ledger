"use client";

import { type Assessment, type ClaimEvaluation, SECTION_LABELS, SECTIONS } from "@ledger/claims/model";
import { SECTORS } from "@ledger/submission/constants";
import { ArrowRight, Check } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { Quantity } from "@/components/quantity";
import { day, int, measure, parts, period, recomputed, varianceParts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { vt } from "./transition";

// The report as the entity signed it, and the check that reads it against the entity's
// own records. A reading rule runs down the page and each line gets its answer in the
// margin as the rule passes it, the way an examiner marks up a submission by hand.

export type CheckPhase = "attested" | "checking" | "checked";

export const SWEEP_DELAY_MS = 350;
export const SWEEP_MS = 6400;
export const SUMMARY_AT_MS = SWEEP_DELAY_MS + SWEEP_MS + 350;

// Inside the sheet: margin, item, measure, attested and status, margin. Then the gutter
// and the ledger's own column, outside the sheet.
const ROW = "grid grid-cols-[40px_48px_minmax(0,1fr)_132px_84px_36px_40px_350px] items-center";

const at = (ms: number | undefined): CSSProperties => ({ "--at": ms ?? 0 }) as CSSProperties;

export function AttestedReport({ assessment: a, phase, onCheck }: { assessment: Assessment; phase: CheckPhase; onCheck: () => void }) {
  const rowsRef = useRef<HTMLDivElement>(null);
  const [times, setTimes] = useState<Record<string, number>>({});
  const running = phase !== "attested";

  // Each line's answer lands when the rule reaches the middle of that line.
  useLayoutEffect(() => {
    const box = rowsRef.current;
    if (!box) return;
    const h = box.offsetHeight;
    const next: Record<string, number> = {};
    for (const el of box.querySelectorAll<HTMLElement>("[data-ref]")) {
      next[el.dataset.ref!] = Math.round(SWEEP_DELAY_MS + ((el.offsetTop + el.offsetHeight / 2) / h) * SWEEP_MS);
    }
    setTimes(next);
  }, []);

  const ev = a.evaluations;
  const gaps = ev.filter((e) => e.status === "gap").length;
  const untestable = ev.filter((e) => e.status === "insufficient_evidence").length;
  const holds = ev.filter((e) => e.status === "holds").length;
  const rows = (name: string) => a.exports.find((x) => x.name === name)?.rows;
  const reading = (["alerts", "cases", "escalations", "assets"] as const).filter((n) => rows(n) !== undefined);

  return (
    <main className="mx-auto flex min-h-[calc(100%-53px)] max-w-[1920px] items-center justify-center px-8 py-3" data-testid="attested-report">
      {/* The whole report grows out of the submission folder when it is opened. */}
      <div className="relative w-[1476px] max-w-full" style={{ viewTransitionName: "vt-sheet" } as CSSProperties}>
        {/* the sheet of paper, behind the report's own columns */}
        <div
          className="absolute inset-y-0 left-0 w-[calc(100%-390px)] border border-rule bg-paper-sheet shadow-[0_1px_0_var(--rule),0_14px_34px_-18px_rgb(38_34_26/0.35)]"
          aria-hidden
        />

        {/* header */}
        <div className={cn(ROW, "relative h-[112px] items-start pt-6")}>
          <span />
          <div className="col-span-4 flex items-start justify-between gap-6">
            <div className="flex flex-col gap-[9px]">
              <span className="flex items-center gap-3">
                <span className="label-caps">
                  Self-assessment and KPI report · <span className="num tracking-normal normal-case">{a.claimsDocument.document_id}</span>
                </span>
                {/* No public NCIIPC template exists, so the layout is ours and says so. */}
                <span
                  className="border border-dashed border-ink-4 px-[6px] py-[3px] text-[9.5px] leading-none font-medium tracking-[0.14em] text-ink-3 uppercase"
                  title="Our layout for the demo. The items are common SOC measures, not NCIIPC's form."
                  data-testid="illustrative-format"
                >
                  Illustrative format
                </span>
              </span>
              <h1 className="font-serif text-[27px] leading-none font-medium text-ink">
                <span className="inline-block" style={vt("entity")} data-testid="attested-entity">
                  {a.entity.code}
                </span>
                <span className="text-ink-2">, {SECTORS[a.entity.sector]}</span>
              </h1>
              <p className="text-[13.5px] leading-none text-ink-2">
                {a.entity.description}, <span className="num">{a.entity.sites}</span> sites · reporting period {period(a.quarter.start, a.quarter.end)}
              </p>
            </div>
            <div className="mt-1 flex -rotate-[4deg] flex-col items-center gap-[3px] border-[3px] border-double border-ink-3/70 px-3 py-[6px] text-ink-3">
              <span className="text-[10.5px] leading-none font-semibold tracking-[0.18em] uppercase">Submitted to NCIIPC</span>
              <span className="num text-[12px] leading-none tracking-[0.08em] uppercase">{day(a.submittedOn)}</span>
            </div>
          </div>
          <span />
          <span />
          <MarginHead
            phase={phase}
            onCheck={onCheck}
            code={a.entity.code}
            reading={reading.map((n) => [n, rows(n)!] as const)}
            counts={{ gaps, untestable, holds, total: ev.length }}
          />
        </div>

        {/* column heads */}
        <div className={cn(ROW, "relative")}>
          <span />
          <div className="col-span-4 grid grid-cols-[48px_minmax(0,1fr)_132px_84px] border-b-[3px] border-double border-ink pb-[7px]">
            <span className="label-caps">Item</span>
            <span className="label-caps">Measure</span>
            <span className="label-caps text-right">Attested</span>
            <span className="label-caps pl-5">Status</span>
          </div>
          <span />
          <span />
          <span className={cn("label-caps pb-[7px] transition-opacity duration-500", phase === "checking" ? "opacity-100" : "opacity-0")}>
            From {a.entity.code}&apos;s own records
          </span>
        </div>

        {/* the lines, with the reading rule over them */}
        <div ref={rowsRef} className="relative">
          {running && (
            <div
              className="anim-sweep pointer-events-none absolute left-0 z-10 h-0 w-full"
              style={{ "--sweep-ms": `${SWEEP_MS}ms`, "--sweep-delay": `${SWEEP_DELAY_MS}ms` } as CSSProperties}
              aria-hidden
            >
              <div className="absolute -top-[46px] left-0 h-[46px] w-[calc(100%-390px)] bg-linear-to-b from-transparent to-evidence/[0.07]" />
              <div className="absolute top-0 left-0 h-[2px] w-full bg-evidence" />
            </div>
          )}
          {SECTIONS.map((section, si) => {
            const items = ev.filter((e) => e.claim.section === section);
            if (!items.length) return null;
            return (
              <div key={section}>
                <div className={cn(ROW, "h-[24px] items-end")}>
                  <span />
                  <span className="num text-[12.5px] leading-none text-ink-3">{si + 1}</span>
                  <span className="col-span-3 font-serif text-[14px] leading-none font-medium tracking-[0.02em] text-ink-2">{SECTION_LABELS[section]}</span>
                </div>
                {items.map((e) => (
                  <Line key={e.claim.ref} evaluation={e} running={running} at={times[e.claim.ref]} />
                ))}
              </div>
            );
          })}
        </div>

        {/* signature */}
        <div className={cn(ROW, "relative items-end pt-3 pb-4")}>
          <span />
          <div className="col-span-4 flex items-end justify-end gap-10 border-t border-rule pt-3" data-testid="attested-signature">
            <p className="max-w-[420px] text-right text-[12px] leading-snug text-ink-3">
              I confirm that the figures above reflect the operation of our Security Operations Centre for the reporting period.
            </p>
            <div className="flex flex-col items-start gap-[3px]">
              <Signature />
              <span className="text-[12.5px] leading-none text-ink">{a.claimsDocument.signed_by_role}</span>
              <span className="num text-[12px] leading-none text-ink-3">Signed {day(a.claimsDocument.signed_on)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function MarginHead({
  phase,
  onCheck,
  code,
  reading,
  counts,
}: {
  phase: CheckPhase;
  onCheck: () => void;
  code: string;
  reading: (readonly [string, number])[];
  counts: { gaps: number; untestable: number; holds: number; total: number };
}) {
  if (phase === "attested") {
    return (
      <div className="relative z-20 flex flex-col gap-3 pt-[2px]">
        <p className="text-[14px] leading-none text-ink-2">As signed. Not one line checked yet.</p>
        <button
          type="button"
          onClick={onCheck}
          data-testid="run-check"
          className="group/btn flex h-[48px] items-center justify-between bg-ink px-5 text-[15px] leading-none font-medium text-paper transition-colors hover:bg-ink-2"
        >
          Check against {code}&apos;s records
          <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-[3px]" aria-hidden />
        </button>
      </div>
    );
  }
  if (phase === "checking") {
    return (
      <div className="flex flex-col gap-3 pt-[2px]" data-testid="check-running">
        <span className="label-caps !text-evidence">Checking every line</span>
        <div className="anim-pulse-rule h-[2px] w-full bg-evidence" aria-hidden />
        <p className="text-[13.5px] leading-[1.55] text-ink-2">
          Reading{" "}
          {reading.map(([name, n], i) => (
            <span key={name}>
              {i > 0 && (i === reading.length - 1 ? " and " : ", ")}
              <span className="num text-ink">{int(n)}</span> {name}
            </span>
          ))}{" "}
          from the same submission.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pt-[2px]" data-testid="check-summary">
      <p className="anim-appear font-serif text-[21px] leading-[1.22] text-ink">
        <span className="num font-semibold text-gap">{counts.gaps}</span> of <span className="num">{counts.total}</span> attested figures do not hold against{" "}
        <span className="whitespace-nowrap">{code}&apos;s</span> own records.
      </p>
      <p className="anim-appear text-[13px] leading-snug text-ink-2" style={{ animationDelay: "250ms" }}>
        <span className="num">{counts.untestable}</span> cannot be tested from this submission. <span className="num">{counts.holds}</span> hold.
      </p>
    </div>
  );
}

function Line({ evaluation: e, running, at: t }: { evaluation: ClaimEvaluation; running: boolean; at: number | undefined }) {
  const isGap = e.status === "gap";
  const untestable = e.status === "insufficient_evidence";
  const ref = e.claim.ref;
  // Only the claims that change verdict fly into the ledger, and only once the check has
  // run. Before that they belong to the report, which grows out of the folder as one piece.
  const moves = (isGap || untestable) && running;
  return (
    <div data-ref={ref} className={cn(ROW, "relative h-[27px]")} data-testid={`attested-line-${ref}`}>
      <span />
      <span className="num text-[12.5px] leading-none text-ink-3">{ref}</span>
      <span className={cn("truncate pr-4 font-serif text-[15.5px] leading-[1.2] text-ink", running && !isGap && "anim-quiet")} style={at(t)}>
        <span className="inline-block" style={moves ? vt("text", ref) : undefined}>
          {e.claim.text}
        </span>
      </span>
      <span className="relative col-span-2 grid grid-cols-[132px_84px] items-center">
        <span className="text-right text-[15.5px] leading-none font-medium text-ink">
          <span className="inline-block" style={moves ? vt("att", ref) : undefined}>
            <Quantity parts={parts(measure(e.claim.attested), e.claim.attested)} unitClassName="text-ink-2" />
          </span>
        </span>
        <span className="flex items-center gap-[6px] pl-5 text-[12.5px] leading-none text-ink-2">
          <span className="flex size-[13px] items-center justify-center border border-ink-3" aria-hidden>
            <Check className="size-[10px] text-ink" strokeWidth={3} />
          </span>
          Met
        </span>
        {running && isGap && (
          <span
            className="anim-strike pointer-events-none absolute top-1/2 -right-2 left-[34px] h-[2px] -translate-y-1/2 bg-gap"
            style={at((t ?? 0) + 140)}
            aria-hidden
          />
        )}
      </span>
      <span />
      <span />
      <span className="flex min-w-0 items-center">
        {running && (
          <span className={cn("anim-margin-in flex h-[27px] min-w-0 items-center gap-3", isGap && "-ml-3 bg-gap-tint/70 pr-3 pl-3")} style={at(t)}>
            {untestable ? (
              <span className="border border-dashed border-ink-3 px-2 py-[3px] text-[12px] leading-none text-ink-2" style={moves ? vt("rec", ref) : undefined}>
                {missingText(e)}
              </span>
            ) : (
              <>
                <span
                  className={cn("inline-block leading-none text-evidence", isGap ? "text-[18px] font-semibold" : "text-[15px] font-medium")}
                  style={moves ? vt("rec", ref) : undefined}
                >
                  <Quantity parts={parts(recomputed(e), e.recomputed!)} />
                </span>
                {isGap ? (
                  <span className="text-[13.5px] leading-none font-semibold text-gap">
                    <Quantity parts={varianceParts(e)} unitClassName="text-[0.86em]" />
                  </span>
                ) : (
                  <Check className="size-[14px] text-ink-3" strokeWidth={2.25} aria-label="Holds" />
                )}
              </>
            )}
          </span>
        )}
      </span>
    </div>
  );
}

function missingText(e: ClaimEvaluation): string {
  const r = e.reason;
  if (r?.kind === "missing_export") return `No ${r.exports.map((x) => x.replace("_", " ")).join(", ")} export`;
  if (r?.kind === "partial_export") return `${r.exports.map((x) => x.replace("_", " ")).join(", ")} export incomplete`;
  if (r?.kind === "short_window") return `Needs ${r.needed} quarters`;
  return "Cannot be tested";
}

// A signature mark. It stands for the signing officer and is not anyone's hand.
function Signature() {
  return (
    <svg width="150" height="38" viewBox="0 0 150 38" aria-hidden className="-mb-1 text-[#27344f]">
      <path
        d="M4 27c9-3 15-18 21-19 5-1-2 21 3 21 6 0 10-16 15-15 4 1-3 13 2 13 5 0 8-9 13-9 4 0 1 8 6 8 7 0 11-11 18-11 5 0 2 9 8 9 8 0 17-6 27-10 7-3 14-5 25-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
