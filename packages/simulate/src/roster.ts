import type { ExportName, Sector } from "@ledger/submission";

// One simulated CSE. `handling` is how its SOC actually works, `behaviour` holds the
// toggles that make findings emerge from that work, and `intended` is the process the
// CSE believes it runs. The claims file is written from `intended` alone, never from
// what the simulation did, which is why a gap can exist at all.

export interface Lognormal {
  medianMin: number;
  sigma: number;
}

export interface EntityConfig {
  code: string;
  // Seeds the quarterly SOC runs. The inventory always seeds from the code, so a new
  // seed replays the same estate with a different run of days.
  seed: string;
  sector: Sector;
  description: string;
  sites: string[];
  assets: {
    datacentre: number;
    dmz: number;
    cloud: number;
    endpoint: number;
    otCritical: number;
    otOther: number;
  };
  alertsPerDay: number;
  staffing: {
    l1Teams: number;
    l1PerTeam: number;
    l2: number;
    l3: number;
  };
  handling: {
    p1AckMeanMin: number;
    p2AckMeanMin: number;
    p1Triage: Lognormal;
    p1CloseEscalated: Lognormal;
    p1CloseL1Only: Lognormal;
    p2Close: Lognormal;
    p3Close: Lognormal;
    p2CaseRate: number;
    p3CaseRate: number;
    p2EscalationRate: number;
    missingDispositionRate: number;
    logSourceOutages: number;
  };
  behaviour: {
    // Probability that an L1 closes a critical alert's triage without escalating it.
    skipL2OnP1: number;
    // A critical alert still open in the last five minutes of its SLA gets closed just under it,
    // with these probabilities, instead of running on to its natural end.
    closeAtSlaMinus: { escalated: number; notEscalated: number } | null;
    // Whether the OT network sensors were ever enrolled in the SIEM.
    otSensorsEnrolled: boolean;
    threatHuntsPerQuarter: number;
    submitsThreatHuntLog: boolean;
    // Closure notes pasted from one paragraph with only the hostname changed.
    // p1_unescalated: L1s who close P1s without L2 paste the same note.
    // analysts: the named analysts paste it on every case they close.
    templatedNotes: { scope: "p1_unescalated"; probability: number } | { scope: "analysts"; analysts: string[]; probability: number } | null;
    // Weekend shifts run with this many L1s, acknowledgement slows by the multiplier,
    // and cases opened at the weekend wait for Monday morning with this probability.
    weekend: { l1OnDuty: number; ackMultiplier: number; deferToMonday: number } | null;
    // Assets that raise the same detection every week. A working SOC opens a case on the
    // third repeat and the host is fixed. With autoClose, automation closes every repeat
    // and nobody ever opens a case.
    recurring: { assets: number; autoClose: boolean } | null;
    // Exports the CSE leaves out of its submission.
    omitExports: ExportName[];
    // The first quarter a toggle is in force. Before it the SOC works as intended there,
    // which is what gives the portfolio a trend.
    startsIn: Partial<Record<Toggle, string>>;
  };
  intended: {
    p1EscalationWithin30Pct: number;
    p1MeanCloseMin: number;
    p1MeanAckMin: number;
    p2WithinSlaPct: number;
    p2MeanAckMin: number;
    p3AckWithin4hPct: number;
    threatHuntsPerQuarter: number;
    p3FalsePositiveMaxPct: number;
    dispositionPct: number;
    shiftsWithThreeL1Pct: number;
    shiftsWithL2Pct: number;
  };
}

export type Toggle = "skipL2OnP1" | "closeAtSlaMinus" | "templatedNotes" | "weekend" | "recurring";

type Overrides = {
  [K in keyof EntityConfig]?: EntityConfig[K] extends object
    ? EntityConfig[K] extends unknown[]
      ? EntityConfig[K]
      : Partial<EntityConfig[K]>
    : EntityConfig[K];
};

