/**
 * Presenter shortcuts: put a viewer into a known state, and jump to any screen
 * with the state that screen needs. Pure data and pure functions; the stores
 * apply them (`applyPreset`, `jumpToScreen` in ./index).
 *
 * A jump never bypasses the rules. It first makes the viewer someone who could
 * legitimately be on that screen, then goes there.
 */
import { branchEpisodes, firstEpisode, otherChoice, sharedEpisodes } from "@/content/helpers";
import type { Choice, Series } from "@/content/schema";
import { routes } from "@/lib/routes";
import { emptyProgress } from "./types";
import type { DemoDay, SeriesProgress } from "./types";

export const VIEWER_PRESETS = [
  { id: "new", label: "New viewer" },
  { id: "at-question", label: "At the question" },
  { id: "voted", label: "Voted" },
  { id: "finished-own", label: "Finished own ending" },
  { id: "seen-both", label: "Seen both endings" },
] as const;

export type ViewerPresetId = (typeof VIEWER_PRESETS)[number]["id"];

function complete(progress: SeriesProgress, ids: string[], now: number): void {
  for (const id of ids) {
    progress.episodes[id] = { positionMs: 0, lang: "hi", shotId: null, completed: true, completedAt: now, updatedAt: now };
    progress.lastPlayableId = id;
  }
}

/**
 * The progress of a viewer in a given state. `choice` is where the ballot
 * goes for the states that have one.
 *
 * new: nothing watched. at-question: shared episodes finished, no ballot.
 * voted: ballot cast, branch not started. finished-own: own ending finished.
 * seen-both: both endings finished, ballot not yet moved.
 */
export function presetProgress(series: Series, preset: ViewerPresetId, choice: Choice, now: number): SeriesProgress {
  const progress = emptyProgress();
  if (preset === "new") return progress;
  complete(progress, sharedEpisodes(series).map((e) => e.id), now);
  if (preset === "at-question") return progress;
  progress.ballot = { choice, castAt: now, moved: false, movedAt: null, kept: false };
  if (preset === "voted") return progress;
  complete(progress, branchEpisodes(series, choice).map((e) => e.id), now);
  if (preset === "finished-own") return progress;
  complete(progress, branchEpisodes(series, otherChoice(choice)).map((e) => e.id), now);
  return progress;
}

export type ScreenId =
  | "welcome"
  | "home"
  | "series"
  | "player"
  | "question"
  | "glimpses"
  | "ballot"
  | "ending"
  | "keep-or-move"
  | "result"
  | "my-choices"
  | "share"
  | "studio";

export interface ScreenJump {
  id: ScreenId;
  /** Label for the drawer. */
  label: string;
  /** The viewer state to apply to the series first. null = leave the viewer as they are. */
  preset: ViewerPresetId | null;
  /** The demo day to switch to first. null = leave the clock alone. */
  day: DemoDay | null;
  /** True for the welcome screen: mark the welcome as not yet seen. */
  resetWelcome?: boolean;
  /** The URL to go to. */
  href: (series: Series, choice: Choice) => string;
}

/** Every screen in plan section 4, with the state it needs. The drawer lists these in this order. */
export const SCREEN_JUMPS: readonly ScreenJump[] = [
  { id: "welcome", label: "Welcome", preset: null, day: null, resetWelcome: true, href: () => routes.welcome() },
  { id: "home", label: "Home", preset: null, day: null, href: () => routes.home() },
  { id: "series", label: "Series page", preset: null, day: null, href: (s) => routes.series(s.id) },
  { id: "player", label: "Player", preset: null, day: null, href: (s) => routes.watch(s.id, firstEpisode(s).id) },
  { id: "question", label: "Question", preset: "at-question", day: 1, href: (s) => routes.question(s.id) },
  { id: "glimpses", label: "Glimpses", preset: "at-question", day: 1, href: (s) => routes.glimpses(s.id) },
  { id: "ballot", label: "Ballot", preset: "at-question", day: 1, href: (s) => routes.ballot(s.id) },
  { id: "ending", label: "Ending", preset: "finished-own", day: 1, href: (s, c) => routes.ending(s.id, c) },
  { id: "keep-or-move", label: "Keep or move", preset: "seen-both", day: 1, href: (s) => routes.keepOrMove(s.id) },
  { id: "result", label: "Day-2 result", preset: "at-question", day: 2, href: (s) => routes.result(s.id) },
  { id: "my-choices", label: "My choices", preset: null, day: null, href: () => routes.myChoices() },
  { id: "share", label: "Share card", preset: "voted", day: null, href: (s) => routes.share(s.id) },
  { id: "studio", label: "Studio", preset: null, day: null, href: () => routes.studio() },
];

export function getScreenJump(id: ScreenId): ScreenJump {
  const jump = SCREEN_JUMPS.find((j) => j.id === id);
  if (!jump) throw new Error(`Unknown screen: ${id}`);
  return jump;
}
