/**
 * The product rules (plan section 2, as overridden by section 9), as pure
 * functions. No React, no stores, no clock of their own: every function takes
 * the manifest, the viewer's progress for that series and the demo state, and
 * returns an answer. Screens never re-derive a rule; they call one of these.
 *
 * The rules in one place:
 * - Day 1 (including its last hour): both endings exist. One ballot per viewer,
 *   cast after the last shared episode. Glimpses are optional.
 * - The other ending opens only after the viewer finishes their own, and only
 *   on day 1.
 * - A viewer who has finished both endings can move the ballot once, on day 1,
 *   or keep it where it is. Either way the decision is final for day 1.
 * - Day 2: only the official ending remains. It is the forced winner if the
 *   presenter set one, otherwise the side with more ballots (seeded numbers
 *   plus the viewer's own ballot); a tie goes to A.
 * - On day 2 a viewer keeps every episode of the losing ending that they
 *   finished on day 1. The rest of it has expired.
 * - A late viewer (day 2, no ballot) watches the shared episodes, sees the
 *   question, may watch both glimpses, sees the split, and continues on the
 *   official ending. No ballot.
 */
import {
  branchEpisodes,
  branchOf,
  endingEpisode,
  episodeLabel,
  findPlayable,
  firstEpisode,
  getEpisode,
  lastSharedEpisode,
  nextEpisodeOnPath,
  otherChoice,
  sharedEpisodes,
  shotStartMs,
} from "@/content/helpers";
import type { Choice, Lang, PlayableMedia, Series } from "@/content/schema";
import type { DemoDay, DemoState, EpisodeProgress, SeriesProgress, ViewerState } from "./types";
import { EMPTY_PROGRESS } from "./types";

// ---------------------------------------------------------------------------
// The demo clock
// ---------------------------------------------------------------------------

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** How much of day 1 is left at the moment the presenter picks a phase. */
export const FRESH_REMAINING_MS: Record<DemoDay, number> = {
  1: 21 * HOUR_MS + 45 * 60 * 1000,
  "last-hour": 45 * 60 * 1000,
  2: 0,
};

export function isDayTwo(demo: DemoState): boolean {
  return demo.day === 2;
}

/** True on day 1, including its last hour. */
export function isDayOne(demo: DemoState): boolean {
  return demo.day !== 2;
}

export function isLastHour(demo: DemoState): boolean {
  return demo.day === "last-hour";
}

/** The launch time that puts the countdown where a freshly picked phase should start. */
export function launchAtFor(day: DemoDay, now: number): number {
  if (day === 2) return now - DAY_MS - 2 * HOUR_MS;
  return now - (DAY_MS - FRESH_REMAINING_MS[day]);
}

/** The range the countdown is held in for a day-1 phase: above one hour on day 1, one second to one hour in the last hour. */
function countdownWindow(day: 1 | "last-hour"): [low: number, high: number] {
  return day === 1 ? [HOUR_MS + 1000, DAY_MS] : [1000, HOUR_MS];
}

/**
 * Milliseconds left in day 1, for the countdown. 0 on day 2.
 *
 * The day only ever changes by hand, so the countdown is held inside the
 * window of the phase the presenter chose: above one hour on day 1, between
 * one second and one hour in the last hour. It never reaches zero by itself.
 * A window that has run out is started again when the app loads
 * (`launchAtOnLoad`), so the countdown does not sit at its floor.
 */
export function dayOneRemainingMs(demo: DemoState, now: number): number {
  if (demo.day === 2) return 0;
  const raw = demo.launchAt === null ? FRESH_REMAINING_MS[demo.day] : demo.launchAt + DAY_MS - now;
  const [low, high] = countdownWindow(demo.day);
  return Math.min(high, Math.max(low, raw));
}

/**
 * The launch time to use when the app loads. A missing one is set for the
 * current phase. A day-1 or last-hour countdown that has left its window
 * (it has run down to its floor, typically because the demo was set up the
 * day before, or the device clock went backwards) starts the phase again:
 * 21:45:00 on day 1, 00:45:00 in the last hour. The day itself never
 * changes; that is the presenter's job. A countdown still inside its window
 * is left alone, so a reload does not restart it.
 */
