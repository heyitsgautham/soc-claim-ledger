import { calibrate } from "@ledger/claims";
import type { Metadata } from "next";
import { AuditLog } from "@/components/calibration/audit-log";
import { CalibrationTable } from "@/components/calibration/calibration-table";
import { Masthead } from "@/components/masthead";
import { defaultEntity, loadCalibrationHistory, loadPortfolio, localAudit, localVerdicts, verdictHistory } from "@/lib/data";
import { int } from "@/lib/format";
import { pageTitle } from "@/lib/brand";

// Dynamic, so a verdict recorded a moment ago counts here straight away.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: pageTitle("Calibration") };

export default function CalibrationPage() {
  const p = loadPortfolio();
  const history = loadCalibrationHistory();
  const live = localVerdicts();
  const verdicts = [...verdictHistory(), ...live];
  const c = calibrate(
    verdicts,
    history.cycles,
    localAudit().filter((a) => a.action !== "verdict_recorded"),
  );
  const pastCycles = new Set(verdicts.filter((v) => v.cycle !== p.cycle).map((v) => v.cycle)).size;
  const tn = c.rows.find((r) => r.detector.id === "templated-notes");
  const first = tn?.cells.find((x) => x.precision !== null);
  const last = [...(tn?.cells ?? [])].reverse().find((x) => x.precision !== null);
  const lastLive =
    live
      .map((v) => v.recordedAt)
      .sort()
      .at(-1) ?? null;
  return (
    <>
      <Masthead screen="calibration" entity={defaultEntity()} cycleLabel={p.cycleLabel} />
      <main className="mx-auto max-w-[1920px] px-8 pb-6 min-[1680px]:px-12">
        <header className="flex flex-col gap-3 pt-8 pb-7">
          <span className="label-caps">Calibration · every detector against examiner verdicts</span>
          <h1 className="font-serif text-[31px] leading-[1.18] text-ink" data-testid="headline">
            <span className="num">{int(verdicts.length)}</span> blind verdicts across <span className="num">{pastCycles}</span> past cycles
            {live.length > 0 && (
              <>
                {" "}
                and <span className="num">{live.length}</span> from this one
              </>
            )}{" "}
            set how far each detector is trusted.
          </h1>
          {first && last && first.version !== last.version && (
            <p className="max-w-[1100px] text-[14.5px] leading-snug text-ink-2">
              In this demo the past cycles hold simulated examiner verdicts. They confirmed{" "}
              <span className="num">{Math.round((first.precision ?? 0) * 100)}%</span> of templated-notes flags under v{first.version}. After v{last.version}{" "}
              raised the threshold, <span className="num">{Math.round((last.precision ?? 0) * 100)}%</span>. Each finding&apos;s weight in the risk indicator is
              its detector&apos;s precision from earlier cycles.
            </p>
          )}
        </header>
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 min-[1680px]:grid-cols-[minmax(0,1fr)_560px]">
          <div className="flex flex-col gap-4">
            <CalibrationTable calibration={c} current={p.cycle} />
            <p className="text-[12.5px] leading-snug text-ink-3">
              Precision is confirmed over confirmed plus rejected. Cannot-tell verdicts are counted as reviewed and nothing else. Counterexamples and random
              picks surfaced <span className="num text-ink-2">{c.controls.reduce((s, x) => s + x.issues, 0)}</span> issues no detector flagged, out of{" "}
              <span className="num text-ink-2">{c.controls.reduce((s, x) => s + x.reviewed, 0)}</span> reviewed, which is the tool&apos;s measured miss.
            </p>
          </div>
          <AuditLog entries={c.audit.slice(0, 16)} highlightSince={lastLive} />
        </div>
      </main>
    </>
  );
}
