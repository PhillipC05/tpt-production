import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    globalSetup: ["src/__tests__/globalSetup.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    testTimeout: 30_000,
    // SQLite doesn't support concurrent writes — run sequentially
    sequence: { concurrent: false },
  },
});