export function launchAtOnLoad(demo: DemoState, now: number): number {
  if (demo.launchAt === null) return launchAtFor(demo.day, now);
  if (demo.day === 2) return demo.launchAt;
  const raw = demo.launchAt + DAY_MS - now;
  const [low, high] = countdownWindow(demo.day);
  return raw > low && raw <= high ? demo.launchAt : launchAtFor(demo.day, now);
}

/** "02:14:09". Hours can exceed 99 only if the input does. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// ---------------------------------------------------------------------------
// What the viewer has done
// ---------------------------------------------------------------------------

/** A viewer's progress for one series; a stable empty one if they have none. */
export function progressFor(viewer: Pick<ViewerState, "series">, seriesId: string): SeriesProgress {
  return viewer.series[seriesId] ?? EMPTY_PROGRESS;
}

export function isStarted(progress: SeriesProgress, episodeId: string): boolean {
  return episodeId in progress.episodes;
}

export function isCompleted(progress: SeriesProgress, episodeId: string): boolean {
  return progress.episodes[episodeId]?.completed === true;
}

/** Has the viewer opened anything in this series? */
export function hasStarted(progress: SeriesProgress): boolean {
  return Object.keys(progress.episodes).length > 0 || progress.ballot !== null;
}

/** The viewer has finished the last shared episode: the cliffhanger and the question. */
export function questionReached(series: Series, progress: SeriesProgress): boolean {
  return isCompleted(progress, lastSharedEpisode(series).id);
}

/** An ending is finished when the last episode of that branch has been watched to the end. */
export function endingFinished(series: Series, progress: SeriesProgress, choice: Choice): boolean {
  return isCompleted(progress, endingEpisode(series, choice).id);
}

export function endingsFinished(series: Series, progress: SeriesProgress): Record<Choice, boolean> {
  return { A: endingFinished(series, progress, "A"), B: endingFinished(series, progress, "B") };
}

export function bothEndingsFinished(series: Series, progress: SeriesProgress): boolean {
  return endingFinished(series, progress, "A") && endingFinished(series, progress, "B");
}

/** The viewer has finished the ending their ballot is NOT on. */
export function otherEndingWatched(series: Series, progress: SeriesProgress): boolean {
  return progress.ballot !== null && endingFinished(series, progress, otherChoice(progress.ballot.choice));
}

export type ViewerKind =
  /** Day 1, no ballot yet. */
  | "day1-undecided"
  /** Day 1, ballot cast. */
  | "day1-voted"
  /** Day 2, voted on day 1. */
  | "day2-voter"
  /** Day 2, never voted: the late viewer. */
  | "day2-late";

export function viewerKind(progress: SeriesProgress, demo: DemoState): ViewerKind {
  if (isDayOne(demo)) return progress.ballot ? "day1-voted" : "day1-undecided";
  return progress.ballot ? "day2-voter" : "day2-late";
}

