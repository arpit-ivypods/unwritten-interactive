/**
 * Fixtures and helpers for the flow tests (P7 test engineer).
 *
 * - Sizes: the "phone" project (Pixel 7 emulation: touch, mobile) is resized to
 *   390x844; "desktop" runs at 1440x900. Plan 7.4 and the P7 brief.
 * - Screenshots: `snap("name")` writes e2e/artifacts/<project>/<test>/NN-name.png.
 *   A failing test also gets FAILED.png there, and errors.txt lists every
 *   console error and uncaught page error seen during the test.
 * - An uncaught page error (pageerror) fails the test. Console errors are only
 *   recorded (a 404 on a placeholder file would be one, and is reported).
 *
 * The walk itself is in ../flow-*.spec.ts. What counts as a pass is in
 * .claude/skills/flow-testing/SKILL.md.
 */
import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import type { Locator, Page, TestInfo } from "@playwright/test";
import type { Choice, Lang, Series } from "../../src/content/schema";
import { loadSeries } from "../state";

export { expect };

export const PHONE = { width: 390, height: 844 } as const;
export const DESKTOP = { width: 1440, height: 900 } as const;
export const ARTIFACTS = path.resolve(import.meta.dirname, "../artifacts");

const SETTLE_MS = 900;

export const SERIES_IDS = ["series1", "series2"] as const;
export const LANGS: Lang[] = ["hi", "en"];

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export function artifactDir(testInfo: TestInfo): string {
  return path.join(ARTIFACTS, testInfo.project.name, slug(testInfo.title));
}

interface Fixtures {
  /** Save a screenshot of the viewport into this test's artifact folder. */
  snap: (name: string) => Promise<void>;
  /** Console errors and page errors seen so far. */
  pageErrors: string[];
  sized: void;
}

