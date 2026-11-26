/**
 * The only ways a viewer's progress changes, as pure functions: old progress
 * in, new progress out. The stores call these; nothing else writes progress.
 * Rules are enforced here, so a screen cannot cast a second ballot or move a
 * ballot twice even if it tries.
 */
import { getEpisode, otherChoice } from "@/content/helpers";
import { LANGS } from "@/content/schema";
import type { Choice, Lang, Series } from "@/content/schema";
import { canCastBallot, canMoveBallot } from "./rules";
import type { CastBallotBlock, MoveBallotBlock } from "./rules";
import { DEFAULT_DEMO_STATE, DEFAULT_VIEWER_STATE, emptyProgress } from "./types";
import type { DemoDay, DemoState, EpisodeProgress, SeriesProgress, ViewerState } from "./types";

export interface PlaybackPosition {
  positionMs: number;
  lang: Lang;
  shotId: string | null;
}

/**
 * Remember where the viewer is in an episode. Also makes it the resume point.
 * Ignored for ids that are not episodes of the series (glimpses keep no position).
 */
export function recordProgress(series: Series, progress: SeriesProgress, episodeId: string, at: PlaybackPosition, now: number): SeriesProgress {
  if (!getEpisode(series, episodeId)) return progress;
  const existing = progress.episodes[episodeId];
  const entry: EpisodeProgress = {
    positionMs: Math.max(0, Math.round(at.positionMs)),
    lang: at.lang,
    shotId: at.shotId,
    completed: existing?.completed ?? false,
    completedAt: existing?.completedAt ?? null,
    updatedAt: now,
  };
  return { ...progress, lastPlayableId: episodeId, episodes: { ...progress.episodes, [episodeId]: entry } };
}

/**
 * The episode was watched to the end. Completion is permanent; the position
 * goes back to 0 so a rewatch starts from the top.
 */
export function completeEpisode(series: Series, progress: SeriesProgress, episodeId: string, now: number): SeriesProgress {
  if (!getEpisode(series, episodeId)) return progress;
  const existing = progress.episodes[episodeId];
  const entry: EpisodeProgress = {
    positionMs: 0,
    lang: existing?.lang ?? "hi",
    shotId: null,
    completed: true,
    completedAt: existing?.completedAt ?? now,
    updatedAt: now,
  };
  return { ...progress, lastPlayableId: episodeId, episodes: { ...progress.episodes, [episodeId]: entry } };
}

export function markGlimpseWatched(progress: SeriesProgress, choice: Choice): SeriesProgress {
  if (progress.glimpsesWatched[choice]) return progress;
  return { ...progress, glimpsesWatched: { ...progress.glimpsesWatched, [choice]: true } };
}

export type TransitionResult<Reason extends string> =
  | { ok: true; progress: SeriesProgress }
  | { ok: false; reason: Reason; progress: SeriesProgress };

/** Cast the one ballot. Refused on day 2, if a ballot exists, or before the question. */
export function castBallot(
  series: Series,
  progress: SeriesProgress,
  demo: DemoState,
  choice: Choice,
  now: number,
): TransitionResult<CastBallotBlock> {
  const verdict = canCastBallot(series, progress, demo);
  if (!verdict.allowed) return { ok: false, reason: verdict.reason, progress };
  return { ok: true, progress: { ...progress, ballot: { choice, castAt: now, moved: false, movedAt: null, kept: false } } };
}

/** Move the ballot to the other choice. Allowed once, on day 1, after both endings. */
export function moveBallot(series: Series, progress: SeriesProgress, demo: DemoState, now: number): TransitionResult<MoveBallotBlock> {
  const verdict = canMoveBallot(series, progress, demo);
  if (!verdict.allowed || !progress.ballot) {
    return { ok: false, reason: verdict.allowed ? "no-ballot" : verdict.reason, progress };
  }
  return {
    ok: true,
    progress: { ...progress, ballot: { ...progress.ballot, choice: otherChoice(progress.ballot.choice), moved: true, movedAt: now } },
  };
}

/**
 * "Keep my ballot" on the keep-or-move screen. Allowed exactly when a move
 * is, and just as final: afterwards the ballot cannot move on day 1, and the
 * viewer is not sent to keep-or-move again.
 */
export function keepBallot(series: Series, progress: SeriesProgress, demo: DemoState): TransitionResult<MoveBallotBlock> {
  const verdict = canMoveBallot(series, progress, demo);
  if (!verdict.allowed || !progress.ballot) {
    return { ok: false, reason: verdict.allowed ? "no-ballot" : verdict.reason, progress };
  }
  return { ok: true, progress: { ...progress, ballot: { ...progress.ballot, kept: true } } };
}

// ---------------------------------------------------------------------------
// Whole-viewer changes
// ---------------------------------------------------------------------------

