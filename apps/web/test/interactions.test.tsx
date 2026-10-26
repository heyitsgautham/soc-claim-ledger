// @vitest-environment happy-dom
import assert from "node:assert/strict";
import type { EvidenceSection } from "@ledger/claims/model";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, test, vi } from "vitest";
import { NotesStack } from "@/components/evidence/notes-stack";
import { SilentAssets } from "@/components/negative-space/silent-assets";
import { NegativeSpaceViews } from "@/components/negative-space/views";
import { ExportPanel } from "@/components/report/export-panel";
import { entity } from "./demo";

const a = entity("P-04");
const machine = { platform: "linux x64", cpus: 8, memoryGb: 16, node: "22.0.0" };

beforeEach(() => {
  // happy-dom has no media queries, and the components ask for reduced motion.
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("export renders the PDF on this machine and offers it to save", async () => {
  const fetch = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ file: "SR-P04-FY27Q1.pdf", pages: 3, bytes: 204800, sha256: "ab".repeat(32), seconds: 2.34, href: "/api/report/P-04" }), {
        status: 200,
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<ExportPanel code="P-04" docId="SR-P04-FY27Q1" machine={machine} />);
  await user.click(screen.getByTestId("export-pdf"));
  const result = await screen.findByTestId("export-result");
  assert.equal(fetch.mock.calls[0]![0], "/api/report/P-04");
  assert.match(result.textContent ?? "", /SR-P04-FY27Q1\.pdf/);
  assert.match(result.textContent ?? "", /3 A4 pages · 200 KB · rendered in 2\.3 s/);
  assert.equal(
    screen
      .getByText(/Save the PDF/)
      .closest("a")
      ?.getAttribute("href"),
    "/api/report/P-04",
  );
  assert.match(screen.getByText(/CPU cores/).textContent ?? "", /linux x64 · 8 CPU cores · 16 GB · Node 22\.0\.0/);
});

test("an export the server refuses shows its reason, and an empty failure its status", async () => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "Chromium is not installed on this machine." }), { status: 503 }));
  const user = userEvent.setup();
  render(<ExportPanel code="P-04" docId="SR-P04-FY27Q1" machine={machine} />);
  await user.click(screen.getByTestId("export-pdf"));
  await screen.findByText("Chromium is not installed on this machine.");
  cleanup();
  vi.stubGlobal("fetch", async () => new Response("", { status: 502, statusText: "Bad Gateway" }));
  render(<ExportPanel code="P-04" docId="SR-P04-FY27Q1" machine={machine} />);
  await user.click(screen.getByTestId("export-pdf"));
  await screen.findByText("Export failed, the server answered 502 Bad Gateway");
});

test("negative space opens on the estate and switches to the tactic grid", async () => {
  const user = userEvent.setup();
  render(<NegativeSpaceViews estate={<p>estate view</p>} grid={<p>grid view</p>} />);
  assert.equal(screen.getByTestId("negative-space-views").dataset.view, "estate");
  assert.equal(screen.getByTestId("view-estate").getAttribute("aria-selected"), "true");
  assert.ok(screen.getByText("estate view"));
  await user.click(screen.getByTestId("view-grid"));
  assert.ok(screen.getByText("grid view"));
  assert.equal(screen.queryByText("estate view"), null);
  assert.equal(screen.getByTestId("view-grid").getAttribute("aria-selected"), "true");
});

test("silent assets show as squares and list their names on request", async () => {
  const silent = a.signals.negativeSpace.silentAssets;
  const user = userEvent.setup();
  render(<SilentAssets assets={silent} quarters="two quarters" />);
  assert.equal(screen.getByLabelText(`${silent.length} silent assets`).children.length, silent.length);
  await user.click(screen.getByTestId("silent-assets-toggle"));
  assert.ok(screen.getByText(silent[0]!.hostname));
  assert.equal(screen.getByTestId("silent-assets-toggle").textContent, "Hide the names");
});

test("a templated cluster lays its notes on one another, names what changes, and lists them on request", async () => {
  const notes = a.assessment.evaluations.flatMap((e) => e.evidence).find((s) => s.type === "notes") as Extract<EvidenceSection, { type: "notes" }>;
  const user = userEvent.setup();
  render(<NotesStack section={notes} />);
  assert.match(screen.getByTestId("notes-stack").textContent ?? "", new RegExp(`${notes.cluster.size} closure notes on these cases`));
  assert.ok(await screen.findByTestId("notes-verdict"));
  assert.match(screen.getByTestId("notes-verdict").textContent ?? "", /Only (the hostname changes|\d+ words? changes?)\./);
  await user.click(screen.getByTestId("notes-view-toggle"));
  assert.ok(screen.getByTestId("notes-table"));
});
