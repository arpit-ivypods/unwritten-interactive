/**
 * Three rules around the ballot and the presenter reset (contracts sections
 * 7 and 10a, plan section 9), at both sizes:
 *
 * - A presenter reset made while a player is open leaves no resume point: the
 *   player's last saves (on unmount, or every second from a player left open
 *   in another window) belong to the old epoch and are dropped.
 * - "Keep my ballot" is remembered: after a reload the screen shows the
 *   outcome, offers neither keep nor move, and no screen sends the viewer back.
 * - On day 2 the ballot page offers no move, and keep-or-move is not offered.
 */
import type { Locator, Page } from "@playwright/test";
import type { Choice, Lang } from "../src/content/schema";
import { readState, seedState, viewerAt } from "./state";
import { drawer, expect, expectPath, facts, openMyChoices, screen, test } from "./flows/fixtures";

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

const SERIES_IDS = ["series1", "series2"] as const;
const LANG_FOR: Record<string, Lang> = { series1: "hi", series2: "en" };

/** Open an episode and let it play until the player has saved a position past 1 s. */
async function playAWhile(page: Page, seriesId: string, episodeId: string): Promise<Locator> {
  await page.goto(`/watch/${seriesId}/${episodeId}`);
  const stage = page.locator(`[data-player-stage][data-playable="${episodeId}"]`);
  await expect.poll(async () => stage.getAttribute("data-state"), { timeout: 25_000 }).toMatch(/^(needs-tap|playing)$/);
  if ((await stage.getAttribute("data-state")) === "needs-tap") await stage.getByRole("button", { name: "Play with sound" }).click();
  await expect(stage).toHaveAttribute("data-state", "playing");
  await expect
    .poll(async () => (await readState(page)).viewer?.series[seriesId]?.episodes[episodeId]?.positionMs ?? 0, {
      timeout: 15_000,
      message: "the player saved a position (precondition: there is a resume point before the reset)",
    })
    .toBeGreaterThan(1000);
  expect((await readState(page)).viewer?.series[seriesId]?.lastPlayableId).toBe(episodeId);
  return stage;
}

/** No saved position, no last playable, nothing finished: nothing to resume. */
async function expectNoResumePoint(page: Page, seriesId: string): Promise<void> {
  const progress = (await readState(page)).viewer?.series[seriesId];
  if (progress) {
    expect(progress.lastPlayableId, "lastPlayableId after the reset").toBeNull();
    expect(Object.values(progress.episodes).filter((e) => e.positionMs > 0 || e.completed), "saved episode progress after the reset").toEqual([]);
    expect(progress.ballot).toBeNull();
  }
}

async function expectMyChoicesOffersNoResume(page: Page, seriesId: string): Promise<void> {
  await openMyChoices(page);
  const m = await screen(page, "my-choices");
  const resume = m.locator(`[data-series="${seriesId}"] [data-part="resume"]`);
  await expect(resume).toBeVisible();
  await expect(resume).not.toContainText("Resume");
  await expect(resume).not.toContainText("Continue");
}

test.describe("presenter reset with a player open", () => {
  test("reset from the drawer on the player page leaves no resume point", async ({ page, snap }) => {
    const f = facts("series1");
    const episodeId = f.shared[0];
    await seedState(page, { viewer: viewerAt("series1", "new", "A", { language: "en" }) });
    await playAWhile(page, "series1", episodeId);
    await snap("playing-before-reset");

    const d = await drawer(page);
    await d.getByRole("button", { name: "Reset watch history and clock" }).click();
    await expectPath(page, "/");
    await expect(page.getByText("Watch history cleared. Back to day 1.")).toBeVisible();
    // The player has unmounted and made its last save by now; give any late save time to land.
    await page.waitForTimeout(1500);
    await expectNoResumePoint(page, "series1");
    expect((await readState(page)).viewer).toMatchObject({ welcomeSeen: true, language: "en" });

    // Still nothing after a reload (what is stored, not only what is in memory).
    await page.reload();
    await screen(page, "home");
    await expectNoResumePoint(page, "series1");
    await expectMyChoicesOffersNoResume(page, "series1");
    await snap("my-choices-after-reset");
  });

  test("reset from a second window while the player keeps playing leaves no resume point", async ({ page, context }) => {
    test.setTimeout(75_000);
    const f = facts("series2");
    const episodeId = f.shared[0];
    await seedState(page, { viewer: viewerAt("series2", "new", "A", { language: "en" }) });
    const stage = await playAWhile(page, "series2", episodeId);

    // The presenter's window, same device (same localStorage).
    const presenter = await context.newPage();
    await presenter.goto("/my-choices?demo=1");
    const d = await drawer(presenter);
    await d.getByRole("button", { name: "Reset watch history and clock" }).click();
    await expectPath(presenter, "/");

    // The viewer's player is still open; whatever it does from here belongs to the old epoch.
    await expect(stage).toBeVisible();
    await page.waitForTimeout(3000);
    await expectNoResumePoint(presenter, "series2");
    await expectNoResumePoint(page, "series2");

    // Closing the player window (its unmount save) does not bring it back either.
    await page.close();
    await presenter.waitForTimeout(500);
    await expectNoResumePoint(presenter, "series2");
    await presenter.reload();
    await screen(presenter, "home");
    await expectMyChoicesOffersNoResume(presenter, "series2");
  });
});

