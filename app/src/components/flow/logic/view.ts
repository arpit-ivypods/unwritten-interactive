/**
 * Flow screens: turning what the rules answer into words and component props.
 * OWNER: flow engineer.
 *
 * Nothing here decides a product rule. Every function takes an answer from
 * `@/state/rules` (a Step, an Access, a HistoryEntry, a ResultView...) and
 * returns the label, chip or rail item that shows it. Pure, no React, tested
 * in view.test.ts.
 */
import { cliffhangerStill, episodeLabel, getEpisode, pathLength } from "@/content/helpers";
import type { Choice, Lang, Series, VisualStyle } from "@/content/schema";
import { routes } from "@/lib/routes";
import { bothEndingsFinished, endingFinished, hasStarted, isCompleted, isStarted, questionReached } from "@/state/rules";
import type { AccessReason, BranchHistory, EndingView, EpisodeHistory, HistoryEntry, ResultView, Step } from "@/state/rules";
import type { ViewerPresetId } from "@/state/presets";
import type { Ballot, SeriesProgress } from "@/state/types";

/** Same union as the design system's StatusChip kinds. */
export type ChipKind = "live" | "alert" | "canon" | "locked" | "plain" | "default";

export interface Chip {
  kind: ChipKind;
  label: string;
}

/** Same shape as the design system's EpisodeRail item. */
export interface RailPill {
  key: string;
  label?: string;
  state: "todo" | "done" | "now" | "choice" | "locked" | "expired";
  href?: string;
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// The day
// ---------------------------------------------------------------------------

export interface DayFlags {
  isDayTwo: boolean;
  isLastHour: boolean;
}

/**
 * The day status in words, for chips. `full` is for panels and cards, `short`
 * for the phone nav pill, where it also carries the countdown.
 * `countdownText` is "21:44:58", or null before the page has mounted.
 */
export function dayStatus(flags: DayFlags, countdownText: string | null): { kind: ChipKind; full: string; short: string } {
  if (flags.isDayTwo) return { kind: "canon", full: "Day 2 · official ending only", short: "Day 2 · official ending" };
  const time = countdownText ?? "--:--:--";
  if (flags.isLastHour) return { kind: "alert", full: `Last hour · closes in ${time}`, short: `Last hour · ${time}` };
  return { kind: "live", full: "Day 1 · both endings open", short: `Day 1 · ${time}` };
}

/** "Closes in 02:14:09" for the alert chip in sheets and panels. null on day 2 or before mount. */
export function closesIn(flags: DayFlags, countdownText: string | null): string | null {
  if (flags.isDayTwo || countdownText === null) return null;
  return `Closes in ${countdownText}`;
}

/** The label above the countdown tiles. */
export function countdownLabel(flags: DayFlags): string {
  return flags.isLastHour ? "Last hour: day 1 ends in" : "Day 1 ends in";
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** What a button that leads to this step says. Buttons name the result (design system, Voice). */
export function stepLabel(series: Series, step: Step, progress: SeriesProgress): string {
  switch (step.type) {
    case "episode": {
      const episode = getEpisode(series, step.episodeId);
      const label = episode ? episodeLabel(episode) : "";
      const halfWatched = isStarted(progress, step.episodeId) && !isCompleted(progress, step.episodeId) && (progress.episodes[step.episodeId]?.positionMs ?? 0) > 0;
      return `${halfWatched ? "Continue" : "Play"} episode ${label}`.trim();
    }
    case "question":
      return "Go to the question";
    case "glimpses":
      return "See both glimpses";
    case "ending":
      return `See ending ${step.branch}`;
    case "keep-or-move":
      return "Keep or move your ballot";
    case "result":
      return "See what the audience chose";
    case "series":
      return "Open the series";
  }
}

/**
 * The still a stage shows when it stands for a step, outside the player: the
 * poster of the episode to play, the cliffhanger frame for the question and
 * everything around the ballot. Never a branch frame for a step that is not
 * that branch's own episode (posters never reveal an outcome; final frames do).
 */
export function stepStill(series: Series, step: Step): string {
  if (step.type === "episode") return getEpisode(series, step.episodeId)?.poster ?? series.backdrop;
  if (step.type === "series" || step.type === "ending") return series.backdrop;
  return cliffhangerStill(series);
}

/** The last shot of an ending. Only for a viewer who has finished that ending. */
export function finalFrame(series: Series, episodeId: string): string {
  const episode = getEpisode(series, episodeId);
  if (!episode) return series.backdrop;
  return episode.shots[episode.shots.length - 1]?.still ?? episode.poster;
}

/**
 * One segment per episode on the viewer's path, for the progress bar of a
 * stage that is not playing: watched episodes are done, the one to play next
 * is "now". The path runs through the viewer's ending, or the official one on
 * day 2 if they never voted; before either exists it has the length of A.
 */
export function pathSegments(history: HistoryEntry): Array<"done" | "now" | "todo"> {
  const branch = history.choice ?? history.official ?? "A";
  return [...history.shared, ...history.branches[branch].episodes].map((episode) => {
    if (history.next.type === "episode" && history.next.episodeId === episode.id) return "now";
    return episode.completed ? "done" : "todo";
  });
}

// ---------------------------------------------------------------------------
// Access, in words
// ---------------------------------------------------------------------------

const REASON_TEXT: Record<AccessReason, string> = {
  shared: "open to everyone",
  "your-ending": "your ending",
  "other-ending-unlocked": "open today only",
  "official-ending": "the official ending",
  "kept-from-day-one": "kept from day 1",
  glimpse: "open",
  "question-not-reached": "watch the shared episodes first",
  "vote-first": "cast your ballot first",
  "finish-your-ending-first": "finish your own ending first",
  unknown: "not available",
  "not-the-official-ending": "it was only open on day 1",
};

export function accessReasonText(reason: AccessReason): string {
  return REASON_TEXT[reason];
}

// ---------------------------------------------------------------------------
// The episode rail
// ---------------------------------------------------------------------------

function episodePill(series: Series, episode: EpisodeHistory, next: Step): RailPill {
  const name = `Episode ${episode.label}`;
  if (episode.access.state === "locked") {
    return { key: episode.id, label: episode.label, state: "locked", ariaLabel: `${name}, locked: ${accessReasonText(episode.access.reason)}` };
  }
  if (episode.access.state === "expired") {
    return { key: episode.id, label: episode.label, state: "expired", ariaLabel: `${name}, expired: ${accessReasonText(episode.access.reason)}` };
  }
  const upNext = next.type === "episode" && next.episodeId === episode.id;
  const state: RailPill["state"] = upNext ? "now" : episode.completed ? "done" : "todo";
  const note = upNext ? ", up next" : episode.completed ? ", watched" : "";
  return { key: episode.id, label: episode.label, state, href: routes.watch(series.id, episode.id), ariaLabel: `${name}${note}` };
}

export interface RailView {
  /** The shared episodes, then the branch point. */
  shared: RailPill[];
  /** Each ending's episodes. */
  branches: Record<Choice, RailPill[]>;
}

/**
 * The episode rail for the series page, from the history the rules give.
 * The branch point links to the question once the viewer has reached it.
 */
export function railView(series: Series, history: HistoryEntry, questionIsReached: boolean): RailView {
  const choicePill: RailPill = {
    key: "choice",
    label: "Choice",
    state: "choice",
    href: questionIsReached ? routes.question(series.id) : undefined,
    ariaLabel: questionIsReached ? "The choice: open the question" : `The choice, after episode ${series.branchAfterEpisode}`,
  };
  return {
    shared: [...history.shared.map((e) => episodePill(series, e, history.next)), choicePill],
    branches: {
      A: history.branches.A.episodes.map((e) => episodePill(series, e, history.next)),
      B: history.branches.B.episodes.map((e) => episodePill(series, e, history.next)),
    },
  };
}

// ---------------------------------------------------------------------------
// Endings and history
// ---------------------------------------------------------------------------

/** What this ending is to this viewer today, for the label over an ending. */
export function endingRole(view: EndingView, yourChoice: Choice | null): string {
  if (view.official !== null) return view.official === view.branch ? "The official ending" : "Not official · kept from day 1";
  if (yourChoice === null) return `Ending ${view.branch}`;
  return yourChoice === view.branch ? "Your ending" : "The other ending";
}

const WATCHED_TEXT: Record<BranchHistory["watched"], string> = {
  "not-started": "Not watched",
  "in-progress": "Started",
  finished: "Watched to the end",
};

function labelsOf(series: Series, episodeIds: string[]): string {
  return episodeIds.map((id) => getEpisode(series, id)).map((e) => (e ? episodeLabel(e) : "")).filter(Boolean).join(", ");
}

/** The chips for one ending in My choices: whose it is, how far the viewer got, and whether it can still be played. */
export function branchChips(series: Series, branch: BranchHistory): Chip[] {
  const chips: Chip[] = [];
  if (branch.isOfficial === true) chips.push({ kind: "canon", label: "Official ending" });
  if (branch.isYourChoice) chips.push({ kind: "plain", label: "Your ballot" });
  chips.push({ kind: "plain", label: WATCHED_TEXT[branch.watched] });
  switch (branch.availability) {
    case "open":
      chips.push({ kind: "live", label: branch.isOfficial === false ? "Kept from day 1" : "Open" });
      break;
    case "locked":
      chips.push({ kind: "locked", label: "Locked" });
      break;
    case "expired":
      chips.push({ kind: "alert", label: "Expired" });
      break;
    case "partly-expired":
      chips.push({ kind: "alert", label: `Partly expired · kept ${labelsOf(series, branch.keptEpisodeIds)}` });
      break;
  }
  return chips;
}

/** One line under an ending in My choices saying why it is locked or gone, or nothing when it is open. */
export function branchNote(branch: BranchHistory): string | null {
  if (branch.availability === "open") return null;
  const blocked = branch.episodes.find((e) => e.access.state !== "open");
  if (!blocked) return null;
  const reason = accessReasonText(blocked.access.reason);
  return branch.availability === "locked" ? `Locked: ${reason}.` : `Expired: ${reason}.`;
}

/** "Resume episode 2 at 0:12" for a half-watched episode. */
export function resumeLabel(series: Series, resume: NonNullable<HistoryEntry["resume"]>): string {
  const episode = getEpisode(series, resume.episodeId);
  const name = episode ? `episode ${episodeLabel(episode)}` : "the episode";
  return `Resume ${name} at ${formatClock(resume.positionMs)}`;
}

/** The primary button on the day-2 result: straight into the official ending. */
export function resultActionLabel(series: Series, result: ResultView, progress: SeriesProgress): string {
  if (result.enter.type !== "episode") return stepLabel(series, result.enter, progress);
  const firstOfOfficial = series.episodes.find((e) => e.kind === (result.official === "A" ? "branchA" : "branchB"));
  const untouched = !isStarted(progress, result.enter.episodeId);
  return firstOfOfficial?.id === result.enter.episodeId && untouched ? "Watch the official ending" : stepLabel(series, result.enter, progress);
}

/** Who can still watch what, under the day-2 result. Always says the numbers are simulated. */
export function resultCaption(series: Series, result: ResultView): string {
  const simulated = "Simulated demo ballots.";
  if (result.isLateViewer) {
    return `Voting closed when day 1 ended. You can still watch both glimpses; the other ending was only open on day 1. ${simulated}`;
  }
  if (result.choseOfficial) {
    const keptOther = result.keptEpisodeIds.length > 0 ? ` You keep what you finished of the other ending (${labelsOf(series, result.keptEpisodeIds)}).` : "";
    return `Your ballot was on the winning side. New viewers now get only this ending.${keptOther} ${simulated}`;
  }
  const kept = result.keptEpisodeIds.length > 0;
  const expired = result.expiredEpisodeIds.length > 0;
  let yours = "";
  if (kept && expired) yours = ` You keep the episodes of your ending you finished on day 1 (${labelsOf(series, result.keptEpisodeIds)}); the rest has expired.`;
  else if (kept) yours = " You keep your own ending, because you finished it on day 1.";
  else if (expired) yours = " Your own ending has expired: it was only open on day 1.";
  return `Your ballot was on ${result.yourChoice}. New viewers now get only the official ending.${yours} ${simulated}`;
}

// ---------------------------------------------------------------------------
// The ballot after it is cast
// ---------------------------------------------------------------------------

/** What the viewer decided at keep-or-move, from the stored ballot. null while undecided. */
export function ballotDecision(ballot: Ballot | null): "moved" | "kept" | null {
  if (!ballot) return null;
  if (ballot.moved) return "moved";
  if (ballot.kept) return "kept";
  return null;
}

/** The note under a cast ballot on the ballot screen: what can still happen to it today. */
export function ballotFootnote(flags: DayFlags, ballot: Ballot): string {
  if (flags.isDayTwo) return ballot.moved ? "You moved your ballot once on day 1. Voting has closed." : "Voting closed when day 1 ended. Your ballot stays where it is.";
  if (ballot.moved) return "You have moved your ballot once. It cannot move again.";
  if (ballot.kept) return "You chose to keep your ballot here. It cannot move now.";
  return "You can move it once, after watching both endings.";
}

/** The line under the split once the keep-or-move decision is made. */
export function decisionCaption(flags: DayFlags, official: Choice | null): string {
  if (flags.isDayTwo) return official ? `Voting has closed. Ending ${official} is the official one.` : "Voting has closed.";
  return "The ending that is ahead when day 1 ends becomes the official one.";
}

// ---------------------------------------------------------------------------
// Presenter drawer
// ---------------------------------------------------------------------------

/**
 * Which presenter preset this viewer's progress matches, so the drawer can
 * show the current state. null when they are somewhere in between (half way
 * through the shared episodes, for example) or have already moved or kept the ballot.
 */
export function matchPreset(series: Series, progress: SeriesProgress): ViewerPresetId | null {
  if (!hasStarted(progress)) return "new";
  const ballot = progress.ballot;
  if (!ballot) return questionReached(series, progress) ? "at-question" : null;
  if (ballot.moved || ballot.kept) return null;
  if (bothEndingsFinished(series, progress)) return "seen-both";
  const other: Choice = ballot.choice === "A" ? "B" : "A";
  const branchStarted = (choice: Choice) => series.episodes.some((e) => e.kind === (choice === "A" ? "branchA" : "branchB") && isStarted(progress, e.id));
  if (endingFinished(series, progress, ballot.choice)) return branchStarted(other) ? null : "finished-own";
  return branchStarted(ballot.choice) ? null : "voted";
}

// ---------------------------------------------------------------------------
// Small formatters
// ---------------------------------------------------------------------------

/** "0:20", "2:05". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const STYLE_TEXT: Record<VisualStyle, string> = { photoreal: "Photoreal", illustration: "2D illustration" };

export function visualStyleLabel(style: VisualStyle): string {
  return STYLE_TEXT[style];
}

/** The one metadata line on a series card: visual style and how many episodes one path has. */
export function seriesMeta(series: Series): string {
  return `${visualStyleLabel(series.visualStyle)} · ${pathLength(series)} episodes`;
}

/** "The Ninth First Night · Ep 2": the line over the question on the share card. */
export function shareSeriesLine(series: Series, lang: Lang): string {
  return `${series.title[lang]} · Ep ${series.branchAfterEpisode}`;
}

/** The invitation on the share card. Never the result, never which ending won. */
export function shareCta(flags: DayFlags): string {
  return flags.isDayTwo ? "What would you have done? Watch it on Unwritten." : "What would you do? Both endings are open today only.";
}

export function shareFileName(seriesId: string, choice: Choice): string {
  return `unwritten-${seriesId}-${choice.toLowerCase()}.png`;
}
