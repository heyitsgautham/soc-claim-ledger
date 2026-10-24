import type { Metadata } from "next";
import { Masthead } from "@/components/masthead";
import { PortfolioTable } from "@/components/portfolio/portfolio-table";
import { loadPortfolio } from "@/lib/data";
import { int } from "@/lib/format";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("Portfolio") };

const ATTENTION = 50;

function list(codes: string[]): string {
  return codes.length < 2 ? (codes[0] ?? "") : `${codes.slice(0, -1).join(", ")} and ${codes.at(-1)}`;
}

export default function PortfolioPage() {
  const p = loadPortfolio();
  const first = p.entries.filter((e) => e.risk >= ATTENTION).map((e) => e.code);
  const withFindings = p.entries.filter((e) => e.findings > 0).length;
  const clean = p.entries.filter((e) => e.findings === 0 && e.insufficient === 0).length;
  const untested = p.entries.filter((e) => e.findings === 0 && e.insufficient > 0);
  const untestedClaims = untested.reduce((s, e) => s + e.insufficient, 0);
  return (
    <>
      <Masthead screen="portfolio" entity={p.entries[0]!.code} cycleLabel={p.cycleLabel} />
      <main className="mx-auto max-w-[1920px] px-8 pb-6 min-[1680px]:px-12">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-12 pt-8 pb-8">
          <div className="flex flex-col gap-3">
            <span className="label-caps">Portfolio · {p.cycleLabel}</span>
            <h1 className="font-serif text-[31px] leading-[1.18] text-ink" data-testid="headline">
              <span className="num font-semibold text-gap">{withFindings}</span> of <span className="num">{p.entries.length}</span> entities have findings this
              cycle.
              {first.length > 0 && <> Start with {list(first)}.</>}
            </h1>
            <p className="text-[14.5px] leading-snug text-ink-2">
              <span className="num">{clean}</span> hold on every claim.
              {untested.length > 0 && (
                <>
                  {" "}
                  {list(untested.map((e) => e.code))} left an export out, so <span className="num">{untestedClaims}</span> claim
                  {untestedClaims === 1 ? " was" : "s were"} not tested.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-[7px] border-l border-rule pl-10 text-right" data-testid="analysis-time">
            <span className="label-caps">Processor time on this machine</span>
            <span className="num text-[34px] leading-none font-medium text-ink">
              {p.analysedInSeconds.toFixed(1)}
              <span className="text-[18px] text-ink-3"> s</span>
            </span>
            <span className="text-[13px] leading-none text-ink-2">
              <span className="num">{int(p.generatedFrom.submissions)}</span> submissions · <span className="num">{int(p.generatedFrom.alerts)}</span> alerts ·{" "}
              <span className="num">{int(p.generatedFrom.cases)}</span> cases
            </span>
          </div>
        </header>
        <PortfolioTable portfolio={p} />
      </main>
    </>
  );
}
