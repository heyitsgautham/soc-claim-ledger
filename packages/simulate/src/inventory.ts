import type { AssetClass, RecordInput } from "@ledger/submission";
import { addDays } from "./calendar";
import type { EntityConfig } from "./roster";
import { Rng } from "./rng";

// The parts of a CSE that do not change quarter to quarter: its asset inventory,
// the SIEM log sources that watch those assets, and its analyst roster.
// Built from the entity's own seed, so every quarter sees the same inventory.

export type AssetRow = RecordInput<"assets">;
export type AnalystRow = RecordInput<"analysts">;

export interface SourceDef {
  id: string;
  name: string;
  kind: string;
  asset_class: AssetClass;
  onboarded_on: string;
  // Aggregate sources, like an EDR console, never go dark in the simulation, since
  // an outage there would silence every endpoint at once.
  aggregate: boolean;
}

export interface Inventory {
  short: string;
  assets: AssetRow[];
  sources: SourceDef[];
  // How noisy each asset is relative to its peers. Some hosts alert far more than others.
  noise: Map<string, number>;
  analysts: AnalystRow[];
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

export function buildInventory(entity: EntityConfig): Inventory {
  const rng = new Rng(`${entity.code}/inventory`);
  const short = entity.code.replace("-", "");
  const assets: AssetRow[] = [];
  const sources: SourceDef[] = [];
  const noise = new Map<string, number>();

  const onboardedOn = () => addDays("2022-01-01", rng.int(0, 1240));

  const addSource = (name: string, kind: string, assetClass: AssetClass, aggregate = false): string => {
    const id = `${short}-LS-${pad(sources.length + 1, 3)}`;
    sources.push({ id, name, kind, asset_class: assetClass, onboarded_on: onboardedOn(), aggregate });
    return id;
  };

  const addAsset = (hostname: string, assetClass: AssetClass, site: string, criticality: AssetRow["criticality"], source: string | null) => {
    const id = `${short}-AS-${pad(assets.length + 1, 4)}`;
    assets.push({ id, hostname, asset_class: assetClass, site, criticality, log_source_id: source });
    noise.set(id, rng.lognormal(1, 0.9));
  };

  const dcSites = entity.sites.filter((s) => s.startsWith("DC"));
  const otSites = entity.sites.filter((s) => !s.startsWith("DC") && s !== "HQ");

  const dcRoles = ["APP", "DB", "AD", "FS", "MGT", "BKP", "ERP", "SIEM"];
  for (let i = 1; i <= entity.assets.datacentre; i++) {
    const role = rng.pick(dcRoles);
    const site = rng.pick(dcSites);
    const hostname = `${site}-${role}-${pad(i, 3)}`;
    const os = role === "AD" || role === "FS" ? "Windows event forwarding" : rng.chance(0.55) ? "Linux syslog" : "Windows event forwarding";
    const src = addSource(`${hostname} ${os}`, "server_os", "datacentre");
    addAsset(hostname, "datacentre", site, role === "AD" || role === "DB" || role === "ERP" ? "critical" : "high", src);
  }

  const dmzRoles: [string, string][] = [
    ["WEB", "web_server"],
    ["VPN", "vpn_gateway"],
    ["MAIL", "mail_relay"],
    ["DNS", "dns_server"],
    ["PRX", "reverse_proxy"],
    ["FW", "firewall"],
  ];
  for (let i = 1; i <= entity.assets.dmz; i++) {
    const [role, kind] = rng.pick(dmzRoles);
    const hostname = `DMZ-${role}-${pad(i, 2)}`;
    const src = addSource(`${hostname} ${kind.replace("_", " ")}`, kind, "dmz");
    addAsset(hostname, "dmz", "HQ", role === "FW" || role === "VPN" ? "critical" : "high", src);
  }

  for (let i = 1; i <= entity.assets.cloud; i++) {
    const hostname = `CLD-VM-${pad(i, 3)}`;
    const src = addSource(`${hostname} cloud audit trail`, "cloud_audit", "cloud");
    addAsset(hostname, "cloud", "CLOUD", rng.chance(0.3) ? "high" : "standard", src);
  }

  // Endpoints report through consoles, not one source per laptop.
  const edr = addSource("EDR management console", "edr_console", "endpoint", true);
  addSource("Antivirus management console", "av_console", "endpoint", true);
  addSource("Forward web proxy", "web_proxy", "endpoint", true);
  addSource("Mail security gateway", "mail_gateway", "endpoint", true);
  addSource("Remote access broker", "remote_access", "endpoint", true);
  addSource("Internal DNS resolvers", "dns_resolver", "endpoint", true);
  const depts = ["OPS", "ENG", "FIN", "HR", "ADM", "GRD", "PRC"];
  for (let i = 1; i <= entity.assets.endpoint; i++) {
    const dept = rng.pick(depts);
    addAsset(`EP-${dept}-${pad(i, 4)}`, "endpoint", rng.pick(entity.sites), "standard", edr);
  }

  // OT. With sensors enrolled, each OT site's network sensor is a log source for its assets.
  // Without them the inventory still lists every RTU and PLC, but nothing in the SIEM watches them.
  const sensorBySite = new Map<string, string>();
  if (entity.behaviour.otSensorsEnrolled) {
    for (const site of otSites) {
      sensorBySite.set(site, addSource(`${site} OT network sensor`, "ot_network_sensor", "ot", true));
    }
  }
  const criticalRoles = ["RTU", "PLC", "HMI", "SCADA", "HIST", "EWS"];
  const otherRoles = ["IED", "GPS", "SW", "PRN"];
  const roleCount = new Map<string, number>();
  const otHost = (site: string, role: string) => {
    const key = `${site}-${role}`;
    const n = (roleCount.get(key) ?? 0) + 1;
    roleCount.set(key, n);
    return `${key}-${pad(n, 2)}`;
  };
  for (let i = 0; i < entity.assets.otCritical; i++) {
    const site = otSites[i % otSites.length] as string;
    const role = site === "CC" ? rng.pick(["SCADA", "HIST", "HMI", "EWS"]) : rng.pick(criticalRoles.slice(0, 3));
    addAsset(otHost(site, role), "ot", site, "critical", sensorBySite.get(site) ?? null);
  }
  for (let i = 0; i < entity.assets.otOther; i++) {
    const site = rng.pick(otSites);
    addAsset(otHost(site, rng.pick(otherRoles)), "ot", site, "standard", sensorBySite.get(site) ?? null);
  }

  const analysts: AnalystRow[] = [];
  const addAnalysts = (level: "L1" | "L2" | "L3", count: number) => {
    for (let i = 1; i <= count; i++) {
      analysts.push({ id: `${level}-${pad(i, 2)}`, level, joined_on: addDays("2019-06-01", rng.int(0, 2100)) });
    }
  };
  addAnalysts("L1", entity.staffing.l1Teams * entity.staffing.l1PerTeam);
  addAnalysts("L2", entity.staffing.l2);
  addAnalysts("L3", entity.staffing.l3);

  return { short, assets, sources, noise, analysts };
}
