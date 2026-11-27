/**
 * The rules and tools around the main paths (plan sections 2, 4 and 9):
 * locked other ending, the presenter drawer (open, day switch, forced winner,
 * reset, jump to any screen), the player (language switch, subtitles, natural
 * playback with auto-advance, next shot), the share card guard, and the studio.
 * Runs at both sizes.
 */
import type { Choice, Lang } from "../src/content/schema";
import { SCREEN_JUMPS } from "../src/state/presets";
import { readState, seedState, viewerAt } from "./state";
import { closeDrawer, drawer, expect, expectPath, facts, other, playToEnd, screen, test, visible } from "./flows/fixtures";

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

const SERIES_IDS = ["series1", "series2"] as const;
const LANG_FOR: Record<string, Lang> = { series1: "hi", series2: "en" };

for (const seriesId of SERIES_IDS) {
  const lang = LANG_FOR[seriesId];

  test(`day 1: the other ending stays locked until your own ending is finished · ${seriesId}`, async ({ page, snap }) => {
    const f = facts(seriesId);
    const vote: Choice = "A";
    await seedState(page, { viewer: viewerAt(seriesId, "voted", vote, { language: lang }) });
    await page.goto(`/series/${seriesId}`);
    const series = await screen(page, "series");
    await expect(series.locator('[data-branch="A"] .uw-chip')).toHaveText("Your ending");
    await expect(series.locator('[data-branch="B"]')).toContainText("finish your own ending first");
    await page.goto(`/watch/${seriesId}/${f.branch[other(vote)][0]}`);
    const stage = page.locator("[data-player-stage]");
    await expect(stage).toHaveAttribute("data-state", "locked");
    await snap("other-ending-locked");
    // The ending screen of an unfinished ending sends the viewer on.
    await page.goto(`/series/${seriesId}/ending/${vote}`);
    await page.waitForURL((url) => !url.pathname.endsWith(`/ending/${vote}`));
    // The ballot cannot be cast twice.
    await page.goto(`/series/${seriesId}/ballot`);
    const b = await screen(page, "ballot");
    await expect(b).toContainText("Your ballot is in");
    await expect(page.getByRole("button", { name: /Cast my ballot/ })).toHaveCount(0);
  });

  test(`day 1: after your own ending the other one opens · ${seriesId}`, async ({ page }) => {
    const f = facts(seriesId);
    await seedState(page, { viewer: viewerAt(seriesId, "finished-own", "B", { language: lang }) });
    await page.goto(`/watch/${seriesId}/${f.branch.A[0]}`);
    await expect(page.locator("[data-player-stage]")).toHaveAttribute("data-state", /^(starting|needs-tap|playing|paused)$/);
  });

  test(`presenter: forcing the winner changes the official ending · ${seriesId}`, async ({ page, snap }) => {
    const f = facts(seriesId);
    const forced = f.losing;
    await seedState(page, { viewer: viewerAt(seriesId, "at-question", "A", { language: lang }) });
    await page.goto(`/series/${seriesId}/result?demo=1`);
    const d = await drawer(page);
    await d.getByRole("group", { name: "Demo clock" }).getByRole("button", { name: "Day 2" }).click();
    await d.getByRole("group", { name: "Winning ending" }).getByRole("button", { name: `${forced} wins` }).click();
    await snap("drawer-forced-winner");
    await closeDrawer(page);
    expect((await readState(page)).demo).toMatchObject({ day: 2, winnerOverride: forced });
    await page.goto(`/series/${seriesId}/result`);
    const r = await screen(page, "result");
    await expect(r.locator(".uw-verdict").first()).toContainText(f.series.choices[forced].label[lang]);
    const row = await r.locator(".uw-tally-row").first().innerText();
    const [a, b] = (row.match(/\d+/g) ?? []).map(Number);
    expect(forced === "A" ? a > b : b > a, `split "${row}" agrees with the forced winner ${forced}`).toBe(true);
    await snap("result-forced");
    await page.goto(`/series/${seriesId}`);
    const official = (await screen(page, "series")).locator(".flow-endings");
    await expect(official.locator(`[data-branch="${forced}"] .uw-chip`)).toHaveText("Official");
    await expect(official.locator(`[data-branch="${other(forced)}"] .uw-chip`)).toHaveText("Expired");
  });

  test(`presenter: jump to every screen · ${seriesId}`, async ({ page, snap }) => {
    test.setTimeout(120_000);
    const f = facts(seriesId);
    await seedState(page, { viewer: viewerAt(seriesId, "new", "A", { language: lang }) });
    // Welcome last: it un-sees the welcome, which then gates every other screen.
    const jumps = [...SCREEN_JUMPS.filter((j) => j.id !== "welcome"), ...SCREEN_JUMPS.filter((j) => j.id === "welcome")];
    const failures: string[] = [];
    for (const jump of jumps) {
      await page.goto("/my-choices?demo=1");
      const d = await drawer(page);
      await d.getByRole("combobox", { name: "Series" }).selectOption(seriesId);
      await d.getByRole("combobox", { name: "Jump to a screen" }).selectOption(jump.id);
      await d.getByRole("button", { name: "Open screen" }).click();
      const want = jump.href(f.series, "A");
      try {
        // 20 s: under the full parallel run the dev server has taken 10.7 s to serve /studio (26 Nov run 1).
        await expectPath(page, want, 20_000);
        if (jump.id === "player") await expect(page.locator("[data-player-stage]")).toHaveAttribute("data-state", /^(starting|needs-tap|playing|paused)$/);
        else if (jump.id === "studio") await expect(page.getByRole("navigation", { name: "Stages" })).toBeVisible();
        else await screen(page, jump.id);
        // Still there a moment later (a screen that cannot be shown redirects away).
        await page.waitForTimeout(400);
        expect(new URL(page.url()).pathname).toBe(want);
        await snap(`jump-${jump.id}`);
      } catch (error) {
        failures.push(`${jump.label}: wanted ${want}, at ${new URL(page.url()).pathname} (${(error as Error).message.split("\n")[0]})`);
      }
    }
    expect(failures, "screens the drawer could not open").toEqual([]);
  });
}

