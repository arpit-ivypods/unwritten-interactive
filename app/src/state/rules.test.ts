/**
 * One block per product rule in plan section 2 (as overridden by section 9).
 * Viewers are built with the real transitions (see test/fixtures.ts), so an
 * impossible viewer cannot be tested by accident.
 */
import { describe, expect, it } from "vitest";
import { validateSeries } from "@/content/schema";
import { DAY_1, DAY_2, LAST_HOUR, NOW, branchIds, finish, makeSeries, sharedIds, viewers } from "@/test/fixtures";
import * as R from "./rules";
import * as T from "./transitions";
import { emptyProgress } from "./types";
import type { DemoState } from "./types";

const series = makeSeries();
const v = viewers(series, "A");
const forced = (day: DemoState["day"], winner: "A" | "B"): DemoState => ({ day, winnerOverride: winner, launchAt: null });

describe("the fixture", () => {
  it("is a valid series, so the rules are tested against the real contract", () => {
    expect(validateSeries(series)).toMatchObject({ ok: true });
    expect(validateSeries(makeSeries({ shared: 3, branch: 3 }))).toMatchObject({ ok: true });
  });
});

describe("launch day: the day is switched by hand", () => {
  it("day 1 includes its last hour; day 2 is everything after", () => {
    expect(R.isDayOne(DAY_1)).toBe(true);
    expect(R.isDayOne(LAST_HOUR)).toBe(true);
    expect(R.isLastHour(LAST_HOUR)).toBe(true);
    expect(R.isLastHour(DAY_1)).toBe(false);
    expect(R.isDayOne(DAY_2)).toBe(false);
    expect(R.isDayTwo(DAY_2)).toBe(true);
  });

  it("the countdown starts where the chosen phase should start", () => {
    expect(R.dayOneRemainingMs(DAY_1, NOW)).toBe(21 * R.HOUR_MS + 45 * 60_000);
    expect(R.dayOneRemainingMs(LAST_HOUR, NOW)).toBe(45 * 60_000);
    expect(R.dayOneRemainingMs(DAY_2, NOW)).toBe(0);
    expect(R.dayOneRemainingMs({ ...DAY_1, launchAt: R.launchAtFor(1, NOW) }, NOW)).toBe(21 * R.HOUR_MS + 45 * 60_000);
    expect(R.dayOneRemainingMs({ ...LAST_HOUR, launchAt: R.launchAtFor("last-hour", NOW) }, NOW)).toBe(45 * 60_000);
  });

  it("the countdown runs down with the clock", () => {
    const demo = { ...DAY_1, launchAt: R.launchAtFor(1, NOW) };
    expect(R.dayOneRemainingMs(demo, NOW + 60_000)).toBe(21 * R.HOUR_MS + 44 * 60_000);
  });

  it("the countdown never leaves the phase the presenter chose, because only they change the day", () => {
    const stale = { ...DAY_1, launchAt: NOW - 30 * R.HOUR_MS };
    expect(R.dayOneRemainingMs(stale, NOW)).toBe(R.HOUR_MS + 1000);
    const staleLastHour = { ...LAST_HOUR, launchAt: R.launchAtFor("last-hour", NOW) };
    expect(R.dayOneRemainingMs(staleLastHour, NOW + 2 * R.HOUR_MS)).toBe(1000);
    const future = { ...LAST_HOUR, launchAt: NOW };
    expect(R.dayOneRemainingMs(future, NOW)).toBe(R.HOUR_MS);
  });

  it("on load, a countdown still inside its window carries on where it was", () => {
    const day1 = { ...DAY_1, launchAt: R.launchAtFor(1, NOW) };
    expect(R.launchAtOnLoad(day1, NOW + 20 * R.HOUR_MS)).toBe(day1.launchAt);
    const lastHour = { ...LAST_HOUR, launchAt: R.launchAtFor("last-hour", NOW) };
    expect(R.launchAtOnLoad(lastHour, NOW + 40 * 60_000)).toBe(lastHour.launchAt);
    expect(R.launchAtOnLoad({ ...DAY_2, launchAt: 5 }, NOW)).toBe(5);
  });

  it("on load, a missing start time starts the phase", () => {
    expect(R.launchAtOnLoad(DAY_1, NOW)).toBe(R.launchAtFor(1, NOW));
    expect(R.launchAtOnLoad(LAST_HOUR, NOW)).toBe(R.launchAtFor("last-hour", NOW));
    expect(R.launchAtOnLoad(DAY_2, NOW)).toBe(R.launchAtFor(2, NOW));
  });

  it("on load, a day-1 countdown that ran out of its window starts again and keeps moving", () => {
    const yesterday = { ...DAY_1, launchAt: NOW - 30 * R.HOUR_MS };
    const rolled = { ...yesterday, launchAt: R.launchAtOnLoad(yesterday, NOW) };
    expect(R.dayOneRemainingMs(rolled, NOW)).toBe(21 * R.HOUR_MS + 45 * 60_000);
    expect(R.dayOneRemainingMs(rolled, NOW + 1000)).toBe(21 * R.HOUR_MS + 45 * 60_000 - 1000);
    // Exactly at the floor counts as run out: it would not move again.
    const atFloor = { ...DAY_1, launchAt: NOW - (R.DAY_MS - R.HOUR_MS - 1000) };
    expect(R.launchAtOnLoad(atFloor, NOW)).toBe(R.launchAtFor(1, NOW));
    // A start time in the future (the clock went back) is outside the window too.
    expect(R.launchAtOnLoad({ ...DAY_1, launchAt: NOW + R.HOUR_MS }, NOW)).toBe(R.launchAtFor(1, NOW));
  });

  it("on load, a last-hour countdown that ran out starts the last hour again, still under an hour", () => {
    const stale = { ...LAST_HOUR, launchAt: R.launchAtFor("last-hour", NOW) };
    const later = NOW + 3 * R.HOUR_MS;
    const rolled = { ...stale, launchAt: R.launchAtOnLoad(stale, later) };
    expect(R.dayOneRemainingMs(rolled, later)).toBe(45 * 60_000);
    expect(R.dayOneRemainingMs(rolled, later + 60_000)).toBe(44 * 60_000);
    expect(R.isLastHour(rolled)).toBe(true);
  });

  it("formats the countdown as HH:MM:SS", () => {
    expect(R.formatCountdown(2 * R.HOUR_MS + 14 * 60_000 + 9_000)).toBe("02:14:09");
    expect(R.formatCountdown(0)).toBe("00:00:00");
    expect(R.formatCountdown(-5)).toBe("00:00:00");
  });
});

