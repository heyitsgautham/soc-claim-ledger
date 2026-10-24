import { listEntities, listQuarters, loadSubmission, type Submission, submissionDir } from "@ledger/submission";

// Loads each submission once and hands out windows of quarters and sector peers.
export class Workspace {
  private subs = new Map<string, Submission>();
  readonly entities: string[];

  constructor(readonly dataDir: string) {
    this.entities = listEntities(dataDir);
  }

  quarters(entity: string): string[] {
    return listQuarters(this.dataDir, entity);
  }

  submission(entity: string, quarter: string): Submission {
    const key = `${entity}/${quarter}`;
    let s = this.subs.get(key);
    if (!s) {
      s = loadSubmission(submissionDir(this.dataDir, entity, quarter));
      this.subs.set(key, s);
    }
    return s;
  }

  // Newest first, up to and including `cycle`.
  window(entity: string, cycle: string, depth: number): Submission[] {
    const qs = this.quarters(entity).filter((q) => q <= cycle);
    return qs
      .reverse()
      .slice(0, depth)
      .map((q) => this.submission(entity, q));
  }

  sectorPeers(entity: string): string[] {
    const sector = this.submission(entity, this.quarters(entity).at(-1)!).manifest.entity.sector;
    return this.entities.filter((e) => e !== entity && this.submission(e, this.quarters(e).at(-1)!).manifest.entity.sector === sector);
  }
}
