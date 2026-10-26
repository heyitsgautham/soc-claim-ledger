import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test, vi } from "vitest";

// The export drives a real Chromium. These tests stand in for it, so they run anywhere.
const launch = vi.hoisted(() => vi.fn());
vi.mock("playwright-core", () => ({ chromium: { launch } }));

const { GET, POST } = await import("@/app/api/report/[code]/route");
const { loadEntity, localAudit } = await import("@/lib/data");
const { log } = await import("@/lib/log");

const demo = path.resolve(import.meta.dirname, "../../../data/demo");
let local: string;

beforeEach(() => {
  local = mkdtempSync(path.join(tmpdir(), "ledger-report-"));
  vi.stubEnv("LEDGER_DATA_DIR", demo);
  vi.stubEnv("LEDGER_LOCAL_DIR", local);
  launch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(local, { recursive: true, force: true });
});

const params = (code: string) => ({ params: Promise.resolve({ code }) });
const post = (code: string) => POST(new Request(`http://localhost:3157/api/report/${code}`, { method: "POST" }), params(code));

// A browser whose page hands back a two-page PDF and records where it was sent.
function fakeBrowser(pdf = Buffer.from("%PDF-1.7 /Type /Page /Type /Pages /Type /Page %%EOF", "latin1")) {
  const visited: string[] = [];
  const close = vi.fn(async () => undefined);
  const page = {
    goto: vi.fn(async (url: string) => visited.push(url)),
    evaluate: vi.fn(async () => undefined),
    pdf: vi.fn(async () => pdf),
  };
  const context = { route: vi.fn(async () => undefined), newPage: vi.fn(async () => page) };
  launch.mockResolvedValue({ newContext: vi.fn(async () => context), close });
  return { visited, close, page };
}

test("with no Chromium on the machine the export answers 503 in JSON and says how to install it", async () => {
  const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
  launch.mockRejectedValue(new Error("browserType.launch: Executable doesn't exist at /ms-playwright/chrome"));
  const res = await post("P-04");
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "Chromium is not installed on this machine. Run pnpm exec playwright install chromium, then export again.");
  assert.equal(error.mock.calls.length, 1);
  assert.deepEqual(localAudit(), []);
});

test("an export renders this server's report page, files the PDF and audits it", async () => {
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  const { visited, close } = fakeBrowser();
  const res = await post("P-04");
  assert.equal(res.status, 200);
  const body = await res.json();
  const cycle = loadEntity("P-04").cycle.replace("-", "");
  assert.equal(body.file, `SR-P04-${cycle}.pdf`);
  assert.equal(body.pages, 2);
  assert.match(body.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(visited, ["http://localhost:3157/entities/P-04/report?print=1"]);
  assert.equal(close.mock.calls.length, 1);
  const [audit] = localAudit();
  assert.equal(audit?.action, "report_exported");
  assert.equal(audit?.detail, `2 pages, SHA-256 ${body.sha256.slice(0, 16)}`);
  const saved = await GET(new Request("http://localhost:3157/api/report/P-04"), params("P-04"));
  assert.equal(saved.headers.get("content-type"), "application/pdf");
  assert.match(saved.headers.get("content-disposition") ?? "", new RegExp(`filename="SR-P04-${cycle}.pdf"`));
});

test("a render that fails closes the browser and answers 500 with the cause", async () => {
  vi.spyOn(log, "error").mockImplementation(() => undefined);
  const { close, page } = fakeBrowser();
  page.pdf.mockRejectedValue(new Error("page crashed"));
  const res = await post("P-04");
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "page crashed");
  assert.equal(close.mock.calls.length, 1);
});

test("an unknown entity is a 404 before any browser starts", async () => {
  const res = await post("Z-99");
  assert.equal(res.status, 404);
  assert.equal(launch.mock.calls.length, 0);
  assert.equal((await GET(new Request("http://localhost/api/report/Z-99"), params("Z-99"))).status, 404);
});

test("a report not exported yet is a 404 on download", async () => {
  const res = await GET(new Request("http://localhost/api/report/P-04"), params("P-04"));
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "not exported yet");
  mkdirSync(path.join(local, "reports"), { recursive: true });
  writeFileSync(path.join(local, "reports", "other.pdf"), "x");
  assert.equal((await GET(new Request("http://localhost/api/report/P-04"), params("P-04"))).status, 404);
});