describe("shared episodes: everyone watches the same opening", () => {
  it("are open to everyone on every day", () => {
    for (const demo of [DAY_1, LAST_HOUR, DAY_2]) {
      for (const id of sharedIds(series)) {
        expect(R.episodeAccess(series, v.fresh, demo, id)).toEqual({ state: "open", reason: "shared" });
      }
    }
  });

  it("the question is reached when the last shared episode is finished, not before", () => {
    expect(R.questionReached(series, v.fresh)).toBe(false);
    expect(R.questionReached(series, finish(series, v.fresh, ["xe01"]))).toBe(false);
    expect(R.questionReached(series, v.atQuestion)).toBe(true);
  });

  it("works for a series with three shared episodes", () => {
    const three = makeSeries({ shared: 3 });
    expect(R.questionReached(three, finish(three, emptyProgress(), ["xe01", "xe02"]))).toBe(false);
    expect(R.questionReached(three, finish(three, emptyProgress(), ["xe01", "xe02", "xe03"]))).toBe(true);
    expect(R.afterPlayable(three, emptyProgress(), DAY_1, "xe02")).toEqual({ type: "episode", episodeId: "xe03" });
    expect(R.afterPlayable(three, emptyProgress(), DAY_1, "xe03")).toEqual({ type: "question" });
  });

  it("before the question, both branches are locked", () => {
    for (const id of [...branchIds(series, "A"), ...branchIds(series, "B")]) {
      expect(R.episodeAccess(series, v.fresh, DAY_1, id)).toEqual({ state: "locked", reason: "question-not-reached" });
    }
  });
});

describe("glimpses: optional before voting (section 9 overrides the design system README)", () => {
  it("a viewer can cast a ballot without watching either glimpse", () => {
    expect(v.atQuestion.glimpsesWatched).toEqual({ A: false, B: false });
    expect(R.canCastBallot(series, v.atQuestion, DAY_1)).toEqual({ allowed: true });
    expect(T.castBallot(series, v.atQuestion, DAY_1, "B", NOW).ok).toBe(true);
  });

  it("watching one or both glimpses changes nothing about the ballot", () => {
    const one = T.markGlimpseWatched(v.atQuestion, "A");
    const both = T.markGlimpseWatched(one, "B");
    expect(R.canCastBallot(series, one, DAY_1)).toEqual({ allowed: true });
    expect(R.canCastBallot(series, both, DAY_1)).toEqual({ allowed: true });
  });

  it("glimpses open with the question, not before", () => {
    expect(R.glimpseAccess(series, v.fresh)).toEqual({ state: "locked", reason: "question-not-reached" });
    expect(R.glimpseAccess(series, v.atQuestion)).toEqual({ state: "open", reason: "glimpse" });
    expect(R.playableAccess(series, v.atQuestion, DAY_1, "xga").state).toBe("open");
    expect(R.playableAccess(series, v.atQuestion, DAY_2, "xgb").state).toBe("open");
  });

  it("a glimpse returns the viewer to the two glimpses", () => {
    expect(R.afterPlayable(series, v.atQuestion, DAY_1, "xga")).toEqual({ type: "glimpses" });
    expect(R.afterPlayable(series, v.atQuestion, DAY_2, "xgb")).toEqual({ type: "glimpses" });
  });
});

