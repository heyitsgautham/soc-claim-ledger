import assert from "node:assert/strict";
import { test } from "vitest";
import { ReportDocument } from "@/components/report/report-document";
import { entity, html, tag, text } from "./demo";

const machine = { platform: "linux x64", cpus: 8, memoryGb: 16, node: "22.0.0" };

test("the report runs to three numbered A4 pages under its document ID", () => {
  const a = entity("P-04");
  const out = html(<ReportDocument a={a} machine={machine} generatedOn="2026-10-26" />);
  assert.equal(out.match(/class="report-page /g)?.length, 3);
  const t = text(<ReportDocument a={a} machine={machine} generatedOn="2026-10-26" />);
  const id = `SR-P04-${a.cycle.replace("-", "")}`;
  for (const n of [1, 2, 3]) assert.ok(t.includes(`${id} Target product · working prototype · synthetic data ${n} / 3`), `page ${n}`);
});

test("each finding is listed with its detector, and the machine that ran the analysis is named", () => {
  const a = entity("P-04");
  const out = html(<ReportDocument a={a} machine={machine} generatedOn="2026-10-26" />);
  for (const f of a.findings) tag(out, `report-finding-${f.id}`);
  assert.ok(text(<ReportDocument a={a} machine={machine} generatedOn="2026-10-26" />).includes("linux x64"));
});

test("the clean control's report lists no findings", () => {
  const a = entity("S-03");
  assert.equal(a.findings.length, 0);
  assert.doesNotMatch(html(<ReportDocument a={a} machine={machine} generatedOn="2026-10-26" />), /report-finding-/);
});
