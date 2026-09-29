import type { CSSProperties } from "react";

// One view-transition name per claim element, shared by the signed report and the ledger,
// so the browser carries each claim's text and figures from one layout into the other.
// "sheet" carries the report half of the submission folder into the report's own page.
export function vt(kind: "text" | "att" | "rec" | "entity" | "sheet", ref = ""): CSSProperties {
  return { viewTransitionName: `vt-${kind}${ref ? `-${ref.replace(/\./g, "-")}` : ""}`, viewTransitionClass: "vt-morph" } as CSSProperties;
}
