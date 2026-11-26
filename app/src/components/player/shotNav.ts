/**
 * Shot navigation and the progress segments. OWNER: player. Pure.
 *
 * Works on the flat shots of one language (`shotsFor(media, lang)`), so every
 * number here is a millisecond of the video file that is playing.
 */
import type { FlatShot } from "@/content/helpers";

/**
 * "Previous shot" within this long of a shot's start goes to the shot before
 * it. Later than that it goes back to the start of the shot on screen, so one
 * tap replays a line that was missed and a second tap steps back.
 */
export const RESTART_WINDOW_MS = 1200;

/** Index of the shot on screen: the last shot that has started. 0 before the first. */
export function shotIndexIn(shots: FlatShot[], positionMs: number): number {
  let index = 0;
  for (let i = 0; i < shots.length; i++) {
    if (shots[i].startMs <= positionMs) index = i;
    else break;
  }
  return index;
}

/** Where "previous shot" seeks to. */
export function previousShotMs(shots: FlatShot[], positionMs: number): number {
  if (shots.length === 0) return 0;
  const index = shotIndexIn(shots, positionMs);
  const current = shots[index];
  if (positionMs - current.startMs > RESTART_WINDOW_MS || index === 0) return current.startMs;
  return shots[index - 1].startMs;
}

/** Where "next shot" seeks to, or null on the last shot: there the episode is finished. */
export function nextShotMs(shots: FlatShot[], positionMs: number): number | null {
  const next = shots[shotIndexIn(shots, positionMs) + 1];
  return next ? next.startMs : null;
}

export type SegmentState = "done" | "now" | "todo";

/** One progress segment per shot: the ones before the current shot are done. */
export function segmentStates(count: number, currentIndex: number): SegmentState[] {
  return Array.from({ length: count }, (_, i) => (i < currentIndex ? "done" : i === currentIndex ? "now" : "todo"));
}

/** How far through a shot the position is, 0..1. */
export function shotFraction(shot: FlatShot | undefined, positionMs: number): number {
  if (!shot) return 0;
  const length = shot.endMs - shot.startMs;
  if (length <= 0) return 1;
  return Math.min(1, Math.max(0, (positionMs - shot.startMs) / length));
}

/** `shotFraction` in steps of `steps`, so the bar redraws that many times per shot and no more. */
export function quantizedShotFraction(shot: FlatShot | undefined, positionMs: number, steps = 100): number {
  return Math.round(shotFraction(shot, positionMs) * steps) / steps;
}

/** "0:07", "2:05". Whole seconds, rounded down. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** A horizontal swipe on the stage, from pointer down to pointer up. */
export interface SwipeInput {
  dx: number;
  dy: number;
  durationMs: number;
}

export const SWIPE_MIN_PX = 44;
export const SWIPE_MAX_MS = 900;

/**
 * Swipe left = next shot, swipe right = previous shot (the film moves with
 * the finger). Anything short, slow or mostly vertical is not a swipe, so a
 * tap stays a tap and a vertical drag scrolls the page.
 */
export function swipeDirection({ dx, dy, durationMs }: SwipeInput): "next" | "previous" | null {
  if (durationMs > SWIPE_MAX_MS) return null;
  if (Math.abs(dx) < SWIPE_MIN_PX) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? "next" : "previous";
}
