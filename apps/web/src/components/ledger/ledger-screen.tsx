"use client";

import type { Assessment, Overview } from "@ledger/claims/model";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { EvidenceDrawer } from "@/components/evidence/evidence-drawer";
import { SubmissionOverview } from "@/components/overview/submission-overview";
import { AttestedReport, type CheckPhase, SUMMARY_AT_MS } from "./attested-report";
import { EntityHeader } from "./entity-header";
import { LedgerTable } from "./ledger-table";

// The hero screen. It can open on the entity's submission as a picture, take the signed
// report out of it, run the check, and carry every changed claim into the ledger. The open evidence drawer is mirrored in
// ?claim= so a take can deep-link straight to it and a reload keeps the examiner there.

// How long the result of the check holds before the report turns into the ledger.
const SUMMARY_HOLD_MS = 1900;

function still(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LedgerScreen({ assessment, overview, startWith }: { assessment: Assessment; overview?: Overview; startWith?: "overview" | "attested" }) {
  const [phase, setPhase] = useState<CheckPhase | "overview" | "ledger">(startWith ?? "ledger");
  const [arrived, setArrived] = useState(false);
  const timers = useRef<number[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const known = useCallback((ref: string | null) => ref !== null && assessment.evaluations.some((e) => e.claim.ref === ref), [assessment]);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("claim");
    if (known(ref)) setOpen(ref);
  }, [known]);

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );

  const toLedger = useCallback(() => {
    window.history.replaceState(null, "", `/entities/${assessment.entity.code}`);
    const go = () =>
      flushSync(() => {
        setArrived(true);
        setPhase("ledger");
      });
    if (still() || typeof document.startViewTransition !== "function") return go();
    document.documentElement.dataset.vt = "check";
    document.startViewTransition(go).finished.finally(() => delete document.documentElement.dataset.vt);
  }, [assessment.entity.code]);

  // The report half of the folder grows into the report's sheet of paper.
  const openReport = useCallback(() => {
    window.history.replaceState(null, "", `/entities/${assessment.entity.code}/check`);
    const go = () => flushSync(() => setPhase("attested"));
    if (still() || typeof document.startViewTransition !== "function") return go();
    document.documentElement.dataset.vt = "open";
    document.startViewTransition(go).finished.finally(() => delete document.documentElement.dataset.vt);
  }, [assessment.entity.code]);

  const check = useCallback(() => {
    const quick = still();
    setPhase("checking");
    timers.current.push(window.setTimeout(() => setPhase("checked"), quick ? 0 : SUMMARY_AT_MS));
    timers.current.push(window.setTimeout(toLedger, quick ? 600 : SUMMARY_AT_MS + SUMMARY_HOLD_MS));
  }, [toLedger]);

  const select = useCallback((ref: string | null) => {
    setOpen(ref);
    const url = new URL(window.location.href);
    if (ref) url.searchParams.set("claim", ref);
    else url.searchParams.delete("claim");
    window.history.replaceState(null, "", url);
  }, []);

  if (phase === "overview" && overview) return <SubmissionOverview assessment={assessment} overview={overview} onOpen={openReport} />;
  if (phase !== "ledger" && phase !== "overview") return <AttestedReport assessment={assessment} phase={phase} onCheck={check} />;

  const evaluation = assessment.evaluations.find((e) => e.claim.ref === open) ?? null;
  return (
    <>
      <main className="mx-auto max-w-[1920px] px-8 pb-6 min-[1680px]:px-12">
        <EntityHeader assessment={assessment} />
        <LedgerTable evaluations={assessment.evaluations} selected={open} onOpen={select} introDelayMs={arrived ? 900 : 0} />
      </main>
      <EvidenceDrawer assessment={assessment} evaluation={evaluation} onClose={() => select(null)} />
    </>
  );
}
