// @vitest-environment jsdom
/**
 * The stores, their persistence to localStorage, and the hooks on top. These
 * run against the real bundled content (series1), in a DOM.
 */
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSeries } from "@/content";
import {
  DEFAULT_DEMO_STATE,
  DEFAULT_VIEWER_STATE,
  DEMO_STORAGE_KEY,
  HOUR_MS,
  STORAGE_VERSION,
  StoreHydration,
  VIEWER_STORAGE_KEY,
  dayOneRemainingMs,
  hydrateStores,
  jumpToScreen,
  resetDemo,
  selectDemoState,
  useDayOneCountdown,
  useDemoStore,
  useHydrated,
  useSeriesRules,
  useViewerStore,
} from "./index";

const series1 = getSeries("series1")!;
const R_DAY = 24 * HOUR_MS;
const stored = (key: string) => JSON.parse(window.localStorage.getItem(key) ?? "null");

beforeEach(() => {
  window.localStorage.clear();
  useViewerStore.setState({ ...DEFAULT_VIEWER_STATE, series: {} });
  useDemoStore.setState({ ...DEFAULT_DEMO_STATE });
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("viewer store", () => {
  it("starts as a first-time visitor: Hinglish audio, subtitles on, welcome not seen", () => {
    expect(useViewerStore.getState()).toMatchObject({ language: "hi", subtitlesOn: true, welcomeSeen: false, series: {} });
  });

  it("writes only data to localStorage, under a versioned key", () => {
    useViewerStore.getState().setLanguage("en");
    useViewerStore.getState().setSubtitlesOn(false);
    useViewerStore.getState().markWelcomeSeen();
    expect(stored(VIEWER_STORAGE_KEY)).toEqual({
      state: { language: "en", subtitlesOn: false, welcomeSeen: true, series: {}, epoch: 0 },
      version: STORAGE_VERSION,
    });
  });

  it("records progress and completion per episode", () => {
    const store = useViewerStore.getState();
    store.recordProgress("series1", "s1e01", { positionMs: 6100, lang: "hi", shotId: "s02" });
    expect(useViewerStore.getState().series.series1.episodes.s1e01).toMatchObject({ positionMs: 6100, lang: "hi", shotId: "s02", completed: false });
    expect(useViewerStore.getState().series.series1.lastPlayableId).toBe("s1e01");
    store.completeEpisode("series1", "s1e01");
    expect(useViewerStore.getState().series.series1.episodes.s1e01).toMatchObject({ positionMs: 0, completed: true });
    expect(stored(VIEWER_STORAGE_KEY).state.series.series1.episodes.s1e01.completed).toBe(true);
  });

  it("ignores progress for a series or episode that does not exist", () => {
    useViewerStore.getState().recordProgress("nope", "s1e01", { positionMs: 1, lang: "hi", shotId: null });
    useViewerStore.getState().recordProgress("series1", "nope", { positionMs: 1, lang: "hi", shotId: null });
    useViewerStore.getState().completeEpisode("nope", "s1e01");
    expect(useViewerStore.getState().series).toEqual({});
  });

  it("tracks watched glimpses", () => {
    useViewerStore.getState().markGlimpseWatched("series1", "B");
    expect(useViewerStore.getState().series.series1.glimpsesWatched).toEqual({ A: false, B: true });
  });

  it("casts one ballot, and refuses a second", () => {
    const store = useViewerStore.getState();
    expect(store.castBallot("series1", "A")).toEqual({ ok: false, reason: "question-not-reached" });
    store.applyPreset("series1", "at-question");
    expect(store.castBallot("series1", "B")).toEqual({ ok: true });
    expect(useViewerStore.getState().series.series1.ballot).toMatchObject({ choice: "B", moved: false });
    expect(store.castBallot("series1", "A")).toEqual({ ok: false, reason: "already-cast" });
    expect(useViewerStore.getState().series.series1.ballot?.choice).toBe("B");
    expect(store.castBallot("nope", "A")).toEqual({ ok: false, reason: "unknown-series" });
  });

  it("reads the demo clock when casting: no ballot on day 2, a ballot in the last hour", () => {
    useViewerStore.getState().applyPreset("series1", "at-question");
    useDemoStore.getState().setDay(2);
    expect(useViewerStore.getState().castBallot("series1", "A")).toEqual({ ok: false, reason: "voting-closed" });
    expect(useViewerStore.getState().series.series1.ballot).toBeNull();
    useDemoStore.getState().setDay("last-hour");
    expect(useViewerStore.getState().castBallot("series1", "A")).toEqual({ ok: true });
  });

  it("moves the ballot once, only after both endings, only on day 1", () => {
    const store = useViewerStore.getState();
    store.applyPreset("series1", "finished-own", "A");
    expect(store.moveBallot("series1")).toEqual({ ok: false, reason: "both-endings-not-finished" });
    store.applyPreset("series1", "seen-both", "A");
    useDemoStore.getState().setDay(2);
    expect(store.moveBallot("series1")).toEqual({ ok: false, reason: "voting-closed" });
    useDemoStore.getState().setDay(1);
    expect(store.moveBallot("series1")).toEqual({ ok: true });
    expect(useViewerStore.getState().series.series1.ballot).toMatchObject({ choice: "B", moved: true });
    expect(store.moveBallot("series1")).toEqual({ ok: false, reason: "already-moved" });
    expect(store.moveBallot("nope")).toEqual({ ok: false, reason: "unknown-series" });
  });

  it("keeps the ballot once, only when a move would be allowed, and then refuses a move", () => {
    const store = useViewerStore.getState();
    store.applyPreset("series1", "finished-own", "A");
    expect(store.keepBallot("series1")).toEqual({ ok: false, reason: "both-endings-not-finished" });
    store.applyPreset("series1", "seen-both", "A");
    expect(store.keepBallot("series1")).toEqual({ ok: true });
    expect(useViewerStore.getState().series.series1.ballot).toMatchObject({ choice: "A", moved: false, kept: true });
    expect(stored(VIEWER_STORAGE_KEY).state.series.series1.ballot.kept).toBe(true);
    expect(store.keepBallot("series1")).toEqual({ ok: false, reason: "kept" });
    expect(store.moveBallot("series1")).toEqual({ ok: false, reason: "kept" });
    expect(store.keepBallot("nope")).toEqual({ ok: false, reason: "unknown-series" });
  });

  it("the reset button clears watch history and keeps the preferences", () => {
    const store = useViewerStore.getState();
    store.setLanguage("en");
    store.markWelcomeSeen();
    store.applyPreset("series1", "seen-both");
    store.applyPreset("series2", "voted", "B");
    store.resetHistory();
    expect(useViewerStore.getState()).toMatchObject({ language: "en", welcomeSeen: true, series: {} });
    expect(stored(VIEWER_STORAGE_KEY).state.series).toEqual({});
    store.resetEverything();
    expect(useViewerStore.getState()).toMatchObject({ language: "hi", subtitlesOn: true, welcomeSeen: false, series: {} });
  });
});

describe("epochs: a player left open cannot undo the presenter", () => {
  const at = { positionMs: 6100, lang: "hi" as const, shotId: "s02" };

  it("a save from before a reset is ignored; a save from after it is kept", () => {
    const store = useViewerStore.getState();
    const session = useViewerStore.getState().epoch;
    store.recordProgress("series1", "s1e01", at, session);
    expect(useViewerStore.getState().series.series1.episodes.s1e01.positionMs).toBe(6100);
    store.resetHistory();
    // The player was still open: its unmount save, its finish, a glimpse.
    store.recordProgress("series1", "s1e01", at, session);
    store.completeEpisode("series1", "s1e01", session);
    store.markGlimpseWatched("series1", "A", session);
    expect(useViewerStore.getState().series).toEqual({});
    expect(stored(VIEWER_STORAGE_KEY).state.series).toEqual({});
    const fresh = useViewerStore.getState().epoch;
    expect(fresh).toBe(session + 1);
    store.recordProgress("series1", "s1e01", at, fresh);
    expect(useViewerStore.getState().series.series1.lastPlayableId).toBe("s1e01");
  });

  it("a save without an epoch is always accepted", () => {
    useViewerStore.getState().resetHistory();
    useViewerStore.getState().recordProgress("series1", "s1e01", at);
    expect(useViewerStore.getState().series.series1.episodes.s1e01.positionMs).toBe(6100);
  });

  it("a preset, a full reset, a jump and the demo reset each start a new epoch", () => {
    const epoch = () => useViewerStore.getState().epoch;
    const steps: Array<() => unknown> = [
      () => useViewerStore.getState().applyPreset("series1", "voted", "A"),
      () => useViewerStore.getState().resetEverything(),
      () => jumpToScreen("ballot", "series1"),
      () => jumpToScreen("my-choices", "series1"),
      () => resetDemo(),
    ];
    for (const step of steps) {
      const before = epoch();
      step();
      expect(epoch()).toBeGreaterThan(before);
    }
  });

  it("a jump is not undone by the save the open player makes as it unmounts", () => {
    const session = useViewerStore.getState().epoch;
    useViewerStore.getState().applyPreset("series1", "voted", "A");
    useViewerStore.getState().recordProgress("series1", "s1a01", { positionMs: 3000, lang: "hi", shotId: "s01" }, useViewerStore.getState().epoch);
    jumpToScreen("ballot", "series1");
    useViewerStore.getState().recordProgress("series1", "s1a01", { positionMs: 4000, lang: "hi", shotId: "s02" }, session + 1);
    const progress = useViewerStore.getState().series.series1;
    expect(progress.ballot).toBeNull();
    expect(progress.episodes.s1a01).toBeUndefined();
    expect(progress.lastPlayableId).toBe("s1e02");
  });

  it("the epoch is stored, so a reset in another window also stops this window's player", async () => {
    render(<StoreHydration />);
    await act(async () => {});
    const session = useViewerStore.getState().epoch;
    await act(async () => {
      window.localStorage.setItem(
        VIEWER_STORAGE_KEY,
        JSON.stringify({ state: { language: "hi", subtitlesOn: true, welcomeSeen: true, series: {}, epoch: session + 1 }, version: 1 }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: VIEWER_STORAGE_KEY }));
    });
    expect(useViewerStore.getState().epoch).toBe(session + 1);
    useViewerStore.getState().recordProgress("series1", "s1e01", at, session);
    expect(useViewerStore.getState().series).toEqual({});
  });
});

describe("demo store", () => {
  it("starts on day 1 with no forced winner", () => {
    expect(selectDemoState(useDemoStore.getState())).toEqual({ day: 1, winnerOverride: null, launchAt: null });
  });

  it("switching the day restarts the countdown for that phase", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    useDemoStore.getState().setDay("last-hour");
    expect(dayOneRemainingMs(selectDemoState(useDemoStore.getState()), Date.now())).toBe(45 * 60_000);
    useDemoStore.getState().setDay(1);
    expect(dayOneRemainingMs(selectDemoState(useDemoStore.getState()), Date.now())).toBe(21 * HOUR_MS + 45 * 60_000);
    useDemoStore.getState().setDay(2);
    expect(dayOneRemainingMs(selectDemoState(useDemoStore.getState()), Date.now())).toBe(0);
  });

  it("persists the day and the forced winner", () => {
    useDemoStore.getState().setDay(2);
    useDemoStore.getState().setWinnerOverride("B");
    expect(stored(DEMO_STORAGE_KEY)).toMatchObject({ state: { day: 2, winnerOverride: "B" }, version: STORAGE_VERSION });
    useDemoStore.getState().setWinnerOverride(null);
    expect(stored(DEMO_STORAGE_KEY).state.winnerOverride).toBeNull();
  });

  it("reset goes back to day 1 with no forced winner", () => {
    useDemoStore.getState().setDay(2);
    useDemoStore.getState().setWinnerOverride("B");
    useDemoStore.getState().reset();
    expect(useDemoStore.getState()).toMatchObject({ day: 1, winnerOverride: null });
    expect(useDemoStore.getState().launchAt).not.toBeNull();
  });
});