export function isLateViewer(progress: SeriesProgress, demo: DemoState): boolean {
  return viewerKind(progress, demo) === "day2-late";
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type Verdict<Reason extends string> = { allowed: true } | { allowed: false; reason: Reason };

export type CastBallotBlock = "voting-closed" | "already-cast" | "question-not-reached";

/**
 * Can the viewer cast a ballot now? Day 1 only, once, after the last shared
 * episode. Glimpses are optional (plan section 9): they are not checked.
 */
export function canCastBallot(series: Series, progress: SeriesProgress, demo: DemoState): Verdict<CastBallotBlock> {
  if (isDayTwo(demo)) return { allowed: false, reason: "voting-closed" };
  if (progress.ballot) return { allowed: false, reason: "already-cast" };
  if (!questionReached(series, progress)) return { allowed: false, reason: "question-not-reached" };
  return { allowed: true };
}

export type OtherEndingBlock = "no-ballot" | "day-one-only" | "own-ending-not-finished";

/** Can the viewer watch the ending they did not vote for? Only after finishing their own, only on day 1. */
export function canWatchOtherEnding(series: Series, progress: SeriesProgress, demo: DemoState): Verdict<OtherEndingBlock> {
  if (!progress.ballot) return { allowed: false, reason: "no-ballot" };
  if (isDayTwo(demo)) return { allowed: false, reason: "day-one-only" };
  if (!endingFinished(series, progress, progress.ballot.choice)) return { allowed: false, reason: "own-ending-not-finished" };
  return { allowed: true };
}

export type MoveBallotBlock = "no-ballot" | "voting-closed" | "already-moved" | "kept" | "both-endings-not-finished";

/**
 * Can the viewer move their ballot to the other choice? Day 1, both endings
 * finished, once, and not after choosing to keep it (`keepBallot`).
 * Also the condition for keeping it: the keep-or-move decision is open
 * exactly while this is allowed.
 */
export function canMoveBallot(series: Series, progress: SeriesProgress, demo: DemoState): Verdict<MoveBallotBlock> {
  if (!progress.ballot) return { allowed: false, reason: "no-ballot" };
  if (isDayTwo(demo)) return { allowed: false, reason: "voting-closed" };
  if (progress.ballot.moved) return { allowed: false, reason: "already-moved" };
  if (progress.ballot.kept) return { allowed: false, reason: "kept" };
  if (!bothEndingsFinished(series, progress)) return { allowed: false, reason: "both-endings-not-finished" };
  return { allowed: true };
}

/** The split is shown after the viewer has cast a ballot on day 1, and to everyone on day 2. */
export function canSeeSplit(progress: SeriesProgress, demo: DemoState): boolean {
  return isDayTwo(demo) || progress.ballot !== null;
}

// ---------------------------------------------------------------------------
// The tally and the official ending
// ---------------------------------------------------------------------------

export interface Tally {
  A: number;
  B: number;
  total: number;
  /** Whole percentages that always add up to 100. */
  percentA: number;
  percentB: number;
  /** The side that is ahead. A tie goes to A. */
  leader: Choice;
  /** True when the presenter forced the winner. */
  forced: boolean;
}

/** More ballots wins; a tie goes to A. */
export function winnerOf(counts: Record<Choice, number>): Choice {
  return counts.B > counts.A ? "B" : "A";
}

/**
 * The simulated audience split: the seeded numbers plus the viewer's own
 * ballot, wherever it is now.
 *
 * If the presenter forced a winner the numbers are made to agree with it, so
 * the bar never contradicts the headline: the seeded numbers are swapped, and
 * if that is still not enough (level seeds) the forced side gets the smallest
 * lead that wins.
 */
export function tally(series: Series, progress: SeriesProgress, demo: DemoState): Tally {
  const own = progress.ballot?.choice ?? null;
  const withOwn = (base: Record<Choice, number>): Record<Choice, number> => ({
    A: base.A + (own === "A" ? 1 : 0),
    B: base.B + (own === "B" ? 1 : 0),
  });
  let counts = withOwn(series.seededTallies);
  const forced = demo.winnerOverride;
  if (forced && winnerOf(counts) !== forced) {
    counts = withOwn({ A: series.seededTallies.B, B: series.seededTallies.A });
    if (winnerOf(counts) !== forced) {
      counts = forced === "A" ? { A: counts.B, B: counts.B } : { A: counts.A, B: counts.A + 1 };
    }
  }
  const total = counts.A + counts.B;
  const percentA = total === 0 ? 50 : Math.round((counts.A * 100) / total);
  return {
    A: counts.A,
    B: counts.B,
    total,
    percentA,
    percentB: 100 - percentA,
    leader: winnerOf(counts),
    forced: forced !== null,
  };
}

/**
 * Which branch is (or, on day 1, would be) the official ending: the forced
 * winner if there is one, otherwise the leader of the tally including the
 * viewer's own ballot, tie to A.
 */
export function officialBranch(series: Series, progress: SeriesProgress, demo: DemoState): Choice {
  return tally(series, progress, demo).leader;
}

/** The official ending, or null on day 1 when nothing is decided yet. */
export function decidedOfficialBranch(series: Series, progress: SeriesProgress, demo: DemoState): Choice | null {
  return isDayTwo(demo) ? officialBranch(series, progress, demo) : null;
}

// ---------------------------------------------------------------------------
// Access: what can be played right now
// ---------------------------------------------------------------------------

export type AccessReason =
  // open
  | "shared"
  | "your-ending"
  | "other-ending-unlocked"
  | "official-ending"
  | "kept-from-day-one"
  | "glimpse"
  // locked
  | "question-not-reached"
  | "vote-first"
  | "finish-your-ending-first"
  | "unknown"
  // expired
  | "not-the-official-ending";

export interface Access {
  /** open = can be played. locked = not yet. expired = gone for this viewer. */
  state: "open" | "locked" | "expired";
  reason: AccessReason;
}

const open = (reason: AccessReason): Access => ({ state: "open", reason });
const locked = (reason: AccessReason): Access => ({ state: "locked", reason });
const expired = (reason: AccessReason): Access => ({ state: "expired", reason });

/** Can this episode be played by this viewer today, and if not, why. */
export function episodeAccess(series: Series, progress: SeriesProgress, demo: DemoState, episodeId: string): Access {
  const episode = getEpisode(series, episodeId);
  if (!episode) return locked("unknown");
  const branch = branchOf(episode);
  if (!branch) return open("shared");

  const ballot = progress.ballot;
  if (isDayOne(demo)) {
    if (!ballot) return locked(questionReached(series, progress) ? "vote-first" : "question-not-reached");
    if (ballot.choice === branch) return open("your-ending");
    return endingFinished(series, progress, ballot.choice) ? open("other-ending-unlocked") : locked("finish-your-ending-first");
  }

  if (branch === officialBranch(series, progress, demo)) {
    return ballot || questionReached(series, progress) ? open("official-ending") : locked("question-not-reached");
  }
  // Day 2, the ending that lost: the viewer keeps what they finished on day 1.
  return isCompleted(progress, episode.id) ? open("kept-from-day-one") : expired("not-the-official-ending");
}

/** Glimpses open with the question, on both days. Watching them is never required. */
export function glimpseAccess(series: Series, progress: SeriesProgress): Access {
  return progress.ballot || questionReached(series, progress) ? open("glimpse") : locked("question-not-reached");
}

/** Access for anything the player route can be asked to play: an episode id or a glimpse id. */
export function playableAccess(series: Series, progress: SeriesProgress, demo: DemoState, playableId: string): Access {
  const playable = findPlayable(series, playableId);
  if (!playable) return locked("unknown");
  if (playable.type === "glimpse") return glimpseAccess(series, progress);
  return episodeAccess(series, progress, demo, playableId);
}

/** Episode ids that have expired for this viewer. Empty on day 1. */
export function expiredEpisodeIds(series: Series, progress: SeriesProgress, demo: DemoState): string[] {
  return series.episodes.filter((e) => episodeAccess(series, progress, demo, e.id).state === "expired").map((e) => e.id);
}

// ---------------------------------------------------------------------------
// Where the viewer goes next
// ---------------------------------------------------------------------------

/** A destination in the viewer flow. `stepHref` in lib/routes.ts turns it into a URL. */
export type Step =
  | { type: "episode"; episodeId: string }
  | { type: "question" }
  | { type: "glimpses" }
  | { type: "ending"; branch: Choice }
  | { type: "keep-or-move" }
  | { type: "result" }
  | { type: "series" };

function withCompleted(progress: SeriesProgress, episodeId: string): SeriesProgress {
  if (isCompleted(progress, episodeId)) return progress;
  const existing = progress.episodes[episodeId];
  return {
    ...progress,
    episodes: {
      ...progress.episodes,
      [episodeId]: {
        positionMs: 0,
        lang: existing?.lang ?? "hi",
        shotId: null,
        completed: true,
        completedAt: existing?.completedAt ?? 0,
        updatedAt: existing?.updatedAt ?? 0,
      },
    },
  };
}

/**
 * Where to go when an episode or glimpse finishes playing. It makes no
 * difference whether the completion has been recorded yet: the answer is
 * worked out as if it has.
 *
 * - a glimpse -> back to the two glimpses
 * - a shared episode -> the next one; the last one -> the question
 * - a branch episode -> the next one in that branch
 * - the last episode of a branch -> on day 1, "keep or move" if that was the
 *   second ending and the ballot can still move, otherwise the ending screen;
 *   on day 2, the ending screen
 */
export function afterPlayable(series: Series, progress: SeriesProgress, demo: DemoState, playableId: string): Step {
  const playable = findPlayable(series, playableId);
  if (!playable) return { type: "series" };
  if (playable.type === "glimpse") return { type: "glimpses" };

  const episode = playable.episode;
  const after = withCompleted(progress, episode.id);
  const branch = branchOf(episode);
  const next = nextEpisodeOnPath(series, episode.id);

  if (!branch) return next ? { type: "episode", episodeId: next.id } : { type: "question" };

  if (next) {
    return episodeAccess(series, after, demo, next.id).state === "open" ? { type: "episode", episodeId: next.id } : { type: "series" };
  }
  if (isDayOne(demo) && canMoveBallot(series, after, demo).allowed) return { type: "keep-or-move" };
  return { type: "ending", branch };
}

function firstUnfinished(series: Series, progress: SeriesProgress, branch: Choice): string | null {
  return branchEpisodes(series, branch).find((e) => !isCompleted(progress, e.id))?.id ?? null;
}

/**
 * The single "continue" target for a series: what the main button on the home
 * and series pages does, and the resume point in My choices.
 */
export function continueStep(series: Series, progress: SeriesProgress, demo: DemoState): Step {
  // 1. Something was left half watched and can still be played: go back to it.
  const last = progress.lastPlayableId;
  if (last && getEpisode(series, last) && !isCompleted(progress, last) && episodeAccess(series, progress, demo, last).state === "open") {
    return { type: "episode", episodeId: last };
  }

  // 2. Still in the shared episodes.
  if (!questionReached(series, progress) && !progress.ballot) {
    const nextShared = sharedEpisodes(series).find((e) => !isCompleted(progress, e.id)) ?? firstEpisode(series);
    return { type: "episode", episodeId: nextShared.id };
  }

  const ballot = progress.ballot;
  if (isDayOne(demo)) {
    if (!ballot) return { type: "question" };
    const own = ballot.choice;
    const nextOwn = firstUnfinished(series, progress, own);
    if (nextOwn) return { type: "episode", episodeId: nextOwn };
    const other = otherChoice(own);
    const nextOther = firstUnfinished(series, progress, other);
    if (nextOther) {
      // Their ending is done. If they have begun the other one, carry on with
      // it; otherwise show the ending screen, which makes the offer.
      const begun = branchEpisodes(series, other).some((e) => isStarted(progress, e.id));
      return begun ? { type: "episode", episodeId: nextOther } : { type: "ending", branch: own };
    }
    return canMoveBallot(series, progress, demo).allowed ? { type: "keep-or-move" } : { type: "ending", branch: own };
  }

  // Day 2: the result first, then the official ending.
  const official = officialBranch(series, progress, demo);
  const nextOfficial = firstUnfinished(series, progress, official);
  if (!nextOfficial) return { type: "ending", branch: official };
  const begun = branchEpisodes(series, official).some((e) => isStarted(progress, e.id));
  return begun ? { type: "episode", episodeId: nextOfficial } : { type: "result" };
}

export interface ResumePoint {
  episodeId: string;
  positionMs: number;
  lang: Lang;
  shotId: string | null;
}

/** The half-watched episode to resume, if there is one and it can still be played. */
export function resumePoint(series: Series, progress: SeriesProgress, demo: DemoState): ResumePoint | null {
  const last = progress.lastPlayableId;
  if (!last) return null;
  const saved = progress.episodes[last];
  if (!saved || saved.completed || saved.positionMs <= 0) return null;
  if (episodeAccess(series, progress, demo, last).state !== "open") return null;
  return { episodeId: last, positionMs: saved.positionMs, lang: saved.lang, shotId: saved.shotId };
}

/**
 * Where the player should start an episode, in ms of the `lang` video.
 * A finished or never-opened episode starts at 0. A half-watched one resumes
 * where it stopped; if the audio language has changed since, it resumes at the
 * start of the shot it stopped in, because the two cuts differ in length.
 */
export function startPositionMs(media: PlayableMedia, saved: EpisodeProgress | undefined, lang: Lang): number {
  if (!saved || saved.completed || saved.positionMs <= 0) return 0;
  if (saved.lang === lang) return Math.min(saved.positionMs, media.durationMs[lang]);
  return saved.shotId ? (shotStartMs(media, lang, saved.shotId) ?? 0) : 0;
}

// ---------------------------------------------------------------------------
// What the question, result and ending screens show
// ---------------------------------------------------------------------------

export interface QuestionView {
  /** Has the viewer finished the last shared episode (or already voted)? If not, send them back to watch. */
  reached: boolean;
  /**
   * vote: day 1, no ballot yet. voted: day 1, ballot cast.
   * result: day 2, the question with the audience result in place of the ballot.
   */
  mode: "vote" | "voted" | "result";
  /** Day 2 and never voted. */
  isLateViewer: boolean;
  /** The ballot can be cast right now. */
  ballotOpen: boolean;
  /** Both glimpses can be opened. True on both days once the question is reached. Never required. */
  glimpsesAvailable: boolean;
  /** The audience split may be shown. */
  splitVisible: boolean;
  /** Where the viewer's ballot is, or null. */
  yourChoice: Choice | null;
  /** The official ending; null on day 1. */
  official: Choice | null;
  /** Where the screen's primary button leads. */
  primary: Step;
}

/** What the question screen shows this viewer today. Covers the day-2 late viewer. */
export function questionView(series: Series, progress: SeriesProgress, demo: DemoState): QuestionView {
  const reached = progress.ballot !== null || questionReached(series, progress);
  const base = {
    reached,
    isLateViewer: isLateViewer(progress, demo),
    ballotOpen: canCastBallot(series, progress, demo).allowed,
    glimpsesAvailable: glimpseAccess(series, progress).state === "open",
    splitVisible: canSeeSplit(progress, demo),
    yourChoice: progress.ballot?.choice ?? null,
    official: decidedOfficialBranch(series, progress, demo),
  };
  if (!reached) {
    return { ...base, mode: isDayTwo(demo) ? "result" : "vote", splitVisible: false, primary: continueStep(series, progress, demo) };
  }
  if (isDayTwo(demo)) return { ...base, mode: "result", primary: { type: "result" } };
  if (progress.ballot) return { ...base, mode: "voted", primary: continueStep(series, progress, demo) };
  return { ...base, mode: "vote", primary: { type: "glimpses" } };
}

export interface ResultView {
  /** The ending the audience chose. */
  official: Choice;
  tally: Tally;
  isLateViewer: boolean;
  yourChoice: Choice | null;
  /** Did the viewer's ballot end on the winning side? null if they never voted. */
  choseOfficial: boolean | null;
  /** Episodes of the losing ending this viewer finished on day 1 and can still watch. */
  keptEpisodeIds: string[];
  /** Episodes of the losing ending that are gone for this viewer. */
  expiredEpisodeIds: string[];
  /** Both glimpses stay available so a late viewer can see what they missed. */
  glimpsesAvailable: boolean;
  /** The primary button: into the official ending (or its ending screen if already finished). */
  enter: Step;
}

/** What the day-2 result screen shows. Only meaningful on day 2. */
export function resultView(series: Series, progress: SeriesProgress, demo: DemoState): ResultView {
  const official = officialBranch(series, progress, demo);
  const losing = branchEpisodes(series, otherChoice(official));
  const nextOfficial = firstUnfinished(series, progress, official);
  return {
    official,
    tally: tally(series, progress, demo),
    isLateViewer: isLateViewer(progress, demo),
    yourChoice: progress.ballot?.choice ?? null,
    choseOfficial: progress.ballot ? progress.ballot.choice === official : null,
    keptEpisodeIds: losing.filter((e) => isCompleted(progress, e.id)).map((e) => e.id),
    expiredEpisodeIds: losing.filter((e) => !isCompleted(progress, e.id)).map((e) => e.id),
    glimpsesAvailable: glimpseAccess(series, progress).state === "open",
    enter: nextOfficial ? { type: "episode", episodeId: nextOfficial } : { type: "ending", branch: official },
  };
}

export interface EndingView {
  branch: Choice;
  /** Has the viewer actually finished this ending? */
  finished: boolean;
  splitVisible: boolean;
  /** Day 1 only: offer the other ending. */
  offerOtherEnding: boolean;
  otherBranch: Choice;
  /** First episode to play if they take the offer. */
  otherEndingStart: string | null;
  /** Day 1 only: both endings are finished and the ballot can still move. */
  offerKeepOrMove: boolean;
  /** The official ending; null on day 1. */
  official: Choice | null;
}

/** What the ending screen shows after the last episode of `branch`. */
export function endingView(series: Series, progress: SeriesProgress, demo: DemoState, branch: Choice): EndingView {
  const other = otherChoice(branch);
  const otherOpen = canWatchOtherEnding(series, progress, demo).allowed;
  return {
    branch,
    finished: endingFinished(series, progress, branch),
    splitVisible: canSeeSplit(progress, demo),
    offerOtherEnding: otherOpen && progress.ballot?.choice === branch && !endingFinished(series, progress, other),
    otherBranch: other,
    otherEndingStart: firstUnfinished(series, progress, other) ?? branchEpisodes(series, other)[0]?.id ?? null,
    offerKeepOrMove: canMoveBallot(series, progress, demo).allowed,
    official: decidedOfficialBranch(series, progress, demo),
  };
}

// ---------------------------------------------------------------------------
// History: the My choices screen
// ---------------------------------------------------------------------------

export interface EpisodeHistory {
  id: string;
  /** "1", "2", "3A"... */
  label: string;
  completed: boolean;
  started: boolean;
  access: Access;
}

export interface BranchHistory {
  branch: Choice;
  /** How far the viewer got. */
  watched: "not-started" | "in-progress" | "finished";
  /**
   * What is true of this ending for this viewer today:
   * open = every episode can be played; locked = not yet (day 1);
   * expired = none of it can be played; partly-expired = they keep the
   * episodes they finished on day 1 and the rest is gone.
   */
  availability: "open" | "locked" | "expired" | "partly-expired";
  /** null on day 1: nothing is official yet. */
  isOfficial: boolean | null;
  /** The viewer's ballot is on this ending. */
  isYourChoice: boolean;
  episodes: EpisodeHistory[];
  expiredEpisodeIds: string[];
  /** Day 2, the losing ending: episodes still watchable because they were finished on day 1. */
  keptEpisodeIds: string[];
}

export interface HistoryEntry {
  seriesId: string;
  /** False if the viewer has never opened this series. */
  started: boolean;
  phase: "day-one" | "day-two";
  /** What you chose: where the ballot is now. null = no ballot. */
  choice: Choice | null;
  /** The ballot was moved once. */
  moved: boolean;
  /** The viewer chose to keep the ballot where it was cast, at keep-or-move. */
  kept: boolean;
  /** What won. null on day 1. */
  official: Choice | null;
  /** null if there is no ballot or nothing is decided. */
  choseOfficial: boolean | null;
  shared: EpisodeHistory[];
  branches: Record<Choice, BranchHistory>;
  /** A half-watched episode to resume, if any. */
  resume: ResumePoint | null;
  /** The continue target. */
  next: Step;
}

function episodeHistory(series: Series, progress: SeriesProgress, demo: DemoState, episodeId: string): EpisodeHistory {
  const episode = getEpisode(series, episodeId)!;
  return {
    id: episode.id,
    label: episodeLabel(episode),
    completed: isCompleted(progress, episode.id),
    started: isStarted(progress, episode.id),
    access: episodeAccess(series, progress, demo, episode.id),
  };
}

function branchHistory(series: Series, progress: SeriesProgress, demo: DemoState, branch: Choice): BranchHistory {
  const episodes = branchEpisodes(series, branch).map((e) => episodeHistory(series, progress, demo, e.id));
  const official = decidedOfficialBranch(series, progress, demo);
  const expiredIds = episodes.filter((e) => e.access.state === "expired").map((e) => e.id);
  const keptIds = episodes.filter((e) => e.access.reason === "kept-from-day-one").map((e) => e.id);
  const openCount = episodes.filter((e) => e.access.state === "open").length;

  let availability: BranchHistory["availability"];
  if (expiredIds.length === episodes.length) availability = "expired";
  else if (expiredIds.length > 0) availability = "partly-expired";
  else if (openCount === episodes.length) availability = "open";
  else availability = "locked";

  let watched: BranchHistory["watched"] = "not-started";
  if (endingFinished(series, progress, branch)) watched = "finished";
  else if (episodes.some((e) => e.started)) watched = "in-progress";

  return {
    branch,
    watched,
    availability,
    isOfficial: official === null ? null : official === branch,
    isYourChoice: progress.ballot?.choice === branch,
    episodes,
    expiredEpisodeIds: expiredIds,
    keptEpisodeIds: keptIds,
  };
}

/** Everything the My choices screen shows for one series: what you chose, what won, what expired, where to resume. */
export function historyEntry(series: Series, progress: SeriesProgress, demo: DemoState): HistoryEntry {
  const official = decidedOfficialBranch(series, progress, demo);
  const choice = progress.ballot?.choice ?? null;
  return {
    seriesId: series.id,
    started: hasStarted(progress),
    phase: isDayTwo(demo) ? "day-two" : "day-one",
    choice,
    moved: progress.ballot?.moved ?? false,
    kept: progress.ballot?.kept ?? false,
    official,
    choseOfficial: choice && official ? choice === official : null,
    shared: sharedEpisodes(series).map((e) => episodeHistory(series, progress, demo, e.id)),
    branches: {
      A: branchHistory(series, progress, demo, "A"),
      B: branchHistory(series, progress, demo, "B"),
    },
    resume: resumePoint(series, progress, demo),
    next: continueStep(series, progress, demo),
  };
}
