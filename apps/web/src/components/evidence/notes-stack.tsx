"use client";

import type { EvidenceSection } from "@ledger/claims/model";
import { type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NotesTable } from "./notes-table";

type NotesSection = Extract<EvidenceSection, { type: "notes" }>;

// The templated-notes cluster, laid one note over another. The notes arrive as a fanned
// stack of separate case notes, then slide into register. Words the notes share print
// through every layer and come out solid. The words that differ, usually just the
// hostname, sit in one slot and blur into each other. A list view keeps each note apart.

const REGISTER_AT_MS = 1500;
const LAYER_ALPHA = 0.22;

function differing(text: string, reference: string): Set<number> {
  const a = text.split(/\s+/);
  const b = reference.split(/\s+/);
  const out = new Set<number>();
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.add(i);
  return out;
}

export function NotesStack({ section }: { section: NotesSection }) {
  const { cluster } = section;
  const [view, setView] = useState<"stack" | "list">("stack");
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (view !== "stack") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setRegistered(true), still ? 0 : REGISTER_AT_MS);
    return () => window.clearTimeout(t);
  }, [view]);

  // Word positions that differ anywhere in the cluster share one slot as wide as the
  // longest word that lands in it, so every other word lines up across the notes.
  const words = cluster.members.map((m) => m.text.split(/\s+/));
  const diffAt = new Set<number>();
  for (const m of cluster.members) for (const i of differing(m.text, cluster.medoidText)) diffAt.add(i);
  const width = new Map<number, number>();
  for (const w of words) for (const i of diffAt) width.set(i, Math.max(width.get(i) ?? 0, w[i]?.length ?? 0));
  const layers = cluster.members.length;
  // Name what changes only when it plainly is a hostname, such as DMZ-WEB-21.
  const changed = cluster.members.flatMap((_m, k) => [...diffAt].map((i) => (words[k]![i] ?? "").replace(/[.,;:]$/, "")));
  const hostnames = diffAt.size === 1 && changed.every((w) => /^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(w));
  const verdict = hostnames ? "Only the hostname changes." : `Only ${diffAt.size} word${diffAt.size === 1 ? "" : "s"} change.`;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="notes-stack">
      <div className="mb-4 flex items-baseline justify-between gap-6">
        <p className="text-[13px] leading-snug text-ink-2">
          <span className="num text-ink">{cluster.size}</span> closure notes on these cases, laid one on another.
        </p>
        <button
          type="button"
          onClick={() => setView(view === "stack" ? "list" : "stack")}
          className="shrink-0 text-[12.5px] leading-none text-ink underline decoration-rule underline-offset-[3px] hover:decoration-ink"
          data-testid="notes-view-toggle"
        >
          {view === "stack" ? `List all ${cluster.size}` : "Lay them on one another"}
        </button>
      </div>

      {view === "list" ? (
        <NotesTable section={section} />
      ) : (
        <>
          <div
            className="relative transition-[height] duration-[1100ms] ease-[cubic-bezier(0.65,0,0.25,1)]"
            style={{ height: registered ? 150 : 150 + 13 * (layers - 1) }}
            aria-label={`${layers} closure notes laid one on another`}
            role="img"
          >
            {cluster.members.map((m, k) => (
              <div
                key={m.id}
                className={cn(
                  "anim-appear absolute top-0 left-0 border px-5 pt-4 pb-5 transition-[transform,background-color,border-color,box-shadow] duration-[1100ms] ease-[cubic-bezier(0.65,0,0.25,1)]",
                  registered ? "border-transparent bg-transparent shadow-none" : "border-rule bg-paper-sheet shadow-[0_6px_14px_-10px_rgb(38_34_26/0.45)]",
                )}
                style={{
                  width: `calc(100% - ${9 * (layers - 1)}px)`,
                  transform: registered ? "none" : `translate(${9 * k}px, ${13 * k}px)`,
                  animationDelay: `${60 + k * 70}ms`,
                  zIndex: k,
                }}
              >
                <div
                  className={cn(
                    "mb-2 flex justify-between text-[11.5px] leading-none transition-opacity duration-500",
                    registered ? "opacity-0" : "opacity-100",
                  )}
                >
                  <span className="num text-ink-3">{m.id}</span>
                  <span className="num text-ink-3">{m.owner}</span>
                </div>
                <p
                  className="font-serif text-[17px] leading-[1.55] transition-colors duration-[1100ms]"
                  style={{ color: registered ? `rgb(27 27 27 / ${LAYER_ALPHA})` : "var(--ink-2)" }}
                >
                  {words[k]!.map((w, i) =>
                    diffAt.has(i) ? (
                      <span
                        key={i}
                        className="num inline-block text-left text-[14px] font-medium transition-colors duration-[1100ms]"
                        style={{ width: `${width.get(i) ?? w.length}ch`, color: registered ? `rgb(180 35 24 / ${LAYER_ALPHA + 0.1})` : "var(--gap)" }}
                      >
                        {w}
                      </span>
                    ) : (
                      <span key={i}>{w}</span>
                    ),
                  ).flatMap<ReactNode>((node, i) => (i ? [" ", node] : [node]))}
                </p>
              </div>
            ))}
          </div>
          <p
            className={cn(
              "mt-3 flex items-baseline gap-4 text-[15px] leading-snug text-ink transition-opacity duration-700",
              registered ? "opacity-100 delay-1000" : "opacity-0",
            )}
            data-testid="notes-verdict"
          >
            <span>
              <span className="num font-semibold text-gap">{cluster.size}</span> notes, one paragraph. {verdict}
            </span>
            <span className="num text-[12.5px] text-ink-3">
              mean similarity {cluster.meanSimilarity.toFixed(2)} · {section.detector.id} {section.detector.version}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