describe("loading from localStorage", () => {
  it("restores what a previous visit saved", async () => {
    window.localStorage.setItem(
      VIEWER_STORAGE_KEY,
      JSON.stringify({ state: { language: "en", subtitlesOn: false, welcomeSeen: true, series: { series1: { ballot: { choice: "B", castAt: 5, moved: false, movedAt: null } } } }, version: 1 }),
    );
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: { day: 2, winnerOverride: "B", launchAt: 99 }, version: 1 }));
    await hydrateStores();
    expect(useViewerStore.getState()).toMatchObject({ language: "en", subtitlesOn: false, welcomeSeen: true });
    expect(useViewerStore.getState().series.series1).toEqual({
      episodes: {},
      lastPlayableId: null,
      glimpsesWatched: { A: false, B: false },
      ballot: { choice: "B", castAt: 5, moved: false, movedAt: null, kept: false },
    });
    expect(selectDemoState(useDemoStore.getState())).toEqual({ day: 2, winnerOverride: "B", launchAt: 99 });
    expect(typeof useViewerStore.getState().castBallot).toBe("function");
  });

  it("survives damaged storage", async () => {
    window.localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify({ state: { language: 42, series: "x" }, version: 1 }));
    window.localStorage.setItem(DEMO_STORAGE_KEY, "not json at all");
    await hydrateStores();
    expect(useViewerStore.getState()).toMatchObject({ language: "hi", subtitlesOn: true, welcomeSeen: false, series: {} });
    expect(useDemoStore.getState().day).toBe(1);
  });

  it("gives the countdown a start time on first run", async () => {
    await hydrateStores();
    expect(useDemoStore.getState().launchAt).not.toBeNull();
  });

  it("restarts a day-1 countdown left over from yesterday, without changing the day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: { day: 1, winnerOverride: "B", launchAt: Date.now() - 30 * HOUR_MS }, version: 1 }));
    await hydrateStores();
    expect(useDemoStore.getState()).toMatchObject({ day: 1, winnerOverride: "B" });
    expect(dayOneRemainingMs(selectDemoState(useDemoStore.getState()), Date.now())).toBe(21 * HOUR_MS + 45 * 60_000);
    expect(stored(DEMO_STORAGE_KEY).state.launchAt).toBe(useDemoStore.getState().launchAt);
  });

  it("restarts a last hour that has run out at 00:45:00, and leaves a running one alone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: { day: "last-hour", winnerOverride: null, launchAt: Date.now() - R_DAY }, version: 1 }));
    await hydrateStores();
    expect(useDemoStore.getState().day).toBe("last-hour");
    expect(dayOneRemainingMs(selectDemoState(useDemoStore.getState()), Date.now())).toBe(45 * 60_000);
    const running = Date.now() - R_DAY + 30 * 60_000;
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: { day: "last-hour", winnerOverride: null, launchAt: running }, version: 1 }));
    await hydrateStores();
    expect(useDemoStore.getState().launchAt).toBe(running);
    expect(dayOneRemainingMs(selectDemoState(useDemoStore.getState()), Date.now())).toBe(30 * 60_000);
  });

  it("follows a change made in another window on this device", async () => {
    render(<StoreHydration />);
    await act(async () => {});
    expect(useDemoStore.getState().day).toBe(1);
    await act(async () => {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: { day: 2, winnerOverride: "A", launchAt: 7 }, version: 1 }));
      window.dispatchEvent(new StorageEvent("storage", { key: DEMO_STORAGE_KEY }));
    });
    expect(useDemoStore.getState()).toMatchObject({ day: 2, winnerOverride: "A" });
    await act(async () => {
      window.localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify({ state: { language: "en", subtitlesOn: true, welcomeSeen: true, series: {} }, version: 1 }));
      window.dispatchEvent(new StorageEvent("storage", { key: VIEWER_STORAGE_KEY }));
    });
    expect(useViewerStore.getState().language).toBe("en");
  });
});

