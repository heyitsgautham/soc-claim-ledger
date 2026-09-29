import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright";

// The offline guarantee, tested. Every screen is opened and driven in a browser that
// records any request leaving this server's origin and refuses it. One such request fails
// the test. Run against a production build: pnpm build && pnpm start, then pnpm test:e2e.

const base = new URL(process.env.LEDGER_URL ?? "http://localhost:3157");
const escaped: string[] = [];
const errors: string[] = [];
let browser: Browser;
let context: BrowserContext;
let page: Page;

before(async () => {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== base.origin && u.protocol !== "data:" && u.protocol !== "blob:") {
      escaped.push(u.href);
      return route.abort();
    }
    return route.continue();
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
});

after(async () => {
  await browser?.close();
});

const url = (p: string) => new URL(p, base).href;

test("every screen renders from this machine alone", async () => {
  for (const p of ["/", "/entities/P-04/check", "/entities/P-04", "/entities/S-03", "/entities/G-04", "/entities/P-04/negative-space", "/entities/P-04/samples", "/calibration", "/entities/P-04/report", "/method", "/title"]) {
    const res = await page.goto(url(p), { waitUntil: "networkidle" });
    assert.equal(res?.status(), 200, p);
    assert.ok(await page.getByTestId("site-footer").isVisible(), `${p} shows the prototype footer`);
  }
  assert.deepEqual(escaped, []);
  assert.deepEqual(errors, []);
});

test("the signed report is checked line by line and becomes the ledger", async () => {
  await page.goto(url("/entities/P-04/check"), { waitUntil: "networkidle" });
  assert.equal(await page.locator('[data-testid^="attested-line-"]').count(), 16);
  await page.getByTestId("run-check").click();
  await page.getByTestId("check-summary").waitFor();
  await page.getByTestId("entity-header").waitFor({ timeout: 15_000 });
  assert.match(await page.getByTestId("headline").innerText(), /3 of 16 attested figures do not hold/);
  assert.equal(new URL(page.url()).pathname, "/entities/P-04");
  assert.deepEqual(escaped, []);
});

test("the hero: a gap opens the histogram, then the cases and the templated notes on request", async () => {
  await page.goto(url("/entities/P-04"), { waitUntil: "networkidle" });
  await page.getByTestId("ledger-row-1.1").click();
  const drawer = page.getByTestId("evidence-drawer");
  await drawer.waitFor();
  assert.match(await drawer.innerText(), /47 critical alerts have no escalation record/);
  assert.ok(await page.getByTestId("closure-histogram").isVisible());
  assert.equal(await page.getByTestId("case-rows").count(), 0, "the case table stays folded until asked for");
  await page.getByTestId("records-tab-no-escalation").click();
  assert.equal(await page.getByTestId("case-rows").locator(":scope > li").count(), 47);
  await page.getByTestId("records-tab-templated-notes").click();
  await page.getByTestId("notes-stack").waitFor();
  await page.getByTestId("notes-view-toggle").click();
  assert.equal(await page.getByTestId("notes-table").locator("ol > li").count(), 12);
  assert.deepEqual(escaped, []);
});

test("blind review records a verdict before revealing the tool's view", async () => {
  await page.goto(url("/entities/P-04/samples"), { waitUntil: "networkidle" });
  await page.getByTestId("start-blind-review").click();
  assert.equal(await page.getByTestId("tool-view").count(), 0);
  await page.getByTestId("verdict-no_issue").click();
  await page.getByTestId("tool-view").waitFor();
  assert.deepEqual(escaped, []);
});

test("the report exports as a PDF rendered on this machine", async () => {
  await page.goto(url("/entities/P-04/report"), { waitUntil: "networkidle" });
  await page.getByTestId("export-pdf").click();
  await page.getByTestId("export-result").waitFor({ timeout: 60_000 });
  assert.match(await page.getByTestId("export-result").innerText(), /A4 pages/);
  assert.match(await page.getByTestId("offline-badge").innerText(), /\n0\s+requests to any other host/);
  assert.deepEqual(escaped, []);
  assert.deepEqual(errors, []);
});
