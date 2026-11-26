import { describe, expect, it } from "vitest";
import { DAY_1, DAY_2, LAST_HOUR, NOW, makeSeries, viewers } from "@/test/fixtures";
import * as T from "./transitions";
import { DEFAULT_DEMO_STATE, DEFAULT_VIEWER_STATE, EMPTY_PROGRESS, emptyProgress } from "./types";
import type { ViewerState } from "./types";

const series = makeSeries();
const v = viewers(series, "A");

describe("recordProgress", () => {
  it("remembers the position, the language and the shot, and makes it the resume point", () => {
    const p = T.recordProgress(series, emptyProgress(), "xe01", { positionMs: 5234.6, lang: "en", shotId: "s02" }, NOW);
    expect(p.episodes.xe01).toEqual({ positionMs: 5235, lang: "en", shotId: "s02", completed: false, completedAt: null, updatedAt: NOW });
    expect(p.lastPlayableId).toBe("xe01");
  });

  it("does not undo a completion", () => {
    const done = T.completeEpisode(series, emptyProgress(), "xe01", NOW);
    const rewatching = T.recordProgress(series, done, "xe01", { positionMs: 1000, lang: "hi", shotId: "s01" }, NOW + 5);
    expect(rewatching.episodes.xe01).toMatchObject({ positionMs: 1000, completed: true, completedAt: NOW });
  });

  it("ignores glimpses and unknown ids", () => {
    const start = emptyProgress();
    expect(T.recordProgress(series, start, "xga", { positionMs: 1000, lang: "hi", shotId: null }, NOW)).toBe(start);
    expect(T.recordProgress(series, start, "nope", { positionMs: 1000, lang: "hi", shotId: null }, NOW)).toBe(start);
  });

  it("never mutates what it was given", () => {
    const start = emptyProgress();
    T.recordProgress(series, start, "xe01", { positionMs: 1, lang: "hi", shotId: null }, NOW);
    expect(start).toEqual(emptyProgress());
    expect(() => T.recordProgress(series, EMPTY_PROGRESS, "xe01", { positionMs: 1, lang: "hi", shotId: null }, NOW)).not.toThrow();
  });
});

describe("completeEpisode", () => {
  it("marks the episode finished for good and rewinds it", () => {
    const watching = T.recordProgress(series, emptyProgress(), "xe01", { positionMs: 7000, lang: "en", shotId: "s02" }, NOW);
    const done = T.completeEpisode(series, watching, "xe01", NOW + 1000);
    expect(done.episodes.xe01).toEqual({ positionMs: 0, lang: "en", shotId: null, completed: true, completedAt: NOW + 1000, updatedAt: NOW + 1000 });
  });

  it("keeps the first completion time on a rewatch", () => {
    const once = T.completeEpisode(series, emptyProgress(), "xe01", NOW);
    const twice = T.completeEpisode(series, once, "xe01", NOW + 99);
    expect(twice.episodes.xe01.completedAt).toBe(NOW);
  });

  it("ignores unknown ids", () => {
    const start = emptyProgress();
    expect(T.completeEpisode(series, start, "nope", NOW)).toBe(start);
  });
});

describe("markGlimpseWatched", () => {
  it("tracks each glimpse separately", () => {
    const a = T.markGlimpseWatched(emptyProgress(), "A");
    expect(a.glimpsesWatched).toEqual({ A: true, B: false });
    expect(T.markGlimpseWatched(a, "B").glimpsesWatched).toEqual({ A: true, B: true });
    expect(T.markGlimpseWatched(a, "A")).toBe(a);
  });
});

describe("castBallot", () => {
  it("records the choice and the time", () => {
    const result = T.castBallot(series, v.atQuestion, DAY_1, "B", NOW);
    expect(result).toMatchObject({ ok: true });
    expect(result.progress.ballot).toEqual({ choice: "B", castAt: NOW, moved: false, movedAt: null, kept: false });
  });

  it("works in the last hour", () => {
    expect(T.castBallot(series, v.atQuestion, LAST_HOUR, "A", NOW).ok).toBe(true);
  });

  it("refuses, and changes nothing, when the rules say no", () => {
    expect(T.castBallot(series, v.fresh, DAY_1, "A", NOW)).toEqual({ ok: false, reason: "question-not-reached", progress: v.fresh });
    expect(T.castBallot(series, v.atQuestion, DAY_2, "A", NOW)).toEqual({ ok: false, reason: "voting-closed", progress: v.atQuestion });
    const second = T.castBallot(series, v.voted, DAY_1, "B", NOW);
    expect(second).toMatchObject({ ok: false, reason: "already-cast" });
    expect(second.progress.ballot?.choice).toBe("A");
  });
});

