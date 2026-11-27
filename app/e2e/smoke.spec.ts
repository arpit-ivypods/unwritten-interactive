/**
 * Smoke test from the tech lead: the app serves every route in the routes
 * table, the content is reachable, a placeholder episode really plays in this
 * browser, and the stores load from localStorage. It does not test any screen:
 * those tests belong to the test engineer and go in their own files here.
 */
import { expect, test } from "@playwright/test";
import { routes } from "../src/lib/routes";
import { loadCatalog, loadSeries, readState, seedState, viewerAt } from "./state";

const catalog = loadCatalog();
const series1 = loadSeries("series1");

test("every route in the routes table responds", async ({ page }) => {
  const id = series1.id;
  const urls = [
    routes.home(),
    routes.welcome(),
    routes.series(id),
    routes.watch(id, series1.episodes[0].id),
    routes.watch(id, series1.glimpses.A.id),
    routes.question(id),
    routes.glimpses(id),
    routes.ballot(id),
    routes.ending(id, "A"),
    routes.ending(id, "B"),
    routes.keepOrMove(id),
    routes.result(id),
    routes.share(id),
    routes.myChoices(),
    routes.studio(),
  ];
  for (const url of urls) {
    const response = await page.request.get(url);
    expect(response.status(), url).toBe(200);
  }
  expect((await page.request.get(routes.series("no-such-series"))).status()).toBe(404);
  expect((await page.request.get(routes.watch(id, "no-such-episode"))).status()).toBe(404);

  const previousBranchEpisodes = {
    series1: ["s1a02", "s1a03", "s1b02", "s1b03"],
    series2: ["s2a02", "s2a03", "s2b02", "s2b03"],
  };
  for (const [seriesId, episodeIds] of Object.entries(previousBranchEpisodes)) {
    for (const episodeId of episodeIds) {
      const url = routes.watch(seriesId, episodeId);
      expect((await page.request.get(url)).status(), url).toBe(404);
    }
  }
});

test("the manifests and media are served", async ({ page }) => {
  expect(catalog.series).toEqual(["series1", "series2"]);
  for (const seriesId of catalog.series) {
    const manifest = await page.request.get(`/media/${seriesId}/series.json`);
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()).id).toBe(seriesId);
  }
  const episode = series1.episodes[0];
  for (const url of [episode.video.hi, episode.video.en, episode.subtitles.hi, episode.poster, episode.shots[0].still, series1.poster, series1.cast[0].voiceSample.hi]) {
    expect((await page.request.head(url)).status(), url).toBe(200);
  }
  const subtitles = await (await page.request.get(episode.subtitles.hi)).json();
  expect(subtitles.lang).toBe("hi");
  expect(subtitles.cues[0].text).toMatch(/[ऀ-ॿ]/);
});

test("an episode video plays in this browser, in both languages", async ({ page }) => {
  await page.goto(routes.home());
  const episode = series1.episodes[0];
  for (const lang of ["hi", "en"] as const) {
    const played = await page.evaluate(async (src) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.src = src;
      document.body.appendChild(video);
      await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error(`cannot load ${src}: ${video.error?.message}`)), { once: true });
      });
      await video.play();
      await new Promise<void>((resolve) => {
        const check = () => (video.currentTime > 0.3 ? resolve() : requestAnimationFrame(check));
        check();
      });
      const result = { width: video.videoWidth, height: video.videoHeight, durationMs: Math.round(video.duration * 1000) };
      video.remove();
      return result;
    }, episode.video[lang]);
    expect(played.width).toBe(1080);
    expect(played.height).toBe(1920);
    expect(Math.abs(played.durationMs - episode.durationMs[lang])).toBeLessThan(300);
  }
});

test("the stores load what is in localStorage and keep it across a reload", async ({ page }) => {
  await seedState(page, { viewer: viewerAt("series1", "voted", "B", { language: "en" }), demo: { day: 2, winnerOverride: "B" } });
  await page.goto(routes.home());
  // Loading the stores gives the countdown its start time and saves it: proof that hydration ran.
  await expect.poll(async () => (await readState(page)).demo?.launchAt ?? null).not.toBeNull();
  await page.reload();
  const state = await readState(page);
  expect(state.demo).toMatchObject({ day: 2, winnerOverride: "B" });
  expect(state.viewer).toMatchObject({ language: "en", welcomeSeen: true });
  expect(state.viewer?.series.series1.ballot).toMatchObject({ choice: "B", moved: false });
});
