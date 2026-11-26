"use client";

/**
 * Everything the app remembers about the viewer: language, subtitles, the
 * welcome, and per series the progress, glimpses and ballot. Persisted to
 * localStorage. The actions are thin: each one calls a pure transition from
 * ./transitions.ts, which is where the rules are enforced and tested.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSeries } from "@/content";
import type { Choice, Lang } from "@/content/schema";
import { selectDemoState, useDemoStore } from "./demoStore";
import { presetProgress } from "./presets";
import type { ViewerPresetId } from "./presets";
import { progressFor } from "./rules";
import type { CastBallotBlock, MoveBallotBlock } from "./rules";
import { STORAGE_VERSION, VIEWER_STORAGE_KEY, deviceStorage } from "./storage";
import * as T from "./transitions";
import type { PlaybackPosition } from "./transitions";
import { DEFAULT_VIEWER_STATE } from "./types";
import type { ViewerState } from "./types";

export type ActionResult<Reason extends string> = { ok: true } | { ok: false; reason: Reason | "unknown-series" };

export interface ViewerActions {
  setLanguage: (language: Lang) => void;
  setSubtitlesOn: (on: boolean) => void;
  markWelcomeSeen: () => void;
  /**
   * Remember the position in an episode and make it the resume point. Call it
   * about once a second while playing, and on pause, shot change and when the
   * page is hidden. Every call writes localStorage. Not for glimpses.
   *
   * `epoch`: the store's `epoch` when the playback session started. If the
   * presenter has reset, applied a preset or jumped since, the epoch has moved
   * on and the call is ignored, so a player that is still open cannot write
   * the old history back. Leave it out only outside a playback session.
   */
  recordProgress: (seriesId: string, episodeId: string, at: PlaybackPosition, epoch?: number) => void;
  /** The episode played to its end. Ignored if `epoch` is given and out of date (see recordProgress). */
  completeEpisode: (seriesId: string, episodeId: string, epoch?: number) => void;
  /** The glimpse of this choice played to its end. Ignored if `epoch` is given and out of date (see recordProgress). */
  markGlimpseWatched: (seriesId: string, choice: Choice, epoch?: number) => void;
  /** Cast the one ballot. Refused (and nothing changes) if the rules do not allow it. */
  castBallot: (seriesId: string, choice: Choice) => ActionResult<CastBallotBlock>;
  /** Move the ballot to the other choice. Refused if the rules do not allow it. */
  moveBallot: (seriesId: string) => ActionResult<MoveBallotBlock>;
  /**
   * "Keep my ballot" at keep-or-move. Allowed exactly when a move is. Final
   * for day 1: afterwards `canMoveBallot` says "kept" and the viewer is not
   * sent to keep-or-move again.
   */
  keepBallot: (seriesId: string) => ActionResult<MoveBallotBlock>;
  /** Presenter: replace this series' progress with a known viewer state. Starts a new epoch. */
  applyPreset: (seriesId: string, preset: ViewerPresetId, choice?: Choice) => void;
  /** The reset button: clear all watch history, glimpses and ballots. Keeps language, subtitles and the welcome. Starts a new epoch. */
  resetHistory: () => void;
  /** Back to a first-time visitor, welcome included. Starts a new epoch. */
  resetEverything: () => void;
  /** Presenter: start a new epoch without changing anything else (used by `jumpToScreen`). */
  newEpoch: () => void;
}

export type ViewerStore = ViewerState & ViewerActions;

export const useViewerStore = create<ViewerStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_VIEWER_STATE,
      series: {},

      setLanguage: (language) => set({ language }),
      setSubtitlesOn: (subtitlesOn) => set({ subtitlesOn }),
      markWelcomeSeen: () => set({ welcomeSeen: true }),

      recordProgress: (seriesId, episodeId, at, epoch) => {
        const series = getSeries(seriesId);
        if (!series || T.isStaleEpoch(get(), epoch)) return;
        set((state) => T.updateSeries(state, seriesId, (p) => T.recordProgress(series, p, episodeId, at, Date.now())));
      },

      completeEpisode: (seriesId, episodeId, epoch) => {
        const series = getSeries(seriesId);
        if (!series || T.isStaleEpoch(get(), epoch)) return;
        set((state) => T.updateSeries(state, seriesId, (p) => T.completeEpisode(series, p, episodeId, Date.now())));
      },

      markGlimpseWatched: (seriesId, choice, epoch) => {
        if (T.isStaleEpoch(get(), epoch)) return;
        set((state) => T.updateSeries(state, seriesId, (p) => T.markGlimpseWatched(p, choice)));
      },

      castBallot: (seriesId, choice) => {
        const series = getSeries(seriesId);
        if (!series) return { ok: false, reason: "unknown-series" };
        const demo = selectDemoState(useDemoStore.getState());
        const result = T.castBallot(series, progressFor(get(), seriesId), demo, choice, Date.now());
        if (!result.ok) return { ok: false, reason: result.reason };
        set((state) => T.updateSeries(state, seriesId, () => result.progress));
        return { ok: true };
      },

      moveBallot: (seriesId) => {
        const series = getSeries(seriesId);
        if (!series) return { ok: false, reason: "unknown-series" };
        const demo = selectDemoState(useDemoStore.getState());
        const result = T.moveBallot(series, progressFor(get(), seriesId), demo, Date.now());
        if (!result.ok) return { ok: false, reason: result.reason };
        set((state) => T.updateSeries(state, seriesId, () => result.progress));
        return { ok: true };
      },

      keepBallot: (seriesId) => {
        const series = getSeries(seriesId);
        if (!series) return { ok: false, reason: "unknown-series" };
        const demo = selectDemoState(useDemoStore.getState());
        const result = T.keepBallot(series, progressFor(get(), seriesId), demo);
        if (!result.ok) return { ok: false, reason: result.reason };
        set((state) => T.updateSeries(state, seriesId, () => result.progress));
        return { ok: true };
      },

      applyPreset: (seriesId, preset, choice = "A") => {
        const series = getSeries(seriesId);
        if (!series) return;
        set((state) => T.newEpoch(T.updateSeries(state, seriesId, () => presetProgress(series, preset, choice, Date.now()))));
      },

      resetHistory: () => set((state) => T.resetHistory(state)),
      resetEverything: () => set((state) => T.resetEverything(state)),
      newEpoch: () => set((state) => T.newEpoch(state)),
    }),
    {
      name: VIEWER_STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: deviceStorage<ViewerState>(),
      skipHydration: true,
      partialize: (state): ViewerState => ({
        language: state.language,
        subtitlesOn: state.subtitlesOn,
        welcomeSeen: state.welcomeSeen,
        series: state.series,
        epoch: state.epoch,
      }),
      merge: (persisted, current) => ({ ...current, ...T.sanitizeViewerState(persisted) }),
    },
  ),
);
