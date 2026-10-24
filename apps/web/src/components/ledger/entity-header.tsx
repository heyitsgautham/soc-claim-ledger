import type { Assessment } from "@ledger/claims/model";
import { SECTORS } from "@ledger/submission/constants";
import Link from "next/link";
import { day, int, period } from "@/lib/format";
import { vt } from "./transition";

// The top of the working paper: which entity, what it attested, what the ledger
// recomputed it from, and the one-line reading of the result.

export function EntityHeader({ assessment: a }: { assessment: Assessment }) {
  const total = a.evaluations.length;
  const gaps = a.evaluations.filter((e) => e.status === "gap").length;
  const untestable = a.evaluations.filter((e) => e.status === "insufficient_evidence").length;
  const hold = a.evaluations.filter((e) => e.status === "holds").length;
  const rows = (name: string) => a.exports.find((x) => x.name === name)?.rows;
  const counts = (
    [
      ["alerts", rows("alerts")],
      ["cases", rows("cases")],
      ["escalations", rows("escalations")],
      ["assets", rows("assets")],
    ] as const
  ).filter(([, n]) => n !== undefined);

  return (
    <header
      className="grid grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(330px,400px)] items-end gap-x-9 pt-8 pb-9 min-[1680px]:grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(360px,440px)] min-[1680px]:gap-x-14"
      data-testid="entity-header"
    >
      <div className="flex flex-col">
        <span className="label-caps">Entity under assessment</span>
        <h1 className="mt-3 font-serif text-[68px] leading-[0.9] font-medium tracking-[-0.01em] text-ink" data-testid="entity-code">
          <span className="inline-block" style={vt("entity")}>
            {a.entity.code}
          </span>
        </h1>
        <p className="mt-4 text-[15px] leading-snug text-ink">{SECTORS[a.entity.sector]}</p>
        <p className="text-[13.5px] leading-snug text-ink-2">
          {a.entity.description}, <span className="num">{a.entity.sites}</span> sites
        </p>
      </div>

      <div className="flex flex-col gap-3 border-l border-rule pl-9 min-[1680px]:pl-14">
        <p className="font-serif text-[27px] leading-[1.2] text-ink min-[1680px]:text-[31px] min-[1680px]:leading-[1.18]" data-testid="headline">
          <span className="num font-semibold text-gap">{gaps}</span> of <span className="num">{total}</span> attested figures do not hold against{" "}
          <span className="whitespace-nowrap">{a.entity.code}&apos;s</span> own records.
        </p>
        <p className="text-[14.5px] leading-snug text-ink-2">
          <span className="num">{untestable}</span> cannot be tested from this submission. <span className="num">{hold}</span> hold within tolerance.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-y-4 border-l border-rule pl-7 text-[12.5px] leading-snug min-[1680px]:pl-8 min-[1680px]:text-[13px]">
        <div>
          <dt className="label-caps mb-1">Attested in</dt>
          <dd className="text-ink">
            <span className="num text-[12.5px]">{a.claimsDocument.document_id}</span>, self-assessment and KPI report
          </dd>
          <dd className="text-ink-2">
            Signed by the {a.claimsDocument.signed_by_role}, {day(a.claimsDocument.signed_on)}
          </dd>
          <dd className="mt-[2px]">
            <Link
              href={`/entities/${a.entity.code}/check`}
              className="text-ink underline decoration-rule underline-offset-[3px] hover:decoration-ink"
              data-testid="view-signed"
            >
              See it as signed
            </Link>
          </dd>
        </div>
        <div>
          <dt className="label-caps mb-1">Recomputed from</dt>
          <dd className="text-ink">
            {a.quarter.label} submission, {period(a.quarter.start, a.quarter.end)}
          </dd>
          <dd className="text-ink-2">
            {counts.map(([name, n], i) => (
              <span key={name}>
                {i > 0 && " · "}
                <span className="num text-ink">{int(n!)}</span> {name}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </header>
  );
}
