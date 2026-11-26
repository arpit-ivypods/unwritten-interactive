/**
 * The contract test: the manifests the app actually ships with must match the
 * contract, and every file they name must be on disk. Fails the same way
 * `pnpm content:check` does (which also probes the videos with ffprobe).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allSeries, catalog, contentProblems, getSeries, teasers } from "./index";
import { branchEpisodes, findPlayable, playableIds, sharedEpisodes } from "./helpers";
import { validateSubtitleTrack } from "./schema";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");
const onDisk = (url: string) => path.join(PUBLIC_DIR, url);

describe("the bundled content", () => {
  it("passes validation", () => {
    expect(contentProblems).toEqual([]);
  });

  it("has two live series and three teasers", () => {
    expect(catalog.series).toEqual(["series1", "series2"]);
    expect(allSeries.map((s) => s.id)).toEqual(["series1", "series2"]);
    expect(teasers).toHaveLength(3);
    expect(getSeries("series1")?.id).toBe("series1");
    expect(getSeries("nope")).toBeUndefined();
  });

  it("series 1: 2 shared + 3 + 3 episodes, choice after episode 2", () => {
    const s = getSeries("series1")!;
    expect(s.branchAfterEpisode).toBe(2);
    expect(sharedEpisodes(s).map((e) => e.id)).toEqual(["s1e01", "s1e02"]);
    expect(branchEpisodes(s, "A").map((e) => e.id)).toEqual(["s1a01", "s1a02", "s1a03"]);
    expect(branchEpisodes(s, "B").map((e) => e.id)).toEqual(["s1b01", "s1b02", "s1b03"]);
    expect(s.episodes).toHaveLength(8);
  });

  it("series 2: 3 shared + 3 + 3 episodes, choice after episode 3", () => {
    const s = getSeries("series2")!;
    expect(s.branchAfterEpisode).toBe(3);
    expect(sharedEpisodes(s).map((e) => e.id)).toEqual(["s2e01", "s2e02", "s2e03"]);
    expect(branchEpisodes(s, "A").map((e) => e.id)).toEqual(["s2a01", "s2a02", "s2a03"]);
    expect(branchEpisodes(s, "B").map((e) => e.id)).toEqual(["s2b01", "s2b02", "s2b03"]);
    expect(s.episodes).toHaveLength(9);
  });

  it("every file a manifest names is on disk", () => {
    const missing: string[] = [];
    const need = (url: string) => {
      if (!fs.existsSync(onDisk(url))) missing.push(url);
    };
    for (const s of allSeries) {
      need(s.poster);
      need(s.backdrop);
      for (const member of s.cast) {
        need(member.voiceSample.hi);
        need(member.voiceSample.en);
        if (member.portrait) need(member.portrait);
      }
      for (const id of playableIds(s)) {
        const media = findPlayable(s, id)!.media;
        need(media.poster);
        for (const lang of ["hi", "en"] as const) {
          need(media.video[lang]);
          need(media.subtitles[lang]);
        }
        for (const shot of media.shots) need(shot.still);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every subtitle file matches the cue contract and fits its video", () => {
    const problems: string[] = [];
    for (const s of allSeries) {
      for (const id of playableIds(s)) {
        const media = findPlayable(s, id)!.media;
        for (const lang of ["hi", "en"] as const) {
          const file = onDisk(media.subtitles[lang]);
          if (!fs.existsSync(file)) continue;
          const result = validateSubtitleTrack(JSON.parse(fs.readFileSync(file, "utf8")), media.durationMs[lang]);
          if (!result.ok) problems.push(...result.errors.map((e) => `${s.id} ${id} ${lang}: ${e}`));
          else if (result.value.lang !== lang) problems.push(`${s.id} ${id} ${lang}: file says ${result.value.lang}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("the Hinglish question and synopsis are in Devanagari; English text never is", () => {
    const devanagari = /[\u0900-\u097F]/;
    for (const s of allSeries) {
      expect(s.question.hi).toMatch(devanagari);
      expect(s.synopsis.hi).toMatch(devanagari);
      const english = [s.title.en, s.synopsis.en, s.question.en, s.choices.A.label.en, s.choices.B.label.en, ...s.episodes.map((e) => e.title.en)];
      for (const line of english) expect(line).not.toMatch(devanagari);
    }
  });
});
