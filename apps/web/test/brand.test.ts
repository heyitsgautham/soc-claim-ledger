import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";

const NAMES = ["NEXT_PUBLIC_PRODUCT", "NEXT_PUBLIC_PS", "NEXT_PUBLIC_EVENT", "NEXT_PUBLIC_EVENT_NAME", "NEXT_PUBLIC_TAGLINE"];

// brand.ts reads the environment once, when it loads, so each case loads a fresh copy.
async function load(env: Record<string, string>) {
  for (const k of NAMES) vi.stubEnv(k, undefined);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  vi.resetModules();
  return await import("../src/lib/brand");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

test("without local names the app shows the neutral product name and no event", async () => {
  const { BRAND, orgLine, pageTitle } = await load({});
  assert.equal(BRAND.product, "SOC Claim Ledger");
  assert.equal(BRAND.event, "");
  assert.equal(orgLine(), "NTRO and NCIIPC");
  assert.equal(pageTitle("Portfolio"), "Portfolio · SOC Claim Ledger");
  assert.equal(pageTitle(), "SOC Claim Ledger");
});

test("local names replace the neutral ones and lead the organisation line", async () => {
  const { BRAND, orgLine, pageTitle } = await load({ NEXT_PUBLIC_PRODUCT: "Ledger X", NEXT_PUBLIC_PS: "PS-1" });
  assert.equal(BRAND.product, "Ledger X");
  assert.equal(orgLine(), "PS-1 · NTRO and NCIIPC");
  assert.equal(orgLine("NCIIPC"), "PS-1 · NCIIPC");
  assert.equal(pageTitle("Method"), "Method · Ledger X");
});

test("an empty local name counts as unset", async () => {
  const { BRAND } = await load({ NEXT_PUBLIC_PRODUCT: "" });
  assert.equal(BRAND.product, "SOC Claim Ledger");
});
