import { readFileSync } from "node:fs";
import path from "node:path";
import type { EntityAnalysis, Portfolio } from "@ledger/claims/model";
import type { Page } from "playwright";
import { BRAND, orgLine } from "./brand";

// The demo video, one slow two-minute cut. One example, P-04: first the entity itself, what
// it runs and who watches it, then its signed self-assessment checked line by line, one
// broken claim followed into its alerts and closure notes, the same entity's negative
// space, the portfolio it sits in, the sample an examiner reads by hand, and how the tool
// was built.
//
// Every number the voiceover says is read from the same analysis the screen renders, so a
// spoken figure can never drift from the one on screen. Each scene owns a window of the
// final cut, its line, and the actions that play in it. record.ts plays this and writes
// voiceover.md from it.

export interface Director {
  page: Page;
  at(seconds: number): Promise<void>;
  moveTo(testId: string, opts?: { ms?: number; dx?: number; dy?: number }): Promise<void>;
  click(testId: string, opts?: { ms?: number; dx?: number; dy?: number }): Promise<void>;
  // An edit zoom: the camera moves so the element sits in the middle of the frame, scaled.
  // `dy` moves the point the camera centres on, in page pixels from the element's centre.
  zoom(testId: string, scale: number, ms?: number, dy?: number): Promise<void>;
  unzoom(ms?: number): Promise<void>;
  // A ring drawn around an element for `ms`, the way an editor points at something.
  ring(testId: string, ms?: number, tone?: "ink" | "gap"): Promise<void>;
  scrollTo(testId: string, ms?: number): Promise<void>;
  // Scroll an element into view inside whatever panel holds it.
  reveal(testId: string, ms?: number): Promise<void>;
  hideCursor(): Promise<void>;
  lowerThird(show: boolean): Promise<void>;
}

export interface Scene {
  id: string;
  start: number;
  end: number;
  screen: string;
  line: string;
  play(d: Director): Promise<void>;
}

// The cut runs under two minutes, the statement's limit for the demo video.
export const DURATION = 118.5;
export const ENTITY = "P-04";
// Where the take opens: P-04's quarterly submission, drawn as a picture.
export const START = `/entities/${ENTITY}/submission`;

// Where the cursor rests when nothing is being pointed at, over plain text in the footer.
const PARK: [number, number] = [1240, 873];

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// A number that opens a sentence is written out, the way the reader says it.
function opening(n: number): string {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (n >= 100) return String(n);
  const w = n < 20 ? ones[n]! : tens[Math.floor(n / 10)]! + (n % 10 ? `-${ones[n % 10]}` : "");
  return w[0]!.toUpperCase() + w.slice(1);
}

function read<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(repo, "data/demo/derived", file), "utf8")) as T;
}

