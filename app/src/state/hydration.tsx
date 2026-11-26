"use client";

/**
 * Loading the stores from localStorage.
 *
 * The server renders every page with the default state (a new viewer on day
 * 1). The stores are filled from localStorage only after the page has mounted
 * in the browser, so the first client render matches the server's. Anything
 * that depends on stored state must wait for `useHydrated()` before showing
 * it, otherwise a returning viewer sees a flash of the new-viewer screen.
 */
import { useEffect } from "react";
import { create } from "zustand";
import { useDemoStore } from "./demoStore";
import { DEMO_STORAGE_KEY, VIEWER_STORAGE_KEY } from "./storage";
import { useViewerStore } from "./viewerStore";

const useHydrationFlag = create<{ hydrated: boolean }>(() => ({ hydrated: false }));

/**
 * Read both stores from localStorage now. Safe to call more than once.
 * Always ends hydrated: if storage cannot be read, the stores keep their
 * defaults (a new viewer on day 1) and the app runs from memory, rather than
 * staying on its loading state for good.
 */
export async function hydrateStores(): Promise<void> {
  try {
    await Promise.all([useViewerStore.persist.rehydrate(), useDemoStore.persist.rehydrate()]);
  } catch (error) {
    console.warn(`[state] could not load saved state, starting fresh: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    useDemoStore.getState().ensureLaunch();
  } catch (error) {
    console.warn(`[state] could not start the countdown: ${error instanceof Error ? error.message : String(error)}`);
  }
  useHydrationFlag.setState({ hydrated: true });
}

/** True once the stores hold what was in localStorage. False on the server and on the first client render. */
export function useHydrated(): boolean {
  return useHydrationFlag((state) => state.hydrated);
}

/** For code outside React (tests, event handlers). */
export function storesHydrated(): boolean {
  return useHydrationFlag.getState().hydrated;
}

/**
 * Mounted once in the root layout. Loads the stores, and reloads one when
 * another tab or window on this device changes it, so a presenter can drive
 * the demo clock from a second window.
 */
export function StoreHydration(): null {
  useEffect(() => {
    void hydrateStores();
    const onStorage = (event: StorageEvent) => {
      if (event.key === VIEWER_STORAGE_KEY || event.key === null) void useViewerStore.persist.rehydrate();
      if (event.key === DEMO_STORAGE_KEY || event.key === null) void useDemoStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
