import type { AssetClass, Priority } from "@ledger/submission";

// The SIEM detection rules a CSE runs, named the way SIEM content packs name them
// and mapped to MITRE ATT&CK v19.2, where Defense Evasion is split into Stealth and
// Defense Impairment. The T08xx ids are ATT&CK for ICS, for rules that
// read OT telemetry. `weight` is how often the rule fires relative to others of its priority.

export interface RuleTemplate {
  id: string;
  name: string;
  technique: string;
  tactic: string;
  priority: Priority;
  asset_classes: AssetClass[];
  weight: number;
}

export const RULES: readonly RuleTemplate[] = [
  // P1
  {
    id: "R-1001",
    name: "Credential dumping via LSASS memory access",
    technique: "T1003.001",
    tactic: "Credential Access",
    priority: "P1",
    asset_classes: ["datacentre", "endpoint"],
    weight: 4,
  },
  {
    id: "R-1002",
    name: "Mass file encryption pattern",
    technique: "T1486",
    tactic: "Impact",
    priority: "P1",
    asset_classes: ["datacentre", "endpoint"],
    weight: 1,
  },
  {
    id: "R-1003",
    name: "Lateral movement over SMB admin shares",
    technique: "T1021.002",
    tactic: "Lateral Movement",
    priority: "P1",
    asset_classes: ["datacentre", "endpoint"],
    weight: 4,
  },
  {
    id: "R-1004",
    name: "Service created remotely on domain controller",
    technique: "T1543.003",
    tactic: "Persistence",
    priority: "P1",
    asset_classes: ["datacentre"],
    weight: 2,
  },
  {
    id: "R-1005",
    name: "Beaconing to newly registered domain",
    technique: "T1071.001",
    tactic: "Command and Control",
    priority: "P1",
    asset_classes: ["endpoint", "datacentre", "dmz"],
    weight: 5,
  },
  { id: "R-1006", name: "Web shell written to DMZ web root", technique: "T1505.003", tactic: "Persistence", priority: "P1", asset_classes: ["dmz"], weight: 2 },
  {
    id: "R-1007",
    name: "Kerberoasting service ticket requests",
    technique: "T1558.003",
    tactic: "Credential Access",
    priority: "P1",
    asset_classes: ["datacentre"],
    weight: 2,
  },
  {
    id: "R-1008",
    name: "Cloud root account console sign-in",
    technique: "T1078.004",
    tactic: "Initial Access",
    priority: "P1",
    asset_classes: ["cloud"],
    weight: 1,
  },
  {
    id: "R-1009",
    name: "Unauthorised command message to RTU",
    technique: "T0855",
    tactic: "Impair Process Control",
    priority: "P1",
    asset_classes: ["ot"],
    weight: 2,
  },
  {
    id: "R-1010",
    name: "Program download to PLC outside change window",
    technique: "T0843",
    tactic: "Lateral Movement",
    priority: "P1",
    asset_classes: ["ot"],
    weight: 1,
  },

  // P2
  {
    id: "R-2001",
    name: "Password spraying against VPN gateway",
    technique: "T1110.003",
    tactic: "Credential Access",
    priority: "P2",
    asset_classes: ["dmz"],
    weight: 5,
  },
  {
    id: "R-2002",
    name: "Member added to privileged AD group",
    technique: "T1098",
    tactic: "Persistence",
    priority: "P2",
    asset_classes: ["datacentre"],
    weight: 3,
  },
  {
    id: "R-2003",
    name: "Encoded PowerShell command line",
    technique: "T1059.001",
    tactic: "Execution",
    priority: "P2",
    asset_classes: ["endpoint", "datacentre"],
    weight: 6,
  },
  {
    id: "R-2004",
    name: "Scheduled task created by standard user",
    technique: "T1053.005",
    tactic: "Persistence",
    priority: "P2",
    asset_classes: ["endpoint"],
    weight: 4,
  },
  {
    id: "R-2005",
    name: "Outbound transfer above host baseline",
    technique: "T1048",
    tactic: "Exfiltration",
    priority: "P2",
    asset_classes: ["datacentre", "cloud"],
    weight: 3,
  },
  {
    id: "R-2006",
    name: "Security event log cleared",
    technique: "T1685.005",
    tactic: "Defense Impairment",
    priority: "P2",
    asset_classes: ["datacentre", "endpoint"],
    weight: 2,
  },
  { id: "R-2007", name: "Storage bucket made public", technique: "T1530", tactic: "Collection", priority: "P2", asset_classes: ["cloud"], weight: 2 },
  {
    id: "R-2008",
    name: "Remote system discovery on control network",
    technique: "T0846",
    tactic: "Discovery",
    priority: "P2",
    asset_classes: ["ot"],
    weight: 3,
  },
  { id: "R-2009", name: "Default credentials used on HMI", technique: "T0812", tactic: "Lateral Movement", priority: "P2", asset_classes: ["ot"], weight: 2 },

  // P3
  { id: "R-3001", name: "Internal port scan", technique: "T1046", tactic: "Discovery", priority: "P3", asset_classes: ["endpoint", "datacentre"], weight: 5 },
  { id: "R-3002", name: "Malicious download blocked", technique: "T1204.002", tactic: "Execution", priority: "P3", asset_classes: ["endpoint"], weight: 8 },
  {
    id: "R-3003",
    name: "Impossible travel sign-in",
    technique: "T1078",
    tactic: "Initial Access",
    priority: "P3",
    asset_classes: ["cloud", "endpoint"],
    weight: 3,
  },
  { id: "R-3004", name: "Phishing link clicked", technique: "T1566.002", tactic: "Initial Access", priority: "P3", asset_classes: ["endpoint"], weight: 6 },
  {
    id: "R-3005",
    name: "Service account interactive logon",
    technique: "T1078.002",
    tactic: "Privilege Escalation",
    priority: "P3",
    asset_classes: ["datacentre"],
    weight: 3,
  },
  {
    id: "R-3006",
    name: "DNS request to known-bad domain blocked",
    technique: "T1071.004",
    tactic: "Command and Control",
    priority: "P3",
    asset_classes: ["endpoint", "dmz"],
    weight: 5,
  },
  {
    id: "R-3007",
    name: "Web application attack blocked by WAF",
    technique: "T1190",
    tactic: "Initial Access",
    priority: "P3",
    asset_classes: ["dmz"],
    weight: 6,
  },
  { id: "R-3008", name: "Program upload from PLC", technique: "T0845", tactic: "Collection", priority: "P3", asset_classes: ["ot"], weight: 3 },

  // P4
  {
    id: "R-4001",
    name: "Failed logon threshold exceeded",
    technique: "T1110.001",
    tactic: "Credential Access",
    priority: "P4",
    asset_classes: ["endpoint", "datacentre"],
    weight: 9,
  },
  { id: "R-4002", name: "USB mass storage mounted", technique: "T1052.001", tactic: "Exfiltration", priority: "P4", asset_classes: ["endpoint"], weight: 6 },
  {
    id: "R-4003",
    name: "Outbound connection denied by proxy",
    technique: "T1071.001",
    tactic: "Command and Control",
    priority: "P4",
    asset_classes: ["endpoint", "dmz"],
    weight: 8,
  },
  {
    id: "R-4004",
    name: "Software installed outside change window",
    technique: "T1072",
    tactic: "Execution",
    priority: "P4",
    asset_classes: ["endpoint"],
    weight: 4,
  },
  { id: "R-4005", name: "Admin share accessed", technique: "T1021.002", tactic: "Lateral Movement", priority: "P4", asset_classes: ["datacentre"], weight: 4 },
  { id: "R-4006", name: "Perimeter deny spike", technique: "T1046", tactic: "Discovery", priority: "P4", asset_classes: ["dmz"], weight: 5 },
  { id: "R-4007", name: "Cloud API call from unusual region", technique: "T1078.004", tactic: "Stealth", priority: "P4", asset_classes: ["cloud"], weight: 3 },
  { id: "R-4008", name: "OT asset talking outside its baseline", technique: "T0840", tactic: "Discovery", priority: "P4", asset_classes: ["ot"], weight: 5 },
];

// Closure SLA per severity, in minutes, as a CSE's SOP typically sets them. A critical
// alert's triage closes within the hour, inside the ranges in docs/methodology.md.
export const CLOSE_SLA_MINUTES: Record<Priority, number> = {
  P1: 60,
  P2: 480,
  P3: 1440,
  P4: 4320,
};

// Which playbook a case is worked under, by the rule's tactic.
export const PLAYBOOKS: Record<string, string> = {
  "Credential Access": "PB-03",
  Impact: "PB-01",
  "Lateral Movement": "PB-04",
  Persistence: "PB-05",
  "Command and Control": "PB-06",
  "Initial Access": "PB-02",
  Execution: "PB-07",
  Exfiltration: "PB-08",
  Stealth: "PB-09",
  "Defense Impairment": "PB-09",
  Collection: "PB-08",
  Discovery: "PB-10",
  "Privilege Escalation": "PB-03",
  "Impair Process Control": "PB-11",
};
