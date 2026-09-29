import { SECTORS } from "@ledger/submission/constants";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FindingText } from "@/components/finding-text";
import { Masthead } from "@/components/masthead";
import { CLASS_LABEL, NegativeSpaceGrid } from "@/components/negative-space/grid";
import { SilentAssets } from "@/components/negative-space/silent-assets";
import { NegativeSpaceViews } from "@/components/negative-space/views";
import { EstatePicture } from "@/components/overview/estate-picture";
import { Quantity } from "@/components/quantity";
import { entityCodes, loadEntity } from "@/lib/data";
import { int, measure, parts } from "@/lib/format";
import { pageTitle } from "@/lib/brand";

export const dynamicParams = false;

export function generateStaticParams() {
  return entityCodes().map((code) => ({ code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: pageTitle(`${code} negative space`) };
}

const LEGEND = [
  { swatch: "border-2 border-gap hatch-gap-soft", label: "Expected, and empty" },
  { swatch: "border border-dashed border-gap bg-paper-sheet", label: "Under a quarter of expected" },
  { swatch: "bg-[color-mix(in_srgb,var(--evidence)_24%,var(--paper-sheet))]", label: "Alerts recorded, with the expected count" },
  { swatch: "border border-rule bg-paper-sheet", label: "No detection rule, or nothing expected" },
];

// A claim this screen can contradict, by the asset class of the empty row.
const CLAIM_FOR_CLASS: Record<string, string> = {
  ot: "ot_critical_assets_monitored",
  dmz: "dmz_assets_monitored",
  cloud: "cloud_workloads_forwarding",
};

export default async function NegativeSpacePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!entityCodes().includes(code)) notFound();
  const a = loadEntity(code);
  const ns = a.signals.negativeSpace;
  const f = a.findings.find((x) => x.detector.id === "negative-space");
  const quarters = a.assessment.window
    .filter((w) => ns.window.includes(w.id))
    .map((w) => w.label)
    .reverse();
  const quartersText = quarters.join(" and ");
  const dark = ns.rows.filter((r) => r.cells.some((c) => c.state === "negative_space"));
  // One dark row reads as one plain sentence. Anything else falls back to the finding.
  const row = dark.length === 1 ? dark[0]! : null;
  const expected = row ? Math.round(row.cells.filter((c) => c.state === "negative_space").reduce((s, c) => s + (c.expected ?? 0), 0)) : 0;
  const observed = row ? row.cells.reduce((s, c) => s + c.observed, 0) : 0;
  const claim = row ? a.assessment.evaluations.find((e) => e.claim.metric === CLAIM_FOR_CLASS[row.assetClass]) : undefined;
  const peers = ns.peers.map((p) => p.code);
  // What each part of the estate raised across the window, and what OT should have.
  const windowAlerts = Object.fromEntries(ns.rows.map((r) => [r.assetClass, r.cells.reduce((s, c) => s + c.observed, 0)]));
  const otRow = ns.rows.find((r) => r.assetClass === "ot");
  const otExpected = otRow ? Math.round(otRow.cells.filter((c) => c.state === "negative_space").reduce((s, c) => s + (c.expected ?? 0), 0)) : undefined;
  return (
    <>
      <Masthead screen="negative-space" entity={code} cycleLabel={a.cycleLabel} />
      <main className="mx-auto max-w-[1920px] px-8 pb-6 min-[1680px]:px-12">
        <header className="grid grid-cols-[minmax(0,1fr)_430px] items-end gap-12 pt-8 pb-7">
          <div className="flex flex-col gap-3">
            <span className="label-caps">
              Negative space · {code} · {SECTORS[a.assessment.entity.sector]}
            </span>
            <h1 className="max-w-[1000px] font-serif text-[33px] leading-[1.18] text-ink" data-testid="headline">
              {row ? (
                <>
                  {code}&apos;s {CLASS_LABEL[row.assetClass]} assets should have raised about <span className="num font-semibold text-gap">{int(expected)}</span> alerts in{" "}
                  {quarters.length === 2 ? "two quarters" : quartersText}.{" "}
                  {observed === 0 ? (
                    "They raised none."
                  ) : (
                    <>
                      They raised <span className="num font-semibold text-gap">{int(observed)}</span>.
                    </>
                  )}
                </>
              ) : f ? (
                <FindingText finding={f.statement} numberClassName="text-gap font-semibold" />
              ) : (
                "Every asset class shows the alerts its inventory and peers predict."
              )}
            </h1>
            <p className="max-w-[980px] text-[15px] leading-snug text-ink-2">
              What should be there and is not. The expectation is the median rate per asset at sector peers {peers.join(" and ")}, times {code}&apos;s own inventory.
            </p>
          </div>
          {claim && claim.status !== "insufficient_evidence" && (
            <dl className="flex flex-col gap-3 border-l border-rule pl-7 text-[13px] leading-snug" data-testid="negative-space-claim">
              <div>
                <dt className="label-caps mb-1">Attested in claim {claim.claim.ref}</dt>
                <dd className="flex items-baseline gap-3 text-ink">
                  <span className="text-[20px] leading-none font-medium">
                    <Quantity parts={parts(measure(claim.claim.attested), claim.claim.attested)} unitClassName="text-ink-2" />
                  </span>
                  <span className="font-serif text-[15px]">{claim.claim.text}</span>
                </dd>
              </div>
              {claim.basis.length > 0 && (
                <div>
                  <dt className="label-caps mb-1">Basis</dt>
                  {claim.basis.slice(0, 1).map((b) => (
                    <dd key={b.clause} className="text-ink">
                      {b.source}, {b.clause}
                      <span className="block text-ink-3">{b.says}</span>
                    </dd>
                  ))}
                </div>
              )}
            </dl>
          )}
        </header>

        <NegativeSpaceViews
          estate={
            <div className="grid grid-cols-[minmax(0,1060px)_minmax(0,1fr)] items-start gap-12">
              <EstatePicture code={code} overview={a.overview} mode="silence" windowAlerts={windowAlerts} expectedOt={otExpected} testId="estate-silence" />
              <div className="flex flex-col gap-4 pt-10 text-[13.5px] leading-snug text-ink-2">
                <p>
                  One square is one asset. Alerts from each part of the estate travel to the SOC, in proportion to what that part raised across {quartersText}.
                </p>
                <p className="flex items-center gap-2">
                  <span className="inline-block size-[10px] bg-evidence" aria-hidden /> Raised alerts
                </p>
                <p className="flex items-center gap-2 text-gap">
                  <span className="inline-block size-[10px] border-[1.5px] border-gap" aria-hidden /> Expected alerts, raised none
                </p>
              </div>
            </div>
          }
          grid={
            <>
              <NegativeSpaceGrid result={ns} />

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-3">
          <ul className="flex flex-wrap gap-x-7 gap-y-2">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <span className={`inline-block h-[14px] w-[22px] ${l.swatch}`} aria-hidden />
                {l.label}
              </li>
            ))}
          </ul>
          <p className="num text-[11.5px] text-ink-3">
            {ns.detector.id} {ns.detector.version} · ATT&amp;CK v19.2, ICS for OT
          </p>
        </div>

        {ns.silentAssets.length > 0 && <SilentAssets assets={ns.silentAssets} quarters={quartersText} />}
            </>
          }
        />
      </main>
    </>
  );
}
