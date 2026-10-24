import type { EntityAnalysis } from "@ledger/claims/model";
import { DETECTORS } from "@ledger/detect";
import { SECTORS } from "@ledger/submission/constants";
import { FindingText } from "@/components/finding-text";
import { StatusMark } from "@/components/ledger/status-mark";
import { day, int, measure, period, recomputed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export interface Machine {
  platform: string;
  cpus: number;
  memoryGb: number;
  node: string;
}

// The supervisory report as A4 pages. The same markup prints to the PDF, so what the
// examiner reads on screen is what gets filed.

function Page({ children, n, of, id }: { children: React.ReactNode; n: number; of: number; id: string }) {
  return (
    <section
      className="report-page relative mx-auto flex w-[794px] flex-col bg-white px-[64px] pt-[56px] pb-[48px] text-ink shadow-[0_0_0_1px_var(--rule)]"
      style={{ minHeight: 1123 }}
    >
      {children}
      <div className="mt-auto flex items-center justify-between border-t border-rule pt-3 text-[10px] text-ink-3">
        <span className="num">{id}</span>
        <span>Target product · working prototype · synthetic data</span>
        <span className="num">
          {n} / {of}
        </span>
      </div>
    </section>
  );
}

export function ReportDocument({ a, machine, generatedOn }: { a: EntityAnalysis; machine: Machine; generatedOn: string }) {
  const s = a.assessment;
  const docId = `SR-${a.code.replace("-", "")}-${a.cycle.replace("-", "")}`;
  const gaps = s.evaluations.filter((e) => e.status === "gap");
  const untestable = s.evaluations.filter((e) => e.status === "insufficient_evidence");
  const exports = new Map<string, { name: string; quarter: string; rows: number; sha256: string }>();
  for (const e of s.evaluations) for (const x of e.exportsUsed) exports.set(`${x.quarter}/${x.name}`, x);
  const pages = 3;

  return (
    <div className="flex flex-col gap-8" data-testid="report-document">
      <Page n={1} of={pages} id={docId}>
        <div className="flex items-start justify-between border-b-[3px] border-double border-ink pb-5">
          <div className="flex flex-col gap-2">
            <span className="label-caps !text-[10px]">Supervisory report · {a.cycleLabel} assessment</span>
            <h1 className="font-serif text-[40px] leading-none font-medium">{a.code}</h1>
            <span className="text-[13px] text-ink-2">
              {SECTORS[s.entity.sector]} · {s.entity.description}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right text-[11px]">
            <dt className="text-ink-3">Document</dt>
            <dd className="num">{docId}</dd>
            <dt className="text-ink-3">Generated</dt>
            <dd className="num">{generatedOn}</dd>
            <dt className="text-ink-3">Claims</dt>
            <dd className="num">{s.claimsDocument.document_id}</dd>
            <dt className="text-ink-3">Records</dt>
            <dd>{period(s.quarter.start, s.quarter.end)}</dd>
          </dl>
        </div>

        <div className="grid grid-cols-[1fr_150px] gap-8 border-b border-rule py-5">
          <p className="font-serif text-[20px] leading-[1.3]">
            <span className="num font-semibold text-gap">{gaps.length}</span> of <span className="num">{s.evaluations.length}</span> attested figures do not
            hold against {a.code}&apos;s own records. <span className="num">{untestable.length}</span> could not be tested from the submission.{" "}
            <span className="num">{a.findings.length}</span> findings in all.
          </p>
          <div className="flex flex-col items-end justify-center gap-1 border-l border-rule pl-5">
            <span className="label-caps !text-[9.5px]">Supervisory risk</span>
            <span className={cn("num text-[40px] leading-none font-semibold", a.risk >= 50 ? "text-gap" : "text-ink")}>{a.risk}</span>
            <span className="text-[10px] text-ink-3">of 100</span>
          </div>
        </div>

        <h2 className="mt-5 mb-2 font-serif text-[17px]">Findings</h2>
        <ol className="flex flex-col">
          {a.findings.map((f) => (
            <li key={f.id} className="grid grid-cols-[44px_1fr] gap-x-3 border-t border-rule py-[10px]" data-testid={`report-finding-${f.id}`}>
              <span className="num text-[12px] font-semibold text-ink">{f.id}</span>
              <div className="flex flex-col gap-[5px]">
                <span className="text-[13px] font-semibold leading-snug">{f.title}</span>
                <span className="text-[12px] leading-snug text-ink-2">
                  <FindingText finding={f.statement} numberClassName="text-ink" />
                </span>
                <span className="num text-[10px] leading-snug text-ink-3" data-testid={`report-finding-${f.id}-meta`}>
                  {f.detector.id} {f.detector.version}
                  {f.claimRef ? ` · claim ${f.claimRef}` : ""} · severity {f.severity.toFixed(2)} ·{" "}
                  {f.precision === null
                    ? "no examiner history yet"
                    : `simulated examiners confirmed ${Math.round(f.precision * 100)}% of this detector's earlier flags`}{" "}
                  · {int(f.subjects.cases.length + f.subjects.assets.length)} records in appendix A
                </span>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 border-l-2 border-ink-4 pl-3 text-[11px] leading-[1.5] text-ink-2">
          Each finding is an observation from the records as submitted, with the rule version that produced it. Whether it amounts to a failure of the SOC is
          the examiner&apos;s judgement, recorded through blind review of the sample sheet.
        </p>
      </Page>

      <Page n={2} of={pages} id={docId}>
        <h2 className="mb-2 font-serif text-[17px]">Claim-versus-evidence ledger</h2>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="label-caps !text-[9px] py-1 font-medium">Item</th>
              <th className="label-caps !text-[9px] py-1 font-medium">Claim</th>
              <th className="label-caps !text-[9px] py-1 text-right font-medium">Attested</th>
              <th className="label-caps !text-[9px] py-1 text-right font-medium">Recomputed</th>
              <th className="label-caps !text-[9px] py-1 pl-4 font-medium">Finding</th>
            </tr>
          </thead>
          <tbody>
            {s.evaluations.map((e) => (
              <tr key={e.claim.ref} className="border-b border-rule-soft">
                <td className="num py-[6px] text-ink-2">{e.claim.ref}</td>
                <td className="py-[6px]">{e.claim.text}</td>
                <td className="num py-[6px] text-right">{measure(e.claim.attested)}</td>
                <td className={cn("num py-[6px] text-right", e.status === "gap" ? "font-semibold text-gap" : "text-evidence")}>{recomputed(e) || "n/a"}</td>
                <td className="py-[6px] pl-4">
                  <StatusMark status={e.status} className="scale-90" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-6 mb-2 font-serif text-[17px]">Method</h2>
        <ul className="flex flex-col gap-2 text-[11px] leading-[1.5] text-ink-2">
          {gaps.map((e) => (
            <li key={e.claim.ref}>
              <span className="num font-semibold text-ink">{e.claim.ref}</span> {e.method}{" "}
              <span className="num text-ink-3">
                ({e.rule.id} {e.rule.version})
              </span>
            </li>
          ))}
          {a.findings
            .filter((f) => f.detector.id !== "claim-gap")
            .map((f) => (
              <li key={f.id}>
                <span className="num font-semibold text-ink">{f.id}</span> {DETECTORS[f.detector.id].question}{" "}
                {f.method !== DETECTORS[f.detector.id].question ? f.method : ""}{" "}
                <span className="num text-ink-3">
                  ({f.detector.id} {f.detector.version})
                </span>
              </li>
            ))}
        </ul>
      </Page>

      <Page n={3} of={pages} id={docId}>
        <h2 className="mb-2 font-serif text-[17px]">Appendix A · records behind each finding</h2>
        <div className="flex flex-col gap-3">
          {a.findings.map((f) => {
            const ids = [...f.subjects.cases, ...f.subjects.assets];
            return (
              <div key={f.id} className="border-t border-rule pt-2">
                <p className="text-[11px] font-semibold">
                  {f.id} · {f.title} <span className="num font-normal text-ink-3">({ids.length} records)</span>
                </p>
                <p className="num mt-1 text-[9.5px] leading-[1.55] break-words text-ink-2">
                  {ids.slice(0, 60).join("  ")}
                  {ids.length > 60 ? `  and ${ids.length - 60} more` : ""}
                </p>
              </div>
            );
          })}
        </div>

        <h2 className="mt-6 mb-2 font-serif text-[17px]">Appendix B · source exports</h2>
        <table className="w-full text-[10.5px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="label-caps !text-[9px] py-1 font-medium">Export</th>
              <th className="label-caps !text-[9px] py-1 font-medium">Quarter</th>
              <th className="label-caps !text-[9px] py-1 text-right font-medium">Rows</th>
              <th className="label-caps !text-[9px] py-1 pl-4 font-medium">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {[...exports.values()]
              .sort((x, y) => (x.quarter + x.name < y.quarter + y.name ? 1 : -1))
              .map((x) => (
                <tr key={`${x.quarter}/${x.name}`} className="border-b border-rule-soft">
                  <td className="num py-[5px]">{x.name}</td>
                  <td className="num py-[5px] text-ink-2">{x.quarter}</td>
                  <td className="num py-[5px] text-right">{int(x.rows)}</td>
                  <td className="num py-[5px] pl-4 text-[9.5px] text-ink-2">{x.sha256}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <p className="mt-6 text-[10.5px] leading-[1.6] text-ink-2">
          Generated by {BRAND.product} 0.1 on one machine, {machine.platform}, {machine.cpus} CPU cores, {machine.memoryGb} GB memory, Node {machine.node}. No
          network connection was used or needed. Claims signed {day(s.claimsDocument.signed_on)} by the {s.claimsDocument.signed_by_role}.
        </p>
      </Page>
    </div>
  );
}
