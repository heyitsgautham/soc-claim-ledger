"use client";

import type { CaseEvidenceRow, EvidenceSection, TimelineMarker } from "@ledger/claims/model";
import { useState } from "react";
import type { Disposition } from "@ledger/submission/constants";
import { duration, durationShort, int, istShort } from "@/lib/format";
import { pct } from "@/lib/scale";
import { cn } from "@/lib/utils";

type CasesSection = Extract<EvidenceSection, { type: "cases" }>;
type AssetsSection = Extract<EvidenceSection, { type: "assets" }>;
type SourcesSection = Extract<EvidenceSection, { type: "sources" }>;

// The records behind a finding, as the entity submitted them.

export const DISPOSITION: Record<Disposition, string> = {
  true_positive_contained: "True positive, contained",
  true_positive_remediated: "True positive, remediated",
  benign_positive: "Benign positive",
  false_positive: "False positive",
  duplicate: "Duplicate",
  inconclusive: "Inconclusive",
};

const CASE_GRID = "grid grid-cols-[124px_minmax(0,1fr)_176px_136px] items-center gap-x-5";

function markerClass(m: TimelineMarker): string {
  return m.tone === "gap" ? "border-l border-dashed border-gap" : "border-l border-ink";
}

export function CaseTable({ section }: { section: CasesSection }) {
  const [open, setOpen] = useState<string | null>(null);
  const span = section.timelineMinutes;
  const sla = section.markers.find((m) => m.label === "SLA")?.minutes ?? null;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={`case-table-${section.id}`}>
      <div className={cn(CASE_GRID, "border-b border-ink pb-2")}>
        <span className="label-caps">Case, opened</span>
        <span className="label-caps">Detection · technique · asset · L1</span>
        <span className="relative h-[11px]" aria-hidden>
          {section.markers.map((m) => (
            <span
              key={m.label}
              className={cn("num absolute top-0 text-[10.5px] leading-none whitespace-nowrap", m.tone === "gap" ? "text-gap" : "text-ink-2")}
              style={{ left: `${pct(m.minutes, span)}%`, transform: "translateX(-50%)" }}
            >
              {m.label === "SLA" ? `SLA ${durationShort(m.minutes)}` : m.label}
            </span>
          ))}
        </span>
        <span className="label-caps text-right">Closed after</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="case-rows">
        {section.rows.map((row) => (
          <CaseRow
            key={row.caseId}
            row={row}
            span={span}
            markers={section.markers}
            sla={sla}
            open={open === row.caseId}
            onToggle={() => setOpen(open === row.caseId ? null : row.caseId)}
          />
        ))}
      </ol>
    </div>
  );
}

