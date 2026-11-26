import { describe, expect, it } from "vitest";
import { positionAfterLanguageSwitch, shotIndexAt, shotsFor } from "@/content/helpers";
import { makeSeries } from "@/test/fixtures";
import {
  RESTART_WINDOW_MS,
  formatClock,
  nextShotMs,
  previousShotMs,
  quantizedShotFraction,
  segmentStates,
  shotFraction,
  shotIndexIn,
  swipeDirection,
} from "./shotNav";
import type { FlatShot } from "@/content/helpers";

const shot = (index: number, startMs: number, endMs: number): FlatShot => ({ id: `s0${index + 1}`, index, startMs, endMs, still: `/s${index}.jpg` });
/** The English placeholder cut: 3.0, 4.5, 3.5, 4.0 and 4.0 seconds. */
const shots: FlatShot[] = [shot(0, 0, 3000), shot(1, 3000, 7500), shot(2, 7500, 11000), shot(3, 11000, 15000), shot(4, 15000, 19000)];

describe("shotIndexIn", () => {
  it("is the last shot that has started", () => {
    expect(shotIndexIn(shots, 0)).toBe(0);
    expect(shotIndexIn(shots, 2999)).toBe(0);
    expect(shotIndexIn(shots, 3000)).toBe(1);
    expect(shotIndexIn(shots, 18_999)).toBe(4);
    expect(shotIndexIn(shots, 99_000)).toBe(4);
    expect(shotIndexIn(shots, -5)).toBe(0);
  });

  it("agrees with the content helper for both language cuts", () => {
    const media = makeSeries().episodes[0];
    for (const lang of ["hi", "en"] as const) {
      const flat = shotsFor(media, lang);
      for (let ms = 0; ms <= media.durationMs[lang]; ms += 250) expect(shotIndexIn(flat, ms)).toBe(shotIndexAt(media, lang, ms));
    }
  });
});

describe("previousShotMs", () => {
  it("goes back to the start of the shot on screen once it has been running a while", () => {
    expect(previousShotMs(shots, 5000)).toBe(3000);
    expect(previousShotMs(shots, 3000 + RESTART_WINDOW_MS + 1)).toBe(3000);
  });

  it("goes to the shot before when the shot on screen has only just started", () => {
    expect(previousShotMs(shots, 3000)).toBe(0);
    expect(previousShotMs(shots, 3000 + RESTART_WINDOW_MS)).toBe(0);
    expect(previousShotMs(shots, 15_200)).toBe(11_000);
  });

  it("two quick taps step back two shots' worth: restart, then the one before", () => {
    const first = previousShotMs(shots, 9000);
    expect(first).toBe(7500);
    expect(previousShotMs(shots, first)).toBe(3000);
  });

  it("stays at the start in the first shot", () => {
    expect(previousShotMs(shots, 0)).toBe(0);
    expect(previousShotMs(shots, 500)).toBe(0);
    expect(previousShotMs(shots, 2500)).toBe(0);
  });

  it("is 0 for an episode with no shots", () => {
    expect(previousShotMs([], 4000)).toBe(0);
  });
});

describe("nextShotMs", () => {
  it("is the start of the shot after the one on screen", () => {
    expect(nextShotMs(shots, 0)).toBe(3000);
    expect(nextShotMs(shots, 2999)).toBe(3000);
    expect(nextShotMs(shots, 3000)).toBe(7500);
    expect(nextShotMs(shots, 14_000)).toBe(15_000);
  });

  it("is null on the last shot: there is nothing to skip to, the episode ends", () => {
    expect(nextShotMs(shots, 15_000)).toBeNull();
    expect(nextShotMs(shots, 18_500)).toBeNull();
    expect(nextShotMs([], 0)).toBeNull();
  });
});

describe("the progress segments", () => {
  it("has one segment per shot: done before the current one, now, then to do", () => {
    expect(segmentStates(5, 0)).toEqual(["now", "todo", "todo", "todo", "todo"]);
    expect(segmentStates(5, 2)).toEqual(["done", "done", "now", "todo", "todo"]);
    expect(segmentStates(5, 4)).toEqual(["done", "done", "done", "done", "now"]);
    expect(segmentStates(0, 0)).toEqual([]);
  });

  it("fills the current segment by time within the shot", () => {
    expect(shotFraction(shots[1], 3000)).toBe(0);
    expect(shotFraction(shots[1], 5250)).toBe(0.5);
    expect(shotFraction(shots[1], 7500)).toBe(1);
    expect(shotFraction(shots[1], 100)).toBe(0);
    expect(shotFraction(shots[1], 99_000)).toBe(1);
    expect(shotFraction(undefined, 500)).toBe(0);
    expect(shotFraction(shot(0, 100, 100), 100)).toBe(1);
  });

  it("quantizes the fill so the bar redraws a bounded number of times", () => {
    const values = new Set<number>();
    for (let ms = 3000; ms <= 7500; ms += 5) values.add(quantizedShotFraction(shots[1], ms, 20));
    expect(values.size).toBe(21);
    expect(quantizedShotFraction(shots[1], 5250)).toBe(0.5);
  });
});

describe("the language switch keeps the shot, not the second", () => {
  it("lands on the start of the same shot in the other cut", () => {
    const media = makeSeries().episodes[0];
    // 5.5 s into Hinglish is shot 2 (starts at 4.0 s); the same shot starts at 3.0 s in English.
    const to = positionAfterLanguageSwitch(media, "hi", "en", 5500);
    expect(to).toBe(3000);
    expect(shotIndexIn(shotsFor(media, "en"), to)).toBe(shotIndexIn(shotsFor(media, "hi"), 5500));
  });
});

describe("formatClock", () => {
  it("formats whole seconds, rounding down", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(7999)).toBe("0:07");
    expect(formatClock(20_000)).toBe("0:20");
    expect(formatClock(125_400)).toBe("2:05");
    expect(formatClock(-40)).toBe("0:00");
  });
});

describe("swipeDirection", () => {
  it("swipe left is next, swipe right is previous", () => {
    expect(swipeDirection({ dx: -120, dy: 8, durationMs: 180 })).toBe("next");
    expect(swipeDirection({ dx: 90, dy: -12, durationMs: 240 })).toBe("previous");
  });

  it("a tap or a small wobble is not a swipe", () => {
    expect(swipeDirection({ dx: 0, dy: 0, durationMs: 80 })).toBeNull();
    expect(swipeDirection({ dx: -20, dy: 3, durationMs: 120 })).toBeNull();
  });

  it("a vertical or diagonal drag is left to the page scroll", () => {
    expect(swipeDirection({ dx: -60, dy: 200, durationMs: 200 })).toBeNull();
    expect(swipeDirection({ dx: 70, dy: 60, durationMs: 200 })).toBeNull();
  });

  it("a slow drag is not a swipe", () => {
    expect(swipeDirection({ dx: -200, dy: 0, durationMs: 1500 })).toBeNull();
  });
});