describe("the choice: one ballot per viewer, then their branch", () => {
  it("cannot be cast before the question", () => {
    expect(R.canCastBallot(series, v.fresh, DAY_1)).toEqual({ allowed: false, reason: "question-not-reached" });
  });

  it("can be cast on day 1, including the last hour", () => {
    expect(R.canCastBallot(series, v.atQuestion, DAY_1)).toEqual({ allowed: true });
    expect(R.canCastBallot(series, v.atQuestion, LAST_HOUR)).toEqual({ allowed: true });
  });

  it("cannot be cast twice", () => {
    expect(R.canCastBallot(series, v.voted, DAY_1)).toEqual({ allowed: false, reason: "already-cast" });
  });

  it("cannot be cast on day 2", () => {
    expect(R.canCastBallot(series, v.atQuestion, DAY_2)).toEqual({ allowed: false, reason: "voting-closed" });
  });

  it("until the ballot is cast, both branches are locked", () => {
    expect(R.episodeAccess(series, v.atQuestion, DAY_1, "xa01")).toEqual({ state: "locked", reason: "vote-first" });
    expect(R.episodeAccess(series, v.atQuestion, DAY_1, "xb01")).toEqual({ state: "locked", reason: "vote-first" });
  });

  it("the ballot opens the chosen branch and only that branch", () => {
    for (const id of branchIds(series, "A")) {
      expect(R.episodeAccess(series, v.voted, DAY_1, id)).toEqual({ state: "open", reason: "your-ending" });
    }
    for (const id of branchIds(series, "B")) {
      expect(R.episodeAccess(series, v.voted, DAY_1, id)).toEqual({ state: "locked", reason: "finish-your-ending-first" });
    }
  });

  it("the viewer then watches their branch to its ending", () => {
    expect(R.afterPlayable(series, v.voted, DAY_1, "xa01")).toEqual({ type: "episode", episodeId: "xa02" });
    expect(R.afterPlayable(series, v.voted, DAY_1, "xa02")).toEqual({ type: "episode", episodeId: "xa03" });
    expect(R.afterPlayable(series, v.voted, DAY_1, "xa03")).toEqual({ type: "ending", branch: "A" });
    expect(R.endingFinished(series, v.voted, "A")).toBe(false);
    expect(R.endingFinished(series, v.finishedOwn, "A")).toBe(true);
  });

  it("the split appears only after the viewer has cast a ballot", () => {
    expect(R.canSeeSplit(v.atQuestion, DAY_1)).toBe(false);
    expect(R.canSeeSplit(v.voted, DAY_1)).toBe(true);
  });
});

describe("the other ending: only after finishing their own, only on day 1", () => {
  it("is refused without a ballot", () => {
    expect(R.canWatchOtherEnding(series, v.atQuestion, DAY_1)).toEqual({ allowed: false, reason: "no-ballot" });
  });

  it("is refused until their own ending is finished", () => {
    expect(R.canWatchOtherEnding(series, v.voted, DAY_1)).toEqual({ allowed: false, reason: "own-ending-not-finished" });
    const partWay = finish(series, v.voted, ["xa01", "xa02"]);
    expect(R.canWatchOtherEnding(series, partWay, DAY_1)).toEqual({ allowed: false, reason: "own-ending-not-finished" });
    expect(R.episodeAccess(series, partWay, DAY_1, "xb01").state).toBe("locked");
  });

  it("opens on day 1 once their own ending is finished", () => {
    expect(R.canWatchOtherEnding(series, v.finishedOwn, DAY_1)).toEqual({ allowed: true });
    expect(R.canWatchOtherEnding(series, v.finishedOwn, LAST_HOUR)).toEqual({ allowed: true });
    for (const id of branchIds(series, "B")) {
      expect(R.episodeAccess(series, v.finishedOwn, DAY_1, id)).toEqual({ state: "open", reason: "other-ending-unlocked" });
    }
  });

  it("is refused on day 2 even if their own ending is finished", () => {
    expect(R.canWatchOtherEnding(series, v.finishedOwn, DAY_2)).toEqual({ allowed: false, reason: "day-one-only" });
  });

  it("the ending screen makes the offer on day 1 and never on day 2", () => {
    const dayOne = R.endingView(series, v.finishedOwn, DAY_1, "A");
    expect(dayOne).toMatchObject({ finished: true, offerOtherEnding: true, otherBranch: "B", otherEndingStart: "xb01", offerKeepOrMove: false, official: null });
    const dayTwo = R.endingView(series, v.finishedOwn, DAY_2, "A");
    expect(dayTwo).toMatchObject({ offerOtherEnding: false, offerKeepOrMove: false, official: "A" });
  });

  it("knows when the other ending has been watched", () => {
    expect(R.otherEndingWatched(series, v.finishedOwn)).toBe(false);
    expect(R.otherEndingWatched(series, v.seenBoth)).toBe(true);
    expect(R.otherEndingWatched(series, v.atQuestion)).toBe(false);
    expect(R.endingsFinished(series, v.finishedOwn)).toEqual({ A: true, B: false });
    expect(R.endingsFinished(series, v.seenBoth)).toEqual({ A: true, B: true });
  });

  it("finishing the other ending leads to keep-or-move", () => {
    const lastOfOther = finish(series, v.finishedOwn, ["xb01", "xb02"]);
    expect(R.afterPlayable(series, lastOfOther, DAY_1, "xb03")).toEqual({ type: "keep-or-move" });
  });
});