describe("moveBallot", () => {
  it("moves to the other choice once", () => {
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW + 7);
    expect(moved.ok).toBe(true);
    expect(moved.progress.ballot).toEqual({ choice: "B", castAt: NOW, moved: true, movedAt: NOW + 7, kept: false });
  });

  it("refuses, and changes nothing, when the rules say no", () => {
    expect(T.moveBallot(series, v.atQuestion, DAY_1, NOW)).toMatchObject({ ok: false, reason: "no-ballot" });
    expect(T.moveBallot(series, v.finishedOwn, DAY_1, NOW)).toMatchObject({ ok: false, reason: "both-endings-not-finished" });
    expect(T.moveBallot(series, v.seenBoth, DAY_2, NOW)).toMatchObject({ ok: false, reason: "voting-closed" });
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW).progress;
    expect(T.moveBallot(series, moved, DAY_1, NOW)).toMatchObject({ ok: false, reason: "already-moved" });
    expect(T.moveBallot(series, v.seenBoth, DAY_2, NOW).progress).toBe(v.seenBoth);
  });

  it("is refused after the viewer chose to keep the ballot", () => {
    const kept = T.keepBallot(series, v.seenBoth, DAY_1).progress;
    expect(T.moveBallot(series, kept, DAY_1, NOW)).toEqual({ ok: false, reason: "kept", progress: kept });
  });
});

describe("keepBallot", () => {
  it("keeps the ballot where it is and marks the decision as made", () => {
    const kept = T.keepBallot(series, v.seenBoth, DAY_1);
    expect(kept.ok).toBe(true);
    expect(kept.progress.ballot).toEqual({ ...v.seenBoth.ballot, kept: true });
    expect(kept.progress.ballot?.choice).toBe("A");
  });

  it("is allowed exactly when a move is, and only once", () => {
    expect(T.keepBallot(series, v.atQuestion, DAY_1)).toEqual({ ok: false, reason: "no-ballot", progress: v.atQuestion });
    expect(T.keepBallot(series, v.finishedOwn, DAY_1)).toMatchObject({ ok: false, reason: "both-endings-not-finished" });
    expect(T.keepBallot(series, v.seenBoth, DAY_2)).toEqual({ ok: false, reason: "voting-closed", progress: v.seenBoth });
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW).progress;
    expect(T.keepBallot(series, moved, DAY_1)).toMatchObject({ ok: false, reason: "already-moved" });
    const kept = T.keepBallot(series, v.seenBoth, DAY_1).progress;
    expect(T.keepBallot(series, kept, DAY_1)).toEqual({ ok: false, reason: "kept", progress: kept });
  });
});

