import path from "node:path";
import { parseArgs } from "node:util";
import { assessLatest } from "./evaluate";
import type { Measure } from "./schema";

// pnpm ledger P-04
// Prints the claim-versus-evidence ledger for one entity to the terminal.

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { data: { type: "string", default: "data/demo" }, quarter: { type: "string" } },
});

function show(m: Measure | null): string {
  if (!m) return "n/a";
  switch (m.kind) {
    case "percent":
      return `${m.value.toFixed(1)}%`;
    case "fraction":
      return `${m.numerator} of ${m.denominator}`;
    case "count":
      return String(m.value);
    case "duration": {
      const total = Math.round(m.seconds / 60);
      return total >= 60 ? `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} m` : `${(m.seconds / 60).toFixed(1)} m`;
    }
  }
}

const dataDir = path.resolve(values.data ?? "data/demo");
for (const entity of positionals.length ? positionals : ["P-04"]) {
  const a = assessLatest(dataDir, entity, values.quarter);
  console.log(`\n${a.entity.code}  ${a.quarter.label}  ${a.claimsDocument.document_id}`);
  for (const e of a.evaluations) {
    const why = e.reason ? `  (${e.reason.kind}${"exports" in e.reason ? `: ${e.reason.exports.join(", ")}` : ""})` : "";
    const basis = e.population ? `  ${e.matched ?? ""}${e.matched !== null ? " of " : ""}${e.population.count} ${e.population.noun}` : "";
    console.log(
      `${e.claim.ref.padEnd(4)} ${e.status.padEnd(22)} ${show(e.claim.attested).padStart(12)}  ${show(e.recomputed).padStart(12)}  ${e.claim.text}${basis}${why}`,
    );
  }
}
