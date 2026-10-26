import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One runner for every TypeScript unit test. The packages run as plain Node modules.
// The web tests resolve "@/" like the Next.js app does and render components on the server.
// The end-to-end test needs a running server, so it has its own config, vitest.e2e.config.ts.

const web = fileURLToPath(new URL("./apps/web/src", import.meta.url));
const serverOnly = fileURLToPath(new URL("./apps/web/test/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "packages",
          include: ["packages/*/test/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
      {
        resolve: { alias: { "@": web, "server-only": serverOnly } },
        test: {
          name: "web",
          include: ["apps/web/test/**/*.test.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: [
        "packages/*/src/**/*.ts",
        "apps/web/src/lib/format.ts",
        "apps/web/src/lib/scale.ts",
        "apps/web/src/lib/brand.ts",
        "apps/web/src/lib/data.ts",
        "apps/web/src/lib/env.ts",
        "apps/web/src/lib/verdict-request.ts",
        "apps/web/src/components/quantity.tsx",
        "apps/web/src/components/finding-text.tsx",
        "apps/web/src/components/ledger/status-mark.tsx",
        "apps/web/src/components/ledger/gap-track.tsx",
      ],
      exclude: ["packages/*/src/**/cli.ts", "packages/*/src/**/types.ts", "packages/claims/src/model.ts"],
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
});
