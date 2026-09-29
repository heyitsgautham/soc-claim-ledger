import type { Verdict, VerdictValue } from "@ledger/claims/model";
import { NextResponse } from "next/server";
import { loadEntity, localVerdicts, recordAudit, recordVerdict } from "@/lib/data";

// Blind verdict entry. The browser sends only which record and which verdict. The server
// looks the record up in the sample sheet, attaches the detectors that had flagged it,
// and appends the verdict and an audit line to data/local. Nothing leaves the machine.

export const dynamic = "force-dynamic";

const VALUES: VerdictValue[] = ["issue_confirmed", "no_issue", "cannot_tell"];

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
  const body = (await req.json().catch(() => null)) as { entity?: string; itemKey?: string; verdict?: string } | null;
  if (!body?.entity || !body.itemKey || !VALUES.includes(body.verdict as VerdictValue)) {
    return NextResponse.json({ error: "entity, itemKey and a verdict of issue_confirmed, no_issue or cannot_tell are required" }, { status: 400 });
  }
  let analysis: ReturnType<typeof loadEntity>;
  try {
    analysis = loadEntity(body.entity);
  } catch {
    return NextResponse.json({ error: `no entity ${body.entity}` }, { status: 404 });
  }
  const item = analysis.samples.items.find((i) => i.key === body.itemKey);
  if (!item) return NextResponse.json({ error: `${body.itemKey} is not on the ${body.entity} sample sheet` }, { status: 404 });
  const examiner = process.env.LEDGER_EXAMINER ?? "EX-02";
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
    verdict: body.verdict as VerdictValue,
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
  return NextResponse.json({ verdict: v, item });
}
