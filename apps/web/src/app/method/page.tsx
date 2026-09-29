import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Masthead } from "@/components/masthead";
import { loadPortfolio } from "@/lib/data";
import { int } from "@/lib/format";
import { BRAND, pageTitle } from "@/lib/brand";

export const metadata: Metadata = { title: pageTitle("Method and sources") };

// How the ledger was built: one card per source the team read, what it shaped, and the clause
// it rests on. Sources are the ones verified in docs/research.md. Every functional
// requirement of the statement is mapped to a screen and a code path in docs/requirements.md.

const SOURCES: { kicker: string; title: string; lines: [string, string]; cite: string }[] = [
  {
    kicker: "Problem statement",
    title: [BRAND.ps || "Problem statement", "NTRO and NCIIPC"].join(", "),
    lines: ["Execution gaps and negative space, as defined", "The records a CSE already submits"],
    cite: BRAND.eventName || "NTRO, for NCIIPC",
  },
  {
    kicker: "Law",
    title: "Protected System Rules, 2018",
    lines: ["CSEs share documented SOC records with NCIIPC", "with audit reports and security SLAs"],
    cite: "MeitY · Rule 4(2), 4(3)(b)",
  },
  {
    kicker: "NCIIPC",
    title: "Guidelines for the Protection of NCII, v2.0",
    lines: ["A clearly demarcated escalation matrix", "Security staffed 24x7x365"],
    cite: "NCIIPC · OC2 8.2.3(a), 6.3.6",
  },
  {
    kicker: "CERT-In",
    title: "Directions under section 70B(6)",
    lines: ["Logs of all ICT systems, kept 180 days", "Clocks synchronised to NIC or NPL"],
    cite: "CERT-In · 28 Apr 2022 · (i), (iv)",
  },
  {
    kicker: "Power sector",
    title: "Cyber Security in Power Sector Guidelines",
    lines: ["Intrusion detection in both IT and OT", "The rule behind P-04's OT claim"],
    cite: "CEA · 7 Oct 2021 · Art. 5(c)(3)",
  },
  {
    kicker: "Regulators",
    title: "Cybersecurity and Cyber Resilience Framework",
    lines: ["Entities already report SOC efficacy as scores", "The kind of figure the ledger recomputes"],
    cite: "SEBI · 20 Aug 2024",
  },
  {
    kicker: "Attack tactics",
    title: "MITRE ATT&CK v19.2 and ATT&CK for ICS",
    lines: ["The columns of the negative-space grid", "Impair Process Control for OT"],
    cite: "MITRE · TA0106",
  },
  {
    kicker: "SOC practice",
    title: "SOC-CMM assessment workbook v2.4.2",
    lines: ["How SOCs rate their own capability", "What a self-assessment covers"],
    cite: "SOC-CMM",
  },
];

const at = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export default function MethodPage() {
  const p = loadPortfolio();
  const g = p.generatedFrom;
  return (
    <>
      <Masthead screen="method" entity={p.entries[0]!.code} cycleLabel={p.cycleLabel} />
      <main className="mx-auto max-w-[1920px] px-8 pb-6 min-[1680px]:px-12" data-testid="method">
        <header className="anim-settle flex items-baseline gap-5 pt-8 pb-6">
          <h1 className="font-serif text-[34px] leading-none text-ink" data-testid="headline">
            How we built it
          </h1>
          <p className="text-[16px] leading-none text-ink-2">What we read, and what each part of {BRAND.product} rests on.</p>
        </header>

        <ol className="grid grid-cols-4 gap-4" data-testid="method-sources">
          {SOURCES.map((s, i) => (
            <li
              key={s.title}
              className="anim-settle flex min-h-[232px] flex-col border border-rule bg-paper-sheet px-6 pt-5 pb-5 shadow-[0_8px_20px_-16px_rgb(38_34_26/0.35)]"
              style={at(250 + i * 180)}
            >
              <span className="label-caps !text-evidence">{s.kicker}</span>
              <span className="mt-3 font-serif text-[21px] leading-[1.18] text-ink">{s.title}</span>
              <span className="mt-3 flex flex-col gap-[3px] text-[14px] leading-snug text-ink-2">
                <span>{s.lines[0]}</span>
                <span>{s.lines[1]}</span>
              </span>
              <span className="num mt-auto pt-4 text-[12.5px] leading-none text-ink-3">{s.cite}</span>
            </li>
          ))}
        </ol>

        <div className="anim-settle mt-4 grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] items-center gap-12 bg-ink px-8 py-6 text-paper" style={at(250 + SOURCES.length * 180 + 200)}>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] leading-none font-medium tracking-[0.14em] text-ink-4 uppercase">Synthetic submissions, the same SOC behaviour</span>
            <span className="text-[15px] leading-snug">
              <span className="num text-[26px]">{int(g.alerts)}</span> alerts · <span className="num text-[26px]">{int(g.cases)}</span> cases ·{" "}
              <span className="num">{int(g.submissions)}</span> quarterly submissions from <span className="num">{int(g.entities)}</span> entities
            </span>
          </div>
          <p className="font-serif text-[21px] leading-snug" data-testid="method-people">
            The team read these rules themselves and spoke with a working SOC analyst.
          </p>
        </div>
        <p className="anim-settle mt-3 text-[12.5px] leading-snug text-ink-3" style={at(250 + SOURCES.length * 180 + 500)}>
          Every functional requirement in the statement is mapped to a screen and a code path in docs/requirements.md. Validation comes next, blind review
          against NCIIPC examiners&apos; own findings. Today&apos;s calibration uses simulated examiners.
        </p>
      </main>
    </>
  );
}
