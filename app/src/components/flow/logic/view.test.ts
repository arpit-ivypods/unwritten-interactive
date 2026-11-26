/**
 * The flow screens' view logic: every label, chip and rail item is derived
 * from what the rules answer, and never names a choice or an ending the
 * viewer should not know about yet.
 */
import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import { VIEWER_PRESETS, presetProgress } from "@/state/presets";
import * as R from "@/state/rules";
import * as T from "@/state/transitions";
import type { DemoState, SeriesProgress } from "@/state/types";
import { DAY_1, DAY_2, LAST_HOUR, NOW, branchIds, finish, makeSeries, viewers } from "@/test/fixtures";
import {
  accessReasonText,
  ballotDecision,
  ballotFootnote,
  branchChips,
  branchNote,
  closesIn,
  countdownLabel,
  dayStatus,
  decisionCaption,
  endingRole,
  finalFrame,
  formatClock,
  matchPreset,
  pathSegments,
  railView,
  resultActionLabel,
  resultCaption,
  resumeLabel,
  seriesMeta,
  shareCta,
  shareFileName,
  shareSeriesLine,
  stepLabel,
  stepStill,
} from "./view";

const series = makeSeries();
const v = viewers(series, "A");
const flags = (demo: DemoState) => ({ isDayTwo: R.isDayTwo(demo), isLastHour: R.isLastHour(demo) });
const history = (progress: SeriesProgress, demo: DemoState) => R.historyEntry(series, progress, demo);
const B_WINS: DemoState = { ...DAY_2, winnerOverride: "B" };

describe("the day, in words", () => {
  it("says which day it is and what that means, with the right chip", () => {
    expect(dayStatus(flags(DAY_1), "21:44:58")).toEqual({ kind: "live", full: "Day 1 · both endings open", short: "Day 1 · 21:44:58" });
    expect(dayStatus(flags(LAST_HOUR), "00:44:58")).toEqual({ kind: "alert", full: "Last hour · closes in 00:44:58", short: "Last hour · 00:44:58" });
    expect(dayStatus(flags(DAY_2), null)).toEqual({ kind: "canon", full: "Day 2 · official ending only", short: "Day 2 · official ending" });
  });

  it("shows a placeholder, not a wrong time, before the clock has been read", () => {
    expect(dayStatus(flags(DAY_1), null).short).toBe("Day 1 · --:--:--");
    expect(closesIn(flags(DAY_1), null)).toBeNull();
  });

  it("has no closing time on day 2", () => {
    expect(closesIn(flags(DAY_1), "02:14:09")).toBe("Closes in 02:14:09");
    expect(closesIn(flags(DAY_2), "00:00:00")).toBeNull();
  });

  it("says the last hour in words above the countdown", () => {
    expect(countdownLabel(flags(DAY_1))).toBe("Day 1 ends in");
    expect(countdownLabel(flags(LAST_HOUR))).toMatch(/last hour/i);
  });
});