function CaseRow({
  row,
  span,
  markers,
  sla,
  open,
  onToggle,
}: {
  row: CaseEvidenceRow;
  span: number;
  markers: TimelineMarker[];
  sla: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const closed = row.closedAfterMin;
  const bunched = closed !== null && sla !== null && closed >= sla - 15 && closed < sla;
  const breached = closed !== null && sla !== null && closed >= sla;
  return (
    <li className={cn("border-b border-rule-soft", open && "bg-paper-deep/60")} data-testid={`case-${row.caseId}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={cn(CASE_GRID, "w-full cursor-pointer py-[7px] text-left hover:bg-paper-deep/60")}>
      <span className="flex flex-col gap-[4px]">
        <span className="num text-[12.5px] leading-none text-ink">{row.caseId}</span>
        <span className="num text-[11.5px] leading-none text-ink-3">{istShort(row.openedAt)}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-[4px]">
        <span className="truncate text-[13px] leading-tight text-ink" title={row.ruleName}>
          {row.ruleName}
        </span>
        <span className="num truncate text-[11.5px] leading-none text-ink-3">
          {row.technique} · {row.assetHostname} · {row.owner}
        </span>
      </span>
      <span className="relative h-[22px]" role="img" aria-label={lifecycleLabel(row)}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-rule" />
        {markers.map((m) => (
          <span key={m.label} className={cn("absolute top-0 bottom-0", markerClass(m))} style={{ left: `${pct(m.minutes, span)}%` }} />
        ))}
        {closed !== null && (
          <span className="absolute top-1/2 left-0 h-[2px] -translate-y-1/2 bg-ink-3" style={{ width: `${pct(Math.min(closed, span), span)}%` }} />
        )}
        {row.escalatedAfterMin !== null && (
          <span
            className={cn(
              "absolute top-1/2 size-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper-sheet",
              row.escalatedAfterMin <= 30 ? "bg-evidence" : "bg-gap-soft",
            )}
            style={{ left: `${pct(row.escalatedAfterMin, span)}%` }}
            title={`Escalated to ${row.escalatedTo} after ${duration(row.escalatedAfterMin * 60)}`}
          />
        )}
        {closed !== null && (
          <span
            className={cn("absolute top-1/2 h-[14px] w-[3px] -translate-x-1/2 -translate-y-1/2", bunched ? "bg-gap" : "bg-ink")}
            style={{ left: `${pct(Math.min(closed, span), span)}%` }}
          />
        )}
        {closed !== null && closed > span && <span className="num absolute top-0 right-0 text-[10px] leading-none text-ink-3">beyond</span>}
      </span>
      <span className="flex flex-col items-end gap-[5px]">
        <span className={cn("num text-[13px] leading-none", bunched ? "font-semibold text-gap" : breached ? "text-ink" : "text-ink-2")}>
          {closed === null ? "Open" : duration(closed * 60)}
        </span>
        <span className="truncate text-[11.5px] leading-none text-ink-3">{row.disposition ? DISPOSITION[row.disposition] : "No disposition"}</span>
      </span>
      </button>
      {open && <CaseChain row={row} />}
    </li>
  );
}

// The escalation chain of one case, step by step, as its records show it.
export function CaseChain({ row, stacked = false }: { row: CaseEvidenceRow; stacked?: boolean }) {
  const plus = (min: number) => `+${duration(min * 60)}`;
  const l2 = row.chain.find((c) => c.to === "L2");
  const steps: { label: string; detail: string; tone: "ink" | "gap" | "evidence" }[] = [];
  if (row.firstAlertAt !== null)
    steps.push({ label: row.alertCount > 1 ? `${row.alertCount} alerts raised` : "Alert raised", detail: istShort(row.firstAlertAt), tone: "ink" });
  steps.push({ label: "Case opened", detail: `${istShort(row.openedAt).slice(7)} by ${row.owner}`, tone: "ink" });
  if (row.priority === "P1" && !l2) steps.push({ label: "L2 escalation", detail: "No record, due +30 m", tone: "gap" });
  for (const c of row.chain) steps.push({ label: `${c.from} to ${c.to}`, detail: `${plus(c.afterMin)} by ${c.by}`, tone: c.to === "L2" && c.afterMin > 30 ? "gap" : "evidence" });
  if (row.closedAfterMin !== null)
    steps.push({
      label: "Closed",
      detail: `${plus(row.closedAfterMin)} by ${row.closedBy ?? row.owner}`,
      tone: row.closedAfterMin >= row.slaMin - 15 && row.closedAfterMin < row.slaMin ? "gap" : "ink",
    });
  if (stacked) {
    return (
      <div className="py-3" data-testid="case-chain">
        <ol className="flex flex-col">
          {steps.map((s, i) => (
            <li key={i} className={cn("grid grid-cols-[170px_minmax(0,1fr)] items-baseline gap-x-4 border-l-2 py-[6px] pl-3", s.tone === "gap" ? "border-gap" : s.tone === "evidence" ? "border-evidence" : "border-rule")}>
              <span className={cn("text-[11px] leading-none font-semibold tracking-[0.08em] uppercase", s.tone === "gap" ? "text-gap" : "text-ink-2")}>{s.label}</span>
              <span className={cn("num text-[12.5px] leading-none", s.tone === "gap" ? "text-gap" : "text-ink")}>{s.detail}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 border-l-2 border-ink-4 pl-3 font-serif text-[14px] leading-[1.45] text-ink-2 italic">{row.note}</p>
      </div>
    );
  }
  return (
    <div className="px-1 pt-1 pb-4" data-testid="case-chain">
      <ol className="flex items-stretch gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-[5px] border px-3 py-[9px]",
                s.tone === "gap" ? "border-dashed border-gap bg-gap-tint/40" : s.tone === "evidence" ? "border-evidence/50" : "border-rule",
              )}
            >
              <span className={cn("text-[11px] leading-none font-semibold tracking-[0.08em] uppercase", s.tone === "gap" ? "text-gap" : "text-ink-2")}>{s.label}</span>
              <span className="num truncate text-[12px] leading-none text-ink">{s.detail}</span>
            </div>
            {i < steps.length - 1 && <span className="text-ink-4" aria-hidden>›</span>}
          </li>
        ))}
      </ol>
      <p className="mt-3 border-l-2 border-ink-4 pl-3 font-serif text-[13.5px] leading-[1.45] text-ink-2 italic">{row.note}</p>
    </div>
  );
}

function lifecycleLabel(row: CaseEvidenceRow): string {
  const esc = row.escalatedAfterMin === null ? "no escalation" : `escalated after ${duration(row.escalatedAfterMin * 60)}`;
  const close = row.closedAfterMin === null ? "still open" : `closed after ${duration(row.closedAfterMin * 60)}`;
  return `${esc}, ${close}`;
}

const ASSET_GRID = "grid grid-cols-[minmax(0,1fr)_64px_84px_92px_minmax(0,1.2fr)] items-center gap-x-4";

export function AssetTable({ section }: { section: AssetsSection }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={`asset-table-${section.id}`}>
      <div className={cn(ASSET_GRID, "border-b border-ink pb-2")}>
        <span className="label-caps">Asset</span>
        <span className="label-caps">Site</span>
        <span className="label-caps">Criticality</span>
        <span className="label-caps text-right">Alerts</span>
        <span className="label-caps">Log source</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {section.rows.map((a) => (
          <li key={a.assetId} className={cn(ASSET_GRID, "border-b border-rule-soft py-[9px]")}>
            <span className="num truncate text-[12.5px] leading-none text-ink">{a.hostname}</span>
            <span className="num text-[12px] leading-none text-ink-2">{a.site}</span>
            <span className="text-[12.5px] leading-none text-ink-2 capitalize">{a.criticality}</span>
            <span className={cn("num text-right text-[13px] leading-none", a.alerts === 0 ? "font-semibold text-gap" : "text-ink")}>{int(a.alerts)}</span>
            <span className="truncate text-[12.5px] leading-none text-ink-2">
              {a.logSource === null ? (
                <span className="text-gap">None attached</span>
              ) : (
                <>
                  {a.logSource}{" "}
                  <span className="num text-ink-3">
                    {int(a.daysReporting ?? 0)}/{int(a.daysExpected ?? 0)} days
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const SOURCE_GRID = "grid grid-cols-[minmax(0,1fr)_140px_120px] items-center gap-x-4";

export function SourceTable({ section }: { section: SourcesSection }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={`source-table-${section.id}`}>
      <div className={cn(SOURCE_GRID, "border-b border-ink pb-2")}>
        <span className="label-caps">Log source</span>
        <span className="label-caps">Kind</span>
        <span className="label-caps text-right">Days reporting</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {section.rows.map((s) => (
          <li key={s.id} className={cn(SOURCE_GRID, "border-b border-rule-soft py-[9px]")}>
            <span className="truncate text-[13px] leading-none text-ink">{s.name}</span>
            <span className="num text-[12px] leading-none text-ink-2">{s.kind}</span>
            <span className="num text-right text-[13px] leading-none text-ink">
              {int(s.daysReporting)} <span className="text-ink-3">of {int(s.daysExpected)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