describe("presenter helpers", () => {
  it("jump to the ballot: day 1, at the question, welcome out of the way", () => {
    useDemoStore.getState().setDay(2);
    expect(jumpToScreen("ballot", "series1")).toBe("/series/series1/ballot");
    expect(useDemoStore.getState().day).toBe(1);
    expect(useViewerStore.getState().welcomeSeen).toBe(true);
    expect(useViewerStore.getState().castBallot("series1", "A")).toEqual({ ok: true });
  });

  it("jump to the day-2 result: day 2, a late viewer", () => {
    expect(jumpToScreen("result", "series2")).toBe("/series/series2/result");
    expect(useDemoStore.getState().day).toBe(2);
    expect(useViewerStore.getState().series.series2.ballot).toBeNull();
    expect(Object.keys(useViewerStore.getState().series.series2.episodes)).toEqual(["s2e01", "s2e02", "s2e03"]);
  });

  it("jump to keep-or-move and to an ending, on the chosen side", () => {
    expect(jumpToScreen("keep-or-move", "series1", "B")).toBe("/series/series1/keep-or-move");
    expect(useViewerStore.getState().moveBallot("series1")).toEqual({ ok: true });
    expect(jumpToScreen("ending", "series1", "B")).toBe("/series/series1/ending/B");
    expect(useViewerStore.getState().series.series1.ballot).toMatchObject({ choice: "B", moved: false });
  });

  it("jump to the welcome shows it again; other jumps leave the day and the viewer alone", () => {
    useViewerStore.getState().markWelcomeSeen();
    useViewerStore.getState().applyPreset("series1", "voted", "A");
    useDemoStore.getState().setDay("last-hour");
    expect(jumpToScreen("welcome", "series1")).toBe("/welcome");
    expect(useViewerStore.getState().welcomeSeen).toBe(false);
    expect(jumpToScreen("my-choices", "series1")).toBe("/my-choices");
    expect(useViewerStore.getState().welcomeSeen).toBe(true);
    expect(useDemoStore.getState().day).toBe("last-hour");
    expect(useViewerStore.getState().series.series1.ballot?.choice).toBe("A");
  });

  it("refuses a series that does not exist", () => {
    expect(() => jumpToScreen("ballot", "nope")).toThrow();
  });

  it("reset demo: history gone, day 1, no forced winner, preferences kept", () => {
    useViewerStore.getState().setLanguage("en");
    useViewerStore.getState().applyPreset("series1", "seen-both");
    useDemoStore.getState().setDay(2);
    useDemoStore.getState().setWinnerOverride("B");
    resetDemo();
    expect(useViewerStore.getState()).toMatchObject({ language: "en", series: {} });
    expect(useDemoStore.getState()).toMatchObject({ day: 1, winnerOverride: null });
  });
});

