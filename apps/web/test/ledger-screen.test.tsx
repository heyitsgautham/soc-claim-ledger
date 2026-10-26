// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, test, vi } from "vitest";
import { LedgerScreen } from "@/components/ledger/ledger-screen";
import { entity } from "./demo";

const a = entity("P-04");
const gap = a.assessment.evaluations.find((e) => e.status === "gap")!;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
  window.history.replaceState(null, "", "/entities/P-04");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("the signed report is checked line by line and turns into the ledger", async () => {
  const user = userEvent.setup();
  render(<LedgerScreen assessment={a.assessment} overview={a.overview} startWith="attested" />);
  assert.ok(screen.getByTestId("attested-report"));
  for (const e of a.assessment.evaluations) assert.ok(screen.getByTestId(`attested-line-${e.claim.ref}`));
  await user.click(screen.getByTestId("run-check"));
  await screen.findByTestId("check-summary");
  await screen.findByTestId("ledger", undefined, { timeout: 3000 });
  assert.equal(window.location.pathname, "/entities/P-04");
});

test("the submission overview opens the signed report and moves the address to /check", async () => {
  const user = userEvent.setup();
  render(<LedgerScreen assessment={a.assessment} overview={a.overview} startWith="overview" />);
  await user.click(screen.getByTestId("open-report"));
  assert.ok(screen.getByTestId("attested-report"));
  assert.equal(window.location.pathname, "/entities/P-04/check");
});

test("opening a claim shows its evidence and mirrors it in ?claim=, closing clears it", async () => {
  const user = userEvent.setup();
  render(<LedgerScreen assessment={a.assessment} />);
  await user.click(screen.getByTestId(`ledger-row-${gap.claim.ref}`));
  const drawer = await screen.findByTestId("evidence-drawer");
  assert.equal(new URLSearchParams(window.location.search).get("claim"), gap.claim.ref);
  assert.ok((drawer.textContent ?? "").includes(gap.claim.text));
  await user.click(screen.getByTestId("drawer-close"));
  await waitFor(() => assert.equal(new URLSearchParams(window.location.search).get("claim"), null));
});

test("a deep link with ?claim= opens that claim, and an unknown one is ignored", async () => {
  window.history.replaceState(null, "", `/entities/P-04?claim=${gap.claim.ref}`);
  render(<LedgerScreen assessment={a.assessment} />);
  assert.ok(await screen.findByTestId("evidence-drawer"));
  cleanup();
  window.history.replaceState(null, "", "/entities/P-04?claim=9.9");
  render(<LedgerScreen assessment={a.assessment} />);
  assert.equal(screen.queryByTestId("evidence-drawer"), null);
});
