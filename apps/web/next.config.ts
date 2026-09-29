import path from "node:path";
import type { NextConfig } from "next";

const root = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source.
  transpilePackages: ["@ledger/claims", "@ledger/detect", "@ledger/submission"],
  // Report export drives the local Chromium, so it stays a plain Node dependency.
  serverExternalPackages: ["playwright-core"],
  poweredByHeader: false,
  devIndicators: false,
  // No generated AGENTS.md or CLAUDE.md in the app folder.
  agentRules: false,
  outputFileTracingRoot: root,
  turbopack: { root },
  images: { unoptimized: true },
};

export default nextConfig;
