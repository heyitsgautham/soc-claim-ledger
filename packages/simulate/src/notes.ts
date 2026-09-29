import type { Disposition } from "@ledger/submission";
import type { RuleTemplate } from "./catalogue";
import type { Rng } from "./rng";

// Investigation notes an analyst writes at closure. A real note mentions what was
// looked at and found, so natural notes differ from each other in wording and in
// specifics. Some analysts write two short lines, and two short lines can look alike,
// which is the benign near-duplicate a templated-notes detector has to tell apart.

const OPENERS = [
  "Triaged {rule} on {host}.",
  "Picked up {rule} raised on {host}.",
  "Investigated the {rule} detection for {host}.",
  "Reviewed alert context for {host} after {rule} fired.",
  "Worked {rule} on {host} from the SIEM queue.",
];

const LOOKED = [
  "Pulled {n} hours of EDR process telemetry around the alert time.",
  "Checked the parent process tree, {proc} spawned from {parent}.",
  "Correlated with proxy and DNS logs for the preceding {n} hours.",
  "Queried authentication logs for {user} across the domain controllers.",
  "Compared the hash against the internal allow list and the TI feed.",
  "Reviewed firewall sessions from {ip} for the last {n} days.",
  "Confirmed the change ticket CHG-{ticket} with the asset owner.",
  "Isolated the host from the network while the scan ran.",
];

const FOUND: Record<Disposition, string[]> = {
  true_positive_contained: [
    "Confirmed malicious activity, {proc} made outbound connections to {ip}.",
    "Credential material was accessed by {proc}, account {user} reset.",
    "Payload matched a known loader family, host contained and reimaged.",
  ],
  true_positive_remediated: [
    "Malicious persistence removed and the host patched to the current baseline.",
    "Compromised service account {user} disabled and its keys rotated.",
  ],
  benign_positive: [
    "Activity traced to the patching window, {proc} run by the platform team.",
    "Admin tooling used by {user} during approved maintenance.",
    "Behaviour matches the backup agent, expected for this host role.",
    "Vulnerability scanner at {ip} generated the pattern, whitelisted in the scan policy.",
  ],
  false_positive: [
    "Rule logic matched a benign command line, tuning request raised.",
    "No malicious indicators in the telemetry, detection threshold too low for this host.",
    "Signature hit on a signed vendor binary, confirmed clean.",
  ],
  duplicate: ["Same activity already tracked in an earlier case, merged."],
  inconclusive: [
    "Telemetry gap on the host for the alert window, could not confirm either way.",
    "Logs rolled over before review, insufficient data to conclude.",
  ],
};

const CLOSERS = [
  "Closing with owner informed.",
  "Closed after sign-off from the shift lead.",
  "No further action, monitoring continues.",
  "Case closed, detection tuning tracked separately.",
  "Handed back to operations and closed.",
];

// Two short lines, the way a hurried analyst writes a benign closure.
const SHORT_FIRST = ["Checked {host} against EDR telemetry.", "Reviewed {host} process and network activity.", "Verified {host} activity with the asset owner."];
const SHORT_SECOND = ["Benign activity, no threat found, closed.", "Expected behaviour for this host role, closing.", "No malicious indicators observed, closed."];

const PROCS = ["powershell.exe", "rundll32.exe", "wmic.exe", "certutil.exe", "python3", "cmd.exe", "svchost.exe", "java"];
const PARENTS = ["winword.exe", "explorer.exe", "services.exe", "sshd", "outlook.exe", "cron"];
const USERS = ["svc_backup", "adm.rkumar", "svc_sql02", "jdoshi", "svc_patch", "adm.meera", "operator7"];

function fill(rng: Rng, text: string, rule: RuleTemplate, host: string): string {
  return text
    .replaceAll("{rule}", rule.name.toLowerCase())
    .replaceAll("{host}", host)
    .replaceAll("{proc}", rng.pick(PROCS))
    .replaceAll("{parent}", rng.pick(PARENTS))
    .replaceAll("{user}", rng.pick(USERS))
    .replaceAll("{ip}", `10.${rng.int(10, 60)}.${rng.int(0, 255)}.${rng.int(2, 254)}`)
    .replaceAll("{ticket}", String(rng.int(10000, 99999)))
    .replaceAll("{n}", String(rng.int(2, 24)));
}

export function naturalNote(rng: Rng, rule: RuleTemplate, host: string, disposition: Disposition): string {
  if ((disposition === "benign_positive" || disposition === "false_positive") && rng.chance(0.18)) {
    return `${fill(rng, rng.pick(SHORT_FIRST), rule, host)} ${rng.pick(SHORT_SECOND)}`;
  }
  const parts = [rng.pick(OPENERS), rng.pick(LOOKED)];
  if (rng.chance(0.5)) parts.push(rng.pick(LOOKED));
  parts.push(rng.pick(FOUND[disposition]), rng.pick(CLOSERS));
  return parts.map((p) => fill(rng, p, rule, host)).join(" ");
}

// The pasted paragraph. Only the hostname changes from one case to the next.
export function templatedNote(host: string): string {
  return (
    `Alert reviewed on ${host}. No malicious activity observed after initial triage. ` +
    "Host checked against EDR telemetry and no further indicators of compromise were found. " +
    "User activity appears consistent with normal business operations. " +
    "Closing as per SOP, no escalation required at this stage."
  );
}
