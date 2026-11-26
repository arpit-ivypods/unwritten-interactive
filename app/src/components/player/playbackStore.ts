/**
 * The playback clock. OWNER: player.
 *
 * One small store per player holds the position of the video in milliseconds.
 * The video is sampled on every animation frame while it plays; components
 * subscribe with a selector (the current shot, the subtitle frame, the whole
 * second), so each redraws only when its own answer changes and never sixty
 * times a second.
 *
 * It is not persisted: resume points go to the viewer store (recordProgress).
 */
import { useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import type { Lang } from "@/content/schema";

export interface PlaybackClock {
  /**
   * The audio language of the file that is loaded in the video. It follows
   * the viewer's language a moment later, and always changes together with
   * `positionMs`, so a shot or a subtitle is never looked up with one
   * language's time on the other language's timings.
   */
  lang: Lang;
  /** Position in that file. */
  positionMs: number;
}

export type PlaybackStore = StoreApi<PlaybackClock>;

export function createPlaybackStore(lang: Lang, positionMs = 0): PlaybackStore {
  return createStore<PlaybackClock>(() => ({ lang, positionMs }));
}

const noSubscription = () => () => {};

/**
 * Read one value from the clock. `select` must return a primitive (a number,
 * a string, a boolean): the component re-renders only when it changes.
 * With no store (nothing is playing) it returns `fallback`.
 */
export function useClock<T extends string | number | boolean>(store: PlaybackStore | null, select: (clock: PlaybackClock) => T, fallback: T): T {
  return useSyncExternalStore(
    store ? store.subscribe : noSubscription,
    () => (store ? select(store.getState()) : fallback),
    () => fallback,
  );
}