// A well-run SOC. Every entity starts here and changes only what makes it itself.
function entity(code: string, sector: Sector, description: string, o: Overrides): EntityConfig {
  const base: EntityConfig = {
    code,
    seed: code,
    sector,
    description,
    sites: ["HQ", "DC1", "DC2"],
    assets: { datacentre: 70, dmz: 24, cloud: 16, endpoint: 640, otCritical: 0, otOther: 0 },
    alertsPerDay: 200,
    staffing: { l1Teams: 4, l1PerTeam: 3, l2: 4, l3: 2 },
    handling: {
      p1AckMeanMin: 3,
      p2AckMeanMin: 8,
      p1Triage: { medianMin: 8, sigma: 0.45 },
      p1CloseEscalated: { medianMin: 30, sigma: 0.45 },
      p1CloseL1Only: { medianMin: 25, sigma: 0.4 },
      p2Close: { medianMin: 150, sigma: 0.55 },
      p3Close: { medianMin: 300, sigma: 0.7 },
      p2CaseRate: 0.25,
      p3CaseRate: 0.02,
      p2EscalationRate: 0.35,
      missingDispositionRate: 0,
      logSourceOutages: 1,
    },
    behaviour: {
      skipL2OnP1: 0,
      closeAtSlaMinus: null,
      otSensorsEnrolled: true,
      threatHuntsPerQuarter: 4,
      submitsThreatHuntLog: true,
      templatedNotes: null,
      weekend: null,
      recurring: { assets: 2, autoClose: false },
      omitExports: [],
      startsIn: {},
    },
    intended: {
      p1EscalationWithin30Pct: 95,
      p1MeanCloseMin: 40,
      p1MeanAckMin: 5,
      p2WithinSlaPct: 95,
      p2MeanAckMin: 15,
      p3AckWithin4hPct: 90,
      threatHuntsPerQuarter: 4,
      p3FalsePositiveMaxPct: 40,
      dispositionPct: 100,
      shiftsWithThreeL1Pct: 100,
      shiftsWithL2Pct: 100,
    },
  };
  return {
    ...base,
    ...o,
    assets: { ...base.assets, ...o.assets },
    staffing: { ...base.staffing, ...o.staffing },
    handling: { ...base.handling, ...o.handling },
    behaviour: { ...base.behaviour, ...o.behaviour },
    intended: { ...base.intended, ...o.intended },
  } as EntityConfig;
}

// The hero. Closes critical alerts just under the SLA, skips L2 on a third of them, pastes one
// closure note, and never enrolled its OT sensors, while attesting to the SOP.
const P04 = entity("P-04", "power_energy", "Regional transmission operator", {
  // The seed chooses which days happen. The behaviour below is what makes the findings.
  seed: "P-04#2008",
  sites: ["HQ", "DC1", "DC2", "CC", "SS01", "SS02", "SS03", "SS04", "SS05", "SS06", "SS07"],
  assets: { datacentre: 118, dmz: 52, cloud: 38, endpoint: 1266, otCritical: 38, otOther: 20 },
  alertsPerDay: 405,
  staffing: { l1Teams: 4, l1PerTeam: 3, l2: 5, l3: 2 },
  handling: {
    p1AckMeanMin: 3.4,
    p2AckMeanMin: 9,
    p1Triage: { medianMin: 11, sigma: 0.72 },
    p1CloseEscalated: { medianMin: 50, sigma: 0.75 },
    p1CloseL1Only: { medianMin: 65, sigma: 0.3 },
    p2Close: { medianMin: 160, sigma: 0.6 },
    p3Close: { medianMin: 360, sigma: 0.8 },
    p2CaseRate: 0.22,
    p3CaseRate: 0.018,
    p2EscalationRate: 0.3,
    missingDispositionRate: 0.004,
    logSourceOutages: 2,
  },
  behaviour: {
    skipL2OnP1: 0.34,
    closeAtSlaMinus: { escalated: 0.3, notEscalated: 0.93 },
    otSensorsEnrolled: false,
    threatHuntsPerQuarter: 2,
    submitsThreatHuntLog: false,
    templatedNotes: { scope: "p1_unescalated", probability: 0.27 },
    recurring: null,
    startsIn: { skipL2OnP1: "FY26-Q3", closeAtSlaMinus: "FY26-Q3", templatedNotes: "FY26-Q4" },
  },
  intended: { p1EscalationWithin30Pct: 100, p1MeanCloseMin: 32, threatHuntsPerQuarter: 6 },
});

// Power-sector peers. They run OT sensors, which is what sets the peer expectation for
// alerts from OT assets.
const P01 = entity("P-01", "power_energy", "State generation utility", {
  sites: ["HQ", "DC1", "CC", "GS1", "GS2", "GS3", "GS4"],
  assets: { datacentre: 96, dmz: 34, cloud: 18, endpoint: 980, otCritical: 44, otOther: 30 },
  alertsPerDay: 260,
  staffing: { l2: 5 },
});

const P06 = entity("P-06", "power_energy", "City gas distribution network", {
  sites: ["HQ", "DC1", "CC", "CGS1", "CGS2", "CGS3"],
  assets: { datacentre: 58, dmz: 20, cloud: 10, endpoint: 520, otCritical: 30, otOther: 24 },
  alertsPerDay: 170,
  handling: { logSourceOutages: 3 },
});