describe("hooks", () => {
  it("useHydrated turns true once the stores are loaded", async () => {
    const { result } = renderHook(() => useHydrated());
    await act(async () => {
      await hydrateStores();
    });
    expect(result.current).toBe(true);
  });

  it("useSeriesRules answers every rule for the current viewer and follows the stores", async () => {
    const { result } = renderHook(() => useSeriesRules(series1));
    expect(result.current).toMatchObject({ isDayOne: true, isDayTwo: false, official: null, splitVisible: false });
    expect(result.current.canCastBallot).toEqual({ allowed: false, reason: "question-not-reached" });
    expect(result.current.next).toEqual({ type: "episode", episodeId: "s1e01" });
    expect(result.current.access("s1a01")).toEqual({ state: "locked", reason: "question-not-reached" });

    act(() => useViewerStore.getState().applyPreset("series1", "at-question"));
    expect(result.current.canCastBallot).toEqual({ allowed: true });
    expect(result.current.question).toMatchObject({ mode: "vote", primary: { type: "glimpses" } });
    expect(result.current.after("s1e02")).toEqual({ type: "question" });

    act(() => void useViewerStore.getState().castBallot("series1", "B"));
    expect(result.current.splitVisible).toBe(true);
    expect(result.current.tally).toMatchObject({ A: series1.seededTallies.A, B: series1.seededTallies.B + 1 });
    expect(result.current.access("s1b01")).toEqual({ state: "open", reason: "your-ending" });
    expect(result.current.ending("B")).toMatchObject({ finished: false, offerOtherEnding: false });

    act(() => useDemoStore.getState().setDay(2));
    expect(result.current).toMatchObject({ isDayTwo: true, viewerKind: "day2-voter" });
    expect(result.current.official).toBe(result.current.tally.leader);
    expect(result.current.history).toMatchObject({ seriesId: "series1", choice: "B", phase: "day-two" });
    expect(result.current.result.yourChoice).toBe("B");
  });

  it("useSeriesRules does not re-render when another series changes", () => {
    let renders = 0;
    renderHook(() => {
      renders++;
      return useSeriesRules(series1);
    });
    const before = renders;
    act(() => useViewerStore.getState().applyPreset("series2", "voted", "A"));
    expect(renders).toBe(before);
    act(() => useViewerStore.getState().applyPreset("series1", "voted", "A"));
    expect(renders).toBe(before + 1);
  });

  it("useDayOneCountdown ticks once a second after loading, and says when it is closing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const { result } = renderHook(() => useDayOneCountdown());
    await act(async () => {
      await hydrateStores();
    });
    act(() => useDemoStore.getState().setDay("last-hour"));
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toMatchObject({ text: "00:44:59", closingSoon: true });
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.text).toBe("00:44:57");
    act(() => useDemoStore.getState().setDay(2));
    expect(result.current).toMatchObject({ remainingMs: 0, text: "00:00:00", closingSoon: false });
  });
});
