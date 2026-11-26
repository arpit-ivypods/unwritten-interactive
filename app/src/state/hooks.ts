"use client";

/**
 * React hooks over the stores and the rules. Screens use these; they do not
 * read localStorage, compare days or count ballots themselves.
 */
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Choice, Series } from "@/content/schema";
import { selectDemoState, useDemoStore } from "./demoStore";
import { useHydrated } from "./hydration";
import * as R from "./rules";
import type { DemoState, SeriesProgress } from "./types";
import { EMPTY_PROGRESS } from "./types";
import { useViewerStore } from "./viewerStore";

/** The demo clock and forced winner. Re-renders only when one of them changes. */
export function useDemoState(): DemoState {
  return useDemoStore(useShallow(selectDemoState));
}

/** This viewer's progress for one series. A stable empty object if they have none. */
export function useSeriesProgress(seriesId: string): SeriesProgress {
  return useViewerStore((state) => state.series[seriesId] ?? EMPTY_PROGRESS);
}

/**
 * The current time, refreshed every `intervalMs`. null on the server and on
 * the first client render, so nothing time-dependent is in the server HTML.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export interface DayOneCountdown {
  /** Milliseconds left in day 1. null until the page has mounted and the stores are loaded. 0 on day 2. */
  remainingMs: number | null;
  /** "21:44:58", or null while remainingMs is null. */
  text: string | null;
  /** True in the last hour of day 1: use the alert styling and say so in words. */
  closingSoon: boolean;
}

/** The countdown to the end of day 1. One timer per caller; use it once per screen. */
export function useDayOneCountdown(): DayOneCountdown {
  const demo = useDemoState();
  const hydrated = useHydrated();
  const now = useNow(1000);
  if (!hydrated || now === null) return { remainingMs: null, text: null, closingSoon: false };
  const remainingMs = R.dayOneRemainingMs(demo, now);
  return { remainingMs, text: R.formatCountdown(remainingMs), closingSoon: R.isLastHour(demo) };
}

/** Every rule, answered for one series and the current viewer. */
export interface SeriesRules {
  /** False until the stores are loaded. Until then everything below describes a new viewer on day 1: do not show it as fact. */
  hydrated: boolean;
  series: Series;
  progress: SeriesProgress;
  demo: DemoState;
  isDayOne: boolean;
  isLastHour: boolean;
  isDayTwo: boolean;
  viewerKind: R.ViewerKind;
  /** The simulated split. Show it only when `splitVisible`. Always label it "Simulated demo ballots". */
  tally: R.Tally;
  splitVisible: boolean;
  /** The official ending; null on day 1. */
  official: Choice | null;
  questionReached: boolean;
  endingsFinished: Record<Choice, boolean>;
  otherEndingWatched: boolean;
  canCastBallot: R.Verdict<R.CastBallotBlock>;
  canWatchOtherEnding: R.Verdict<R.OtherEndingBlock>;
  canMoveBallot: R.Verdict<R.MoveBallotBlock>;
  /** What the question screen shows, including for a day-2 late viewer. */
  question: R.QuestionView;
  /** What the day-2 result screen shows. */
  result: R.ResultView;
  /** What the My choices screen shows for this series. */
  history: R.HistoryEntry;
  /** The continue target. Turn it into a URL with `stepHref(series.id, next)`. */
  next: R.Step;
  /** Can this episode or glimpse be played now, and if not, why. */
  access: (playableId: string) => R.Access;
  /** Where to go when this episode or glimpse finishes. */
  after: (playableId: string) => R.Step;
  /** What the ending screen shows for a branch. */
  ending: (branch: Choice) => R.EndingView;
}

/** The rules for one series and the current viewer and day. Recomputed only when progress or the demo state changes. */
export function useSeriesRules(series: Series): SeriesRules {
  const hydrated = useHydrated();
  const progress = useSeriesProgress(series.id);
  const demo = useDemoState();
  return useMemo(
    () => ({
      hydrated,
      series,
      progress,
      demo,
      isDayOne: R.isDayOne(demo),
      isLastHour: R.isLastHour(demo),
      isDayTwo: R.isDayTwo(demo),
      viewerKind: R.viewerKind(progress, demo),
      tally: R.tally(series, progress, demo),
      splitVisible: R.canSeeSplit(progress, demo),
      official: R.decidedOfficialBranch(series, progress, demo),
      questionReached: R.questionReached(series, progress),
      endingsFinished: R.endingsFinished(series, progress),
      otherEndingWatched: R.otherEndingWatched(series, progress),
      canCastBallot: R.canCastBallot(series, progress, demo),
      canWatchOtherEnding: R.canWatchOtherEnding(series, progress, demo),
      canMoveBallot: R.canMoveBallot(series, progress, demo),
      question: R.questionView(series, progress, demo),
      result: R.resultView(series, progress, demo),
      history: R.historyEntry(series, progress, demo),
      next: R.continueStep(series, progress, demo),
      access: (playableId: string) => R.playableAccess(series, progress, demo, playableId),
      after: (playableId: string) => R.afterPlayable(series, progress, demo, playableId),
      ending: (branch: Choice) => R.endingView(series, progress, demo, branch),
    }),
    [hydrated, series, progress, demo],
  );
}
