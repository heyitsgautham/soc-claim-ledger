import type { AssetClass } from "./constants";

// The one place asset counts come from. The claims ledger, the negative-space grid and
// the report all count the inventory through this function, so a screen can never say
// 38 critical OT assets while another says something else about the same export.

export interface ClassCount {
  total: number;
  critical: number;
}

export function classCounts(assets: readonly { asset_class: AssetClass; criticality: string }[]): Record<AssetClass, ClassCount> {
  const out: Record<AssetClass, ClassCount> = {
    datacentre: { total: 0, critical: 0 },
    dmz: { total: 0, critical: 0 },
    endpoint: { total: 0, critical: 0 },
    cloud: { total: 0, critical: 0 },
    ot: { total: 0, critical: 0 },
  };
  for (const a of assets) {
    out[a.asset_class].total++;
    if (a.criticality === "critical") out[a.asset_class].critical++;
  }
  return out;
}

export function isCriticalOt(a: { asset_class: AssetClass; criticality: string }): boolean {
  return a.asset_class === "ot" && a.criticality === "critical";
}