// Copy-paste investigation notes from two analysts.
const B02 = entity("B-02", "bfsi", "Scheduled commercial bank", {
  sites: ["HQ", "DC1", "DR1", "RO1", "RO2"],
  assets: { datacentre: 140, dmz: 60, cloud: 44, endpoint: 1600 },
  alertsPerDay: 300,
  staffing: { l1Teams: 4, l1PerTeam: 3, l2: 6, l3: 3 },
  behaviour: { templatedNotes: { scope: "analysts", analysts: ["L1-03", "L1-08"], probability: 0.9 }, startsIn: { templatedNotes: "FY26-Q3" } },
});

const B05 = entity("B-05", "bfsi", "Payment clearing house", {
  assets: { datacentre: 88, dmz: 36, cloud: 30, endpoint: 540 },
  alertsPerDay: 210,
});

// Unstaffed weekends. One L1 holds the desk from Friday night to Monday morning.
const T07 = entity("T-07", "telecom", "Mobile network operator", {
  sites: ["HQ", "DC1", "DC2", "NOC1", "NOC2"],
  assets: { datacentre: 120, dmz: 48, cloud: 26, endpoint: 1100 },
  alertsPerDay: 280,
  behaviour: { weekend: { l1OnDuty: 1, ackMultiplier: 3.2, deferToMonday: 0.65 }, startsIn: { weekend: "FY26-Q4" } },
});

const T03 = entity("T-03", "telecom", "National fibre backbone operator", {
  assets: { datacentre: 76, dmz: 30, cloud: 12, endpoint: 480 },
  alertsPerDay: 190,
});

const R02 = entity("R-02", "transport", "Metro rail operator", {
  sites: ["HQ", "DC1", "OCC", "DEP1", "DEP2"],
  assets: { datacentre: 64, dmz: 22, cloud: 14, endpoint: 700, otCritical: 22, otOther: 30 },
  alertsPerDay: 170,
});

const R05 = entity("R-05", "transport", "Airport operator", {
  assets: { datacentre: 70, dmz: 30, cloud: 20, endpoint: 820, otCritical: 18, otOther: 26 },
  sites: ["HQ", "DC1", "ATC", "TRM1", "TRM2"],
  alertsPerDay: 190,
});

// Automation closes the same weekly alert on eight hosts and nobody ever looks.
const G01 = entity("G-01", "government", "State data centre", {
  assets: { datacentre: 150, dmz: 56, cloud: 40, endpoint: 900 },
  alertsPerDay: 230,
  behaviour: { recurring: { assets: 8, autoClose: true } },
});

// Leaves the escalation export out of its submission. The tool reports insufficient
// evidence for the claims that need it, not a failure of the SOC.
const G04 = entity("G-04", "government", "e-Governance service platform", {
  assets: { datacentre: 66, dmz: 28, cloud: 34, endpoint: 420 },
  alertsPerDay: 160,
  behaviour: { omitExports: ["escalations"] },
});

// The clean control. Nothing is toggled, and the tool has to show every claim holding,
// which is how it proves it does not flag everyone.
const S03 = entity("S-03", "strategic_public", "Public-sector process plant operator", {
  sites: ["HQ", "DC1", "PL1", "PL2", "PL3"],
  assets: { datacentre: 84, dmz: 30, cloud: 12, endpoint: 820, otCritical: 26, otOther: 40 },
  alertsPerDay: 240,
  behaviour: { recurring: null },
});

export const ROSTER: readonly EntityConfig[] = [P01, P04, P06, B02, B05, T03, T07, R02, R05, G01, G04, S03];

export function entityByCode(code: string): EntityConfig {
  const e = ROSTER.find((x) => x.code === code);
  if (!e) throw new Error(`no simulated entity ${code}`);
  return e;
}

// The behaviour in force for one quarter, with toggles that have not started yet switched off.
export function behaviourIn(entity: EntityConfig, quarter: string): EntityConfig["behaviour"] {
  const b = { ...entity.behaviour };
  const off = (t: Toggle) => {
    const from = b.startsIn[t];
    return from !== undefined && quarter < from;
  };
  if (off("skipL2OnP1")) b.skipL2OnP1 = 0;
  if (off("closeAtSlaMinus")) b.closeAtSlaMinus = null;
  if (off("templatedNotes")) b.templatedNotes = null;
  if (off("weekend")) b.weekend = null;
  if (off("recurring") && b.recurring) b.recurring = { ...b.recurring, autoClose: false };
  return b;
}