describe("changing the vote: a viewer who has finished both endings can move the ballot once", () => {
  it("is refused without a ballot", () => {
    expect(R.canMoveBallot(series, v.atQuestion, DAY_1)).toEqual({ allowed: false, reason: "no-ballot" });
  });

  it("is refused until both endings are finished", () => {
    expect(R.canMoveBallot(series, v.voted, DAY_1)).toEqual({ allowed: false, reason: "both-endings-not-finished" });
    expect(R.canMoveBallot(series, v.finishedOwn, DAY_1)).toEqual({ allowed: false, reason: "both-endings-not-finished" });
  });

  it("is allowed on day 1 after both endings, including the last hour", () => {
    expect(R.canMoveBallot(series, v.seenBoth, DAY_1)).toEqual({ allowed: true });
    expect(R.canMoveBallot(series, v.seenBoth, LAST_HOUR)).toEqual({ allowed: true });
  });

  it("is refused on day 2", () => {
    expect(R.canMoveBallot(series, v.seenBoth, DAY_2)).toEqual({ allowed: false, reason: "voting-closed" });
  });

  it("works once and never again", () => {
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW);
    expect(moved.ok).toBe(true);
    expect(moved.progress.ballot).toMatchObject({ choice: "B", moved: true, movedAt: NOW });
    expect(R.canMoveBallot(series, moved.progress, DAY_1)).toEqual({ allowed: false, reason: "already-moved" });
    const again = T.moveBallot(series, moved.progress, DAY_1, NOW);
    expect(again.ok).toBe(false);
    expect(again.progress.ballot?.choice).toBe("B");
  });

  it("until the viewer decides, the option stays open", () => {
    expect(R.canMoveBallot(series, v.seenBoth, DAY_1)).toEqual({ allowed: true });
    expect(v.seenBoth.ballot).toMatchObject({ choice: "A", moved: false, kept: false });
  });

  it("keeping the ballot is final for day 1: no move, and keep-or-move is not offered again", () => {
    const kept = T.keepBallot(series, v.seenBoth, DAY_1).progress;
    expect(kept.ballot).toMatchObject({ choice: "A", moved: false, kept: true });
    expect(R.canMoveBallot(series, kept, DAY_1)).toEqual({ allowed: false, reason: "kept" });
    expect(R.canMoveBallot(series, kept, LAST_HOUR)).toEqual({ allowed: false, reason: "kept" });
    expect(R.afterPlayable(series, kept, DAY_1, "xb03")).toEqual({ type: "ending", branch: "B" });
    expect(R.continueStep(series, kept, DAY_1)).toEqual({ type: "ending", branch: "A" });
    expect(R.endingView(series, kept, DAY_1, "A").offerKeepOrMove).toBe(false);
    expect(R.endingView(series, kept, DAY_1, "B").offerKeepOrMove).toBe(false);
    expect(R.historyEntry(series, kept, DAY_1)).toMatchObject({ choice: "A", moved: false, kept: true });
    // Both endings stay open on day 1, and the vote counts where it was cast.
    expect(R.episodeAccess(series, kept, DAY_1, "xb01").state).toBe("open");
    expect(R.tally(series, kept, DAY_1)).toEqual(R.tally(series, v.seenBoth, DAY_1));
  });

  it("moving the ballot moves the viewer's vote in the tally", () => {
    const before = R.tally(series, v.seenBoth, DAY_1);
    const after = R.tally(series, T.moveBallot(series, v.seenBoth, DAY_1, NOW).progress, DAY_1);
    expect(before).toMatchObject({ A: 101, B: 90 });
    expect(after).toMatchObject({ A: 100, B: 91 });
  });

  it("after a move, both endings stay open on day 1 and keep-or-move is not offered again", () => {
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW).progress;
    expect(R.episodeAccess(series, moved, DAY_1, "xa01").state).toBe("open");
    expect(R.episodeAccess(series, moved, DAY_1, "xb01").state).toBe("open");
    expect(R.afterPlayable(series, moved, DAY_1, "xb03")).toEqual({ type: "ending", branch: "B" });
    expect(R.continueStep(series, moved, DAY_1)).toEqual({ type: "ending", branch: "B" });
  });
});

