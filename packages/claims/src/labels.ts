// Questionnaire sections. Kept free of zod and node built-ins so browser code can import it.

export const SECTIONS = ["timeliness", "coverage", "capability", "staffing"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABELS: Record<Section, string> = {
  timeliness: "Timeliness",
  coverage: "Coverage",
  capability: "Capability",
  staffing: "Staffing",
};
