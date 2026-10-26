import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { type Browser, chromium } from "playwright-core";
import { entityCodes, loadEntity, localDir, recordAudit } from "@/lib/data";
import { examinerId } from "@/lib/env";
import { log } from "@/lib/log";

// Renders the report page to an A4 PDF with the Chromium already on this machine and
// files it under data/local/reports. The browser loads only this server's own pages.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CHROMIUM = "Chromium is not installed on this machine. Run pnpm exec playwright install chromium, then export again.";

function fileFor(code: string, cycle: string): string {
  return `SR-${code.replace("-", "")}-${cycle.replace("-", "")}.pdf`;
}

function istNow(): string {
  const d = new Date(Date.now() + 330 * 60_000);
  return `${d.toISOString().slice(0, 19)}+05:30`;
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!entityCodes().includes(code)) return NextResponse.json({ error: `no entity ${code}` }, { status: 404 });
  const a = loadEntity(code);
  const origin = new URL(req.url).origin;
  const started = performance.now();
  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    log.error({ entity: code, err: e }, "report export failed, no Chromium");
    return NextResponse.json({ error: NO_CHROMIUM }, { status: 503 });
  }
  try {
    const context = await browser.newContext();
    // The render may only reach this server.
    await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));
    const page = await context.newPage();
    await page.goto(`${origin}/entities/${code}/report?print=1`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const file = fileFor(code, a.cycle);
    const dir = path.join(localDir(), "reports");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, file), pdf);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
    const sha256 = createHash("sha256").update(pdf).digest("hex");
    recordAudit({
      at: istNow(),
      actor: examinerId(),
      action: "report_exported",
      subject: `${code} ${file}`,
      detail: `${pages} pages, SHA-256 ${sha256.slice(0, 16)}`,
    });
    const seconds = (performance.now() - started) / 1000;
    log.info({ entity: code, file, pages, bytes: pdf.length, seconds }, "report exported");
    return NextResponse.json({ file, pages, bytes: pdf.length, sha256, seconds, href: `/api/report/${code}` });
  } catch (e) {
    log.error({ entity: code, err: e }, "report export failed");
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    await browser.close();
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!entityCodes().includes(code)) return NextResponse.json({ error: `no entity ${code}` }, { status: 404 });
  const file = fileFor(code, loadEntity(code).cycle);
  const full = path.join(localDir(), "reports", file);
  if (!existsSync(full)) return NextResponse.json({ error: "not exported yet" }, { status: 404 });
  return new NextResponse(readFileSync(full), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${file}"` } });
}
