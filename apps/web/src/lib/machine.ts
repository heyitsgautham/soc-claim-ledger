import "server-only";
import os from "node:os";
import type { Machine } from "@/components/report/report-document";

export function machine(): Machine {
  const platform = { darwin: "macOS", linux: "Linux", win32: "Windows" }[os.platform() as string] ?? os.platform();
  return {
    platform: `${platform} ${os.arch()}`,
    cpus: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 2 ** 30),
    node: process.versions.node,
  };
}