/** Apply a change to one series' progress inside the viewer state. */
export function updateSeries(viewer: ViewerState, seriesId: string, change: (progress: SeriesProgress) => SeriesProgress): ViewerState {
  const current = viewer.series[seriesId] ?? emptyProgress();
  const next = change(current);
  if (next === current) return viewer;
  return { ...viewer, series: { ...viewer.series, [seriesId]: next } };
}

/**
 * Start a new demo epoch (see `ViewerState.epoch`): saves from playback
 * sessions that began before this are ignored from now on. Every presenter
 * action that rewrites the viewer calls it.
 */
export function newEpoch(viewer: ViewerState): ViewerState {
  return { ...viewer, epoch: viewer.epoch + 1 };
}

/**
 * Is a save from a session that started in `epoch` out of date? A save
 * without an epoch (undefined) is never stale.
 */
export function isStaleEpoch(viewer: Pick<ViewerState, "epoch">, epoch: number | undefined): boolean {
  return epoch !== undefined && epoch !== viewer.epoch;
}

/** The reset button: clears all watch history (progress, glimpses, ballots). Language, subtitles and the welcome stay. Starts a new epoch. */
export function resetHistory(viewer: ViewerState): ViewerState {
  return newEpoch({ ...viewer, series: {} });
}

/** Back to a first-time visitor: history gone, welcome shown again, defaults restored. Starts a new epoch. */
export function resetEverything(viewer: Pick<ViewerState, "epoch">): ViewerState {
  return { ...DEFAULT_VIEWER_STATE, series: {}, epoch: viewer.epoch + 1 };
}

// ---------------------------------------------------------------------------
// Reading stored state back safely
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isChoice = (value: unknown): value is Choice => value === "A" || value === "B";
const isLang = (value: unknown): value is Lang => (LANGS as readonly unknown[]).includes(value);
const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function sanitizeProgress(input: unknown): SeriesProgress {
  const progress = emptyProgress();
  if (!isRecord(input)) return progress;
  if (isRecord(input.episodes)) {
    for (const [id, raw] of Object.entries(input.episodes)) {
      if (!isRecord(raw)) continue;
      progress.episodes[id] = {
        positionMs: isTime(raw.positionMs) ? raw.positionMs : 0,
        lang: isLang(raw.lang) ? raw.lang : "hi",
        shotId: typeof raw.shotId === "string" ? raw.shotId : null,
        completed: raw.completed === true,
        completedAt: isTime(raw.completedAt) ? raw.completedAt : null,
        updatedAt: isTime(raw.updatedAt) ? raw.updatedAt : 0,
      };
    }
  }
  if (typeof input.lastPlayableId === "string") progress.lastPlayableId = input.lastPlayableId;
  if (isRecord(input.glimpsesWatched)) {
    progress.glimpsesWatched = { A: input.glimpsesWatched.A === true, B: input.glimpsesWatched.B === true };
  }
  if (isRecord(input.ballot) && isChoice(input.ballot.choice)) {
    progress.ballot = {
      choice: input.ballot.choice,
      castAt: isTime(input.ballot.castAt) ? input.ballot.castAt : 0,
      moved: input.ballot.moved === true,
      movedAt: isTime(input.ballot.movedAt) ? input.ballot.movedAt : null,
      kept: input.ballot.kept === true,
    };
  }
  return progress;
}

/** Turn whatever was found in localStorage into a valid ViewerState. Unknown or damaged parts fall back to defaults. */
export function sanitizeViewerState(input: unknown): ViewerState {
  const state: ViewerState = { ...DEFAULT_VIEWER_STATE, series: {} };
  if (!isRecord(input)) return state;
  if (isLang(input.language)) state.language = input.language;
  if (typeof input.subtitlesOn === "boolean") state.subtitlesOn = input.subtitlesOn;
  if (typeof input.welcomeSeen === "boolean") state.welcomeSeen = input.welcomeSeen;
  if (typeof input.epoch === "number" && Number.isSafeInteger(input.epoch) && input.epoch >= 0) state.epoch = input.epoch;
  if (isRecord(input.series)) {
    for (const [seriesId, raw] of Object.entries(input.series)) state.series[seriesId] = sanitizeProgress(raw);
  }
  return state;
}

const isDemoDay = (value: unknown): value is DemoDay => value === 1 || value === 2 || value === "last-hour";

/** Turn whatever was found in localStorage into a valid DemoState. */
export function sanitizeDemoState(input: unknown): DemoState {
  const state: DemoState = { ...DEFAULT_DEMO_STATE };
  if (!isRecord(input)) return state;
  if (isDemoDay(input.day)) state.day = input.day;
  if (isChoice(input.winnerOverride)) state.winnerOverride = input.winnerOverride;
  if (isTime(input.launchAt)) state.launchAt = input.launchAt;
  return state;
}
