"use client";

/**
 * The presenter's controls: the demo clock and the forced winner. Persisted to
 * localStorage so a reload keeps the demo where it was. Rules: ./rules.ts.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Choice } from "@/content/schema";
import { launchAtFor, launchAtOnLoad } from "./rules";
import { DEMO_STORAGE_KEY, STORAGE_VERSION, deviceStorage } from "./storage";
import { sanitizeDemoState } from "./transitions";
import { DEFAULT_DEMO_STATE } from "./types";
import type { DemoDay, DemoState } from "./types";

export interface DemoActions {
  /** Switch the demo clock. Also restarts the countdown for that phase. */
  setDay: (day: DemoDay) => void;
  /** Force which ending wins, for every series. null = let the tallies decide. */
  setWinnerOverride: (winner: Choice | null) => void;
  /**
   * Called once after loading. Gives the countdown a start time if it has
   * none, and restarts the current phase's countdown if it has run out of its
   * window (`launchAtOnLoad` in ./rules.ts). Never changes the day.
   */
  ensureLaunch: () => void;
  /** Back to day 1, no forced winner. Does not touch watch history. */
  reset: () => void;
}

export type DemoStore = DemoState & DemoActions;

export const useDemoStore = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...DEFAULT_DEMO_STATE,
      setDay: (day) => set({ day, launchAt: launchAtFor(day, Date.now()) }),
      setWinnerOverride: (winnerOverride) => set({ winnerOverride }),
      ensureLaunch: () => {
        const launchAt = launchAtOnLoad(selectDemoState(get()), Date.now());
        if (launchAt !== get().launchAt) set({ launchAt });
      },
      reset: () => set({ day: 1, winnerOverride: null, launchAt: launchAtFor(1, Date.now()) }),
    }),
    {
      name: DEMO_STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: deviceStorage<DemoState>(),
      skipHydration: true,
      partialize: (state): DemoState => ({ day: state.day, winnerOverride: state.winnerOverride, launchAt: state.launchAt }),
      merge: (persisted, current) => ({ ...current, ...sanitizeDemoState(persisted) }),
    },
  ),
);

/** The demo state without the actions. */
export function selectDemoState(store: DemoStore): DemoState {
  return { day: store.day, winnerOverride: store.winnerOverride, launchAt: store.launchAt };
}
