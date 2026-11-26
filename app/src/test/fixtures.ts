/**
 * Test fixtures: a small valid series that does not depend on the generated
 * content, and helpers to walk a viewer through it using the real transitions.
 * For unit tests only.
 */
import { branchEpisodes, sharedEpisodes } from "@/content/helpers";
import type { Choice, Episode, EpisodeKind, Glimpse, PlayableMedia, Series } from "@/content/schema";
import * as T from "@/state/transitions";
import { emptyProgress } from "@/state/types";
import type { DemoState, SeriesProgress } from "@/state/types";

export const DAY_1: DemoState = { day: 1, winnerOverride: null, launchAt: null };
export const LAST_HOUR: DemoState = { day: "last-hour", winnerOverride: null, launchAt: null };
export const DAY_2: DemoState = { day: 2, winnerOverride: null, launchAt: null };

/** A fixed "now" so tests never read the clock. */
export const NOW = 1_800_000_000_000;

function media(seriesId: string, folder: string, id: string): PlayableMedia {
  const base = `/media/${seriesId}/${folder}/${id}`;
  return {
    video: { hi: `${base}/hi.mp4`, en: `${base}/en.mp4` },
    durationMs: { hi: 8000, en: 7000 },
    subtitles: { hi: `${base}/hi.json`, en: `${base}/en.json` },
    shots: [
      { id: "s01", still: `${base}/shots/s01.jpg`, timing: { hi: { startMs: 0, endMs: 4000 }, en: { startMs: 0, endMs: 3000 } } },
      { id: "s02", still: `${base}/shots/s02.jpg`, timing: { hi: { startMs: 4000, endMs: 8000 }, en: { startMs: 3000, endMs: 7000 } } },
    ],
    poster: `${base}/poster.jpg`,
    placeholder: false,
  };
}

export interface MakeSeriesOptions {
  id?: string;
  /** Number of shared episodes; the choice comes after the last. */
  shared?: number;
  /** Episodes in each branch. */
  branch?: number;
  seeded?: Record<Choice, number>;
}

/**
 * A valid series. Episode ids: xe01, xe02 (shared), xa01.. (branch A),
 * xb01.. (branch B). Glimpses: xga, xgb. Seeded tallies default to A 100, B 90.
 */
export function makeSeries({ id = "demo", shared = 2, branch = 3, seeded = { A: 100, B: 90 } }: MakeSeriesOptions = {}): Series {
  const episode = (kind: EpisodeKind, letter: string, index: number, number: number): Episode => {
    const episodeId = `x${letter}${String(index).padStart(2, "0")}`;
    return { id: episodeId, number, kind, title: { hi: `कड़ी ${number}`, en: `Episode ${number}` }, ...media(id, "episodes", episodeId) };
  };
  const glimpse = (letter: string): Glimpse => ({ id: `xg${letter}`, ...media(id, "glimpses", `xg${letter}`) });
  return {
    schemaVersion: 1,
    id,
    title: { hi: "नमूना Series", en: "Sample Series" },
    synopsis: { hi: "यह सिर्फ़ test के लिए है।", en: "This is only for tests." },
    visualStyle: "photoreal",
    question: { hi: "अब क्या करें?", en: "What now?" },
    choices: { A: { label: { hi: "सच बता दो", en: "Tell the truth" } }, B: { label: { hi: "चुप रहो", en: "Stay quiet" } } },
    cast: [
      {
        id: "meera",
        name: { hi: "मीरा", en: "Meera" },
        role: { hi: "Lead", en: "Lead" },
        voiceSample: { hi: `/media/${id}/cast/meera.hi.mp3`, en: `/media/${id}/cast/meera.en.mp3` },
      },
    ],
    poster: `/media/${id}/poster.jpg`,
    backdrop: `/media/${id}/backdrop.jpg`,
    branchAfterEpisode: shared,
    episodes: [
      ...Array.from({ length: shared }, (_, i) => episode("shared", "e", i + 1, i + 1)),
      ...Array.from({ length: branch }, (_, i) => episode("branchA", "a", i + 1, shared + i + 1)),
      ...Array.from({ length: branch }, (_, i) => episode("branchB", "b", i + 1, shared + i + 1)),
    ],
    glimpses: { A: glimpse("a"), B: glimpse("b") },
    seededTallies: seeded,
    placeholder: false,
  };
}

export const sharedIds = (series: Series): string[] => sharedEpisodes(series).map((e) => e.id);
export const branchIds = (series: Series, choice: Choice): string[] => branchEpisodes(series, choice).map((e) => e.id);

/** Watch these episodes to the end, in order. */
export function finish(series: Series, progress: SeriesProgress, episodeIds: string[]): SeriesProgress {
  return episodeIds.reduce((p, episodeId) => T.completeEpisode(series, p, episodeId, NOW), progress);
}

/** Cast a ballot on day 1. Throws if the rules refuse it, so a test cannot build an impossible viewer by accident. */
export function vote(series: Series, progress: SeriesProgress, choice: Choice, demo: DemoState = DAY_1): SeriesProgress {
  const result = T.castBallot(series, progress, demo, choice, NOW);
  if (!result.ok) throw new Error(`castBallot refused: ${result.reason}`);
  return result.progress;
}

/** Viewers at each stage of day 1, built only with the real transitions. */
export function viewers(series: Series, choice: Choice = "A") {
  const other: Choice = choice === "A" ? "B" : "A";
  const fresh = emptyProgress();
  const atQuestion = finish(series, fresh, sharedIds(series));
  const voted = vote(series, atQuestion, choice);
  const finishedOwn = finish(series, voted, branchIds(series, choice));
  const seenBoth = finish(series, finishedOwn, branchIds(series, other));
  return { fresh, atQuestion, voted, finishedOwn, seenBoth };
}
