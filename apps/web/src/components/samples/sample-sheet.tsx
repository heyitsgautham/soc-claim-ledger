"use client";

import type { SampleItem, SampleSheet as Sheet, Verdict, VerdictValue } from "@ledger/claims/model";
import { DETECTORS } from "@ledger/detect";
import { Check, CircleHelp, EyeOff, X } from "lucide-react";
import { useState } from "react";
import { CaseChain } from "@/components/evidence/record-tables";
import { CLASS_LABEL } from "@/components/negative-space/grid";
import { int } from "@/lib/format";
import { cn } from "@/lib/utils";

const PICK: Record<SampleItem["pick"], string> = {
  finding: "Finding",
  counterexample: "Counterexample",
  random: "Random pick",
};

const VERDICT_TEXT: Record<VerdictValue, string> = {
  issue_confirmed: "Issue confirmed",
  no_issue: "No issue",
  cannot_tell: "Cannot tell",
};

function VerdictMark({ v }: { v: VerdictValue }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[6px] text-[11.5px] leading-none font-semibold tracking-[0.08em] uppercase",
        v === "issue_confirmed" ? "text-gap" : v === "no_issue" ? "text-evidence" : "text-ink-2",
      )}
    >
      {v === "issue_confirmed" ? <Check className="size-[13px]" /> : v === "no_issue" ? <X className="size-[13px]" /> : <CircleHelp className="size-[13px]" />}
      {VERDICT_TEXT[v]}
    </span>
  );
}

