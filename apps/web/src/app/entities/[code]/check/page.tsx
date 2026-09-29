import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LedgerScreen } from "@/components/ledger/ledger-screen";
import { Masthead } from "@/components/masthead";
import { entityCodes, loadEntity } from "@/lib/data";
import { pageTitle } from "@/lib/brand";

// The entity's signed report before anything is checked. Running the check turns it into
// the ledger at /entities/[code].
export const dynamicParams = false;

export function generateStaticParams() {
  return entityCodes().map((code) => ({ code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: pageTitle(`${code} signed report`) };
}

export default async function EntityCheckPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!entityCodes().includes(code)) notFound();
  const analysis = loadEntity(code);
  return (
    <>
      <Masthead screen="ledger" entity={code} cycleLabel={analysis.cycleLabel} />
      <LedgerScreen assessment={analysis.assessment} startWith="attested" />
    </>
  );
}
