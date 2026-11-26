/**
 * Shapes of everything the app remembers. All of it lives on the device
 * (localStorage); there is no server. The rules that read these shapes are in
 * rules.ts, the only ways to change them are in transitions.ts.
 */
import type { Choice, Lang } from "@/content/schema";

/**
 * The demo clock, set by hand in the presenter drawer.
 * 1 = day 1, both endings open. "last-hour" = still day 1, about to close.
 * 2 = day 2 onwards, only the official ending.
 */
export type DemoDay = 1 | "last-hour" | 2;

export interface DemoState {
  day: DemoDay;
  /** The presenter forces which ending wins. null = decided by the tallies. Applies to every series. */
  winnerOverride: Choice | null;
  /**
   * When the series "launched", ms since epoch. Day 1 is the 24 hours after it.
   * Drives the countdown only: the rules read `day`, never the clock.
   * null until the app has run once in a browser.
   */
  launchAt: number | null;
}

export interface EpisodeProgress {
  /** Where the viewer stopped, in ms of the `lang` video. 0 after finishing. */
  positionMs: number;
  /** The audio language `positionMs` was measured in. */
  lang: Lang;
  /** The shot on screen when they stopped. Used to resume in the other language. */
  shotId: string | null;
  /** Watched to the end at least once. Never goes back to false. */
  completed: boolean;
  completedAt: number | null;
  updatedAt: number;
}

export interface Ballot {
  /** Where the ballot is now. */
  choice: Choice;
  castAt: number;
  /** A ballot can be moved once. True after that. */
  moved: boolean;
  movedAt: number | null;
  /**
   * The viewer chose "Keep" on the keep-or-move screen. Like a move, that
   * decision is final for day 1: the ballot can no longer move.
   */
  kept: boolean;
}

/** Everything remembered about one viewer and one series. */
export interface SeriesProgress {
  /** By episode id. An episode with no entry has never been opened. */
  episodes: Record<string, EpisodeProgress>;
  /** The episode opened most recently: the resume point. Glimpses are not recorded here. */
  lastPlayableId: string | null;
  glimpsesWatched: Record<Choice, boolean>;
  /** One ballot per viewer per series. null until cast. */
  ballot: Ballot | null;
}

export interface ViewerState {
  /** Audio language. Subtitles follow it. */
  language: Lang;
  subtitlesOn: boolean;
  /** The one-time welcome screen has been completed. */
  welcomeSeen: boolean;
  /** By series id. */
  series: Record<string, SeriesProgress>;
  /**
   * Goes up by one whenever the presenter rewrites the demo: reset, a viewer
   * preset, a jump to a screen. A playback session remembers the epoch it
   * started in and passes it with every save; a save from an older epoch is
   * ignored, so a player that was open during a reset cannot write the old
   * history back. Stored, so a reset made in another window counts too.
   */
  epoch: number;
}

export const DEFAULT_DEMO_STATE: DemoState = { day: 1, winnerOverride: null, launchAt: null };

export const DEFAULT_VIEWER_STATE: ViewerState = {
  language: "hi",
  subtitlesOn: true,
  welcomeSeen: false,
  series: {},
  epoch: 0,
};

/** A series nobody has touched yet. Returns a fresh object every time. */
export function emptyProgress(): SeriesProgress {
  return { episodes: {}, lastPlayableId: null, glimpsesWatched: { A: false, B: false }, ballot: null };
}

/** A shared, frozen empty progress for selectors that need a stable reference. */
export const EMPTY_PROGRESS: SeriesProgress = Object.freeze({
  episodes: Object.freeze({}) as Record<string, EpisodeProgress>,
  lastPlayableId: null,
  glimpsesWatched: Object.freeze({ A: false, B: false }) as Record<Choice, boolean>,
  ballot: null,
}) as SeriesProgress;
