import { describe, expect, it } from "vitest";
import { findPlayable } from "@/content/helpers";
import { playableAccess } from "@/state/rules";
import { DAY_1, DAY_2, makeSeries, viewers } from "@/test/fixtures";
import { afterLine, gateCopy, playableName, playableShortName, stepButtonLabel } from "./labels";

const series = makeSeries();
const playable = (id: string) => {
  const found = findPlayable(series, id);
  if (!found) throw new Error(`no playable ${id}`);
  return found;
};

describe("names", () => {
  it("names episodes by their place on the path and glimpses by their choice", () => {
    expect(playableShortName(playable("xe02"))).toBe("Ep 2");
    expect(playableShortName(playable("xa01"))).toBe("Ep 3A");
    expect(playableShortName(playable("xgb"))).toBe("Glimpse B");
    expect(playableName(playable("xb02"))).toBe("Episode 4B");
    expect(playableName(playable("xga"))).toBe("Glimpse of choice A");
  });
});

describe("stepButtonLabel and afterLine", () => {
  it("names the result for every kind of step", () => {
    expect(stepButtonLabel(series, { type: "episode", episodeId: "xe02" })).toBe("Play episode 2");
    expect(stepButtonLabel(series, { type: "episode", episodeId: "xb01" })).toBe("Play episode 3B");
    expect(stepButtonLabel(series, { type: "question" })).toBe("Go to the question");
    expect(stepButtonLabel(series, { type: "glimpses" })).toBe("See both glimpses");
    expect(stepButtonLabel(series, { type: "ending", branch: "A" })).toBe("See how it ended");
    expect(stepButtonLabel(series, { type: "keep-or-move" })).toBe("Keep or move your ballot");
    expect(stepButtonLabel(series, { type: "result" })).toBe("See what the audience chose");
    expect(stepButtonLabel(series, { type: "series" })).toBe("Back to the series");
    expect(afterLine(series, { type: "episode", episodeId: "xa02" })).toBe("Episode 4A plays next.");
    expect(afterLine(series, { type: "question" })).toMatch(/question/);
  });

  it("never says Next, OK or Submit, and never names an ending as the winner", () => {
    const steps = [
      { type: "episode", episodeId: "xe01" },
      { type: "episode", episodeId: "nope" },
      { type: "question" },
      { type: "glimpses" },
      { type: "ending", branch: "B" },
      { type: "keep-or-move" },
      { type: "result" },
      { type: "series" },
    ] as const;
    for (const step of steps) {
      for (const text of [stepButtonLabel(series, step), afterLine(series, step)]) {
        expect(text).not.toMatch(/^(next|ok|submit)$/i);
        expect(text).not.toMatch(/\b(won|wins|winner|official)\b/i);
      }
    }
  });
});

describe("gateCopy", () => {
  const v = viewers(series, "B");

  it("says why a branch episode is locked before the question", () => {
    const access = playableAccess(series, v.fresh, DAY_1, "xa01");
    expect(access.state).toBe("locked");
    expect(gateCopy(access, playable("xa01")).title).toBe("This episode is not open yet");
  });

  it("asks for the ballot once the question is reached", () => {
    const access = playableAccess(series, v.atQuestion, DAY_1, "xa01");
    expect(access).toMatchObject({ state: "locked", reason: "vote-first" });
    expect(gateCopy(access, playable("xa01")).text).toMatch(/ballot/);
  });

  it("holds the other ending back until the viewer's own is finished, and says it is day 1 only", () => {
    const access = playableAccess(series, v.voted, DAY_1, "xa01");
    expect(access).toMatchObject({ state: "locked", reason: "finish-your-ending-first" });
    expect(gateCopy(access, playable("xa01")).text).toMatch(/day 1 only/);
  });

  it("is exact about an expired ending on day 2", () => {
    // Seeds make A official; this viewer chose B and never finished it.
    const access = playableAccess(series, v.voted, DAY_2, "xb01");
    expect(access).toMatchObject({ state: "expired", reason: "not-the-official-ending" });
    expect(gateCopy(access, playable("xb01"))).toEqual({
      title: "This ending has expired",
      text: "It was open on day 1 only. The official ending is still here.",
    });
  });

  it("words a locked glimpse as a glimpse", () => {
    const access = playableAccess(series, v.fresh, DAY_1, "xga");
    expect(access.state).toBe("locked");
    expect(gateCopy(access, playable("xga")).title).toBe("This glimpse is not open yet");
  });
});
