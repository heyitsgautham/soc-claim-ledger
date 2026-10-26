// @vitest-environment happy-dom
import assert from "node:assert/strict";
import type { Verdict } from "@ledger/claims/model";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, test, vi } from "vitest";
import { SampleSheet } from "@/components/samples/sample-sheet";
import { entity } from "./demo";

const a = entity("P-04");
const sheet = a.samples;
const first = sheet.items[0]!;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function verdictFor(itemKey: string): Verdict {
  const item = sheet.items.find((i) => i.key === itemKey)!;
  return {
    id: `V-${a.cycle}-P-04-01-live`,
    cycle: a.cycle,
    entity: "P-04",
    itemKey,
    kind: item.kind,
    recordId: item.recordId,
    pick: item.pick,
    detectors: item.reasons.map((r) => r.detector),
    verdict: "issue_confirmed",
    examiner: "EX-02",
    recordedAt: "2026-10-26T18:00:00+05:30",
    blind: true,
  };
}

test("blind review hides the tool's reasons until the examiner records a verdict, then reveals them", async () => {
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ verdict: verdictFor(body.itemKey) }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<SampleSheet sheet={sheet} initial={[]} entity="P-04" />);

  assert.equal(screen.queryAllByLabelText("Hidden until a verdict is recorded").length, 0);
  await user.click(screen.getByTestId("start-blind-review"));
  assert.equal(screen.getAllByLabelText("Hidden until a verdict is recorded").length, sheet.items.length);
  assert.equal(screen.queryByTestId("tool-view"), null);

  await user.click(screen.getByTestId("verdict-issue_confirmed"));
  await waitFor(() => screen.getByTestId("tool-view"));
  assert.deepEqual(JSON.parse(String(fetch.mock.calls[0]![1].body)), { entity: "P-04", itemKey: first.key, verdict: "issue_confirmed" });
  assert.equal(screen.getAllByLabelText("Hidden until a verdict is recorded").length, sheet.items.length - 1);
  assert.match(screen.getByTestId("tool-view").textContent ?? "", /EX-02 · 2026-10-26 18:00 IST · blind/);
});

test("next record moves to the first record still unreviewed", async () => {
  vi.stubGlobal(
    "fetch",
    async (_url: string, init: RequestInit) => new Response(JSON.stringify({ verdict: verdictFor(JSON.parse(String(init.body)).itemKey) })),
  );
  const user = userEvent.setup();
  render(<SampleSheet sheet={sheet} initial={[]} entity="P-04" />);
  await user.click(screen.getByTestId("start-blind-review"));
  await user.click(screen.getByTestId("verdict-no_issue"));
  await user.click(await screen.findByTestId("next-record"));
  assert.match(screen.getByTestId("blind-record").textContent ?? "", new RegExp(`record ${String(sheet.items[1]!.n).padStart(2, "0")}`));
});

test("a server error that is not JSON shows the status, not a parse error, and the record stays hidden", async () => {
  vi.stubGlobal("fetch", async () => new Response("", { status: 500, statusText: "Internal Server Error" }));
  const user = userEvent.setup();
  render(<SampleSheet sheet={sheet} initial={[]} entity="P-04" />);
  await user.click(screen.getByTestId("start-blind-review"));
  await user.click(screen.getByTestId("verdict-cannot_tell"));
  await screen.findByText("The verdict was not saved, the server answered 500 Internal Server Error");
  assert.equal(screen.queryByTestId("tool-view"), null);
  assert.doesNotMatch(document.body.textContent ?? "", /JSON/);
});

test("the server's own reason is shown when it gives one", async () => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "The verdict was not saved. EACCES" }), { status: 500 }));
  const user = userEvent.setup();
  render(<SampleSheet sheet={sheet} initial={[]} entity="P-04" />);
  await user.click(screen.getByTestId("start-blind-review"));
  await user.click(screen.getByTestId("verdict-no_issue"));
  await screen.findByText("The verdict was not saved. EACCES");
});

test("verdicts already recorded show on the sheet and count as reviewed", () => {
  render(<SampleSheet sheet={sheet} initial={[verdictFor(first.key)]} entity="P-04" />);
  assert.match(screen.getByTestId("review-panel").textContent ?? "", new RegExp(`Reviewed this cycle1 of ${sheet.items.length}`));
  assert.match(screen.getByTestId(`sample-${first.n}`).textContent ?? "", /Issue confirmed/);
});
