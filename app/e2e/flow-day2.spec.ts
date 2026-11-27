/**
 * Day 2, plan sections 2, 4 and 9, for both series, in both languages, at both sizes.
 *
 * 1. The late viewer (first visit on day 2). The day is switched with the
 *    presenter drawer, as a presenter would: welcome -> drawer "Day 2" -> home
 *    -> series page -> shared episodes -> question (voting closed) -> both
 *    glimpses -> result -> official branch -> official ending. No ballot; the
 *    losing ending is expired.
 * 2. A day-1 viewer arriving on day 2 (set through the store): keeps the
 *    losing-branch episodes they finished on day 1, loses the ones they did not.
 */
import type { Choice, Lang } from "../src/content/schema";
import { readState, seedState, viewerAt } from "./state";
import { closeDrawer, doWelcome, drawer, expect, expectPath, facts, other, playAll, playToEnd, screen, test, visible } from "./flows/fixtures";

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

const SERIES_IDS = ["series1", "series2"] as const;
const LANGS: Lang[] = ["hi", "en"];

for (const seriesId of SERIES_IDS) {
  for (const lang of LANGS) {
    test(`day 2 late viewer path · ${seriesId} · ${lang}`, async ({ page, snap }) => {
      test.setTimeout(180_000);
      const f = facts(seriesId);
      const s = f.series;
      const official = f.official;

      await test.step("welcome, then the presenter switches to day 2 in the drawer", async () => {
        await doWelcome(page, lang);
        await screen(page, "home");
        const d = await drawer(page);
        const clock = d.getByRole("group", { name: "Demo clock" });
        await clock.getByRole("button", { name: "Day 2" }).click();
        await expect(clock.getByRole("button", { name: "Day 2" })).toHaveAttribute("aria-pressed", "true");
        await snap("drawer-day-2");
        await closeDrawer(page);
        expect((await readState(page)).demo).toMatchObject({ day: 2, winnerOverride: null });
      });

      await test.step("home on day 2", async () => {
        const home = await screen(page, "home");
        await expect(home.getByTestId("day-status")).toHaveText("Day 2 · official ending only");
        await expect(home.locator('[data-part="hero"]')).toContainText("voting has closed");
        if (seriesId !== "series1") await home.getByRole("group", { name: "Series on the stage" }).getByRole("button", { name: s.title[lang] }).click();
        await expect(home.locator('[data-part="hero"]')).toContainText(s.title[lang]);
        await snap("home-day-2");
        await home.locator('[data-part="hero"]').getByRole("link", { name: "Synopsis and cast" }).click();
        await expectPath(page, `/series/${seriesId}`);
      });

      await test.step("series page on day 2: the losing ending is not playable", async () => {
        const sp = await screen(page, "series");
        await expect(sp.getByTestId("day-status")).toHaveText("Day 2 · official ending only");
        await expect(sp.getByRole("list", { name: `Ending ${f.losing}` }).locator("li.is-locked")).toHaveCount(1);
        await snap("series-day-2");
        await sp.locator('[data-part="hero"]').getByRole("link", { name: "Play episode 1" }).click();
      });

      await test.step("shared episodes to the question", async () => {
        await expectPath(page, `/watch/${seriesId}/${f.shared[0]}`);
        await playAll(page, f.shared, lang);
        await expectPath(page, `/series/${seriesId}/question`);
      });

      await test.step("question on day 2: voting closed, no ballot, glimpses offered", async () => {
        const q = await screen(page, "question");
        await expect(q.locator("h1")).toContainText(s.question[lang]);
        await expect(q).toContainText("Day 2 · voting has closed");
        await expect(q).toContainText("there is no ballot");
        await expect(q.getByRole("link", { name: "Go straight to the ballot" })).toHaveCount(0);
        await snap("question-day-2");
        await visible(q.getByRole("link", { name: "See both glimpses" })).click();
        await expectPath(page, `/series/${seriesId}/glimpses`);
      });

      await test.step("late viewer watches both glimpses", async () => {
        let g = await screen(page, "glimpses");
        await expect(g).toContainText("What you missed");
        for (const c of ["A", "B"] as Choice[]) {
          await g.locator(`a[href="/watch/${seriesId}/${f.glimpse[c]}"]`).click();
          await playAll(page, [f.glimpse[c]], lang);
          await expectPath(page, `/series/${seriesId}/glimpses`);
          g = await screen(page, "glimpses");
          await expect(g.locator(`a[href="/watch/${seriesId}/${f.glimpse[c]}"]`)).toContainText(/· watched/);
        }
        await snap("glimpses-day-2");
        await g.getByRole("link", { name: "See what the audience chose" }).click();
        await expectPath(page, `/series/${seriesId}/result`);
      });

      await test.step(`result: the audience chose ${official}`, async () => {
        const r = await screen(page, "result");
        await expect(r).toContainText("The audience chose");
        await expect(r.locator(".uw-verdict").first()).toContainText(s.choices[official].label[lang]);
        await expect(r).toContainText("Simulated demo ballots");
        await expect(r.getByRole("link", { name: "See both glimpses" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Cast my ballot/ })).toHaveCount(0);
        await snap("result");
      });

      await test.step("no ballot for a late viewer", async () => {
        await page.goto(`/series/${seriesId}/ballot`);
        const b = await screen(page, "ballot");
        await expect(b).toContainText("Voting closed");
        for (const option of await b.getByRole("group", { name: "Choices" }).getByRole("button").all()) await expect(option).toBeDisabled();
        await expect(page.getByRole("button", { name: /Cast my ballot/ })).toHaveCount(0);
        expect((await readState(page)).viewer?.series[seriesId].ballot).toBeNull();
        await snap("ballot-closed");
      });

      await test.step(`official branch ${official} ends after its first episode`, async () => {
        await page.goto(`/series/${seriesId}/result`);
        const r = await screen(page, "result");
        await r.getByRole("link", { name: "Watch the official ending" }).click();
        const episodeId = f.branch[official][0];
        await expectPath(page, `/watch/${seriesId}/${episodeId}`);
        await playToEnd(page, episodeId, { lang });
        await expectPath(page, `/series/${seriesId}/ending/${official}`);
        const e = await screen(page, "ending");
        await expect(e).toContainText("This is how the story ends.");
        await expect(e.locator('[data-part="split"]')).toContainText("How the audience voted");
        await expect(e.getByRole("link", { name: "Watch the other ending" })).toHaveCount(0);
        await snap("ending-official");
      });

      await test.step("the losing ending is expired in the player and in My choices", async () => {
        await page.goto(`/watch/${seriesId}/${f.branch[f.losing][0]}`);
        const stage = page.locator(`[data-player-stage][data-playable="${f.branch[f.losing][0]}"]`);
        await expect(stage).toHaveAttribute("data-state", "expired");
        await expect(stage.getByRole("link", { name: "Official ending" })).toBeVisible();
        await snap("player-expired");
        await page.goto("/my-choices");
        const m = await screen(page, "my-choices");
        const h = m.locator(`[data-series="${seriesId}"]`);
        await expect(h.locator('[data-part="you-chose"]')).toContainText("You did not vote. Voting closed when day 1 ended.");
        await expect(h.locator('[data-part="what-won"]')).toContainText(s.choices[official].label[lang]);
        await expect(h.locator(`[data-branch="${f.losing}"]`)).toHaveAttribute("data-availability", "expired");
        await expect(h.locator(`[data-branch="${official}"]`)).toHaveAttribute("data-availability", "open");
        await snap("my-choices-day-2");
      });
    });

    test(`day 2: a day-1 voter keeps the losing ending they finished · ${seriesId} · ${lang}`, async ({ page, snap }) => {
      const f = facts(seriesId);
      const s = f.series;
      // Voted for the side that loses, finished it on day 1, never watched the official one.
      await seedState(page, { viewer: viewerAt(seriesId, "finished-own", f.losing, { language: lang }), demo: { day: 2 } });
      await page.goto(`/series/${seriesId}/ending/${f.losing}`);
      const e = await screen(page, "ending");
      await expect(e).toContainText("Not official · kept from day 1");
      await expect(e).toContainText("This ending lost the vote.");
      await expect(e.getByRole("link", { name: "Watch the other ending" })).toHaveCount(0);
      await snap("ending-kept");
      await page.goto(`/watch/${seriesId}/${f.branch[f.losing][0]}`);
      await expect(page.locator("[data-player-stage]")).toHaveAttribute("data-state", /^(starting|needs-tap|playing|paused)$/);
      await page.goto(`/series/${seriesId}/result`);
      const r = await screen(page, "result");
      await expect(r.locator(".uw-verdict").first()).toContainText(s.choices[f.official].label[lang]);
      await page.goto("/my-choices");
      const h = (await screen(page, "my-choices")).locator(`[data-series="${seriesId}"]`);
      await expect(h.locator(`[data-branch="${f.losing}"]`)).toHaveAttribute("data-availability", "open");
      await expect(h.locator('[data-part="what-won"]')).toContainText("not your side");
      await snap("my-choices-kept");
    });

    test(`day 2: a day-1 voter who did not finish the losing ending loses it · ${seriesId} · ${lang}`, async ({ page, snap }) => {
      const f = facts(seriesId);
      await seedState(page, { viewer: viewerAt(seriesId, "voted", f.losing, { language: lang }), demo: { day: 2 } });
      await page.goto(`/watch/${seriesId}/${f.branch[f.losing][0]}`);
      await expect(page.locator("[data-player-stage]")).toHaveAttribute("data-state", "expired");
      await snap("player-expired");
      await page.goto(`/series/${seriesId}/result`);
      const r = await screen(page, "result");
      await expect(r).toContainText("The audience chose");
      await r.locator(".uw-btn--primary").first().click();
      await expectPath(page, `/watch/${seriesId}/${f.branch[f.official][0]}`);
      await page.goto("/my-choices");
      const h = (await screen(page, "my-choices")).locator(`[data-series="${seriesId}"]`);
      await expect(h.locator('[data-part="you-chose"]')).toContainText(f.series.choices[f.losing].label[lang]);
      await expect(h.locator(`[data-branch="${f.losing}"]`)).toHaveAttribute("data-availability", /expired/);
      expect(other(f.losing)).toBe(f.official);
    });
  }
}
