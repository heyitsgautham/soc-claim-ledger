import assert from "node:assert/strict";
import { test } from "vitest";
import { PortfolioTable } from "@/components/portfolio/portfolio-table";
import { html, portfolio, text } from "./demo";

const p = portfolio();

test("one row per entity, in rank order, each linking to its ledger", () => {
  const out = html(<PortfolioTable portfolio={p} />);
  const codes = [...out.matchAll(/data-testid="portfolio-row-([A-Z]-\d{2})"/g)].map((m) => m[1]);
  assert.deepEqual(
    codes,
    p.entries.map((e) => e.code),
  );
  for (const e of p.entries) assert.match(out, new RegExp(`href="/entities/${e.code}"`));
});

test("a high-risk row is drawn in the gap colour with its leading finding and how many more", () => {
  const top = p.entries[0]!;
  assert.ok(top.risk >= 50);
  const row = html(<PortfolioTable portfolio={{ ...p, entries: [top] }} />);
  assert.match(row, new RegExp(`text-gap">${top.risk}<`));
  assert.ok(row.includes(top.reasons[0]!.title.replace(/'/g, "&#x27;")));
  if (top.findings > 1) assert.match(text(<PortfolioTable portfolio={{ ...p, entries: [top] }} />), new RegExp(`· ${top.findings - 1} more`));
});

test("an entity that left an export out says which one and how many claims went untested", () => {
  const g04 = p.entries.find((e) => e.code === "G-04")!;
  const out = text(<PortfolioTable portfolio={{ ...p, entries: [{ ...g04, reasons: [], findings: 0 }] }} />);
  assert.match(out, /No finding\. The escalations export is missing, so \d+ claims? (was|were) not tested\./);
  assert.match(out, /\d+ insufficient evidence/);
});

test("a clean entity reads as clean, and an unchanged risk reads as steady", () => {
  const s03 = p.entries.find((e) => e.code === "S-03")!;
  const out = text(<PortfolioTable portfolio={{ ...p, entries: [{ ...s03, previousRisk: s03.risk }] }} />);
  assert.match(out, /Clean\. Every tested claim holds and no detector fired\./);
  assert.match(out, /steady/);
});

test("a rise in risk shows its size with a sign, a fall with a minus", () => {
  const e = { ...p.entries[0]!, risk: 60, previousRisk: 45 };
  assert.match(text(<PortfolioTable portfolio={{ ...p, entries: [e] }} />), /\+15/);
  assert.match(text(<PortfolioTable portfolio={{ ...p, entries: [{ ...e, previousRisk: 70 }] }} />), /−10/);
});
