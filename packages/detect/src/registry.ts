// Every detector the tool runs, with the versions it has shipped and the parameters each
// version used. An assessment always runs the version that was current for its cycle,
// so a past finding can be reproduced exactly and calibration can compare versions.

export const DETECTOR_IDS = [
  "claim-gap",
  "sla-bunching",
  "templated-notes",
  "negative-space",
  "weekend-coverage",
  "repeat-no-remediation",
] as const;
export type DetectorId = (typeof DETECTOR_IDS)[number];

export interface DetectorVersion {
  version: string;
  // First assessment cycle the version ran in.
  from: string;
  change: string;
  params: Record<string, number>;
}

export interface DetectorInfo {
  id: DetectorId;
  title: string;
  question: string;
  // What rides on a flag from this detector, 0 to 1, on the same footing as a claim's stakes.
  // Behavioural signals sit below a direct control failure on critical alerts or critical assets.
  stakes: number;
  versions: DetectorVersion[];
}

export const DETECTORS: Record<DetectorId, DetectorInfo> = {
  "claim-gap": {
    id: "claim-gap",
    stakes: 1,
    title: "Claim versus evidence",
    question: "Does an attested figure hold when recomputed from the entity's own records?",
    versions: [{ version: "1.0.0", from: "FY26-Q2", change: "First release, 16 questionnaire metrics", params: { percentTolerance: 2, relativeTolerance: 0.1 } }],
  },
  "sla-bunching": {
    id: "sla-bunching",
    stakes: 0.8,
    title: "SLA bunching",
    question: "Do closures pile into the last minutes before the SLA?",
    versions: [{ version: "1.0.0", from: "FY26-Q2", change: "First release", params: { bucketMinutes: 5, minRatio: 3, minCount: 8 } }],
  },
  "templated-notes": {
    id: "templated-notes",
    stakes: 0.7,
    title: "Templated investigation notes",
    question: "Are closure notes one paragraph with the hostname changed?",
    versions: [
      { version: "1.0.0", from: "FY26-Q2", change: "First release, cosine 0.90", params: { threshold: 0.9, minCluster: 5 } },
      { version: "1.1.0", from: "FY26-Q4", change: "Threshold raised to 0.95 after examiners rejected short benign notes", params: { threshold: 0.95, minCluster: 5 } },
    ],
  },
  "negative-space": {
    id: "negative-space",
    stakes: 0.9,
    title: "Negative space",
    question: "Which asset class and alert category should show alerts, going by inventory and peers, and shows none?",
    versions: [
      { version: "1.0.0", from: "FY26-Q2", change: "First release, any expectation above 1 alert", params: { minExpected: 1 } },
      { version: "1.1.0", from: "FY26-Q3", change: "Minimum expectation raised to 3 alerts across the window", params: { minExpected: 3 } },
    ],
  },
  "weekend-coverage": {
    id: "weekend-coverage",
    stakes: 0.8,
    title: "Weekend coverage",
    question: "Does acknowledgement slow down when the desk is thin at weekends?",
    versions: [{ version: "1.0.0", from: "FY26-Q2", change: "First release", params: { minRatio: 2, minAlerts: 30 } }],
  },
  "repeat-no-remediation": {
    id: "repeat-no-remediation",
    stakes: 0.7,
    title: "Repeat without remediation",
    question: "Does the same asset raise the same alert week after week, closed by automation, with no case opened?",
    versions: [{ version: "1.0.0", from: "FY26-Q2", change: "First release", params: { minWeeks: 6, minAutomatedShare: 0.5 } }],
  },
};

// The version of a detector that was current for an assessment cycle.
export function versionFor(id: DetectorId, cycle: string): DetectorVersion {
  const versions = DETECTORS[id].versions;
  let current = versions[0]!;
  for (const v of versions) if (v.from <= cycle) current = v;
  return current;
}
