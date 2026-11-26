/**
 * The words the player uses. OWNER: player. Pure.
 *
 * The player never decides where the story goes: it is handed a `Step` or an
 * `Access` by the rules and only puts words to it. Interface text is English
 * (design system, Voice and content); story text stays in the audio language
 * and is rendered by the caller with lang="hi" where needed.
 */
import { episodeLabel, getEpisode } from "@/content/helpers";
import type { Playable } from "@/content/helpers";
import type { Series } from "@/content/schema";
import type { Access, Step } from "@/state/rules";

/** A button that goes to this step: names the result, never "Next" or "OK". */
export function stepButtonLabel(series: Series, step: Step): string {
  switch (step.type) {
    case "episode": {
      const episode = getEpisode(series, step.episodeId);
      return episode ? `Play episode ${episodeLabel(episode)}` : "Play the next episode";
    }
    case "question":
      return "Go to the question";
    case "glimpses":
      return "See both glimpses";
    case "ending":
      return "See how it ended";
    case "keep-or-move":
      return "Keep or move your ballot";
    case "result":
      return "See what the audience chose";
    case "series":
      return "Back to the series";
  }
}

/** One line that says what happens when this episode or glimpse ends. */
export function afterLine(series: Series, step: Step): string {
  switch (step.type) {
    case "episode": {
      const episode = getEpisode(series, step.episodeId);
      return episode ? `Episode ${episodeLabel(episode)} plays next.` : "The next episode plays next.";
    }
    case "question":
      return "Then the question. Your call.";
    case "glimpses":
      return "Then back to the two glimpses.";
    case "ending":
      return "Then the ending and how the audience voted.";
    case "keep-or-move":
      return "Then you can keep or move your ballot.";
    case "result":
      return "Then what the audience chose.";
    case "series":
      return "Then back to the series.";
  }
}

/** Short name for the stage's meta row: "Ep 3A", "Glimpse A". */
export function playableShortName(playable: Playable): string {
  return playable.type === "episode" ? `Ep ${episodeLabel(playable.episode)}` : `Glimpse ${playable.choice}`;
}

/** Longer name for headings and status lines: "Episode 3A", "Glimpse of choice A". */
export function playableName(playable: Playable): string {
  return playable.type === "episode" ? `Episode ${episodeLabel(playable.episode)}` : `Glimpse of choice ${playable.choice}`;
}

export interface GateCopy {
  title: string;
  text: string;
}

/** Why something cannot be played, in the product's own terms. Only for `locked` and `expired`. */
export function gateCopy(access: Access, playable: Playable): GateCopy {
  const what = playable.type === "episode" ? "episode" : "glimpse";
  switch (access.reason) {
    case "question-not-reached":
      return {
        title: `This ${what} is not open yet`,
        text: "It opens after the last shared episode, when the story reaches the question.",
      };
    case "vote-first":
      return {
        title: "This ending opens with your ballot",
        text: "Cast your ballot first. Your choice decides which ending you watch.",
      };
    case "finish-your-ending-first":
      return {
        title: "Finish your own ending first",
        text: "The other ending opens after yours, on day 1 only.",
      };
    case "not-the-official-ending":
      return {
        title: "This ending has expired",
        text: "It was open on day 1 only. The official ending is still here.",
      };
    default:
      return { title: `This ${what} cannot be played`, text: "Go back to the series to carry on." };
  }
}
