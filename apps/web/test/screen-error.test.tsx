// @vitest-environment happy-dom
import assert from "node:assert/strict";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, test, vi } from "vitest";
import ScreenError from "@/app/error";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  refresh.mockReset();
});

test("a failed screen says how to run the analysis and which digest to look for", () => {
  render(<ScreenError error={Object.assign(new Error("hidden in production"), { digest: "2352814717" })} reset={() => {}} />);
  const page = screen.getByTestId("screen-error").textContent ?? "";
  assert.match(page, /run pnpm simulate and pnpm analyse, then reload/);
  assert.equal(screen.getByTestId("screen-error-digest").textContent, "Look for digest 2352814717 in the server log.");
  assert.doesNotMatch(page, /hidden in production/);
});

test("without a digest the line is left out, and try again fetches the screen again and re-renders it", async () => {
  const reset = vi.fn();
  render(<ScreenError error={new Error("x")} reset={reset} />);
  assert.equal(screen.queryByTestId("screen-error-digest"), null);
  await userEvent.setup().click(screen.getByTestId("screen-error-retry"));
  assert.equal(refresh.mock.calls.length, 1);
  assert.equal(reset.mock.calls.length, 1);
});