export function scenes(): Scene[] {
  const a = read<EntityAnalysis>(`entities/${ENTITY}.json`);
  const p = read<Portfolio>("portfolio.json");
  const ev = a.assessment.evaluations;
  const count = (s: string) => ev.filter((e) => e.status === s).length;
  const [gaps, holds, untested] = [count("gap"), count("holds"), count("insufficient_evidence")];
  const e = ev.find((x) => x.claim.ref === "1.1")!;
  const recomputed = e.recomputed?.kind === "percent" ? Math.round(e.recomputed.value) : 0;
  const tally = e.evidence.find((s) => s.type === "breakdown");
  const none = tally?.type === "breakdown" ? (tally.parts.find((x) => x.key === "none")?.count ?? 0) : 0;
  const hist = e.evidence.find((s) => s.type === "histogram");
  const h = hist?.type === "histogram" ? hist.histogram : null;
  const share = h ? Math.round(h.bunching.share * 100) : 0;
  const lastMinutes = h ? h.bunching.bucket.end - h.bunching.bucket.start : 0;
  const notes = e.evidence.find((s) => s.type === "notes");
  const templated = notes?.type === "notes" ? notes.cluster.size : 0;
  const ot = a.signals.negativeSpace.rows.find((r) => r.assetClass === "ot")!;
  const expectedOt = Math.round(ot.cells.filter((c) => c.state === "negative_space").reduce((s, c) => s + (c.expected ?? 0), 0)).toLocaleString("en-IN");
  const samples = a.samples.items.length;
  const withFindings = p.entries.filter((x) => x.risk > 0).length;

  return [
    {
      id: "world",
      start: 0,
      end: 16.5,
      screen: `${ENTITY} as a picture: its data centre, DMZ, endpoints and cloud, one square per asset, its OT substations below, and the SOC with its analysts. Alerts flow in as dots, and one critical alert is followed from alert to case to L2 to closure. Lower third with ${[BRAND.product, orgLine()].join(", ")}, Team 1`,
      line: "This is P-04. It runs part of India's power grid. Its security team, the SOC, watches every alert its systems raise, and escalates the serious ones to a senior analyst.",
      async play(d) {
        await d.page.mouse.move(...PARK, { steps: 2 });
        await d.at(0.8);
        await d.lowerThird(true);
        await d.at(7.4);
        await d.lowerThird(false);
      },
    },
    {
      id: "check",
      start: 16.5,
      end: 34.5,
      screen: `The quarter's submission is sent to NCIIPC in two halves, the signed report and the records. The report grows out of the folder. Click Check: a rule sweeps down it, ${holds} lines go quiet, ${untested} turns dashed, ${gaps} are struck through with the recomputed figure in red, and the report becomes the ledger`,
      line: `Each quarter, it sends NCIIPC a signed report, and its own records. ${BRAND.product} checks every line against those records. ${opening(holds)} claims hold. ${opening(untested)} cannot be tested. ${opening(gaps)} do not.`,
      async play(d) {
        await d.at(19.6);
        await d.click("open-report", { ms: 800, dx: 0.2 });
        await d.at(22.2);
        await d.click("run-check", { ms: 800, dx: 0.2 });
        // Out of the way of the summary that takes the button's place.
        await d.page.mouse.move(1520, 840, { steps: 45 });
        await d.at(32.6);
        await d.ring("headline", 1800, "gap");
      },
    },
    {
      id: "gap",
      start: 34.5,
      end: 53,
      screen: `Click row 1.1. The drawer opens: attested 100%, recomputed ${recomputed}%. ${e.population?.count ?? 0} marks, one per critical alert, colour and sort, ${none} red with no escalation record, and the closure histogram rises. Edit zoom on the spike, ${share}% in the last ${lastMinutes} minutes before the SLA`,
      line: `It signed that every critical alert is escalated within 30 minutes. Its records say ${recomputed} percent. ${opening(none)} have no escalation record. And ${share} percent close in the last ${lastMinutes} minutes before the deadline.`,
      async play(d) {
        await d.at(34.7);
        await d.click("ledger-row-1.1", { ms: 700, dx: -0.1 });
        await d.page.mouse.move(...PARK, { steps: 30 });
        await d.at(40.8);
        await d.ring("tally-escalation-outcome", 3000, "gap");
        await d.at(43.9);
        await d.zoom("closure-histogram", 1.55, 1200);
        await d.at(51.9);
        await d.unzoom(600);
      },
    },
    {
      id: "notes",
      start: 53,
      end: 63,
      screen: `Open the ${templated} templated notes. The closure notes lie on one another, blurred where the hostnames differ, then register into one crisp paragraph. Edit zoom`,
      line: `${opening(templated)} of those closure notes, laid on top of one another, are the same paragraph. Only the hostname changes.`,
      async play(d) {
        await d.at(52.7);
        await d.click("records-tab-templated-notes", { ms: 700 });
        await d.page.mouse.move(...PARK, { steps: 20 });
        await d.at(53.9);
        await d.zoom("notes-stack", 1.6, 1000, -60);
        await d.at(62.3);
        await d.unzoom(500);
      },
    },
    {
      id: "negative-space",
      start: 63,
      end: 78.5,
      screen: `Negative space for ${ENTITY}, drawn as the estate: IT lit by alerts, the OT substations outlined in red and silent, about ${expectedOt} alerts expected. Ring on the OT row, then the grid by ATT&CK tactic, where the OT row flips to red zeros`,
      line: `Negative space is what should be there, and is not. ${ENTITY}'s grid control systems should have raised about ${expectedOt} alerts. They raised none.`,
      async play(d) {
        await d.at(62.9);
        await d.page.keyboard.press("Escape");
        await d.at(63.3);
        await d.click("nav-negative-space", { ms: 650 });
        await d.page.mouse.move(...PARK, { steps: 40 });
        await d.at(67.1);
        await d.ring("estate-ot-row", 4400, "gap");
        await d.at(71.9);
        await d.click("view-grid", { ms: 700 });
        await d.page.mouse.move(...PARK, { steps: 30 });
        await d.at(74.8);
        await d.ring("grid-row-ot", 3500, "gap");
      },
    },
    {
      id: "portfolio",
      start: 78.5,
      end: 89.5,
      screen: `Portfolio. ${p.entries.length} entities glide from filing order into risk order. ${withFindings} have findings, ${ENTITY} and T-07 first, and the clean ones hold on every claim. Ring on the headline`,
      line: `The same checks run across all ${p.entries.length} entities, so examiners know where to start, and which ones hold on every claim.`,
      async play(d) {
        await d.at(78.3);
        await d.click("nav-portfolio", { ms: 700 });
        await d.page.mouse.move(...PARK, { steps: 40 });
        await d.at(83.4);
        await d.ring("headline", 4600, "ink");
      },
    },
    {
      id: "samples",
      start: 89.5,
      end: 101,
      screen: `Sample sheet, ${samples} records for manual review with the tool's reasons hidden. Open record 01, confirm the issue, and the tool's reasons are revealed`,
      line: `Examiners already read samples by hand. ${BRAND.product} picks the ${samples} most worth reading, and shows why only after the examiner decides.`,
      async play(d) {
        await d.at(89.3);
        await d.click("nav-samples", { ms: 700 });
        await d.at(93.9);
        await d.click("start-blind-review", { ms: 800 });
        await d.at(96.4);
        await d.click("verdict-issue_confirmed", { ms: 700 });
        await d.page.mouse.move(...PARK, { steps: 30 });
        await d.at(97.7);
        await d.ring("tool-view", 3000, "ink");
      },
    },
    {
      id: "method",
      start: 101,
      end: 112,
      screen: "How we built it: one card per source the team read, each with its clause, and the synthetic data counts",
      line: "We built it from the statement and the rules these sectors follow, read them ourselves, and spoke with a SOC analyst.",
      async play(d) {
        await d.at(100.8);
        await d.click("footer-method", { ms: 800 });
        await d.page.mouse.move(...PARK, { steps: 40 });
        await d.at(106.4);
        await d.ring("method-people", 4600, "ink");
      },
    },
    {
      id: "end-card",
      start: 112,
      end: DURATION,
      screen: `End card, ${[BRAND.product, orgLine()].join(", ")}, Team 1, working prototype on synthetic data`,
      line: "A working prototype on synthetic data, by Team 1, Saveetha Engineering College.",
      async play(d) {
        await d.at(111.7);
        await d.page.goto(new URL("/title", d.page.url()).href, { waitUntil: "load" });
        await d.hideCursor();
      },
    },
  ];
}
