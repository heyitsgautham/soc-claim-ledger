import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Page } from "playwright";

// pnpm take
// Screenshots of every screen and of the hero interaction, against a running build.
// It fails if the page asks for anything outside its own origin.
//
//   pnpm take                      1920x1080 into recording/shots
//   pnpm take --size 1440x900      the laptop check

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3157" },
    size: { type: "string", default: "1920x1080" },
  },
});

const [width, height] = (values.size ?? "1920x1080").split("x").map(Number) as [number, number];
const base = new URL(values.url ?? "http://localhost:3157");
const root = path.dirname(new URL(import.meta.url).pathname);
const shots = path.join(root, "shots");
mkdirSync(shots, { recursive: true });
const suffix = `${width}x${height}`;
const offOrigin: string[] = [];
const errors: string[] = [];

async function shot(page: Page, name: string, settleMs = 1800) {
  await page.mouse.move(4, 4);
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: path.join(shots, `${name}-${suffix}.png`) });
}

async function main() {
  rmSync(path.join(root, "../data/local"), { recursive: true, force: true });
  for (const f of readdirSync(shots)) if (f.endsWith(`-${suffix}.png`)) rmSync(path.join(shots, f));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== base.origin && u.protocol !== "data:" && u.protocol !== "blob:") {
      offOrigin.push(u.href);
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const go = async (p: string) => {
    await page.goto(new URL(p, base).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
  };

  await go("/entities/P-04/submission");
  await shot(page, "00-submission", 18500);
  await go("/entities/P-04/check");
  await shot(page, "01-signed-report", 1200);
  await page.getByTestId("run-check").click();
  await page.getByTestId("check-summary").waitFor();
  await shot(page, "02-report-checked", 700);
  await page.getByTestId("entity-header").waitFor({ timeout: 15_000 });
  await shot(page, "03-ledger", 2400);
  await page.getByTestId("ledger-row-1.1").click();
  await page.getByTestId("evidence-drawer").waitFor();
  await shot(page, "04-evidence-drawer", 6800);
  await page.getByTestId("records-tab-templated-notes").click();
  await shot(page, "05-pasted-notes", 3400);
  await page.getByTestId("records-tab-no-escalation").click();
  await page.getByTestId("case-P04-27Q1-C0043").locator("button").click();
  await shot(page, "06-escalation-chain", 600);
  await go("/entities/P-04/negative-space");
  await shot(page, "07-negative-space", 3600);
  await page.getByTestId("view-grid").click();
  await shot(page, "07-negative-space-grid", 3600);
  await go("/");
  await shot(page, "08-portfolio", 3200);
  await go("/method");
  await shot(page, "09-method", 4200);
  await go("/entities/P-04/samples");
  await shot(page, "10-sample-sheet", 800);
  await page.getByTestId("start-blind-review").click();
  await shot(page, "11-blind-review", 600);
  await page.getByTestId("verdict-issue_confirmed").click();
  await page.getByTestId("tool-view").waitFor();
  await shot(page, "12-tool-view-revealed", 800);
  await go("/calibration");
  await shot(page, "13-calibration");
  await go("/entities/P-04/report");
  await page.getByTestId("export-pdf").click();
  await page.getByTestId("export-result").waitFor({ timeout: 60_000 });
  await shot(page, "14-report-exported", 800);
  await go("/title");
  await shot(page, "15-title-card", 800);

  await browser.close();
  if (offOrigin.length || errors.length) {
    console.error([...offOrigin.map((u) => `left the origin: ${u}`), ...errors].join("\n"));
    process.exit(1);
  }
  console.log(`take ok at ${suffix}, no request left ${base.origin}, shots in ${path.relative(process.cwd(), shots)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
