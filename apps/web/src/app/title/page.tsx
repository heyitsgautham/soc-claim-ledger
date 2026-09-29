import type { Metadata } from "next";
import { loadPortfolio } from "@/lib/data";
import { int } from "@/lib/format";
import { BRAND, orgLine } from "@/lib/brand";

export const metadata: Metadata = { title: BRAND.product };

// The closing card of the demo video.
export default function TitlePage() {
  const p = loadPortfolio();
  return (
    <main className="flex h-full flex-col items-center justify-center px-8" data-testid="title-card">
      <div className="anim-settle flex w-full max-w-[1100px] flex-col gap-8">
        <span className="label-caps">{[BRAND.event, orgLine()].filter(Boolean).join(" · ")}</span>
        <h1 className="font-serif text-[120px] leading-[0.9] font-medium tracking-[-0.01em] text-ink">{BRAND.product}</h1>
        <p className="max-w-[900px] font-serif text-[34px] leading-[1.2] text-ink">
          What a CSE claims about its SOC, beside what its own alert and case records say.
        </p>
        <div className="double-rule" />
        <div className="grid grid-cols-3 gap-10 text-[15px] leading-snug text-ink-2">
          <p>
            Target product and working prototype on synthetic SOC data, <span className="num text-ink">{int(p.generatedFrom.submissions)}</span> quarterly
            submissions from <span className="num text-ink">{p.generatedFrom.entities}</span> simulated entities.
          </p>
          <p>Air-gapped. One machine. No network, no cloud, no hosted models. Docker image or USB install.</p>
          <p>
            Team 1, Saveetha Engineering College
            <br />
            for NCIIPC
          </p>
        </div>
      </div>
    </main>
  );
}
