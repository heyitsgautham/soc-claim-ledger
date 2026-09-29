import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { ExportPanel } from "@/components/report/export-panel";
import { ReportDocument } from "@/components/report/report-document";
import { entityCodes, loadEntity } from "@/lib/data";
import { day } from "@/lib/format";
import { machine } from "@/lib/machine";
import { pageTitle } from "@/lib/brand";

// Dynamic, because the hardware line describes the machine serving the report.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: pageTitle(`${code} report`) };
}

function today(): string {
  const d = new Date(Date.now() + 330 * 60_000);
  return day(d.toISOString().slice(0, 10));
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ print?: string }> }) {
  const { code } = await params;
  const { print } = await searchParams;
  if (!entityCodes().includes(code)) notFound();
  const a = loadEntity(code);
  const m = machine();
  const docId = `SR-${code.replace("-", "")}-${a.cycle.replace("-", "")}`;
  if (print === "1") {
    return (
      <div className="print-mode">
        <ReportDocument a={a} machine={m} generatedOn={today()} />
      </div>
    );
  }
  return (
    <>
      <Masthead screen="report" entity={code} cycleLabel={a.cycleLabel} />
      <main className="mx-auto max-w-[1920px] px-8 pb-10 min-[1680px]:px-12">
        <header className="flex flex-col gap-3 pt-8 pb-7">
          <span className="label-caps">Supervisory report · {code}</span>
          <h1 className="font-serif text-[31px] leading-[1.18] text-ink" data-testid="headline">
            Every finding goes into the report with its rationale, its evidence and the rule version that produced it.
          </h1>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-x-12">
          <div className="bg-paper-deep py-8">
            <ReportDocument a={a} machine={m} generatedOn={today()} />
          </div>
          <ExportPanel code={code} docId={docId} machine={m} />
        </div>
      </main>
    </>
  );
}