describe("step labels and stills", () => {
  it("names what each step does", () => {
    expect(stepLabel(series, { type: "episode", episodeId: "xe01" }, v.fresh)).toBe("Play episode 1");
    expect(stepLabel(series, { type: "episode", episodeId: "xa02" }, v.voted)).toBe("Play episode 4A");
    expect(stepLabel(series, { type: "question" }, v.atQuestion)).toBe("Go to the question");
    expect(stepLabel(series, { type: "glimpses" }, v.atQuestion)).toBe("See both glimpses");
    expect(stepLabel(series, { type: "ending", branch: "B" }, v.seenBoth)).toBe("See ending B");
    expect(stepLabel(series, { type: "keep-or-move" }, v.seenBoth)).toBe("Keep or move your ballot");
    expect(stepLabel(series, { type: "result" }, v.atQuestion)).toBe("See what the audience chose");
    expect(stepLabel(series, { type: "series" }, v.fresh)).toBe("Open the series");
  });

  it("says Continue only for an episode that was left half watched", () => {
    const half = T.recordProgress(series, v.fresh, "xe01", { positionMs: 3000, lang: "hi", shotId: "s01" }, NOW);
    expect(stepLabel(series, { type: "episode", episodeId: "xe01" }, half)).toBe("Continue episode 1");
    expect(stepLabel(series, { type: "episode", episodeId: "xe01" }, finish(series, half, ["xe01"]))).toBe("Play episode 1");
  });

  it("covers every step the rules can return for every preset on both days", () => {
    for (const preset of VIEWER_PRESETS) {
      for (const demo of [DAY_1, LAST_HOUR, DAY_2]) {
        const progress = presetProgress(series, preset.id, "B", NOW);
        const next = R.continueStep(series, progress, demo);
        expect(stepLabel(series, next, progress)).toMatch(/\S/);
        expect(stepStill(series, next)).toMatch(/^\/media\//);
      }
    }
  });

  it("never puts a branch's last frame on a stage that only points at a step", () => {
    const cliffhanger = "/media/demo/episodes/xe02/shots/s02.jpg";
    expect(stepStill(series, { type: "question" })).toBe(cliffhanger);
    expect(stepStill(series, { type: "glimpses" })).toBe(cliffhanger);
    expect(stepStill(series, { type: "keep-or-move" })).toBe(cliffhanger);
    expect(stepStill(series, { type: "result" })).toBe(cliffhanger);
    expect(stepStill(series, { type: "ending", branch: "A" })).toBe(series.backdrop);
    expect(stepStill(series, { type: "episode", episodeId: "xa01" })).toBe("/media/demo/episodes/xa01/poster.jpg");
  });

  it("gives the ending screen the last shot of that ending", () => {
    expect(finalFrame(series, "xa03")).toBe("/media/demo/episodes/xa03/shots/s02.jpg");
    expect(finalFrame(series, "nope")).toBe(series.backdrop);
  });
});

describe("the episode rail", () => {
  it("marks the next episode for a new viewer and locks both endings", () => {
    const rail = railView(series, history(v.fresh, DAY_1), false);
    expect(rail.shared.map((p) => p.state)).toEqual(["now", "todo", "choice"]);
    expect(rail.shared[0].href).toBe(routes.watch(series.id, "xe01"));
    expect(rail.shared[2].href).toBeUndefined();
    expect(rail.shared[2].ariaLabel).toBe("The choice, after episode 2");
    for (const pill of [...rail.branches.A, ...rail.branches.B]) {
      expect(pill.state).toBe("locked");
      expect(pill.href).toBeUndefined();
      expect(pill.ariaLabel).toMatch(/locked: watch the shared episodes first/);
    }
  });

  it("links the branch point to the question once it is reached, and says to vote first", () => {
    const rail = railView(series, history(v.atQuestion, DAY_1), true);
    expect(rail.shared.map((p) => p.state)).toEqual(["done", "done", "choice"]);
    expect(rail.shared[2].href).toBe(routes.question(series.id));
    expect(rail.branches.A[0].ariaLabel).toBe("Episode 3A, locked: cast your ballot first");
  });

  it("opens the viewer's ending and keeps the other locked until theirs is finished", () => {
    const rail = railView(series, history(v.voted, DAY_1), true);
    expect(rail.branches.A.map((p) => p.state)).toEqual(["now", "todo", "todo"]);
    expect(rail.branches.A.map((p) => p.label)).toEqual(["3A", "4A", "5A"]);
    expect(rail.branches.B.every((p) => p.state === "locked" && /finish your own ending first/.test(p.ariaLabel ?? ""))).toBe(true);
    const after = railView(series, history(v.finishedOwn, DAY_1), true);
    expect(after.branches.A.map((p) => p.state)).toEqual(["done", "done", "done"]);
    expect(after.branches.B.every((p) => p.state === "todo" && p.href !== undefined)).toBe(true);
  });

  it("shows the losing ending as expired on day 2, except what the viewer finished on day 1", () => {
    const partB = finish(series, v.finishedOwn, ["xb01"]);
    // A wins by the seeds: B lost. The viewer finished only its first episode.
    const rail = railView(series, history(partB, DAY_2), true);
    expect(rail.branches.B.map((p) => p.state)).toEqual(["done", "expired", "expired"]);
    expect(rail.branches.B[1].ariaLabel).toBe("Episode 4B, expired: it was only open on day 1");
    expect(rail.branches.B[1].href).toBeUndefined();
  });
});

describe("progress segments on a stage that is not playing", () => {
  it("has one segment per episode on the viewer's path", () => {
    expect(pathSegments(history(v.fresh, DAY_1))).toEqual(["now", "todo", "todo", "todo", "todo"]);
    expect(pathSegments(history(v.voted, DAY_1))).toEqual(["done", "done", "now", "todo", "todo"]);
    expect(pathSegments(history(v.seenBoth, DAY_1))).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("follows the official ending for a late viewer", () => {
    const late = history(v.atQuestion, B_WINS);
    expect(late.official).toBe("B");
    expect(pathSegments(late)).toEqual(["done", "done", "todo", "todo", "todo"]);
  });
});

describe("endings and history", () => {
  it("says whose ending this is on day 1 and whether it is official on day 2", () => {
    expect(endingRole(R.endingView(series, v.finishedOwn, DAY_1, "A"), "A")).toBe("Your ending");
    expect(endingRole(R.endingView(series, v.seenBoth, DAY_1, "B"), "A")).toBe("The other ending");
    expect(endingRole(R.endingView(series, v.finishedOwn, DAY_2, "A"), "A")).toBe("The official ending");
    expect(endingRole(R.endingView(series, v.finishedOwn, B_WINS, "A"), "A")).toBe("Not official · kept from day 1");
  });

  it("never calls anything official on day 1", () => {
    for (const progress of Object.values(v)) {
      const h = history(progress, DAY_1);
      const labels = [...branchChips(series, h.branches.A), ...branchChips(series, h.branches.B)].map((c) => c.label);
      expect(labels.some((l) => /official/i.test(l))).toBe(false);
    }
  });

  it("gives each ending its chips: whose it is, how far, and whether it is still there", () => {
    const day1 = history(v.finishedOwn, DAY_1);
    expect(branchChips(series, day1.branches.A).map((c) => c.label)).toEqual(["Your ballot", "Watched to the end", "Open"]);
    expect(branchChips(series, day1.branches.B).map((c) => c.label)).toEqual(["Not watched", "Open"]);
    expect(branchChips(series, history(v.voted, DAY_1).branches.B).map((c) => c.label)).toEqual(["Not watched", "Locked"]);

    // Day 2, B forced to win: the viewer's ending A lost, but they finished it on day 1 and keep it.
    const lost = history(v.finishedOwn, B_WINS);
    expect(branchChips(series, lost.branches.A)).toEqual([
      { kind: "plain", label: "Your ballot" },
      { kind: "plain", label: "Watched to the end" },
      { kind: "live", label: "Kept from day 1" },
    ]);
    expect(branchChips(series, lost.branches.B)[0]).toEqual({ kind: "canon", label: "Official ending" });
  });

  it("says what expired and what was kept", () => {
    const partB = finish(series, v.finishedOwn, ["xb01"]);
    const h = history(partB, DAY_2);
    expect(branchChips(series, h.branches.B).at(-1)).toEqual({ kind: "alert", label: "Partly expired · kept 3B" });
    expect(branchNote(h.branches.B)).toBe("Expired: it was only open on day 1.");
    const none = history(v.voted, B_WINS);
    expect(branchChips(series, none.branches.A).at(-1)).toEqual({ kind: "alert", label: "Expired" });
    expect(branchNote(history(v.voted, DAY_1).branches.B)).toBe("Locked: finish your own ending first.");
    expect(branchNote(history(v.finishedOwn, DAY_1).branches.A)).toBeNull();
  });

  it("names the resume point", () => {
    const half = T.recordProgress(series, v.voted, "xa01", { positionMs: 72_000, lang: "hi", shotId: "s02" }, NOW);
    const resume = history(half, DAY_1).resume;
    expect(resume).not.toBeNull();
    expect(resumeLabel(series, resume!)).toBe("Resume episode 3A at 1:12");
  });

  it("has words for every access reason", () => {
    const reasons: R.AccessReason[] = [
      "shared", "your-ending", "other-ending-unlocked", "official-ending", "kept-from-day-one", "glimpse",
      "question-not-reached", "vote-first", "finish-your-ending-first", "unknown", "not-the-official-ending",
    ];
    for (const reason of reasons) expect(accessReasonText(reason)).toMatch(/\S/);
  });
});

describe("the day-2 result", () => {
  it("sends a late viewer straight into the official ending and offers the glimpses", () => {
    const result = R.resultView(series, v.atQuestion, DAY_2);
    expect(resultActionLabel(series, result, v.atQuestion)).toBe("Watch the official ending");
    const caption = resultCaption(series, result);
    expect(caption).toMatch(/Voting closed when day 1 ended/);
    expect(caption).toMatch(/both glimpses/);
    expect(caption).toMatch(/Simulated demo ballots\.$/);
  });

  it("names the episode once the official ending has been started, and the ending once it is finished", () => {
    const begun = finish(series, v.voted, ["xa01"]);
    expect(resultActionLabel(series, R.resultView(series, begun, DAY_2), begun)).toBe("Play episode 4A");
    expect(resultActionLabel(series, R.resultView(series, v.finishedOwn, DAY_2), v.finishedOwn)).toBe("See ending A");
  });

  it("tells a voter whose side lost what they keep and what expired", () => {
    const kept = resultCaption(series, R.resultView(series, v.finishedOwn, B_WINS));
    expect(kept).toMatch(/Your ballot was on A/);
    expect(kept).toMatch(/You keep your own ending/);
    const part = finish(series, v.voted, branchIds(series, "A").slice(0, 1));
    expect(resultCaption(series, R.resultView(series, part, B_WINS))).toMatch(/\(3A\); the rest has expired/);
    expect(resultCaption(series, R.resultView(series, v.voted, B_WINS))).toMatch(/Your own ending has expired/);
  });

  it("tells a voter on the winning side so, and always labels the numbers", () => {
    const caption = resultCaption(series, R.resultView(series, v.seenBoth, DAY_2));
    expect(caption).toMatch(/winning side/);
    expect(caption).toMatch(/\(3B, 4B, 5B\)/);
    for (const progress of Object.values(v)) {
      for (const demo of [DAY_2, B_WINS]) expect(resultCaption(series, R.resultView(series, progress, demo))).toMatch(/Simulated demo ballots\./);
    }
  });
});

describe("presenter drawer: which preset the viewer is in", () => {
  it("recognises every preset it can apply, for either choice", () => {
    for (const preset of VIEWER_PRESETS) {
      for (const choice of ["A", "B"] as const) {
        expect(matchPreset(series, presetProgress(series, preset.id, choice, NOW))).toBe(preset.id);
      }
    }
  });

  it("recognises the same states when the viewer got there by watching", () => {
    expect(matchPreset(series, v.fresh)).toBe("new");
    expect(matchPreset(series, v.atQuestion)).toBe("at-question");
    expect(matchPreset(series, v.voted)).toBe("voted");
    expect(matchPreset(series, v.finishedOwn)).toBe("finished-own");
    expect(matchPreset(series, v.seenBoth)).toBe("seen-both");
  });

  it("is null in between, and after the ballot has moved", () => {
    expect(matchPreset(series, finish(series, v.fresh, ["xe01"]))).toBeNull();
    expect(matchPreset(series, finish(series, v.voted, ["xa01"]))).toBeNull();
    expect(matchPreset(series, finish(series, v.finishedOwn, ["xb01"]))).toBeNull();
    const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(matchPreset(series, moved.progress)).toBeNull();
    const kept = T.keepBallot(series, v.seenBoth, DAY_1);
    expect(kept.ok).toBe(true);
    if (kept.ok) expect(matchPreset(series, kept.progress)).toBeNull();
  });
});

describe("the ballot after it is cast", () => {
  const ballotOf = (progress: SeriesProgress) => {
    if (!progress.ballot) throw new Error("no ballot");
    return progress.ballot;
  };
  const moved = T.moveBallot(series, v.seenBoth, DAY_1, NOW);
  const kept = T.keepBallot(series, v.seenBoth, DAY_1);
  if (!moved.ok || !kept.ok) throw new Error("fixture: move and keep must be allowed");

  it("reads the keep-or-move decision from the stored ballot", () => {
    expect(ballotDecision(null)).toBeNull();
    expect(ballotDecision(ballotOf(v.seenBoth))).toBeNull();
    expect(ballotDecision(ballotOf(moved.progress))).toBe("moved");
    expect(ballotDecision(ballotOf(kept.progress))).toBe("kept");
  });

  it("offers a move only on day 1, and only while undecided", () => {
    for (const demo of [DAY_1, LAST_HOUR]) {
      expect(ballotFootnote(flags(demo), ballotOf(v.voted))).toMatch(/can move it once/);
      expect(ballotFootnote(flags(demo), ballotOf(moved.progress))).toMatch(/cannot move again/);
      expect(ballotFootnote(flags(demo), ballotOf(kept.progress))).toMatch(/keep your ballot here/);
    }
    for (const progress of [v.voted, moved.progress, kept.progress]) {
      const text = ballotFootnote(flags(DAY_2), ballotOf(progress));
      expect(text).toMatch(/closed/);
      expect(text).not.toMatch(/can move/);
    }
  });

  it("names the official ending once day 2 has begun", () => {
    expect(decisionCaption(flags(DAY_1), null)).toMatch(/when day 1 ends/);
    expect(decisionCaption(flags(LAST_HOUR), null)).toMatch(/when day 1 ends/);
    expect(decisionCaption(flags(DAY_2), "B")).toBe("Voting has closed. Ending B is the official one.");
    expect(decisionCaption(flags(DAY_2), "B")).not.toMatch(/day 1 ends/);
  });
});

describe("small formatters and the share card", () => {
  it("formats a length as minutes and seconds", () => {
    expect(formatClock(20_000)).toBe("0:20");
    expect(formatClock(125_400)).toBe("2:05");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("writes the series card's one line", () => {
    expect(seriesMeta(series)).toBe("Photoreal · 5 episodes");
  });

  it("puts the series and the cliffhanger episode on the share card, in the audio language", () => {
    expect(shareSeriesLine(series, "en")).toBe("Sample Series · Ep 2");
    expect(shareSeriesLine(series, "hi")).toBe("नमूना Series · Ep 2");
    expect(shareFileName("series1", "B")).toBe("unwritten-series1-b.png");
  });

  it("never puts the result on the share card", () => {
    for (const demo of [DAY_1, LAST_HOUR, DAY_2]) {
      const cta = shareCta(flags(demo));
      expect(cta).not.toMatch(/won|official|audience chose|\bA\b|\bB\b/i);
    }
    expect(shareCta(flags(DAY_1))).toMatch(/today only/);
    expect(shareCta(flags(DAY_2))).not.toMatch(/today/);
  });
});
