import path from "node:path";
import { parseArgs } from "node:util";
import { runAnalysis } from "./run";

// pnpm analyse
// Recomputes every ledger, detector, finding, risk indicator and sample sheet from the
// submissions in data/demo and writes data/demo/derived for the interface.

const { values } = parseArgs({ options: { data: { type: "string", default: "data/demo" } } });
const dataDir = path.resolve(values.data ?? "data/demo");
const started = performance.now();
const s = runAnalysis(dataDir);
console.log(`analysed ${s.entities} entities for ${s.cycle} with ${s.verdicts} past verdicts in ${((performance.now() - started) / 1000).toFixed(1)} s`);