function Reasons({ item }: { item: SampleItem }) {
  if (!item.reasons.length) {
    return (
      <span className="text-[12.5px] leading-snug text-ink-2">
        {item.pick === "counterexample" ? "Meets the claims. Checks the tool is not over-flagging." : "Reproducible random pick from every closed case."}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-[5px]">
      {item.reasons.map((r) => (
        <span key={`${r.detector.id}-${r.findingId}`} className="border border-rule bg-paper-sheet px-[6px] py-[3px] text-[11.5px] leading-none text-ink-2">
          {r.detector.id === "claim-gap" ? r.text : DETECTORS[r.detector.id].title}
          {r.findingId && <span className="num ml-1 text-ink-4">{r.findingId}</span>}
        </span>
      ))}
    </span>
  );
}

export function SampleSheet({ sheet, initial, entity }: { sheet: Sheet; initial: Verdict[]; entity: string }) {
  const [mode, setMode] = useState<"sheet" | "review">("sheet");
  const [active, setActive] = useState<string>(sheet.items[0]?.key ?? "");
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(() => Object.fromEntries(initial.map((v) => [v.itemKey, v])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = sheet.items.find((i) => i.key === active);
  const findings = new Set(sheet.items.flatMap((i) => i.reasons.map((r) => r.findingId)).filter(Boolean)).size;
  const done = sheet.items.filter((i) => verdicts[i.key]).length;

  async function record(v: VerdictValue) {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/verdicts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity, itemKey: item.key, verdict: v }),
      });
      // A server that failed before answering in JSON still gets its status shown, not a parse error.
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `The verdict was not saved, the server answered ${res.status} ${res.statusText}`.trim());
      setVerdicts((cur) => ({ ...cur, [item.key]: json.verdict as Verdict }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const next = () => {
    const i = sheet.items.findIndex((x) => x.key === active);
    const after = sheet.items.slice(i + 1).find((x) => !verdicts[x.key]) ?? sheet.items.find((x) => !verdicts[x.key]);
    if (after) setActive(after.key);
  };

  const blind = mode === "review";

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_470px] gap-x-10 min-[1680px]:grid-cols-[minmax(0,1fr)_680px] min-[1680px]:gap-x-12"
      data-testid="sample-sheet"
    >
      <section aria-label="Sample sheet">
        <div className="double-rule grid grid-cols-[34px_minmax(0,1fr)_120px_minmax(0,1fr)_156px] items-end gap-x-5 pb-[9px]">
          <span className="label-caps">#</span>
          <span className="label-caps">Record</span>
          <span className="label-caps">Pick</span>
          <span className="label-caps">{blind ? "Tool's reason, hidden" : "Reason for the pick"}</span>
          <span className="label-caps">Verdict</span>
        </div>
        <ol>
          {sheet.items.map((it) => {
            const v = verdicts[it.key];
            const hidden = blind && !v;
            return (
              <li key={it.key} className="border-b border-rule">
                <button
                  type="button"
                  data-testid={`sample-${it.n}`}
                  onClick={() => setActive(it.key)}
                  className={cn(
                    "grid min-h-[58px] w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)_120px_minmax(0,1fr)_156px] items-center gap-x-5 py-[8px] text-left transition-colors hover:bg-paper-deep",
                    blind && it.key === active && "bg-paper-deep",
                  )}
                >
                  <span className="num text-[13px] leading-none text-ink-3">{String(it.n).padStart(2, "0")}</span>
                  <span className="flex min-w-0 flex-col gap-[5px]">
                    <span className="truncate text-[14px] leading-none text-ink">{it.title}</span>
                    <span className="num truncate text-[11.5px] leading-none text-ink-3">
                      {it.recordId} · {it.subtitle}
                    </span>
                  </span>
                  <span className={cn("text-[12.5px] leading-none", hidden ? "text-ink-4" : it.pick === "finding" ? "text-ink" : "text-ink-2")}>
                    {hidden ? "hidden" : PICK[it.pick]}
                  </span>
                  <span className="min-w-0">
                    {hidden ? (
                      <span
                        className="hatch block h-[14px] w-full max-w-[260px] border-y border-rule"
                        role="img"
                        aria-label="Hidden until a verdict is recorded"
                      />
                    ) : (
                      <Reasons item={it} />
                    )}
                  </span>
                  <span>{v ? <VerdictMark v={v.verdict} /> : <span className="text-[12px] text-ink-4">Not reviewed</span>}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-3">{sheet.method}</p>
      </section>

      <aside className="flex flex-col gap-5 self-start border-l border-rule pl-10" data-testid="review-panel">
        {!blind ? (
          <>
            <div className="flex flex-col gap-2">
              <span className="label-caps">Manual review</span>
              <p className="font-serif text-[22px] leading-[1.25] text-ink">
                <span className="num">{sheet.items.length}</span> records for the examiner, <span className="num">{sheet.items.length - 2}</span> from{" "}
                <span className="num">{findings}</span> findings, one counterexample and one random pick.
              </p>
            </div>
            <p className="text-[14px] leading-[1.55] text-ink-2">
              In blind review the examiner sees each record as the entity submitted it, and records a verdict before the tool&apos;s reasons appear. Those
              verdicts are what calibrate every detector.
            </p>
            <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
              <dt className="text-ink-3">Reviewed this cycle</dt>
              <dd className="num text-ink">
                {done} of {sheet.items.length}
              </dd>
              <dt className="text-ink-3">Random seed</dt>
              <dd className="num text-ink">{sheet.seed}</dd>
            </dl>
            <button
              type="button"
              data-testid="start-blind-review"
              onClick={() => {
                setMode("review");
                const first = sheet.items.find((x) => !verdicts[x.key]);
                if (first) setActive(first.key);
              }}
              className="flex items-center justify-center gap-2 self-start border border-ink bg-ink px-5 py-[11px] text-[14px] leading-none text-paper hover:bg-ink-2"
            >
              <EyeOff className="size-4" aria-hidden /> Start blind review
            </button>
          </>
        ) : item ? (
          <BlindRecord
            item={item}
            verdict={verdicts[item.key]}
            saving={saving}
            error={error}
            onVerdict={record}
            onNext={next}
            onLeave={() => setMode("sheet")}
          />
        ) : null}
      </aside>
    </div>
  );
}

function BlindRecord({
  item,
  verdict,
  saving,
  error,
  onVerdict,
  onNext,
  onLeave,
}: {
  item: SampleItem;
  verdict: Verdict | undefined;
  saving: boolean;
  error: string | null;
  onVerdict: (v: VerdictValue) => void;
  onNext: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="blind-record">
      <div className="flex items-center justify-between">
        <span className="label-caps">Blind review · record {String(item.n).padStart(2, "0")}</span>
        <button type="button" onClick={onLeave} className="text-[12.5px] text-ink-2 hover:text-ink">
          Back to the sheet
        </button>
      </div>
      <h2 className="font-serif text-[24px] leading-[1.2] text-ink">{item.title}</h2>
      <p className="num -mt-2 text-[12.5px] text-ink-3">
        {item.recordId} · {item.subtitle}
      </p>

      {item.record.kind === "case" ? (
        <div className="border-y border-rule">
          <CaseChain row={item.record.case} stacked />
        </div>
      ) : (
        <dl className="grid grid-cols-[160px_minmax(0,1fr)] gap-y-2 border-y border-rule py-4 text-[13.5px]">
          <dt className="text-ink-3">Asset class</dt>
          <dd className="text-ink">{CLASS_LABEL[item.record.asset.assetClass] ?? item.record.asset.assetClass}</dd>
          <dt className="text-ink-3">Site, criticality</dt>
          <dd className="text-ink capitalize">
            {item.record.asset.site}, {item.record.asset.criticality}
          </dd>
          <dt className="text-ink-3">Alerts, two quarters</dt>
          <dd className="num text-ink">{int(item.record.asset.alerts)}</dd>
          <dt className="text-ink-3">Log source</dt>
          <dd className="text-ink">
            {item.record.asset.logSource ?? "None attached"}
            {item.record.asset.daysReporting !== null && (
              <span className="num text-ink-3">
                {" "}
                {item.record.asset.daysReporting}/{item.record.asset.daysExpected} days
              </span>
            )}
          </dd>
        </dl>
      )}

      {!verdict ? (
        <>
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            <EyeOff className="size-4 text-ink-3" aria-hidden />
            The tool&apos;s view is hidden until you record a verdict.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(["issue_confirmed", "no_issue", "cannot_tell"] as const).map((v) => (
              <button
                key={v}
                type="button"
                disabled={saving}
                data-testid={`verdict-${v}`}
                onClick={() => onVerdict(v)}
                className={cn(
                  "border px-3 py-[12px] text-[14px] leading-none transition-colors disabled:opacity-50",
                  v === "issue_confirmed"
                    ? "border-gap text-gap hover:bg-gap hover:text-paper"
                    : v === "no_issue"
                      ? "border-evidence text-evidence hover:bg-evidence hover:text-paper"
                      : "border-ink-3 text-ink-2 hover:bg-paper-deep",
                )}
              >
                {VERDICT_TEXT[v]}
              </button>
            ))}
          </div>
          {error && <p className="text-[13px] text-gap">{error}</p>}
        </>
      ) : (
        <div className="anim-settle flex flex-col gap-3 border-l-2 border-ink pl-4" data-testid="tool-view">
          <div className="flex items-center justify-between">
            <span className="label-caps">Recorded, then revealed</span>
            <VerdictMark v={verdict.verdict} />
          </div>
          <p className="num text-[12px] text-ink-3">
            {verdict.examiner} · {verdict.recordedAt.replace("T", " ").slice(0, 16)} IST · blind
          </p>
          <span className="label-caps mt-1">The tool&apos;s view</span>
          {item.reasons.length ? (
            <ul className="flex flex-col gap-2">
              {item.reasons.map((r) => (
                <li key={`${r.detector.id}-${r.findingId}`} className="text-[13.5px] leading-snug text-ink">
                  <span className="font-medium">{r.detector.id === "claim-gap" ? r.text : DETECTORS[r.detector.id].title}</span>
                  <span className="num text-ink-3">
                    {" "}
                    · {r.detector.id} {r.detector.version} · {r.findingId}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13.5px] text-ink">{PICK[item.pick]}. No detector flagged this record.</p>
          )}
          <p className="text-[12.5px] leading-snug text-ink-2">
            This verdict now counts toward the precision of every detector listed, on the calibration screen.
          </p>
          <button
            type="button"
            onClick={onNext}
            data-testid="next-record"
            className="self-start border border-ink px-4 py-[9px] text-[13px] leading-none text-ink hover:bg-paper-deep"
          >
            Next record
          </button>
        </div>
      )}
    </div>
  );
}
