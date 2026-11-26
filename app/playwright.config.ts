import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: `pnpm test:e2e` (against `pnpm dev`, reusing a dev server
 * that is already running on port 3210) or `pnpm test:e2e:prod` (builds, then
 * serves the production build on port 3211).
 *
 * Two projects: "phone" (Pixel 7 emulation) and "desktop" (1440x900).
 *
 * Browser: Playwright's own Chromium, which is pinned to the Playwright
 * version (`pnpm exec playwright install chromium`). It played the H.264/AAC
 * episode files on this Mac when checked on 26 Nov 2026. To run in the
 * installed Google Chrome instead: E2E_CHANNEL=chrome pnpm test:e2e
 */
const PROD = Boolean(process.env.E2E_PROD);
const PORT = PROD ? 3211 : 3210;
const BASE_URL = `http://localhost:${PORT}`;
const CHANNEL = process.env.E2E_CHANNEL || undefined;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    channel: CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], channel: CHANNEL } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: CHANNEL, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: PROD ? `pnpm build && pnpm exec next start --port ${PORT}` : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