for (const seriesId of SERIES_IDS) {
  const lang = LANG_FOR[seriesId];

  test(`keep my ballot is remembered · ${seriesId}`, async ({ page, snap }) => {
    const vote: Choice = "B";
    await seedState(page, { viewer: viewerAt(seriesId, "seen-both", vote, { language: lang }) });
    await page.goto(`/series/${seriesId}/keep-or-move`);
    const k = await screen(page, "keep-or-move");
    await k.getByRole("button", { name: `Keep my ballot on ${vote}` }).click();
    await expect(k.locator('[data-part="outcome"]')).toContainText("Ballot kept");
    expect((await readState(page)).viewer?.series[seriesId].ballot).toMatchObject({ choice: vote, moved: false, kept: true });

    // A later visit shows the outcome and offers neither keep nor move.
    await page.reload();
    const again = await screen(page, "keep-or-move");
    await expect(again.locator('[data-part="outcome"]')).toContainText("Ballot kept");
    await expect(again.locator('[data-part="outcome"]')).toHaveAttribute("data-outcome", "kept");
    await expect(again.getByRole("button", { name: /Keep my ballot|Move my ballot/ })).toHaveCount(0);
    await snap("keep-or-move-kept-after-reload");

    // Nothing sends the viewer back to keep-or-move.
    await page.goto(`/series/${seriesId}/ending/${vote}`);
    const e = await screen(page, "ending");
    await expect(e.getByRole("link", { name: "Keep or move my ballot" })).toHaveCount(0);
    await expect(e.locator('a[href$="/keep-or-move"]')).toHaveCount(0);

    await page.goto(`/series/${seriesId}/ballot`);
    const b = await screen(page, "ballot");
    await expect(b).toContainText("Your ballot is in");
    await expect(b).toContainText("You chose to keep your ballot here. It cannot move now.");
    await expect(b.locator('a[href$="/keep-or-move"]')).toHaveCount(0);

    await openMyChoices(page);
    const m = await screen(page, "my-choices");
    const h = m.locator(`[data-series="${seriesId}"]`);
    await expect(h.locator('[data-part="you-chose"]')).not.toContainText("moved once");
    await expect(h.locator('[data-part="resume"] a[href$="/keep-or-move"]')).toHaveCount(0);

    const state = (await readState(page)).viewer?.series[seriesId].ballot;
    expect(state).toMatchObject({ choice: vote, moved: false, kept: true });
  });

  test(`day 2: the ballot page offers no move · ${seriesId}`, async ({ page, snap }) => {
    const f = facts(seriesId);
    // A day-1 voter who saw both endings and made no decision: on day 1 they could move.
    const vote: Choice = f.losing;
    await seedState(page, { viewer: viewerAt(seriesId, "seen-both", vote, { language: lang }), demo: { day: 2 } });
    await page.goto(`/series/${seriesId}/ballot`);
    const b = await screen(page, "ballot");
    await expect(b).toContainText("Your ballot is in");
    await expect(b).toContainText("Voting closed when day 1 ended. Your ballot stays where it is.");
    await expect(b.getByRole("button", { name: /Move my ballot|Keep my ballot|Cast my ballot/ })).toHaveCount(0);
    await expect(b.getByRole("link", { name: /Keep or move|Move my ballot/ })).toHaveCount(0);
    await expect(page.locator('a[href$="/keep-or-move"]')).toHaveCount(0);
    await snap("ballot-day2-voter");

    // The keep-or-move screen itself does not offer a move on day 2 either.
    await page.goto(`/series/${seriesId}/keep-or-move`);
    await page.waitForTimeout(1200);
    await expect(page.getByRole("button", { name: /Move my ballot|Keep my ballot/ })).toHaveCount(0);

    const ballot = (await readState(page)).viewer?.series[seriesId].ballot;
    expect(ballot).toMatchObject({ choice: vote, moved: false });
  });
}
