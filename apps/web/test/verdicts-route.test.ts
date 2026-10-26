import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test, vi } from "vitest";
import { GET, POST } from "@/app/api/verdicts/route";
import { loadEntity, localAudit, localVerdicts } from "@/lib/data";
import { log } from "@/lib/log";

const demo = path.resolve(import.meta.dirname, "../../../data/demo");
let local: string;

beforeEach(() => {
  local = mkdtempSync(path.join(tmpdir(), "ledger-verdicts-"));
  vi.stubEnv("LEDGER_DATA_DIR", demo);
  vi.stubEnv("LEDGER_LOCAL_DIR", local);
  vi.stubEnv("LEDGER_EXAMINER", "EX-05");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(local, { recursive: true, force: true });
});

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/verdicts", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

test("a blind verdict is stamped by the server, appended with an audit line and logged", async () => {
  const info = vi.spyOn(log, "info").mockImplementation(() => undefined);
  const item = loadEntity("P-04").samples.items[0]!;
  const res = await post({ entity: "P-04", itemKey: item.key, verdict: "issue_confirmed", examiner: "EX-99" });
  assert.equal(res.status, 200);
  const { verdict } = await res.json();
  assert.equal(verdict.examiner, "EX-05");
  assert.equal(verdict.blind, true);
  assert.equal(verdict.recordId, item.recordId);
  assert.match(verdict.recordedAt, /\+05:30$/);
  assert.deepEqual(
    localVerdicts().map((v) => v.id),
    [verdict.id],
  );
  const [audit] = localAudit();
  assert.equal(audit?.action, "verdict_recorded");
  assert.equal(audit?.actor, "EX-05");
  assert.equal(audit?.subject, `P-04 ${item.recordId}`);
  assert.deepEqual(info.mock.calls[0], [
    { entity: "P-04", recordId: item.recordId, verdict: "issue_confirmed", examiner: "EX-05", detectors: verdict.detectors.length },
    "verdict recorded",
  ]);
});

test("a body that is not a verdict is a 400 and writes nothing", async () => {
  const warn = vi.spyOn(log, "warn").mockImplementation(() => undefined);
  for (const body of ["not json", { entity: "P-04", itemKey: "k", verdict: "maybe" }, { entity: "../x", itemKey: "k", verdict: "no_issue" }]) {
    const res = await post(body);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /entity, itemKey and a verdict/);
  }
  assert.deepEqual(localVerdicts(), []);
  assert.equal(warn.mock.calls.length, 3);
  assert.equal((warn.mock.calls[0]![0] as { status: number }).status, 400);
});

test("an unknown entity and a record off the sample sheet are 404s", async () => {
  vi.spyOn(log, "warn").mockImplementation(() => undefined);
  const unknown = await post({ entity: "Z-99", itemKey: "k", verdict: "no_issue" });
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error, "no entity Z-99");
  const off = await post({ entity: "P-04", itemKey: "case:nope", verdict: "no_issue" });
  assert.equal(off.status, 404);
  assert.equal((await off.json()).error, "case:nope is not on the P-04 sample sheet");
  assert.deepEqual(localAudit(), []);
});

test("GET lists the verdicts recorded here, filtered by entity when asked", async () => {
  vi.spyOn(log, "info").mockImplementation(() => undefined);
  const p04 = loadEntity("P-04").samples.items[0]!;
  const s03 = loadEntity("S-03").samples.items[0]!;
  await post({ entity: "P-04", itemKey: p04.key, verdict: "no_issue" });
  await post({ entity: "S-03", itemKey: s03.key, verdict: "cannot_tell" });
  const all = await (await GET(new Request("http://localhost/api/verdicts"))).json();
  assert.equal(all.length, 2);
  const only = await (await GET(new Request("http://localhost/api/verdicts?entity=S-03"))).json();
  assert.deepEqual(
    only.map((v: { entity: string }) => v.entity),
    ["S-03"],
  );
});

test("a verdict that cannot be written answers 500 in JSON naming the file, and logs it", async () => {
  const error = vi.spyOn(log, "error").mockImplementation(() => undefined);
  const blocked = path.join(local, "not-a-directory");
  writeFileSync(blocked, "");
  vi.stubEnv("LEDGER_LOCAL_DIR", blocked);
  const item = loadEntity("P-04").samples.items[0]!;
  const res = await post({ entity: "P-04", itemKey: item.key, verdict: "no_issue" });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /^The verdict was not saved\. .*not-a-directory/);
  assert.equal(error.mock.calls.length, 1);
});