describe("votes: simulated tallies, including the viewer's own ballot, tie to A", () => {
  it("start from the seeded numbers", () => {
    expect(R.tally(series, v.atQuestion, DAY_1)).toEqual({ A: 100, B: 90, total: 190, percentA: 53, percentB: 47, leader: "A", forced: false });
  });

  it("include the viewer's own ballot", () => {
    expect(R.tally(series, v.voted, DAY_1)).toMatchObject({ A: 101, B: 90, total: 191 });
    const votedB = viewers(series, "B").voted;
    expect(R.tally(series, votedB, DAY_1)).toMatchObject({ A: 100, B: 91, total: 191 });
  });

  it("a tie goes to A", () => {
    const level = makeSeries({ seeded: { A: 50, B: 50 } });
    expect(R.officialBranch(level, emptyProgress(), DAY_2)).toBe("A");
    const oneBehind = makeSeries({ seeded: { A: 50, B: 49 } });
    const votedB = viewers(oneBehind, "B").voted;
    expect(R.tally(oneBehind, votedB, DAY_2)).toMatchObject({ A: 50, B: 50, leader: "A" });
    expect(R.officialBranch(oneBehind, votedB, DAY_2)).toBe("A");
  });

  it("the viewer's own ballot can decide it", () => {
    const level = makeSeries({ seeded: { A: 50, B: 50 } });
    expect(R.officialBranch(level, viewers(level, "B").voted, DAY_2)).toBe("B");
    expect(R.officialBranch(level, viewers(level, "A").voted, DAY_2)).toBe("A");
  });

  it("B wins when it has more ballots", () => {
    const bAhead = makeSeries({ seeded: { A: 10, B: 30 } });
    expect(R.officialBranch(bAhead, emptyProgress(), DAY_2)).toBe("B");
    expect(R.tally(bAhead, emptyProgress(), DAY_2)).toMatchObject({ percentA: 25, percentB: 75, leader: "B" });
  });

  it("percentages are whole numbers that add up to 100 and never contradict the leader", () => {
    for (const seeded of [{ A: 1, B: 2 }, { A: 333, B: 667 }, { A: 6241, B: 5873 }, { A: 5000, B: 5001 }, { A: 0, B: 0 }, { A: 7, B: 0 }]) {
      const t = R.tally(makeSeries({ seeded }), emptyProgress(), DAY_2);
      expect(t.percentA + t.percentB).toBe(100);
      expect(Number.isInteger(t.percentA)).toBe(true);
      if (t.leader === "A") expect(t.percentA).toBeGreaterThanOrEqual(t.percentB);
      else expect(t.percentB).toBeGreaterThanOrEqual(t.percentA);
    }
    expect(R.tally(makeSeries({ seeded: { A: 0, B: 0 } }), emptyProgress(), DAY_2)).toMatchObject({ percentA: 50, percentB: 50, leader: "A" });
  });

  it("nothing is official on day 1", () => {
    expect(R.decidedOfficialBranch(series, v.voted, DAY_1)).toBeNull();
    expect(R.decidedOfficialBranch(series, v.voted, LAST_HOUR)).toBeNull();
    expect(R.decidedOfficialBranch(series, v.voted, DAY_2)).toBe("A");
  });
});

describe("the presenter can set which ending wins", () => {
  it("the forced winner is official whatever the tallies say", () => {
    expect(R.officialBranch(series, v.voted, forced(2, "B"))).toBe("B");
    expect(R.officialBranch(series, v.voted, forced(2, "A"))).toBe("A");
    expect(R.decidedOfficialBranch(series, v.voted, forced(1, "B"))).toBeNull();
  });

  it("the split is made to agree with the forced winner", () => {
    const t = R.tally(series, v.atQuestion, forced(2, "B"));
    expect(t).toMatchObject({ A: 90, B: 100, leader: "B", forced: true });
    expect(t.percentB).toBeGreaterThan(t.percentA);
  });

  it("the split is left alone when the forced winner is already ahead", () => {
    expect(R.tally(series, v.atQuestion, forced(2, "A"))).toMatchObject({ A: 100, B: 90, leader: "A", forced: true });
  });

  it("still agrees when the seeds are level or one ballot apart", () => {
    const level = makeSeries({ seeded: { A: 50, B: 50 } });
    expect(R.tally(level, emptyProgress(), forced(2, "B"))).toMatchObject({ A: 50, B: 51, leader: "B" });
    const votedB = viewers(level, "B").voted;
    expect(R.tally(level, votedB, forced(2, "A"))).toMatchObject({ A: 51, B: 51, leader: "A" });
    for (const seeded of [{ A: 50, B: 50 }, { A: 50, B: 51 }, { A: 51, B: 50 }, { A: 0, B: 0 }, { A: 900, B: 3 }]) {
      for (const winner of ["A", "B"] as const) {
        for (const choice of ["A", "B"] as const) {
          const s = makeSeries({ seeded });
          expect(R.tally(s, viewers(s, choice).voted, forced(2, winner)).leader).toBe(winner);
          expect(R.tally(s, emptyProgress(), forced(2, winner)).leader).toBe(winner);
        }
      }
    }
  });
});