export const test = base.extend<Fixtures>({
  sized: [
    async ({ page }, use, testInfo) => {
      await page.setViewportSize(testInfo.project.name === "phone" ? PHONE : DESKTOP);
      await use();
    },
    { auto: true },
  ],
  pageErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console.error: ${message.text()} (${message.location().url})`);
      });
      await use(errors);
      const dir = artifactDir(testInfo);
      if (errors.length > 0) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "errors.txt"), errors.join("\n") + "\n");
        testInfo.annotations.push({ type: "console", description: `${errors.length} console/page errors, see ${path.relative(process.cwd(), dir)}/errors.txt` });
      }
      const uncaught = errors.filter((e) => e.startsWith("pageerror"));
      expect(uncaught, "uncaught errors in the page").toEqual([]);
    },
    { auto: true },
  ],
  snap: [
    async ({ page }, use, testInfo) => {
      const dir = artifactDir(testInfo);
      fs.rmSync(dir, { recursive: true, force: true });
      let n = 0;
      await use(async (name: string) => {
        n += 1;
        fs.mkdirSync(dir, { recursive: true });
        // Let entrance motion (GSAP rise, about 0.4-0.9 s) settle so the picture is the resting screen.
        await page.waitForTimeout(SETTLE_MS);
        await page.screenshot({ path: path.join(dir, `${String(n).padStart(2, "0")}-${slug(name)}.png`) });
      });
      if (testInfo.status !== testInfo.expectedStatus) {
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, "FAILED.png") }).catch(() => undefined);
        fs.writeFileSync(path.join(dir, "FAILED.txt"), `${testInfo.error?.message ?? "failed"}\n\nURL: ${page.url()}\n`);
      }
    },
    { auto: true },
  ],
});

// ---------------------------------------------------------------------------
// Content facts the tests check against (read from the manifests, never typed in)
// ---------------------------------------------------------------------------

export interface SeriesFacts {
  series: Series;
  shared: string[];
  branch: Record<Choice, string[]>;
  glimpse: Record<Choice, string>;
  /** Official by seeded tallies (tie goes to A), with no forced winner. */
  official: Choice;
  losing: Choice;
}

export function facts(seriesId: string): SeriesFacts {
  const series = loadSeries(seriesId);
  const ids = (kind: string) => series.episodes.filter((e) => e.kind === kind).map((e) => e.id);
  const official: Choice = series.seededTallies.A >= series.seededTallies.B ? "A" : "B";
  return {
    series,
    shared: ids("shared"),
    branch: { A: ids("branchA"), B: ids("branchB") },
    glimpse: { A: series.glimpses.A.id, B: series.glimpses.B.id },
    official,
    losing: official === "A" ? "B" : "A",
  };
}

export const other = (choice: Choice): Choice => (choice === "A" ? "B" : "A");

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

/** The screen root once the stores are loaded (ScreenLoading shares the data-screen id). */
export async function screen(page: Page, id: string): Promise<Locator> {
  const root = page.locator(`main[data-screen="${id}"]`);
  await expect(root).toBeVisible();
  await expect(root.locator('[data-state="loading"]')).toHaveCount(0);
  return root;
}

export async function expectPath(page: Page, pathname: string, timeout = 15_000): Promise<void> {
  await page.waitForURL((url) => url.pathname === pathname, { timeout });
}

/** A link or button that is actually on screen at this size (desktop nav and phone dock both exist in the DOM). */
export function visible(locator: Locator): Locator {
  return locator.filter({ visible: true }).first();
}

/**
 * Go to My choices the way a viewer would at this size: the nav link or dock
 * if one is on screen; otherwise (phone, on a screen with a sheet and no dock)
 * the wordmark home first, then the dock.
 */
export async function openMyChoices(page: Page): Promise<void> {
  const link = page.getByRole("link", { name: "My choices", exact: true }).filter({ visible: true });
  if ((await link.count()) === 0) {
    await page.locator("a:has(.uw-wordmark), .uw-wordmark a, a.uw-wordmark").filter({ visible: true }).first().click();
    await expectPath(page, "/");
  }
  await link.first().click();
  await expectPath(page, "/my-choices");
}

/** First-time visitor: "/" sends them to the welcome; pick the language and continue to home. */
export async function doWelcome(page: Page, lang: Lang, snap?: (name: string) => Promise<void>): Promise<void> {
  await page.goto("/");
  await expectPath(page, "/welcome");
  const welcome = page.locator('main[data-screen="welcome"]');
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText("From day 2, only the ending the audience chose remains");
  const tiles = welcome.getByRole("group", { name: "Audio language" });
  const tile = tiles.getByRole("button", { name: lang === "hi" ? /^हिंदी/ : /^English/ });
  await tile.click();
  await expect(tile).toHaveAttribute("aria-pressed", "true");
  const go = welcome.getByRole("button", { name: lang === "hi" ? "Continue in Hindi" : "Continue in English" });
  await expect(go).toBeVisible();
  if (snap) await snap(`welcome-${lang}`);
  await go.click();
  await expectPath(page, "/");
}

/** Text that must be marked lang="hi" when the audio is Hinglish. */
export async function expectHindiMarked(scope: Locator, text: string): Promise<void> {
  await expect(scope.locator('[lang="hi"]', { hasText: text }).first()).toBeVisible();
}

export type PlayMode = "seek" | "next-shot" | "natural";

/**
 * Play one episode or glimpse to its end and wait until the player has moved on.
 * seek: jump the <video> to 0.3 s before the end and let the real "ended" event fire.
 * next-shot: pause, then press "Next shot" until the last press (the one past
 *   the last shot) finishes it; at most `shots` presses. Paused, the film
 *   cannot cross a shot by itself between presses (real shots are ~2 s).
 * natural: let it play.
 */
export async function playToEnd(page: Page, playableId: string, opts: { lang?: Lang; mode?: PlayMode; shots?: number } = {}): Promise<void> {
  const mode = opts.mode ?? "seek";
  const stage = page.locator(`[data-player-stage][data-playable="${playableId}"]`);
  await expect(stage, `player for ${playableId}`).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => stage.getAttribute("data-state"), { timeout: 25_000, message: `${playableId}: player never reached playing or needs-tap` })
    .toMatch(/^(needs-tap|playing|failed|locked|expired)$/);
  const state = await stage.getAttribute("data-state");
  if (state === "failed" || state === "locked" || state === "expired") throw new Error(`${playableId}: player is "${state}"`);
  if (state === "needs-tap") {
    await stage.getByRole("button", { name: "Play with sound" }).click();
    await expect(stage).toHaveAttribute("data-state", "playing");
  }
  if (opts.lang) await expect(stage).toHaveAttribute("data-lang", opts.lang);

  if (mode === "seek") {
    await page.evaluate((id) => {
      const video = document.querySelector<HTMLVideoElement>(`[data-player-stage][data-playable="${id}"] video`);
      if (!video) throw new Error(`no video for ${id}`);
      video.currentTime = Math.max(0, video.duration - 0.3);
      if (video.paused) void video.play();
    }, playableId);
  } else if (mode === "next-shot") {
    await stage.getByRole("button", { name: "Pause" }).click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    const next = stage.getByRole("button", { name: "Next shot" });
    const limit = opts.shots ?? 5;
    // The shot buttons go in the same render as the press that finishes it
    // (data-state follows a moment later), so they are what the loop watches.
    let presses = 0;
    while (presses < limit && (await next.count()) > 0) {
      await next.click();
      presses += 1;
    }
    await expect(next, `${playableId}: ${presses} presses of "Next shot" did not finish it`).toHaveCount(0);
  }
  await page.waitForURL((url) => !url.pathname.endsWith(`/${playableId}`), { timeout: mode === "natural" ? 45_000 : 20_000 });
}

export async function playAll(page: Page, ids: string[], lang?: Lang, mode: PlayMode = "seek"): Promise<void> {
  for (const id of ids) await playToEnd(page, id, { lang, mode });
}

/** The presenter drawer. Opens it with Shift + D if it is not open. */
export async function drawer(page: Page): Promise<Locator> {
  const aside = page.getByRole("complementary", { name: "Presenter controls" });
  // ?demo=1 opens it by itself once the page has mounted; pressing Shift + D as well would toggle it shut.
  if (/[?&]demo=1/.test(page.url())) {
    await expect(aside).toBeVisible();
    return aside;
  }
  if (!(await aside.isVisible())) await page.keyboard.press("Shift+D");
  await expect(aside).toBeVisible();
  return aside;
}

export async function closeDrawer(page: Page): Promise<void> {
  const aside = page.getByRole("complementary", { name: "Presenter controls" });
  await aside.getByRole("button", { name: "Close controls" }).click();
  await expect(aside).toBeHidden();
}

/** PNG width and height from the IHDR chunk. */
export function pngSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 1, 4) !== "PNG") throw new Error(`${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
