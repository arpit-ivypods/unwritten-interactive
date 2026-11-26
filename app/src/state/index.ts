/**
 * The state model, for client components: `import { ... } from "@/state"`.
 *
 * - Pure rules: ./rules (also importable on their own, anywhere, including
 *   server components and tests).
 * - Pure state changes: ./transitions.
 * - Stores: useViewerStore, useDemoStore (localStorage).
 * - Hooks: useSeriesRules and friends.
 * - Presenter helpers: applyPreset, jumpToScreen, resetDemo.
 */
import { getSeries } from "@/content";
import type { Choice } from "@/content/schema";
import { useDemoStore } from "./demoStore";
import { getScreenJump } from "./presets";
import type { ScreenId } from "./presets";
import { useViewerStore } from "./viewerStore";

export * from "./types";
export * from "./rules";
export * from "./presets";
export * from "./storage";
export * from "./demoStore";
export * from "./viewerStore";
export * from "./hydration";
export * from "./hooks";
export type { PlaybackPosition } from "./transitions";

/**
 * Presenter: make the app ready for a screen and return the URL to go to.
 * Switches the day if the screen needs one, puts the viewer in the state the
 * screen needs for that series, and makes sure the welcome does not get in the
 * way (or, for the welcome screen itself, shows it again).
 *
 *   router.push(jumpToScreen("ballot", "series1"))
 */
export function jumpToScreen(screen: ScreenId, seriesId: string, choice: Choice = "A"): string {
  const jump = getScreenJump(screen);
  const series = getSeries(seriesId);
  if (!series) throw new Error(`Unknown series: ${seriesId}`);
  // A new epoch first: a player still open on the page cannot save over what the jump sets up.
  useViewerStore.getState().newEpoch();
  useViewerStore.setState({ welcomeSeen: !jump.resetWelcome });
  if (jump.day !== null && useDemoStore.getState().day !== jump.day) useDemoStore.getState().setDay(jump.day);
  if (jump.preset !== null) useViewerStore.getState().applyPreset(seriesId, jump.preset, choice);
  return jump.href(series, choice);
}

/** Presenter: the reset button. Clears all watch history and puts the clock back to day 1 with no forced winner. Starts a new epoch. */
export function resetDemo(): void {
  useViewerStore.getState().resetHistory();
  useDemoStore.getState().reset();
}