describe("day 2 onwards: only the official ending remains", () => {
  it("a new viewer gets the official branch after the shared episodes, and nothing else", () => {
    for (const id of branchIds(series, "A")) {
      expect(R.episodeAccess(series, v.atQuestion, DAY_2, id)).toEqual({ state: "open", reason: "official-ending" });
    }
    for (const id of branchIds(series, "B")) {
      expect(R.episodeAccess(series, v.atQuestion, DAY_2, id)).toEqual({ state: "expired", reason: "not-the-official-ending" });
    }
    expect(R.expiredEpisodeIds(series, v.atQuestion, DAY_2)).toEqual(branchIds(series, "B"));
  });

  it("the official branch still waits for the shared episodes", () => {
    expect(R.episodeAccess(series, v.fresh, DAY_2, "xa01")).toEqual({ state: "locked", reason: "question-not-reached" });
    expect(R.episodeAccess(series, v.fresh, DAY_2, "xb01").state).toBe("expired");
  });

  it("a viewer who finished the losing ending on day 1 keeps it", () => {
    const votedB = viewers(series, "B");
    expect(R.officialBranch(series, votedB.finishedOwn, DAY_2)).toBe("A");
    for (const id of branchIds(series, "B")) {
      expect(R.episodeAccess(series, votedB.finishedOwn, DAY_2, id)).toEqual({ state: "open", reason: "kept-from-day-one" });
    }
    for (const id of branchIds(series, "A")) {
      expect(R.episodeAccess(series, votedB.finishedOwn, DAY_2, id)).toEqual({ state: "open", reason: "official-ending" });
    }
    expect(R.expiredEpisodeIds(series, votedB.finishedOwn, DAY_2)).toEqual([]);
  });

  it("a viewer keeps exactly the losing episodes they finished; the rest has expired", () => {
    const startedOther = finish(series, v.finishedOwn, ["xb01"]);
    expect(R.episodeAccess(series, startedOther, DAY_2, "xb01")).toEqual({ state: "open", reason: "kept-from-day-one" });
    expect(R.episodeAccess(series, startedOther, DAY_2, "xb02")).toEqual({ state: "expired", reason: "not-the-official-ending" });
    expect(R.episodeAccess(series, startedOther, DAY_2, "xb03")).toEqual({ state: "expired", reason: "not-the-official-ending" });
    expect(R.expiredEpisodeIds(series, startedOther, DAY_2)).toEqual(["xb02", "xb03"]);
  });

  it("an episode that was only started, not finished, is not kept", () => {
    const halfWay = T.recordProgress(series, v.finishedOwn, "xb01", { positionMs: 3000, lang: "hi", shotId: "s01" }, NOW);
    expect(R.episodeAccess(series, halfWay, DAY_2, "xb01").state).toBe("expired");
  });

  it("a day-1 voter whose side lost moves on to the official ending", () => {
    const votedB = viewers(series, "B").voted;
    expect(R.episodeAccess(series, votedB, DAY_2, "xb01").state).toBe("expired");
    expect(R.episodeAccess(series, votedB, DAY_2, "xa01")).toEqual({ state: "open", reason: "official-ending" });
    expect(R.continueStep(series, votedB, DAY_2)).toEqual({ type: "result" });
  });

  it("nothing has expired on day 1", () => {
    for (const p of Object.values(v)) expect(R.expiredEpisodeIds(series, p, DAY_1)).toEqual([]);
  });

  it("follows the forced winner", () => {
    expect(R.episodeAccess(series, v.atQuestion, forced(2, "B"), "xb01")).toEqual({ state: "open", reason: "official-ending" });
    expect(R.episodeAccess(series, v.atQuestion, forced(2, "B"), "xa01").state).toBe("expired");
    expect(R.episodeAccess(series, v.finishedOwn, forced(2, "B"), "xa01")).toEqual({ state: "open", reason: "kept-from-day-one" });
  });

  it("the official ending ends on the ending screen, with no way to the other one", () => {
    expect(R.afterPlayable(series, v.atQuestion, DAY_2, "xa03")).toEqual({ type: "ending", branch: "A" });
    expect(R.afterPlayable(series, v.seenBoth, DAY_2, "xb03")).toEqual({ type: "ending", branch: "B" });
    expect(R.afterPlayable(series, finish(series, v.finishedOwn, ["xb01"]), DAY_2, "xb01")).toEqual({ type: "series" });
  });
});

describe("late viewers: arrive on day 2, no ballot", () => {
  it("are recognised", () => {
    expect(R.viewerKind(v.fresh, DAY_1)).toBe("day1-undecided");
    expect(R.viewerKind(v.voted, DAY_1)).toBe("day1-voted");
    expect(R.viewerKind(v.voted, DAY_2)).toBe("day2-voter");
    expect(R.viewerKind(v.fresh, DAY_2)).toBe("day2-late");
    expect(R.viewerKind(v.atQuestion, DAY_2)).toBe("day2-late");
    expect(R.isLateViewer(v.atQuestion, DAY_2)).toBe(true);
    expect(R.isLateViewer(v.voted, DAY_2)).toBe(false);
  });

  it("watch the shared episodes first", () => {
    expect(R.continueStep(series, v.fresh, DAY_2)).toEqual({ type: "episode", episodeId: "xe01" });
    expect(R.afterPlayable(series, v.fresh, DAY_2, "xe02")).toEqual({ type: "question" });
    expect(R.questionView(series, v.fresh, DAY_2)).toMatchObject({ reached: false, splitVisible: false, primary: { type: "episode", episodeId: "xe01" } });
  });

  it("see the question with the result, both glimpses, the split, and no ballot", () => {
    expect(R.questionView(series, v.atQuestion, DAY_2)).toEqual({
      reached: true,
      mode: "result",
      isLateViewer: true,
      ballotOpen: false,
      glimpsesAvailable: true,
      splitVisible: true,
      yourChoice: null,
      official: "A",
      primary: { type: "result" },
    });
  });

  it("continue on the official branch", () => {
    const result = R.resultView(series, v.atQuestion, DAY_2);
    expect(result).toMatchObject({
      official: "A",
      isLateViewer: true,
      yourChoice: null,
      choseOfficial: null,
      keptEpisodeIds: [],
      expiredEpisodeIds: branchIds(series, "B"),
      glimpsesAvailable: true,
      enter: { type: "episode", episodeId: "xa01" },
    });
    expect(result.tally).toMatchObject({ A: 100, B: 90 });
    expect(R.continueStep(series, v.atQuestion, DAY_2)).toEqual({ type: "result" });
    const watching = finish(series, v.atQuestion, ["xa01"]);
    expect(R.continueStep(series, watching, DAY_2)).toEqual({ type: "episode", episodeId: "xa02" });
    expect(R.continueStep(series, finish(series, watching, ["xa02", "xa03"]), DAY_2)).toEqual({ type: "ending", branch: "A" });
  });

  it("a returning day-1 voter sees the same result with their own ballot in it", () => {
    const votedB = viewers(series, "B").finishedOwn;
    expect(R.questionView(series, votedB, DAY_2)).toMatchObject({ mode: "result", isLateViewer: false, yourChoice: "B", official: "A", ballotOpen: false });
    expect(R.resultView(series, votedB, DAY_2)).toMatchObject({
      official: "A",
      isLateViewer: false,
      yourChoice: "B",
      choseOfficial: false,
      keptEpisodeIds: branchIds(series, "B"),
      expiredEpisodeIds: [],
      enter: { type: "episode", episodeId: "xa01" },
    });
    expect(R.resultView(series, v.finishedOwn, DAY_2)).toMatchObject({ choseOfficial: true, enter: { type: "ending", branch: "A" } });
  });
});

