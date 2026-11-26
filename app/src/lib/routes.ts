/**
 * Every URL in the app, in one place. Build links with these functions, never
 * with string literals, so a route can move without a hunt through the code.
 * The table of screens, routes and owners is in docs/contracts.md.
 */
import type { Choice } from "@/content/schema";
import type { Step } from "@/state/rules";

export const routes = {
  /** One-time language choice and the day-one rule. */
  welcome: () => "/welcome",
  /** Tonight's series on the stage, the dock, the "coming next" shelf. */
  home: () => "/",
  /** Synopsis, cast with voice samples, episode rail. */
  series: (seriesId: string) => `/series/${seriesId}`,
  /** The player. `playableId` is an episode id or a glimpse id. */
  watch: (seriesId: string, playableId: string) => `/watch/${seriesId}/${playableId}`,
  /** The cliffhanger frame and the question. */
  question: (seriesId: string) => `/series/${seriesId}/question`,
  /** The two glimpses side by side. */
  glimpses: (seriesId: string) => `/series/${seriesId}/glimpses`,
  /** The ballot, and the split once it is cast. */
  ballot: (seriesId: string) => `/series/${seriesId}/ballot`,
  /** Final frame and split after the last episode of branch A or B. */
  ending: (seriesId: string, branch: Choice) => `/series/${seriesId}/ending/${branch}`,
  /** Both endings seen: keep or move the ballot. */
  keepOrMove: (seriesId: string) => `/series/${seriesId}/keep-or-move`,
  /** Day 2: "The audience chose ...". */
  result: (seriesId: string) => `/series/${seriesId}/result`,
  /** The 9:16 share card. */
  share: (seriesId: string) => `/series/${seriesId}/share`,
  /** History: what you chose, what won, what expired, resume points. */
  myChoices: () => "/my-choices",
  /** How an episode is made. */
  studio: () => "/studio",
} as const;

/** Turn a Step from the rules into the URL that shows it. */
export function stepHref(seriesId: string, step: Step): string {
  switch (step.type) {
    case "episode":
      return routes.watch(seriesId, step.episodeId);
    case "question":
      return routes.question(seriesId);
    case "glimpses":
      return routes.glimpses(seriesId);
    case "ending":
      return routes.ending(seriesId, step.branch);
    case "keep-or-move":
      return routes.keepOrMove(seriesId);
    case "result":
      return routes.result(seriesId);
    case "series":
      return routes.series(seriesId);
  }
}

/** Query flag that opens the presenter drawer on load (for tests and deep links): /?demo=1 */
export const DEMO_QUERY_FLAG = "demo";