describe("the viewer as a whole", () => {
  const viewer: ViewerState = { language: "en", subtitlesOn: false, welcomeSeen: true, series: { demo: v.seenBoth, other: v.voted }, epoch: 4 };

  it("updateSeries changes one series and leaves the rest alone", () => {
    const next = T.updateSeries(viewer, "demo", (p) => T.markGlimpseWatched(p, "A"));
    expect(next.series.demo.glimpsesWatched.A).toBe(true);
    expect(next.series.other).toBe(viewer.series.other);
    expect(viewer.series.demo.glimpsesWatched.A).toBe(false);
  });

  it("updateSeries starts a series nobody has opened, and does nothing when nothing changed", () => {
    const next = T.updateSeries(viewer, "fresh", (p) => T.markGlimpseWatched(p, "B"));
    expect(next.series.fresh.glimpsesWatched).toEqual({ A: false, B: true });
    expect(T.updateSeries(viewer, "fresh", (p) => p)).toBe(viewer);
  });

  it("the reset button clears all watch history, keeps the preferences and starts a new epoch", () => {
    expect(T.resetHistory(viewer)).toEqual({ language: "en", subtitlesOn: false, welcomeSeen: true, series: {}, epoch: 5 });
  });

  it("a full reset is a first-time visitor, in a new epoch", () => {
    expect(T.resetEverything(viewer)).toEqual({ ...DEFAULT_VIEWER_STATE, epoch: 5 });
    expect(T.resetEverything(viewer).series).not.toBe(DEFAULT_VIEWER_STATE.series);
    // Never back to an epoch a session may still hold.
    expect(T.resetEverything(DEFAULT_VIEWER_STATE).epoch).toBe(1);
  });

  it("an epoch is stale once a newer one has started; a save without an epoch never is", () => {
    const next = T.newEpoch(viewer);
    expect(next).toEqual({ ...viewer, epoch: 5 });
    expect(T.isStaleEpoch(next, 4)).toBe(true);
    expect(T.isStaleEpoch(next, 5)).toBe(false);
    expect(T.isStaleEpoch(next, undefined)).toBe(false);
  });
});

describe("reading localStorage back safely", () => {
  it("returns the defaults for anything that is not an object", () => {
    for (const junk of [null, undefined, "x", 4, [], true]) {
      expect(T.sanitizeViewerState(junk)).toEqual(DEFAULT_VIEWER_STATE);
      expect(T.sanitizeDemoState(junk)).toEqual(DEFAULT_DEMO_STATE);
    }
  });

  it("round-trips a real viewer through JSON", () => {
    const viewer: ViewerState = {
      language: "en",
      subtitlesOn: false,
      welcomeSeen: true,
      series: { demo: T.moveBallot(series, v.seenBoth, DAY_1, NOW).progress, other: T.keepBallot(series, v.seenBoth, DAY_1).progress },
      epoch: 3,
    };
    expect(T.sanitizeViewerState(JSON.parse(JSON.stringify(viewer)))).toEqual(viewer);
  });

  it("repairs damaged parts and keeps the good ones", () => {
    const repaired = T.sanitizeViewerState({
      language: "fr",
      subtitlesOn: "yes",
      welcomeSeen: true,
      series: {
        demo: {
          episodes: { xe01: { positionMs: -4, lang: "de", completed: true }, xe02: "broken" },
          lastPlayableId: 7,
          glimpsesWatched: { A: 1, B: true },
          ballot: { choice: "C", castAt: 5 },
        },
        other: { ballot: { choice: "B", castAt: 5, moved: true, movedAt: 9 } },
      },
    });
    expect(repaired.language).toBe("hi");
    expect(repaired.subtitlesOn).toBe(true);
    expect(repaired.welcomeSeen).toBe(true);
    expect(repaired.series.demo).toEqual({
      episodes: { xe01: { positionMs: 0, lang: "hi", shotId: null, completed: true, completedAt: null, updatedAt: 0 } },
      lastPlayableId: null,
      glimpsesWatched: { A: false, B: true },
      ballot: null,
    });
    // Saved before `kept` existed: read as not kept.
    expect(repaired.series.other.ballot).toEqual({ choice: "B", castAt: 5, moved: true, movedAt: 9, kept: false });
    expect(repaired.epoch).toBe(0);
    for (const epoch of [-1, 1.5, "2", null, Number.POSITIVE_INFINITY]) expect(T.sanitizeViewerState({ epoch }).epoch).toBe(0);
    expect(T.sanitizeViewerState({ epoch: 7 }).epoch).toBe(7);
  });

  it("reads the demo state and rejects impossible values", () => {
    expect(T.sanitizeDemoState({ day: "last-hour", winnerOverride: "B", launchAt: 123 })).toEqual({ day: "last-hour", winnerOverride: "B", launchAt: 123 });
    expect(T.sanitizeDemoState({ day: 2, winnerOverride: null, launchAt: null })).toEqual({ day: 2, winnerOverride: null, launchAt: null });
    expect(T.sanitizeDemoState({ day: 3, winnerOverride: "C", launchAt: "soon" })).toEqual(DEFAULT_DEMO_STATE);
  });
});
