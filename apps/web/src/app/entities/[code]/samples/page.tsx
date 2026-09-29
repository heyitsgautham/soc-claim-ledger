import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { SampleSheet } from "@/components/samples/sample-sheet";
import { entityCodes, loadEntity, localVerdicts } from "@/lib/data";
import { pageTitle } from "@/lib/brand";

// Dynamic, because verdicts recorded on this machine change what the sheet shows.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: pageTitle(`${code} sample sheet`) };
}

export default async function SamplesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!entityCodes().includes(code)) notFound();
  const a = loadEntity(code);
  const mine = localVerdicts().filter((v) => v.entity === code && v.cycle === a.cycle);
  return (
    <>
      <Masthead screen="samples" entity={code} cycleLabel={a.cycleLabel} />
      <main className="mx-auto max-w-[1920px] px-8 pb-6 min-[1680px]:px-12">
        <header className="flex flex-col gap-3 pt-8 pb-7">
          <span className="label-caps">
            Sample sheet · {code} · {a.cycleLabel}
          </span>
          <h1 className="font-serif text-[31px] leading-[1.18] text-ink" data-testid="headline">
            <span className="num">{a.samples.items.length}</span> records for manual review, each picked for a stated reason.
          </h1>
          <p className="max-w-[1000px] text-[14.5px] leading-snug text-ink-2">
            The sheet covers every finding before it doubles up on any, and holds back a counterexample and a random pick so the review also sees what the tool
            did not flag.
          </p>
        </header>
        <SampleSheet sheet={a.samples} initial={mine} entity={code} />
      </main>
    </>
  );
}
