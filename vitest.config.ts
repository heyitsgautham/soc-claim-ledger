import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// One runner for every TypeScript unit test. The packages run as plain Node modules.
// The repo project holds checks over the repository itself, such as .env.example, and the recording tools.
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
      {
        test: {
          name: "repo",
          include: ["scripts/**/*.test.ts", "recording/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      // Every module the tests can reach: the packages, and the web app's helpers, components and API routes.
      // The pages are server components that read the disk, and the end-to-end test covers them.
      include: ["packages/*/src/**/*.ts", "apps/web/src/lib/**", "apps/web/src/components/**", "apps/web/src/app/api/**", "apps/web/src/instrumentation.ts"],
      exclude: ["packages/*/src/**/cli.ts", "packages/*/src/**/types.ts", "packages/claims/src/model.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 92,
        functions: 90,
        branches: 77,
        statements: 92,
      },
    },
  },
});
