import { describe, expect, it } from "vitest";
import { DAY_1, NOW, branchIds, makeSeries, sharedIds } from "@/test/fixtures";
import { SCREEN_JUMPS, VIEWER_PRESETS, getScreenJump, presetProgress } from "./presets";
import * as R from "./rules";
import { emptyProgress } from "./types";
import type { DemoState } from "./types";

const series = makeSeries();
const demoFor = (day: DemoState["day"] | null): DemoState => ({ ...DAY_1, day: day ?? 1 });

describe("viewer presets", () => {
  it("new viewer: nothing watched", () => {
    expect(presetProgress(series, "new", "A", NOW)).toEqual(emptyProgress());
  });

  it("at the question: shared episodes finished, no ballot, ballot open", () => {
    const p = presetProgress(series, "at-question", "A", NOW);
    expect(Object.keys(p.episodes)).toEqual(sharedIds(series));
    expect(p.ballot).toBeNull();
    expect(R.canCastBallot(series, p, DAY_1)).toEqual({ allowed: true });
    expect(R.continueStep(series, p, DAY_1)).toEqual({ type: "question" });
  });

  it("voted: ballot on the chosen side, branch not started", () => {
    const p = presetProgress(series, "voted", "B", NOW);
    expect(p.ballot).toEqual({ choice: "B", castAt: NOW, moved: false, movedAt: null, kept: false });
    expect(R.continueStep(series, p, DAY_1)).toEqual({ type: "episode", episodeId: "xb01" });
  });

  it("finished own ending: the other ending is on offer", () => {
    const p = presetProgress(series, "finished-own", "B", NOW);
    expect(R.endingsFinished(series, p)).toEqual({ A: false, B: true });
    expect(R.canWatchOtherEnding(series, p, DAY_1)).toEqual({ allowed: true });
    expect(R.canMoveBallot(series, p, DAY_1).allowed).toBe(false);
  });

  it("seen both: the ballot can still be moved", () => {
    const p = presetProgress(series, "seen-both", "A", NOW);
    expect(R.endingsFinished(series, p)).toEqual({ A: true, B: true });
    expect(Object.keys(p.episodes).sort()).toEqual([...sharedIds(series), ...branchIds(series, "A"), ...branchIds(series, "B")].sort());
    expect(R.canMoveBallot(series, p, DAY_1)).toEqual({ allowed: true });
  });

  it("every preset is listed for the drawer", () => {
    expect(VIEWER_PRESETS.map((p) => p.id)).toEqual(["new", "at-question", "voted", "finished-own", "seen-both"]);
  });
});

describe("screen jumps: every screen in plan section 4, with the state it needs", () => {
  it("covers all thirteen screens (the fourteenth, the drawer, is where the jumps live)", () => {
    expect(SCREEN_JUMPS.map((j) => j.id)).toEqual([
      "welcome", "home", "series", "player", "question", "glimpses", "ballot", "ending", "keep-or-move", "result", "my-choices", "share", "studio",
    ]);
  });

  it("points at the right URLs", () => {
    const href = (id: Parameters<typeof getScreenJump>[0]) => getScreenJump(id).href(series, "B");
    expect(href("welcome")).toBe("/welcome");
    expect(href("home")).toBe("/");
    expect(href("series")).toBe("/series/demo");
    expect(href("player")).toBe("/watch/demo/xe01");
    expect(href("question")).toBe("/series/demo/question");
    expect(href("glimpses")).toBe("/series/demo/glimpses");
    expect(href("ballot")).toBe("/series/demo/ballot");
    expect(href("ending")).toBe("/series/demo/ending/B");
    expect(href("keep-or-move")).toBe("/series/demo/keep-or-move");
    expect(href("result")).toBe("/series/demo/result");
    expect(href("my-choices")).toBe("/my-choices");
    expect(href("share")).toBe("/series/demo/share");
    expect(href("studio")).toBe("/studio");
  });

  const stateFor = (id: Parameters<typeof getScreenJump>[0], choice: "A" | "B" = "A") => {
    const jump = getScreenJump(id);
    return { progress: presetProgress(series, jump.preset ?? "new", choice, NOW), demo: demoFor(jump.day) };
  };

  it("question, glimpses and ballot land on an open ballot", () => {
    for (const id of ["question", "glimpses", "ballot"] as const) {
      const { progress, demo } = stateFor(id);
      expect(R.questionView(series, progress, demo)).toMatchObject({ reached: true, mode: "vote", ballotOpen: true, glimpsesAvailable: true });
    }
  });

  it("ending lands on a finished ending with the other one on offer", () => {
    const { progress, demo } = stateFor("ending", "B");
    expect(R.endingView(series, progress, demo, "B")).toMatchObject({ finished: true, offerOtherEnding: true, otherBranch: "A" });
  });

  it("keep or move lands with a ballot that can move", () => {
    const { progress, demo } = stateFor("keep-or-move");
    expect(R.canMoveBallot(series, progress, demo)).toEqual({ allowed: true });
  });

  it("the day-2 result lands as a late viewer on day 2", () => {
    const { progress, demo } = stateFor("result");
    expect(demo.day).toBe(2);
    expect(R.questionView(series, progress, demo)).toMatchObject({ mode: "result", isLateViewer: true, ballotOpen: false });
    expect(R.resultView(series, progress, demo).enter).toEqual({ type: "episode", episodeId: "xa01" });
  });

  it("the share card lands with a ballot to show", () => {
    const { progress } = stateFor("share", "B");
    expect(progress.ballot?.choice).toBe("B");
  });

  it("only the welcome jump shows the welcome again", () => {
    expect(SCREEN_JUMPS.filter((j) => j.resetWelcome).map((j) => j.id)).toEqual(["welcome"]);
  });

  it("refuses an unknown screen", () => {
    expect(() => getScreenJump("nope" as never)).toThrow();
  });
});
