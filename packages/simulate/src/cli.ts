import path from "node:path";
import { parseArgs } from "node:util";
import { ROSTER } from "./roster";
import { simulateExaminers } from "./examiners";
import { writeEntity } from "./writer";

// pnpm simulate
// Writes data/demo from the seeded simulator. Same code, same bytes, every run.

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "data/demo" },
    entity: { type: "string", multiple: true },
  },
});

const outDir = path.resolve(values.out ?? "data/demo");
const wanted = values.entity?.length ? ROSTER.filter((e) => values.entity!.includes(e.code)) : ROSTER;
if (!wanted.length) {
  console.error(`no roster entity matches ${values.entity?.join(", ")}`);
  process.exit(1);
}

const started = performance.now();
for (const entity of wanted) {
  for (const s of writeEntity(entity, outDir)) {
    const r = s.rows;
    console.log(
      `${s.entity} ${s.quarter}  alerts ${String(r.alerts).padStart(6)}  cases ${String(r.cases).padStart(4)}  escalations ${r.escalations === undefined ? "none" : String(r.escalations).padStart(4)}  assets ${r.assets}  log sources ${r.log_sources}${r.threat_hunts === undefined ? "  no hunt log" : `  hunts ${r.threat_hunts}`}`,
    );
  }
}
const verdicts = simulateExaminers(outDir);
console.log(`examiners reviewed ${verdicts.length} sampled records across past cycles`);
console.log(`wrote ${path.relative(process.cwd(), outDir) || outDir} in ${((performance.now() - started) / 1000).toFixed(1)} s`);
