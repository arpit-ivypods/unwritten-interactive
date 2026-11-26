import { describe, expect, it } from "vitest";
import { routes } from "@/lib/routes";
import { SCREEN_JUMPS } from "@/state/presets";
import { makeSeries } from "@/test/fixtures";
import { chromeFor } from "./sections";

const id = "series1";

describe("what surrounds each screen", () => {
  it("gives the browse screens the nav and the dock", () => {
    expect(chromeFor(routes.home())).toEqual({ chrome: "full", current: "tonight", gated: true, seriesId: null });
    expect(chromeFor(routes.series(id))).toEqual({ chrome: "full", current: "series", gated: true, seriesId: id });
    expect(chromeFor(routes.myChoices())).toEqual({ chrome: "full", current: "my-choices", gated: true, seriesId: null });
  });

  it("drops the dock on every screen that has a bottom sheet", () => {
    const sheets = [routes.question(id), routes.glimpses(id), routes.ballot(id), routes.ending(id, "A"), routes.ending(id, "B"), routes.keepOrMove(id), routes.result(id), routes.share(id)];
    for (const url of sheets) {
      expect(chromeFor(url), url).toEqual({ chrome: "nav", current: "series", gated: true, seriesId: id });
    }
  });

  it("leaves the welcome, the player and /ds bare", () => {
    expect(chromeFor(routes.welcome()).chrome).toBe("none");
    expect(chromeFor(routes.watch(id, "s1e01"))).toEqual({ chrome: "none", current: "series", gated: true, seriesId: id });
    expect(chromeFor("/ds").chrome).toBe("none");
  });

  it("does not put the studio, the welcome or /ds behind the welcome gate", () => {
    expect(chromeFor(routes.studio())).toEqual({ chrome: "full", current: "studio", gated: false, seriesId: null });
    expect(chromeFor(`${routes.studio()}/series1`).gated).toBe(false);
    expect(chromeFor(`${routes.studio()}/series1`).current).toBe("studio");
    expect(chromeFor(routes.welcome()).gated).toBe(false);
    expect(chromeFor("/ds").gated).toBe(false);
  });

  it("gates every viewer screen the presenter can jump to", () => {
    const series = makeSeries({ id });
    for (const jump of SCREEN_JUMPS) {
      const url = jump.href(series, "A");
      const expected = jump.id !== "welcome" && jump.id !== "studio";
      expect(chromeFor(url).gated, jump.id).toBe(expected);
    }
  });

  it("does not mistake a longer path for a known one", () => {
    expect(chromeFor("/welcome-back").chrome).toBe("full");
    expect(chromeFor("/studious").gated).toBe(true);
    expect(chromeFor("/dsx").chrome).toBe("full");
  });
});
