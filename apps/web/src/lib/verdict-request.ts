import type { VerdictValue } from "@ledger/claims/model";
import { z } from "zod";

// What the browser may send when an examiner records a blind verdict: which record, and
// which verdict. Everything else on the verdict the server looks up itself.

export const VERDICT_VALUES = ["issue_confirmed", "no_issue", "cannot_tell"] as const satisfies readonly VerdictValue[];

export const VerdictRequest = z.object({
  entity: z.string().regex(/^[A-Z]-\d{2}$/),
  itemKey: z.string().min(1).max(200),
  verdict: z.enum(VERDICT_VALUES),
});

export type VerdictRequest = z.output<typeof VerdictRequest>;

export const VERDICT_REQUEST_ERROR = "entity, itemKey and a verdict of issue_confirmed, no_issue or cannot_tell are required";

export function parseVerdictRequest(body: unknown): VerdictRequest | null {
  const parsed = VerdictRequest.safeParse(body);
  return parsed.success ? parsed.data : null;
}
