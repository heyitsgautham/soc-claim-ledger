"use client";

import { type Assessment, type ClaimEvaluation, type EvidenceSection, SECTION_LABELS } from "@ledger/claims/model";
import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { FindingText } from "@/components/finding-text";
import { basis } from "@/components/ledger/ledger-table";
import { StatusMark } from "@/components/ledger/status-mark";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Quantity } from "@/components/quantity";
import { day, int, measure, type Part, parts, recomputed, varianceParts } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClosureHistogram } from "./closure-histogram";
import { NotesStack } from "./notes-stack";
import { AssetTable, CaseTable, SourceTable } from "./record-tables";
import { Tally } from "./tally";

type TableSection = Extract<EvidenceSection, { type: "cases" | "assets" | "sources" | "notes" }>;

export function EvidenceDrawer({
  assessment,
  evaluation,
  onClose,
}: {
  assessment: Assessment;
  evaluation: ClaimEvaluation | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={evaluation !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-[min(1290px,calc(100vw-150px))]"
        data-testid="evidence-drawer"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {evaluation && <DrawerBody key={evaluation.claim.ref} assessment={assessment} evaluation={evaluation} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ assessment: a, evaluation: e }: { assessment: Assessment; evaluation: ClaimEvaluation }) {
  const breakdown = e.evidence.find((s): s is Extract<EvidenceSection, { type: "breakdown" }> => s.type === "breakdown");
  const tables = e.evidence
    .filter((s): s is TableSection => s.type === "cases" || s.type === "assets" || s.type === "sources" || s.type === "notes")
    .filter((s) => s.type === "notes" || s.rows.length > 0);
  const histogram = e.evidence.find((s): s is Extract<EvidenceSection, { type: "histogram" }> => s.type === "histogram");
  // The marks and the chart tell the story. The records behind them stay folded until
  // the examiner asks for them, except where there is no chart to show instead.
  const [tab, setTab] = useState<number | null>(histogram ? null : 0);
  const active = tab === null ? null : tables[Math.min(tab, tables.length - 1)];
  const isGap = e.status === "gap";
  const untestable = e.status === "insufficient_evidence";
  const windowLabel = quarterLabels(a, e.window);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="border-b border-ink px-9 pt-6 pb-6">
        <div className="flex items-center justify-between">
          <span className="num text-[12px] leading-none text-ink-3">
            Item {e.claim.ref} · {SECTION_LABELS[e.claim.section]} · {a.claimsDocument.document_id}
          </span>
          <SheetClose
            className="flex items-center gap-2 border border-transparent px-2 py-1 text-[12.5px] leading-none text-ink-2 hover:border-rule hover:text-ink"
            data-testid="drawer-close"
          >
            Close <span className="num text-[10.5px] text-ink-4">Esc</span>
            <X className="size-4" aria-hidden />
          </SheetClose>
        </div>

        <div className="mt-4 flex items-start justify-between gap-8">
          <div className="flex flex-col gap-2">
            <SheetTitle className="font-serif text-[30px] leading-[1.15] font-normal text-ink">{e.claim.text}</SheetTitle>
            <SheetDescription className="text-[13px] leading-none text-ink-3">
              As attested by {a.entity.code}, against the records in its {windowLabel} {e.window.length > 1 ? "submissions" : "submission"}
            </SheetDescription>
            {e.basis.length > 0 && (
              <p className="mt-1 text-[12.5px] leading-snug text-ink-2" data-testid="drawer-basis">
                <span className="label-caps mr-2 !text-[10px]">Basis</span>
                {e.basis.map((b, i) => (
                  <span key={b.source + b.clause}>
                    {i > 0 && <span className="text-ink-4"> · </span>}
                    <span title={b.says}>
                      {b.source}, {b.clause}
                    </span>
                  </span>
                ))}
              </p>
            )}
          </div>
          <StatusMark status={e.status} className="mt-2 shrink-0" />
        </div>

        <div className="mt-6 flex items-start gap-x-14">
          <Figure
            label="Attested"
            value={parts(measure(e.claim.attested), e.claim.attested)}
            tone="ink"
            caption={`signed ${day(a.claimsDocument.signed_on)}`}
          />
          <Figure
            label="Recomputed"
            value={untestable || !e.recomputed ? "Not recomputed" : parts(recomputed(e), e.recomputed)}
            tone={untestable ? "muted" : "evidence"}
            caption={untestable ? "records not submitted" : `${basis(e, false)}, ${windowLabel}`}
          />
          {!untestable && (
            <Figure label={isGap ? "Gap" : "Difference"} value={varianceParts(e)} tone={isGap ? "gap" : "ink"} caption={toleranceLabel(e)} />
          )}
        </div>

        {e.finding && (
          <p className="mt-5 text-[16px] leading-snug text-ink" data-testid="drawer-finding">
            <FindingText finding={e.finding} numberClassName={isGap ? "text-gap" : "text-ink"} />
          </p>
        )}
      </div>

      {/* body */}
      {untestable ? (
        <UntestableBody evaluation={e} assessment={a} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {breakdown && (
            <div className="border-b border-rule px-9 pt-5 pb-5">
              <Tally section={breakdown} />
            </div>
          )}
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-x-9 px-9 pt-5">
            <div className="flex min-h-0 flex-col">
              {active ? (
                <>
                  <div className="mb-3 flex items-baseline justify-between gap-6 border-b border-rule pb-2">
                    <span className="font-serif text-[18px] leading-none text-ink">{active.tab ?? active.title}</span>
                    {histogram && (
                      <button type="button" onClick={() => setTab(null)} className="text-[12.5px] leading-none text-ink-2 underline decoration-rule underline-offset-4 hover:text-ink" data-testid="records-back">
                        Back to the chart
                      </button>
                    )}
                  </div>
                  {active.type === "cases" && <CaseTable section={active} />}
                  {active.type === "assets" && <AssetTable section={active} />}
                  {active.type === "sources" && <SourceTable section={active} />}
                  {active.type === "notes" && <NotesStack key={active.id} section={active} />}
                </>
              ) : (
                histogram && (
                  <div className="max-w-[640px]">
                    <ClosureHistogram histogram={histogram.histogram} title={histogram.title} width={640} height={300} />
                  </div>
                )
              )}
            </div>
            <aside className="flex min-h-0 flex-col gap-7 overflow-y-auto pb-6">
              {tables.length > 0 && (
                <nav className="flex flex-col" aria-label="Records behind this claim">
                  <span className="label-caps mb-2">The records behind it</span>
                  {tables.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      data-testid={`records-tab-${t.id}`}
                      aria-pressed={t === active}
                      onClick={() => setTab(t === active ? null : i)}
                      className={cn(
                        "group/rec flex h-[42px] items-center justify-between border-b border-rule text-left font-serif text-[16px] leading-none transition-colors",
                        t === active ? "text-ink" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      <span className={cn(t === active && "underline decoration-ink decoration-2 underline-offset-[6px]")}>{t.tab ?? t.title}</span>
                      <ChevronRight className="size-4 text-ink-3 transition-transform group-hover/rec:translate-x-[2px]" aria-hidden />
                    </button>
                  ))}
                </nav>
              )}
              <Method evaluation={e} />
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

// Quarter labels in time order: Q4 FY26 and Q1 FY27.
function quarterLabels(a: Assessment, ids: string[]): string {
  return a.window
    .filter((w) => ids.includes(w.id))
    .sort((x, y) => (x.id < y.id ? -1 : 1))
    .map((w) => w.label)
    .join(" and ");
}

function toleranceLabel(e: ClaimEvaluation): string {
  const t = e.tolerance;
  if (t.kind === "points") return `tolerance ${t.value} pts`;
  if (t.kind === "relative") return `tolerance ${Math.round(t.value * 100)}%`;
  return "must match exactly";
}

function Figure({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string | Part[];
  tone: "ink" | "evidence" | "gap" | "muted";
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      <span className="label-caps">{label}</span>
      <span
        className={cn(
          "flex h-[38px] items-end leading-none whitespace-nowrap",
          tone === "muted" ? "text-[20px] text-ink-3" : "text-[38px] font-semibold",
          tone === "ink" && "font-medium text-ink",
          tone === "evidence" && "text-evidence",
          tone === "gap" && "text-gap",
        )}
      >
        {typeof value === "string" ? value : <Quantity parts={value} />}
      </span>
      <span className="text-[12.5px] leading-none text-ink-3">{caption}</span>
    </div>
  );
}

function Method({ evaluation: e }: { evaluation: ClaimEvaluation }) {
  const complete = e.exportsUsed.every((x) => x.declaredComplete);
  return (
    <section className="flex flex-col gap-3" data-testid="method">
      <h4 className="font-serif text-[16px] leading-none text-ink">How this was recomputed</h4>
      <p className="text-[13px] leading-[1.5] text-ink-2">{e.method}</p>
      {e.exportsUsed.length > 0 && (
      <table className="w-full text-[12px] leading-none">
        <thead>
          <tr className="border-b border-rule text-left">
            <th className="label-caps !text-[10px] pb-[6px] font-medium">Export</th>
            <th className="label-caps !text-[10px] pb-[6px] font-medium">Quarter</th>
            <th className="label-caps !text-[10px] pb-[6px] text-right font-medium">Rows</th>
            <th className="label-caps !text-[10px] pb-[6px] pl-3 font-medium">SHA-256</th>
          </tr>
        </thead>
        <tbody>
          {e.exportsUsed.map((x) => (
            <tr key={`${x.quarter}-${x.name}`} className="border-b border-rule-soft">
              <td className="num py-[6px] text-ink">{x.name}</td>
              <td className="num py-[6px] text-ink-2">{x.quarter}</td>
              <td className="num py-[6px] text-right text-ink">{int(x.rows)}</td>
              <td className="num py-[6px] pl-3 text-ink-3">{x.sha256.slice(0, 12)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      <p className="num text-[11.5px] leading-snug text-ink-3">
        Rule {e.rule.id} {e.rule.version}
      </p>
      {e.exportsUsed.length > 0 && (
      <p className="border-l-2 border-ink-4 pl-3 text-[12.5px] leading-[1.5] text-ink-2">
        {complete
          ? "Observation, not verdict. Every export this reads was submitted and declared complete by the entity, so an absent record describes the submission as filed. What it means is the examiner's call."
          : "Some exports this reads were declared incomplete, so absent records here may be missing from the file rather than from the SOC."}
      </p>
      )}
    </section>
  );
}

function UntestableBody({ evaluation: e, assessment: a }: { evaluation: ClaimEvaluation; assessment: Assessment }) {
  const r = e.reason;
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-x-9 overflow-y-auto px-9 pt-7 pb-6">
      <div className="flex flex-col gap-4">
        <div className="hatch h-[14px] border-y border-rule" aria-hidden />
        <h4 className="font-serif text-[20px] leading-snug text-ink">This submission cannot settle the claim either way.</h4>
        <p className="max-w-[620px] text-[14.5px] leading-[1.55] text-ink-2">
          {r?.kind === "missing_export" && (
            <>
              The claim is tested against the <span className="num text-ink">{r.exports.join(", ")}</span> export, and the {quarterLabels(a, r.quarters)} submission from{" "}
              {a.entity.code} does not include it. The ledger marks this as insufficient evidence rather than a gap, because a missing file says nothing yet about
              the SOC. Request the export before drawing any conclusion.
            </>
          )}
          {r?.kind === "partial_export" && (
            <>
              The entity declared the <span className="num text-ink">{r.exports.join(", ")}</span> export incomplete in its {quarterLabels(a, r.quarters)}{" "}
              submission, so records missing from it cannot be read as
              work that never happened.
            </>
          )}
          {r?.kind === "short_window" && (
            <>
              The claim needs {r.needed} quarterly submissions to test and {r.available} are on file.
            </>
          )}
          {r?.kind === "empty_population" && <>The submission contains no {r.noun}, so there is nothing to recompute the figure from.</>}
        </p>
      </div>
      <aside>
        <Method evaluation={e} />
      </aside>
    </div>
  );
}
