import assert from "node:assert/strict";
import { test } from "vitest";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { Sparkline } from "@/components/sparkline";
import { html, tag, text } from "./demo";

test("the masthead links every screen for the entity and marks the current one", () => {
  const out = html(<Masthead screen="samples" entity="P-04" cycleLabel="Q1 FY27" />);
  for (const [id, href] of [
    ["portfolio", "/"],
    ["ledger", "/entities/P-04"],
    ["negative-space", "/entities/P-04/negative-space"],
    ["samples", "/entities/P-04/samples"],
    ["calibration", "/calibration"],
    ["report", "/entities/P-04/report"],
  ]) {
    assert.match(tag(out, `nav-${id}`), new RegExp(`href="${href}"`), id);
  }
  assert.equal(out.match(/aria-current="page"/g)?.length, 1);
  assert.match(tag(out, "nav-samples"), /aria-current="page"/);
  assert.match(text(<Masthead screen="method" entity="S-03" cycleLabel="Q1 FY27" />), /Q1 FY27 assessment · S-03/);
});

test("the footer says what the product is and links the method", () => {
  const out = html(<SiteFooter />);
  assert.match(tag(out, "footer-method"), /href="\/method"/);
  assert.match(text(<SiteFooter />), /synthetic data · Method and sources SOC Claim Ledger/);
});

test("a sparkline draws one point per value on a fixed 0 to 100 scale, the last one larger", () => {
  const out = html(<Sparkline values={[0, 50, 100]} width={106} height={26} />);
  assert.match(out, /d="M3\.0,23\.0 L53\.0,13\.0 L103\.0,3\.0"/);
  assert.equal(out.match(/<circle/g)?.length, 3);
  assert.match(out, /r="3"[^>]*fill="var\(--ink\)"/);
  assert.match(html(<Sparkline values={[10]} tone="gap" />), /stroke="var\(--gap\)"/);
  assert.equal(html(<Sparkline values={[]} />), "");
});