test("presenter: the drawer opens with ?demo=1, Shift + D and a long press on the wordmark", async ({ page }) => {
  await seedState(page, { viewer: viewerAt("series1", "new") });
  const aside = page.getByRole("complementary", { name: "Presenter controls" });
  await page.goto("/?demo=1");
  await expect(aside).toBeVisible();
  await closeDrawer(page);
  await page.keyboard.press("Shift+D");
  await expect(aside).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(aside).toBeHidden();
  const mark = visible(page.locator(".uw-wordmark"));
  const box = await mark.boundingBox();
  if (!box) throw new Error("no wordmark on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect(aside).toBeVisible();
});

test("presenter: last hour, then reset clears history and the clock", async ({ page, snap }) => {
  await seedState(page, { viewer: viewerAt("series1", "seen-both", "B", { language: "en" }), demo: { day: 1 } });
  await page.goto("/?demo=1");
  const d = await drawer(page);
  await d.getByRole("group", { name: "Demo clock" }).getByRole("button", { name: "Last hour" }).click();
  await expect(page.locator('main[data-screen="home"]').getByTestId("day-status")).toContainText("Last hour · closes in");
  await d.getByRole("group", { name: "Demo clock" }).getByRole("button", { name: "Day 2" }).click();
  await d.getByRole("group", { name: "Winning ending" }).getByRole("button", { name: "B wins" }).click();
  expect((await readState(page)).demo).toMatchObject({ day: 2, winnerOverride: "B" });
  await d.getByRole("button", { name: "Reset watch history and clock" }).click();
  await expectPath(page, "/");
  await expect(page.getByText("Watch history cleared. Back to day 1.")).toBeVisible();
  await snap("after-reset");
  const state = await readState(page);
  expect(state.demo).toMatchObject({ day: 1, winnerOverride: null });
  expect(state.viewer).toMatchObject({ welcomeSeen: true, language: "en" });
  for (const progress of Object.values(state.viewer?.series ?? {})) {
    expect(progress.ballot).toBeNull();
    expect(Object.values(progress.episodes).filter((e) => e.completed)).toEqual([]);
  }
  await expect(page.locator('main[data-screen="home"]').getByTestId("day-status")).toHaveText("Day 1 · both endings open");
});

test("player: language switch keeps the shot, subtitles toggle, and the episode plays to its end and advances by itself", async ({ page, snap }) => {
  test.setTimeout(90_000);
  const f = facts("series1");
  const ep = f.series.episodes[0];
  const videoMs = () => page.evaluate(() => document.querySelector<HTMLVideoElement>("[data-player-stage] video")!.currentTime * 1000);
  /** Index of the shot that holds `ms` in one language's cut. */
  const shotIn = (lang: Lang, ms: number) => ep.shots.findLastIndex((shot) => shot.timing[lang].startMs <= ms);
  await seedState(page, { viewer: viewerAt("series1", "new", "A", { language: "hi" }) });
  await page.goto(`/watch/series1/${ep.id}`);
  const stage = page.locator(`[data-player-stage][data-playable="${ep.id}"]`);
  await expect.poll(async () => stage.getAttribute("data-state"), { timeout: 20_000 }).toMatch(/^(needs-tap|playing)$/);
  if ((await stage.getAttribute("data-state")) === "needs-tap") await stage.getByRole("button", { name: "Play with sound" }).click();
  await expect(stage).toHaveAttribute("data-state", "playing");
  await expect(stage.locator(".uw-sub")).toBeVisible({ timeout: 10_000 });
  await snap("playing-hi");

  // Pause first: real shots are about two seconds long, so a playing film
  // would cross into the next shot while the test reads the clock.
  await stage.getByRole("button", { name: "Pause" }).click();
  await expect(stage).toHaveAttribute("data-state", "paused");
  const from = shotIn("hi", await videoMs());
  const target = from + 2;
  expect(target, `${ep.id} has a shot two after shot ${from + 1}`).toBeLessThan(ep.shots.length);

  // Two "next shot" taps: two shots on, at the start of that shot.
  await stage.getByRole("button", { name: "Next shot" }).click();
  await stage.getByRole("button", { name: "Next shot" }).click();
  const shot = ep.shots[target].timing;
  await expect.poll(videoMs, { timeout: 10_000 }).toBeGreaterThanOrEqual(shot.hi.startMs - 50);
  expect(shotIn("hi", await videoMs()), `two taps from shot ${from + 1} land in shot ${target + 1}`).toBe(target);

  // Switch to English: same shot, not the same second (the start of that shot in the English cut). It stays paused.
  await page.getByRole("group", { name: "Audio" }).getByRole("button", { name: "English" }).click();
  await expect(stage).toHaveAttribute("data-lang", "en");
  await expect(page.locator("[data-player-stage] video")).toHaveAttribute("src", ep.video.en);
  await expect
    .poll(async () => Math.abs((await videoMs()) - shot.en.startMs), { timeout: 10_000, message: `English cut at the start of shot ${target + 1} (${shot.en.startMs} ms)` })
    .toBeLessThanOrEqual(50);
  expect(shotIn("en", await videoMs()), `after the switch the English cut is in shot ${target + 1} (${shot.en.startMs}-${shot.en.endMs} ms)`).toBe(target);
  await expect(stage).toHaveAttribute("data-state", "paused");
  expect((await readState(page)).viewer?.language).toBe("en");

  // Subtitles off hides them; on brings them back once it plays on.
  await page.getByRole("group", { name: "Subtitles" }).getByRole("button", { name: "Off" }).click();
  await expect(stage.locator(".uw-sub")).toHaveCount(0);
  await snap("subtitles-off");
  await page.getByRole("group", { name: "Subtitles" }).getByRole("button", { name: "On" }).click();
  await stage.getByRole("button", { name: "Play" }).click();
  await expect(stage).toHaveAttribute("data-state", "playing");
  await expect(stage.locator(".uw-sub")).toBeVisible({ timeout: 10_000 });

  // Play out to the real "ended" event (from just before the end: the episode
  // is two minutes long). The player moves on to episode 2 on its own.
  await playToEnd(page, ep.id, { mode: "seek" });
  await expectPath(page, `/watch/series1/${f.shared[1]}`);
  await expect(page.locator(`[data-player-stage][data-playable="${f.shared[1]}"]`)).toHaveAttribute("data-state", /^(starting|needs-tap|playing)$/);
  expect((await readState(page)).viewer?.series.series1.episodes[ep.id]?.completed).toBe(true);
});

test("player: pressing next shot past the last shot finishes the episode", async ({ page }) => {
  const f = facts("series2");
  await seedState(page, { viewer: viewerAt("series2", "new", "A", { language: "en" }) });
  await page.goto(`/watch/series2/${f.shared[0]}`);
  await playToEnd(page, f.shared[0], { mode: "next-shot", shots: f.series.episodes[0].shots.length, lang: "en" });
  await expectPath(page, `/watch/series2/${f.shared[1]}`);
});

test("share card needs a ballot", async ({ page }) => {
  await seedState(page, { viewer: viewerAt("series1", "at-question") });
  await page.goto("/series/series1/share");
  await page.waitForURL((url) => !url.pathname.endsWith("/share"));
  expect(new URL(page.url()).pathname).not.toBe("/series/series1/share");
});

test("studio: open to first-time visitors, the process stage by stage, read-only", async ({ page, snap }) => {
  await page.goto("/studio");
  await page.waitForTimeout(800);
  expect(new URL(page.url()).pathname).toBe("/studio");
  const stages = page.getByRole("navigation", { name: "Stages" });
  await expect(stages).toBeVisible();
  const links = stages.getByRole("link");
  expect(await links.count()).toBeGreaterThan(2);
  const sections = page.locator("main section[aria-labelledby]");
  expect(await sections.count()).toBeGreaterThan(2);
  await expect(page.locator("main input, main textarea, main select")).toHaveCount(0);
  await snap("studio");
  await links.nth(1).click();
  await snap("studio-stage-2");
});

test("series page: the audio language switch changes the story text", async ({ page }) => {
  const s = facts("series2").series;
  await seedState(page, { viewer: viewerAt("series2", "new", "A", { language: "hi" }) });
  await page.goto("/series/series2");
  const sp = await screen(page, "series");
  await expect(sp.locator("h1")).toContainText(s.title.hi);
  await sp.getByRole("group", { name: "Audio language" }).getByRole("button", { name: "English" }).click();
  await expect(sp.locator("h1")).toContainText(s.title.en);
  expect((await readState(page)).viewer?.language).toBe("en");
});
