/**
 * Day 1, the whole viewer path of plan section 4, for both series, in both
 * audio languages, at 390x844 (phone project) and 1440x900 (desktop project):
 *
 *   welcome -> home -> series page -> shared episodes -> question
 *   -> glimpses (hi: both watched; en: skipped, glimpses are optional)
 *   -> ballot -> own branch -> ending -> other ending -> keep or move
 *   (hi: move; en: keep) -> share card PNG -> my choices
 *
 * Starts as a first-time visitor with empty localStorage. Episodes are played
 * to the end by seeking to 0.3 s before the end and letting "ended" fire.
 */
import path from "node:path";
import type { Choice, Lang } from "../src/content/schema";
import { readState } from "./state";
import { artifactDir, doWelcome, expect, expectHindiMarked, expectPath, facts, openMyChoices, other, playAll, pngSize, screen, test, visible } from "./flows/fixtures";

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

const SERIES_IDS = ["series1", "series2"] as const;
const LANGS: Lang[] = ["hi", "en"];

for (const seriesId of SERIES_IDS) {
  for (const lang of LANGS) {
    test(`day 1 full path · ${seriesId} · ${lang}`, async ({ page, snap }, testInfo) => {
      test.setTimeout(240_000);
      const f = facts(seriesId);
      const s = f.series;
      // hi: watch both glimpses, vote A, then move. en: skip glimpses, vote B, then keep.
      const watchGlimpses = lang === "hi";
      const vote: Choice = lang === "hi" ? "A" : "B";
      const move = lang === "hi";
      const finalChoice: Choice = move ? other(vote) : vote;

      // 1. Welcome
      await test.step("welcome: pick the audio language", async () => {
        await doWelcome(page, lang, snap);
        expect((await readState(page)).viewer).toMatchObject({ language: lang, welcomeSeen: true });
      });

      // 2. Home
      await test.step("home: two live series, three teasers, day 1 status", async () => {
        const home = await screen(page, "home");
        await expect(home.getByTestId("day-status")).toHaveText("Day 1 · both endings open");
        const live = home.locator('[data-part="live"]');
        await expect(live.locator("a")).toHaveCount(2);
        for (const id of SERIES_IDS) await expect(live.locator(`a[href="/series/${id}"]`)).toHaveCount(1);
        const shelf = home.locator(".flow-shelf > li");
        await expect(shelf).toHaveCount(3);
        await expect(home.locator(".flow-shelf a")).toHaveCount(0);
        for (const tile of await shelf.all()) await expect(tile).toContainText("Coming next");
        await expect(home.locator('[data-part="hero"]')).toContainText("Day 1 ends in");
        if (seriesId !== "series1") {
          await home.getByRole("group", { name: "Series on the stage" }).getByRole("button", { name: s.title[lang] }).click();
        }
        await expect(home.locator('[data-part="hero"]')).toContainText(s.title[lang]);
        if (lang === "hi") await expectHindiMarked(home.locator('[data-part="hero"]'), s.title.hi.split(" ").find((w) => /[ऀ-ॿ]/.test(w)) ?? s.title.hi);
        await snap("home");
        await home.locator('[data-part="hero"]').getByRole("link", { name: "Synopsis and cast" }).click();
        await expectPath(page, `/series/${seriesId}`);
      });

      // 3. Series page
      await test.step("series page: synopsis, cast with voices, rail with the branch point and locked endings", async () => {
        const page3 = await screen(page, "series");
        await expect(page3.locator("h1")).toContainText(s.title[lang]);
        await expect(page3).toContainText(s.synopsis[lang].slice(0, 30));
        for (const member of s.cast) await expect(page3.getByRole("button", { name: `Play the voice of ${member.name.en}` })).toBeVisible();
        const voice = page3.getByRole("button", { name: `Play the voice of ${s.cast[0].name.en}` });
        await voice.click();
        await expect(page3.getByRole("button", { name: `Stop the voice of ${s.cast[0].name.en}` })).toHaveAttribute("aria-pressed", "true");
        await page3.getByRole("button", { name: `Stop the voice of ${s.cast[0].name.en}` }).click();
        await expect(page3.getByRole("list", { name: "Shared episodes and the choice" }).locator("li")).toHaveCount(f.shared.length + 1);
        for (const c of ["A", "B"] as Choice[]) {
          const rail = page3.getByRole("list", { name: `Ending ${c}` }).locator("li");
          await expect(rail).toHaveCount(f.branch[c].length);
          await expect(page3.getByRole("list", { name: `Ending ${c}` }).locator("li.is-locked")).toHaveCount(f.branch[c].length);
          // The choices are not named before the question.
          await expect(page3.locator(`[data-branch="${c}"]`)).not.toContainText(s.choices[c].label[lang]);
        }
        await snap("series");
        await page3.locator('[data-part="hero"]').getByRole("link", { name: "Play episode 1" }).click();
        await expectPath(page, `/watch/${seriesId}/${f.shared[0]}`);
      });

      // 4. Shared episodes
      await test.step("shared episodes play to the question", async () => {
        const stage = page.locator(`[data-player-stage][data-playable="${f.shared[0]}"]`);
        await expect(stage).toHaveAttribute("data-lang", lang);
        await expect(page.locator(`[data-player-stage] video`)).toHaveAttribute("src", s.episodes[0].video[lang]);
        await snap("player-episode-1");
        await playAll(page, f.shared, lang);
        await expectPath(page, `/series/${seriesId}/question`);
      });

      // 5. Question
      await test.step("question: the cliffhanger and the question, never the choices", async () => {
        const q = await screen(page, "question");
        await expect(q.locator("h1")).toContainText(s.question[lang]);
        // The choices are introduced by the glimpses and the ballot, never here: no option, glimpse card
        // or verdict, and no label anywhere outside the question itself (a label can be a word of it).
        await expect(q.locator(".uw-option, .uw-verdict, a[href*='/watch/']")).toHaveCount(0);
        const outside = (await q.innerText()).replace(await q.locator("h1").innerText(), "");
        for (const c of ["A", "B"] as Choice[]) expect(outside, `choice ${c} label outside the question`).not.toContain(s.choices[c].label[lang]);
        await expect(q).toContainText("Watching them is optional");
        await snap("question");
      });

      // 6. Glimpses (optional)
      if (watchGlimpses) {
        await test.step("glimpses: both watched, watched state tracked", async () => {
          await page.locator('main[data-screen="question"]').getByRole("link", { name: "See both glimpses" }).first().click();
          await expectPath(page, `/series/${seriesId}/glimpses`);
          let g = await screen(page, "glimpses");
          await expect(g).toContainText("Before you vote");
          for (const c of ["A", "B"] as Choice[]) {
            const card = g.locator(`a[href="/watch/${seriesId}/${f.glimpse[c]}"]`);
            await expect(card).toContainText("not watched");
            await card.click();
            await expectPath(page, `/watch/${seriesId}/${f.glimpse[c]}`);
            await playAll(page, [f.glimpse[c]], lang);
            await expectPath(page, `/series/${seriesId}/glimpses`);
            g = await screen(page, "glimpses");
            await expect(g.locator(`a[href="/watch/${seriesId}/${f.glimpse[c]}"]`)).toContainText(/· watched/);
          }
          expect((await readState(page)).viewer?.series[seriesId].glimpsesWatched).toEqual({ A: true, B: true });
          await snap("glimpses-watched");
          await g.getByRole("link", { name: "Go to the ballot" }).click();
        });
      } else {
        await test.step("glimpses skipped: straight to the ballot", async () => {
          await visible(page.locator('main[data-screen="question"]').getByRole("link", { name: "Go straight to the ballot" })).click();
        });
      }

      // 7. Ballot
      await test.step(`ballot: cast for ${vote}${watchGlimpses ? "" : " without watching any glimpse"}`, async () => {
        await expectPath(page, `/series/${seriesId}/ballot`);
        const b = await screen(page, "ballot");
        const cast = b.getByRole("button", { name: "Pick A or B to cast your ballot" });
        await expect(cast).toBeDisabled();
        const choices = b.getByRole("group", { name: "Choices" });
        for (const c of ["A", "B"] as Choice[]) {
          await expect(choices.getByRole("button", { name: new RegExp(`^${c}`) })).toContainText(watchGlimpses ? "Glimpse watched" : "Glimpse not watched yet");
        }
        const option = choices.getByRole("button", { name: new RegExp(`^${vote}`) });
        await option.click();
        await expect(option).toHaveAttribute("aria-pressed", "true");
        const castFor = b.getByRole("button", { name: `Cast my ballot for ${vote}` });
        await expect(castFor).toBeEnabled();
        await snap("ballot-selected");
        await castFor.click();
        await expect(b).toContainText("Your ballot is in");
        await expect(b).toContainText("Simulated demo ballots");
        await expect(b.locator(".uw-tally-row")).toContainText(/A · \d+%/);
        await expect(page.getByText(`Ballot cast for ${vote}.`)).toBeVisible();
        expect((await readState(page)).viewer?.series[seriesId].ballot).toMatchObject({ choice: vote, moved: false });
        await snap("ballot-cast");
        await b.getByRole("link", { name: /^Play episode/ }).first().click();
      });

      // 8. Chosen branch to its ending
      await test.step(`branch ${vote} plays to its ending`, async () => {
        await expectPath(page, `/watch/${seriesId}/${f.branch[vote][0]}`);
        await playAll(page, f.branch[vote], lang);
        await expectPath(page, `/series/${seriesId}/ending/${vote}`);
        const e = await screen(page, "ending");
        await expect(e).toContainText("Your ending");
        await expect(e.locator('[data-part="split"]')).toContainText("How the audience is voting");
        await expect(e.locator('[data-part="split"]')).toContainText("Simulated demo ballots");
        await expect(e.getByRole("link", { name: "Watch the other ending" })).toBeVisible();
        await snap("ending-own");
        await e.getByRole("link", { name: "Watch the other ending" }).click();
      });

      // 9. The other ending
      await test.step(`other ending ${other(vote)} plays, then keep or move`, async () => {
        await expectPath(page, `/watch/${seriesId}/${f.branch[other(vote)][0]}`);
        await playAll(page, f.branch[other(vote)], lang);
        await expectPath(page, `/series/${seriesId}/keep-or-move`);
      });

      // 10. Keep or move
      await test.step(move ? "keep or move: move once" : "keep or move: keep", async () => {
        const k = await screen(page, "keep-or-move");
        await expect(k).toContainText("Keep your ballot, or move it?");
        await snap("keep-or-move");
        if (move) {
          await k.getByRole("button", { name: `Move my ballot to ${other(vote)}` }).click();
          await expect(k.locator('[data-part="outcome"]')).toContainText("Ballot moved");
          await expect(k).toContainText(`Your ballot is on ${other(vote)}.`);
          expect((await readState(page)).viewer?.series[seriesId].ballot).toMatchObject({ choice: other(vote), moved: true });
          await page.reload();
          const again = await screen(page, "keep-or-move");
          await expect(again.locator('[data-part="outcome"]')).toContainText("Ballot already moved");
          await expect(again.getByRole("button", { name: /Move my ballot/ })).toHaveCount(0);
        } else {
          await k.getByRole("button", { name: `Keep my ballot on ${vote}` }).click();
          await expect(k.locator('[data-part="outcome"]')).toContainText("Ballot kept");
          expect((await readState(page)).viewer?.series[seriesId].ballot).toMatchObject({ choice: vote, moved: false });
        }
        await snap("keep-or-move-done");
        await page.locator('main[data-screen="keep-or-move"]').getByRole("link", { name: "Make my share card" }).click();
      });

      // 11. Share card
      await test.step("share card: question and choice, no spoilers, PNG download", async () => {
        await expectPath(page, `/series/${seriesId}/share`);
        const sh = await screen(page, "share");
        const card = sh.locator(".uw-share");
        await expect(card).toContainText(s.question[lang]);
        await expect(card).toContainText(s.choices[finalChoice].label[lang]);
        // Only the viewer's own pick, never the other choice (checked outside the question, which may share words with a label).
        await expect(card.locator(".uw-share-pick")).toContainText(s.choices[finalChoice].label[lang]);
        await expect(card.locator(".uw-share-pick")).toHaveCount(1);
        const cardOutsideQuestion = (await card.innerText()).replace(await card.locator(".uw-share-q").innerText(), "");
        expect(cardOutsideQuestion).not.toContain(s.choices[other(finalChoice)].label[lang]);
        await snap("share");
        const download = page.waitForEvent("download", { timeout: 30_000 });
        await sh.getByRole("button", { name: "Save the card as a PNG" }).click();
        const file = await download;
        expect(file.suggestedFilename()).toMatch(/\.png$/);
        const saved = path.join(artifactDir(testInfo), file.suggestedFilename());
        await file.saveAs(saved);
        expect(pngSize(saved)).toEqual({ width: 1080, height: 1920 });
        await expect(page.getByText("Share card saved as a PNG.")).toBeVisible();
      });

      // 12. My choices
      await test.step("my choices: what you chose, nothing has won yet, both endings open", async () => {
        await openMyChoices(page);
        const m = await screen(page, "my-choices");
        const h = m.locator(`[data-series="${seriesId}"]`);
        await expect(h.locator('[data-part="you-chose"]')).toContainText(s.choices[finalChoice].label[lang]);
        if (move) await expect(h.locator('[data-part="you-chose"]')).toContainText("moved once");
        await expect(h.locator('[data-part="what-won"]')).toContainText("Nothing yet");
        await expect(h.locator('[data-branch="A"]')).toHaveAttribute("data-availability", "open");
        await expect(h.locator('[data-branch="B"]')).toHaveAttribute("data-availability", "open");
        await snap("my-choices");
      });
    });
  }
}
