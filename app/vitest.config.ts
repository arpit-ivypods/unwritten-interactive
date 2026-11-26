import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests: `pnpm test`. Files named *.test.ts or *.test.tsx next to the
 * code they test. The default environment is plain Node (the rules are pure);
 * a test that needs a DOM starts with the comment
 *   // @vitest-environment jsdom
 * End-to-end tests live in e2e/ and run with Playwright, not here.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    restoreMocks: true,
  },
});
