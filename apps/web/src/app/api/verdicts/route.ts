import type { Verdict } from "@ledger/claims/model";
import { NextResponse } from "next/server";
import { entityCodes, loadEntity, localVerdicts, recordAudit, recordVerdict } from "@/lib/data";
import { examinerId } from "@/lib/env";
import { log } from "@/lib/log";
import { parseVerdictRequest, VERDICT_REQUEST_ERROR } from "@/lib/verdict-request";

// Blind verdict entry. The browser sends only which record and which verdict. The server
// looks the record up in the sample sheet, attaches the detectors that had flagged it,
// and appends the verdict and an audit line to data/local. Nothing leaves the machine.

export const dynamic = "force-dynamic";

function istNow(): string {
  const d = new Date(Date.now() + 330 * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+05:30`;
}

export async function GET(req: Request) {
  const entity = new URL(req.url).searchParams.get("entity");
  return NextResponse.json(localVerdicts().filter((v) => !entity || v.entity === entity));
}

export async function POST(req: Request) {
  const body = parseVerdictRequest(await req.json().catch(() => null));
  if (!body) return refuse(400, VERDICT_REQUEST_ERROR);
  if (!entityCodes().includes(body.entity)) return refuse(404, `no entity ${body.entity}`);
  const analysis = loadEntity(body.entity);
  const item = analysis.samples.items.find((i) => i.key === body.itemKey);
  if (!item) return refuse(404, `${body.itemKey} is not on the ${body.entity} sample sheet`);
  const examiner = examinerId();
  const detectors = item.reasons.map((r) => r.detector).filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);
  const v: Verdict = {
    id: `V-${analysis.cycle}-${analysis.code}-${String(item.n).padStart(2, "0")}-live`,
    cycle: analysis.cycle,
    entity: analysis.code,
    itemKey: item.key,
    kind: item.kind,
    recordId: item.recordId,
    pick: item.pick,
    detectors,
    verdict: body.verdict,
    examiner,
    recordedAt: istNow(),
    blind: true,
  };
  recordVerdict(v);
  recordAudit({
    at: v.recordedAt,
    actor: examiner,
    action: "verdict_recorded",
    subject: `${v.entity} ${v.recordId}`,
    detail: `${v.verdict.replace("_", " ")}, blind, ${detectors.length ? `${detectors.length} detector${detectors.length > 1 ? "s" : ""}` : `${v.pick} pick`}`,
  });
  log.info({ entity: v.entity, recordId: v.recordId, verdict: v.verdict, examiner, detectors: detectors.length }, "verdict recorded");
  return NextResponse.json({ verdict: v, item });
}

function refuse(status: 400 | 404, error: string) {
  log.warn({ status, reason: error }, "verdict refused");
  return NextResponse.json({ error }, { status });
}