describe("the question screen on day 1", () => {
  it("before the ballot: vote mode, glimpses offered, no split, no result", () => {
    expect(R.questionView(series, v.atQuestion, DAY_1)).toEqual({
      reached: true,
      mode: "vote",
      isLateViewer: false,
      ballotOpen: true,
      glimpsesAvailable: true,
      splitVisible: false,
      yourChoice: null,
      official: null,
      primary: { type: "glimpses" },
    });
  });

  it("after the ballot: the split appears and the button leads into their branch", () => {
    expect(R.questionView(series, v.voted, DAY_1)).toMatchObject({
      mode: "voted",
      ballotOpen: false,
      splitVisible: true,
      yourChoice: "A",
      official: null,
      primary: { type: "episode", episodeId: "xa01" },
    });
  });

  it("a viewer who has not reached the question is sent back to watch", () => {
    expect(R.questionView(series, v.fresh, DAY_1)).toMatchObject({ reached: false, ballotOpen: false, primary: { type: "episode", episodeId: "xe01" } });
  });
});

describe("continue: one target per viewer", () => {
  it("walks a day-1 viewer through the whole flow", () => {
    expect(R.continueStep(series, v.fresh, DAY_1)).toEqual({ type: "episode", episodeId: "xe01" });
    expect(R.continueStep(series, finish(series, v.fresh, ["xe01"]), DAY_1)).toEqual({ type: "episode", episodeId: "xe02" });
    expect(R.continueStep(series, v.atQuestion, DAY_1)).toEqual({ type: "question" });
    expect(R.continueStep(series, v.voted, DAY_1)).toEqual({ type: "episode", episodeId: "xa01" });
    expect(R.continueStep(series, finish(series, v.voted, ["xa01"]), DAY_1)).toEqual({ type: "episode", episodeId: "xa02" });
    expect(R.continueStep(series, v.finishedOwn, DAY_1)).toEqual({ type: "ending", branch: "A" });
    expect(R.continueStep(series, finish(series, v.finishedOwn, ["xb01"]), DAY_1)).toEqual({ type: "episode", episodeId: "xb02" });
    expect(R.continueStep(series, v.seenBoth, DAY_1)).toEqual({ type: "keep-or-move" });
  });

  it("goes back to a half-watched episode first", () => {
    const halfWay = T.recordProgress(series, v.voted, "xa02", { positionMs: 5200, lang: "hi", shotId: "s02" }, NOW);
    expect(R.continueStep(series, halfWay, DAY_1)).toEqual({ type: "episode", episodeId: "xa02" });
    expect(R.resumePoint(series, halfWay, DAY_1)).toEqual({ episodeId: "xa02", positionMs: 5200, lang: "hi", shotId: "s02" });
  });

  it("does not send anyone back to an episode that has expired", () => {
    const votedB = viewers(series, "B").voted;
    const halfWay = T.recordProgress(series, votedB, "xb01", { positionMs: 5200, lang: "en", shotId: "s02" }, NOW);
    expect(R.continueStep(series, halfWay, DAY_1)).toEqual({ type: "episode", episodeId: "xb01" });
    expect(R.continueStep(series, halfWay, DAY_2)).toEqual({ type: "result" });
    expect(R.resumePoint(series, halfWay, DAY_2)).toBeNull();
  });

  it("has no resume point for a finished episode or a fresh viewer", () => {
    expect(R.resumePoint(series, v.fresh, DAY_1)).toBeNull();
    expect(R.resumePoint(series, v.atQuestion, DAY_1)).toBeNull();
  });
});

