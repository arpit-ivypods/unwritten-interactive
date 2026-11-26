/**
 * Helpers for end-to-end tests: put the app into a known state before the page
 * loads, by writing the two localStorage keys the stores read.
 *
 *   await seedState(page, { viewer: viewerAt("series1", "at-question"), demo: { day: 2 } });
 *   await page.goto(routes.question("series1"));
 *
 * Import pure modules from src/ only (rules, presets, routes, storage keys).
 * Do not import "@/content" here: it bundles JSON, which Playwright's loader
 * does not do. Read manifests with `loadSeries` instead.
 */
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import type { Catalog, Choice, Series } from "../src/content/schema";
import { presetProgress } from "../src/state/presets";
import type { ViewerPresetId } from "../src/state/presets";
import { DEMO_STORAGE_KEY, STORAGE_VERSION, VIEWER_STORAGE_KEY } from "../src/state/storage";
import { DEFAULT_DEMO_STATE, DEFAULT_VIEWER_STATE } from "../src/state/types";
import type { DemoState, ViewerState } from "../src/state/types";

const MEDIA_DIR = path.resolve(import.meta.dirname, "../public/media");

export function loadCatalog(): Catalog {
  return JSON.parse(fs.readFileSync(path.join(MEDIA_DIR, "catalog.json"), "utf8")) as Catalog;
}

export function loadSeries(seriesId: string): Series {
  return JSON.parse(fs.readFileSync(path.join(MEDIA_DIR, seriesId, "series.json"), "utf8")) as Series;
}

/**
 * A viewer who has done the welcome and is in a known state for one series:
 * "new", "at-question", "voted", "finished-own" or "seen-both".
 */
export function viewerAt(seriesId: string, preset: ViewerPresetId, choice: Choice = "A", overrides: Partial<ViewerState> = {}): ViewerState {
  return {
    ...DEFAULT_VIEWER_STATE,
    welcomeSeen: true,
    series: { [seriesId]: presetProgress(loadSeries(seriesId), preset, choice, Date.now()) },
    ...overrides,
  };
}

export interface SeedState {
  /** Defaults to a first-time visitor (welcome not seen). */
  viewer?: Partial<ViewerState>;
  /** Defaults to day 1, no forced winner. */
  demo?: Partial<DemoState>;
}

/**
 * Seed localStorage before the app's scripts run. Call before `page.goto`.
 * It seeds once per browser context, so a reload inside the test keeps
 * whatever the app has saved since.
 */
export async function seedState(page: Page, state: SeedState = {}): Promise<void> {
  const viewer = { state: { ...DEFAULT_VIEWER_STATE, ...state.viewer }, version: STORAGE_VERSION };
  const demo = { state: { ...DEFAULT_DEMO_STATE, ...state.demo }, version: STORAGE_VERSION };
  await page.addInitScript(
    ([viewerKey, viewerJson, demoKey, demoJson]) => {
      if (window.localStorage.getItem("unwritten:e2e-seeded")) return;
      window.localStorage.setItem(viewerKey, viewerJson);
      window.localStorage.setItem(demoKey, demoJson);
      window.localStorage.setItem("unwritten:e2e-seeded", "1");
    },
    [VIEWER_STORAGE_KEY, JSON.stringify(viewer), DEMO_STORAGE_KEY, JSON.stringify(demo)] as const,
  );
}

/** What the app has saved, read back from the page. */
export async function readState(page: Page): Promise<{ viewer: ViewerState | null; demo: DemoState | null }> {
  return page.evaluate(
    ([viewerKey, demoKey]) => {
      const read = (key: string) => {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw).state : null;
      };
      return { viewer: read(viewerKey), demo: read(demoKey) };
    },
    [VIEWER_STORAGE_KEY, DEMO_STORAGE_KEY] as const,
  );
}
