import { NextResponse } from "next/server";
import { loadPortfolio } from "@/lib/data";
import { log } from "@/lib/log";
import pkg from "../../../../package.json";

// Liveness and readiness in one: the server answers, and the analysis the screens render
// is on disk. The Docker health check and CI wait on this before they drive the app.

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const portfolio = loadPortfolio();
    return NextResponse.json({ status: "ok", version: pkg.version, cycle: portfolio.cycle, entities: portfolio.entries.length, network: "none required" });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    log.error({ err: e }, "health check failed");
    return NextResponse.json({ status: "unavailable", version: pkg.version, detail }, { status: 503 });
  }
}
