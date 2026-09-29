"use client";

import type { Assessment, Overview } from "@ledger/claims/model";
import { SECTORS } from "@ledger/submission/constants";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { DISPOSITION } from "@/components/evidence/record-tables";
import { vt } from "@/components/ledger/transition";
import { day, int, istShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EstatePicture, WORLD_TIMES } from "./estate-picture";

// A submission before anyone reads it. The entity as a picture, one critical alert
// followed from alert to closure the way its SOP says, and the quarter's submission as
// NCIIPC receives it: the signed report and the records, in two halves.

// When the alert's path lights, step by step, and when the submission is packed and sent.
const STEP_MS = [WORLD_TIMES.exemplar + 1000, WORLD_TIMES.exemplar + 1900, WORLD_TIMES.exemplar + 2800, WORLD_TIMES.exemplar + 3700];
const FOLDER_MS = 12600;
const SENT_MS = 17000;

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
const mins = (m: number) => `+${Math.round(m)} min`;

export function SubmissionOverview({ assessment: a, overview: o, onOpen }: { assessment: Assessment; overview: Overview; onOpen: () => void }) {
  const rows = (name: string) => a.exports.find((x) => x.name === name)?.rows;
  const records = (["alerts", "cases", "escalations", "assets"] as const).filter((n) => rows(n) !== undefined);
  const ex = o.exemplar;
  const steps = ex
    ? [
        { label: "Alert", detail: `${istShort(ex.firstAlertAt ?? ex.openedAt)}, ${ex.ruleName} on ${ex.assetHostname}` },
        { label: "Case opened", detail: `by ${ex.owner}, ${mins(ex.firstAlertAt ? (ex.openedAt - ex.firstAlertAt) / 60_000 : 0)}` },
        { label: "Escalated to L2", detail: `${mins(ex.escalatedAfterMin ?? 0)}, inside the 30-minute rule` },
        { label: "Closed", detail: `${mins(ex.closedAfterMin ?? 0)}, ${ex.disposition ? DISPOSITION[ex.disposition].toLowerCase() : "no disposition"}` },
      ]
    : [];

  return (
    <main className="mx-auto flex min-h-[calc(100vh-53px-var(--footer-height))] max-w-[1920px] flex-col px-8 pb-4 min-[1680px]:px-12" data-testid="submission-overview">
      <header className="flex items-end justify-between gap-10 pt-6 pb-3">
        <div className="flex flex-col gap-[10px]">
          <span className="label-caps">Quarterly submission · {a.quarter.label}</span>
          <h1 className="font-serif text-[36px] leading-none font-medium text-ink">
            <span className="inline-block" style={vt("entity")}>
              {a.entity.code}
            </span>
            <span className="text-ink-2">, {SECTORS[a.entity.sector]}</span>
          </h1>
          <p className="text-[14px] leading-none text-ink-2">
            {a.entity.description}, <span className="num">{a.entity.sites}</span> sites. What it runs, who watches it, and what it sent NCIIPC.
          </p>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_340px] items-center gap-12">
        <EstatePicture code={a.entity.code} overview={o} mode="world" testId="estate-world" />

        <aside className="flex flex-col gap-7">
          {ex && (
            <section className="flex flex-col gap-3" data-testid="alert-path">
              <span className="label-caps">One critical alert, start to finish</span>
              <ol className="flex flex-col">
                {steps.map((s, i) => (
                  <li key={s.label} className="anim-settle relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 pb-[14px]" style={at(STEP_MS[i]! - 150)}>
                    {i < steps.length - 1 && <span className="absolute top-[14px] bottom-0 left-[6px] w-px bg-rule" aria-hidden />}
                    <span
                      className={cn("anim-appear relative mt-[3px] size-[13px] rounded-full border-2", i === 2 ? "border-evidence bg-evidence" : "border-ink bg-ink")}
                      style={at(STEP_MS[i]!)}
                      aria-hidden
                    />
                    <span className="flex flex-col gap-[5px]">
                      <span className="font-serif text-[16.5px] leading-none">{s.label}</span>
                      <span className="text-[12.5px] leading-snug text-ink-2">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="anim-settle flex flex-col gap-3" style={at(FOLDER_MS)} data-testid="submission-folder">
            <span className="label-caps">This quarter&apos;s submission</span>
            <div className="grid grid-cols-2 border border-ink bg-paper-sheet shadow-[0_10px_24px_-16px_rgb(38_34_26/0.4)]">
              <div className="flex flex-col gap-[7px] border-r border-rule p-4" style={vt("sheet")} data-testid="folder-report">
                <span className="font-serif text-[16px] leading-none text-ink">Signed report</span>
                <span className="text-[12.5px] leading-snug text-ink-2">
                  <span className="num text-ink">{a.evaluations.length}</span> attested figures
                </span>
                <span className="text-[12px] leading-snug text-ink-3">Signed {day(a.claimsDocument.signed_on)}</span>
              </div>
              <div className="flex flex-col gap-[7px] p-4" data-testid="folder-records">
                <span className="font-serif text-[16px] leading-none text-ink">Records</span>
                <ul className="flex flex-col gap-[3px] text-[12.5px] leading-snug text-ink-2">
                  {records.map((n) => (
                    <li key={n}>
                      <span className="num text-ink">{int(rows(n)!)}</span> {n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="anim-appear flex items-center gap-2 text-[13px] leading-none text-ink" style={at(SENT_MS)} data-testid="folder-sent">
              <ArrowRight className="size-4" aria-hidden />
              Sent to NCIIPC, {day(a.submittedOn)}
            </p>
          </section>

          <button
            type="button"
            onClick={onOpen}
            data-testid="open-report"
            className="group/btn flex h-[48px] items-center justify-between bg-ink px-5 text-[15px] leading-none font-medium text-paper transition-colors hover:bg-ink-2"
          >
            Open the signed report
            <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-[3px]" aria-hidden />
          </button>
        </aside>
      </div>
    </main>
  );
}
