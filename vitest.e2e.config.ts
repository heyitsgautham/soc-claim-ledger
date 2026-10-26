import { defineConfig } from "vitest/config";

// The offline end-to-end test drives a running production build in Chromium.
// Start it first with pnpm build && pnpm start. One browser, so the tests run in order.

export default defineConfig({
  test: {
    name: "e2e",
    include: ["apps/web/e2e/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
