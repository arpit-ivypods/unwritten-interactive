import { describe, expect, it } from "vitest";
import { makeSeries } from "@/test/fixtures";
import * as H from "./helpers";
import type { SubtitleTrack } from "./schema";

const series = makeSeries();
const episode = series.episodes[0];

describe("the episode path", () => {
  it("splits the series into shared episodes and two branches", () => {
    expect(H.sharedEpisodes(series).map((e) => e.id)).toEqual(["xe01", "xe02"]);
    expect(H.branchEpisodes(series, "A").map((e) => e.id)).toEqual(["xa01", "xa02", "xa03"]);
    expect(H.branchEpisodes(series, "B").map((e) => e.id)).toEqual(["xb01", "xb02", "xb03"]);
    expect(H.pathEpisodes(series, "B").map((e) => e.id)).toEqual(["xe01", "xe02", "xb01", "xb02", "xb03"]);
    expect(H.pathLength(series)).toBe(5);
    expect(H.pathLength(makeSeries({ shared: 3 }))).toBe(6);
  });

  it("knows the first episode, the cliffhanger episode and each ending", () => {
    expect(H.firstEpisode(series).id).toBe("xe01");
    expect(H.lastSharedEpisode(series).id).toBe("xe02");
    expect(H.endingEpisode(series, "A").id).toBe("xa03");
    expect(H.endingEpisode(series, "B").id).toBe("xb03");
    expect(H.cliffhangerStill(series)).toBe("/media/demo/episodes/xe02/shots/s02.jpg");
  });

  it("labels episodes the way the rail shows them", () => {
    expect(series.episodes.map(H.episodeLabel)).toEqual(["1", "2", "3A", "4A", "5A", "3B", "4B", "5B"]);
    expect(H.branchOf(series.episodes[0])).toBeNull();
    expect(H.branchOf(series.episodes[2])).toBe("A");
    expect(H.branchOf(series.episodes[5])).toBe("B");
  });

  it("steps forward inside a run and never across the branch point", () => {
    expect(H.nextEpisodeOnPath(series, "xe01")?.id).toBe("xe02");
    expect(H.nextEpisodeOnPath(series, "xe02")).toBeNull();
    expect(H.nextEpisodeOnPath(series, "xa01")?.id).toBe("xa02");
    expect(H.nextEpisodeOnPath(series, "xa03")).toBeNull();
    expect(H.nextEpisodeOnPath(series, "nope")).toBeNull();
  });

  it("steps back across the branch point", () => {
    expect(H.previousEpisodeOnPath(series, "xe01")).toBeNull();
    expect(H.previousEpisodeOnPath(series, "xb01")?.id).toBe("xe02");
    expect(H.previousEpisodeOnPath(series, "xb03")?.id).toBe("xb02");
  });

  it("finds anything the player can play", () => {
    expect(H.findPlayable(series, "xa02")).toMatchObject({ type: "episode", id: "xa02" });
    expect(H.findPlayable(series, "xgb")).toMatchObject({ type: "glimpse", id: "xgb", choice: "B" });
    expect(H.findPlayable(series, "nope")).toBeUndefined();
    expect(H.glimpseChoice(series, "xga")).toBe("A");
    expect(H.glimpseChoice(series, "xe01")).toBeNull();
    expect(H.playableIds(series)).toEqual(["xe01", "xe02", "xa01", "xa02", "xa03", "xb01", "xb02", "xb03", "xga", "xgb"]);
    expect(H.otherChoice("A")).toBe("B");
    expect(H.otherChoice("B")).toBe("A");
  });
});