describe("resuming an episode", () => {
  const media = series.episodes[0];
  const saved = (positionMs: number, lang: "hi" | "en", shotId: string | null, completed = false) => ({ positionMs, lang, shotId, completed, completedAt: null, updatedAt: NOW });

  it("starts at the top when there is nothing to resume", () => {
    expect(R.startPositionMs(media, undefined, "hi")).toBe(0);
    expect(R.startPositionMs(media, saved(0, "hi", "s01"), "hi")).toBe(0);
    expect(R.startPositionMs(media, saved(5000, "hi", "s02", true), "hi")).toBe(0);
  });

  it("resumes at the same second in the same language", () => {
    expect(R.startPositionMs(media, saved(5200, "hi", "s02"), "hi")).toBe(5200);
    expect(R.startPositionMs(media, saved(99_000, "hi", "s02"), "hi")).toBe(8000);
  });

  it("resumes at the start of the same shot when the language has changed", () => {
    expect(R.startPositionMs(media, saved(5200, "hi", "s02"), "en")).toBe(3000);
    expect(R.startPositionMs(media, saved(3500, "en", "s02"), "hi")).toBe(4000);
    expect(R.startPositionMs(media, saved(3500, "en", null), "hi")).toBe(0);
    expect(R.startPositionMs(media, saved(3500, "en", "gone"), "hi")).toBe(0);
  });
});

describe("history: what you chose, what won, what expired, where to resume", () => {
  it("day 1, part way through their branch", () => {
    const watching = T.recordProgress(series, finish(series, v.voted, ["xa01"]), "xa02", { positionMs: 2500, lang: "hi", shotId: "s01" }, NOW);
    const h = R.historyEntry(series, watching, DAY_1);
    expect(h).toMatchObject({
      seriesId: "demo",
      started: true,
      phase: "day-one",
      choice: "A",
      moved: false,
      official: null,
      choseOfficial: null,
      resume: { episodeId: "xa02", positionMs: 2500 },
      next: { type: "episode", episodeId: "xa02" },
    });
    expect(h.shared.map((e) => [e.label, e.completed])).toEqual([["1", true], ["2", true]]);
    expect(h.branches.A).toMatchObject({ watched: "in-progress", availability: "open", isOfficial: null, isYourChoice: true, expiredEpisodeIds: [], keptEpisodeIds: [] });
    expect(h.branches.A.episodes.map((e) => e.label)).toEqual(["3A", "4A", "5A"]);
    expect(h.branches.B).toMatchObject({ watched: "not-started", availability: "locked", isOfficial: null, isYourChoice: false });
  });

  it("an untouched series has not started", () => {
    expect(R.historyEntry(series, v.fresh, DAY_1)).toMatchObject({ started: false, choice: null, resume: null, next: { type: "episode", episodeId: "xe01" } });
    expect(R.hasStarted(v.fresh)).toBe(false);
  });

  it("day 2, the viewer's side won and they had begun the other ending: part of it is kept, the rest expired", () => {
    const h = R.historyEntry(series, finish(series, v.finishedOwn, ["xb01"]), DAY_2);
    expect(h).toMatchObject({ phase: "day-two", choice: "A", official: "A", choseOfficial: true });
    expect(h.branches.A).toMatchObject({ watched: "finished", availability: "open", isOfficial: true, isYourChoice: true });
    expect(h.branches.B).toMatchObject({
      watched: "in-progress",
      availability: "partly-expired",
      isOfficial: false,
      keptEpisodeIds: ["xb01"],
      expiredEpisodeIds: ["xb02", "xb03"],
    });
  });

  it("day 2, the viewer's side lost but they finished it: all of it is kept", () => {
    const h = R.historyEntry(series, viewers(series, "B").finishedOwn, DAY_2);
    expect(h).toMatchObject({ choice: "B", official: "A", choseOfficial: false, next: { type: "result" } });
    expect(h.branches.B).toMatchObject({ watched: "finished", availability: "open", isOfficial: false, isYourChoice: true, keptEpisodeIds: branchIds(series, "B"), expiredEpisodeIds: [] });
    expect(h.branches.A).toMatchObject({ watched: "not-started", availability: "open", isOfficial: true });
  });

  it("day 2, a late viewer: the losing ending is simply expired", () => {
    const h = R.historyEntry(series, v.atQuestion, DAY_2);
    expect(h).toMatchObject({ choice: null, official: "A", choseOfficial: null });
    expect(h.branches.B).toMatchObject({ availability: "expired", expiredEpisodeIds: branchIds(series, "B"), keptEpisodeIds: [] });
    expect(h.branches.A).toMatchObject({ availability: "open", isOfficial: true });
  });

  it("records a moved ballot", () => {
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW).progress;
    expect(R.historyEntry(series, moved, DAY_1)).toMatchObject({ choice: "B", moved: true });
  });
});

describe("unknown ids never crash a screen", () => {
  it("are locked and lead back to the series page", () => {
    expect(R.playableAccess(series, v.voted, DAY_1, "nope")).toEqual({ state: "locked", reason: "unknown" });
    expect(R.episodeAccess(series, v.voted, DAY_1, "nope")).toEqual({ state: "locked", reason: "unknown" });
    expect(R.afterPlayable(series, v.voted, DAY_1, "nope")).toEqual({ type: "series" });
  });

  it("progressFor gives a stable empty progress for a series nobody has opened", () => {
    const viewer = { series: {} };
    expect(R.progressFor(viewer, "demo")).toBe(R.progressFor(viewer, "other"));
    expect(R.progressFor(viewer, "demo").ballot).toBeNull();
  });
});
