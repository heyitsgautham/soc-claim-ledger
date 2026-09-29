import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { CLAIMS_FILE, ClaimsFileSchema } from "@ledger/claims";
import {
  encodeExport,
  type ExportEntry,
  type ExportName,
  exportFileName,
  MANIFEST_FILE,
  type Manifest,
  ManifestSchema,
  type RecordInput,
  sha256,
} from "@ledger/submission";
import { QUARTERS } from "./calendar";
import { writeClaims } from "./claims-writer";
import { buildInventory } from "./inventory";
import { behaviourIn, type EntityConfig } from "./roster";
import { simulateQuarter } from "./soc";

export const TRUTH_FILE = "_truth.ndjson.gz";

export interface WriteSummary {
  entity: string;
  quarter: string;
  rows: Partial<Record<ExportName, number>>;
}

// Writes every quarter of one entity as the folders a CSE would hand over.
export function writeEntity(entity: EntityConfig, outDir: string): WriteSummary[] {
  const inventory = buildInventory(entity);
  const entityDir = path.join(outDir, entity.code);
  rmSync(entityDir, { recursive: true, force: true });
  const summaries: WriteSummary[] = [];

  for (const quarter of QUARTERS) {
    const dir = path.join(entityDir, quarter.id);
    mkdirSync(dir, { recursive: true });
    const out = simulateQuarter(entity, inventory, quarter);

    const exported: { [N in ExportName]?: RecordInput<N>[] } = {
      alerts: out.alerts,
      cases: out.cases,
      escalations: out.escalations,
      assets: inventory.assets,
      log_sources: out.log_sources,
      rules: out.rules,
      analysts: inventory.analysts,
      shifts: out.shifts,
    };
    if (behaviourIn(entity, quarter.id).submitsThreatHuntLog) exported.threat_hunts = out.threat_hunts;
    for (const name of entity.behaviour.omitExports) delete exported[name];

    const exports: Partial<Record<ExportName, ExportEntry>> = {};
    const rows: WriteSummary["rows"] = {};
    for (const [name, list] of Object.entries(exported) as [ExportName, RecordInput<ExportName>[]][]) {
      const bytes = encodeExport(list);
      const file = exportFileName(name);
      writeFileSync(path.join(dir, file), bytes);
      exports[name] = { file, rows: list.length, sha256: sha256(bytes), declared_complete: true };
      rows[name] = list.length;
    }

    const manifest: Manifest = ManifestSchema.parse({
      schema_version: 1,
      entity: { code: entity.code, sector: entity.sector, description: entity.description, sites: entity.sites.length },
      quarter: { id: quarter.id, label: quarter.label, start: quarter.start, end: quarter.end },
      submitted_on: quarter.submittedOn,
      exports,
    });
    writeFileSync(path.join(dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);

    const claims = ClaimsFileSchema.parse(writeClaims(entity, inventory, quarter));
    writeFileSync(path.join(dir, CLAIMS_FILE), `${JSON.stringify(claims, null, 2)}\n`);

    // Ground truth stays beside the submission but outside the manifest. The loader never
    // reads it, and only the simulated examiner and the validation tests do.
    writeFileSync(path.join(dir, TRUTH_FILE), gzipSync(Buffer.from(`${out.truth.map((t) => JSON.stringify(t)).join("\n")}\n`)));

    summaries.push({ entity: entity.code, quarter: quarter.id, rows });
  }
  return summaries;
}
