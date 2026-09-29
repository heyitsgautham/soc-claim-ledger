// The browser-safe face of the claims package: labels, and the shapes of an assessment.
// Everything here is a type or a constant, so a client component can import it without
// pulling the file loaders or node built-ins into the bundle.

export { SECTION_LABELS, SECTIONS, type Section } from "./labels";
export type { AttestedClaim, ClaimsFile, Measure, MeasureKind, Metric } from "./schema";
export type * from "./types";
export type { Assessment } from "./evaluate";
export type * from "./analyse/types";