describe("shots: the two cuts have the same shots at different times", () => {
  it("flattens shots for one language", () => {
    expect(H.shotsFor(episode, "hi")).toEqual([
      { id: "s01", index: 0, startMs: 0, endMs: 4000, still: "/media/demo/episodes/xe01/shots/s01.jpg" },
      { id: "s02", index: 1, startMs: 4000, endMs: 8000, still: "/media/demo/episodes/xe01/shots/s02.jpg" },
    ]);
    expect(H.shotsFor(episode, "en").map((s) => [s.startMs, s.endMs])).toEqual([[0, 3000], [3000, 7000]]);
  });

  it("finds the shot on screen", () => {
    expect(H.shotIndexAt(episode, "hi", 0)).toBe(0);
    expect(H.shotIndexAt(episode, "hi", 3999)).toBe(0);
    expect(H.shotIndexAt(episode, "hi", 4000)).toBe(1);
    expect(H.shotIndexAt(episode, "en", 3500)).toBe(1);
    expect(H.shotIndexAt(episode, "hi", 99_999)).toBe(1);
    expect(H.shotIndexAt(episode, "hi", -5)).toBe(0);
    expect(H.shotAt(episode, "en", 3500).id).toBe("s02");
    expect(H.shotStartMs(episode, "en", "s02")).toBe(3000);
    expect(H.shotStartMs(episode, "en", "s99")).toBeNull();
  });

  it("a language switch keeps the viewer at the same shot, not the same second", () => {
    expect(H.positionAfterLanguageSwitch(episode, "hi", "en", 3500)).toBe(0);
    expect(H.positionAfterLanguageSwitch(episode, "en", "hi", 3500)).toBe(4000);
    expect(H.positionAfterLanguageSwitch(episode, "hi", "en", 6000)).toBe(3000);
    expect(H.positionAfterLanguageSwitch(episode, "hi", "hi", 6000)).toBe(6000);
  });
});

describe("subtitles", () => {
  const track: SubtitleTrack = {
    lang: "hi",
    cues: [
      { id: "c1", line_id: "l1", speaker: "meera", startMs: 300, endMs: 1500, text: "यह file", words: [{ text: "यह", startMs: 300, endMs: 800 }, { text: "file", startMs: 900, endMs: 1500 }] },
      { id: "c2", line_id: "l2", speaker: "meera", startMs: 2000, endMs: 3000, text: "रुको!", words: [{ text: "रुको!", startMs: 2000, endMs: 3000 }] },
    ],
  };

  it("finds the cue on screen, and nothing between lines", () => {
    expect(H.cueAt(track, 0)).toBeNull();
    expect(H.cueAt(track, 300)?.id).toBe("c1");
    expect(H.cueAt(track, 1499)?.id).toBe("c1");
    expect(H.cueAt(track, 1500)).toBeNull();
    expect(H.cueAt(track, 2500)?.id).toBe("c2");
    expect(H.cueAt(track, 9000)).toBeNull();
  });

  it("names the speaker in the audio language, and falls back to the id", () => {
    expect(H.speakerName(series, "meera", "hi")).toBe("मीरा");
    expect(H.speakerName(series, "meera", "en")).toBe("Meera");
    expect(H.speakerName(series, "caller", "en")).toBe("caller");
  });

  it("highlights whole words and stays on the last one spoken", () => {
    const cue = track.cues[0];
    expect(H.wordIndexAt(cue, 300)).toBe(0);
    expect(H.wordIndexAt(cue, 850)).toBe(0);
    expect(H.wordIndexAt(cue, 900)).toBe(1);
    expect(H.wordIndexAt(cue, 1499)).toBe(1);
    expect(H.wordIndexAt(cue, 100)).toBe(-1);
  });
});

describe("placeholders", () => {
  it("lists everything that is still a stand-in", () => {
    expect(H.listPlaceholders(series)).toEqual([]);
    const withPlaceholders = structuredClone(series);
    withPlaceholders.placeholder = true;
    withPlaceholders.episodes[3].placeholder = true;
    withPlaceholders.episodes[3].placeholderNote = "Frames missing";
    withPlaceholders.glimpses.B.placeholder = true;
    withPlaceholders.cast[0].placeholder = true;
    expect(H.listPlaceholders(withPlaceholders)).toEqual([
      { seriesId: "demo", id: "series", kind: "series" },
      { seriesId: "demo", id: "meera", kind: "cast" },
      { seriesId: "demo", id: "xa02", kind: "episode", note: "Frames missing" },
      { seriesId: "demo", id: "xgb", kind: "glimpse", note: undefined },
    ]);
  });
});
