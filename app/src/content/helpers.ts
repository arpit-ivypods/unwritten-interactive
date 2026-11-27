/**
 * Pure helpers for reading a Series manifest. No React, no stores, no I/O.
 * Everything that needs "which episode comes next" or "which shot is this"
 * goes through here so the answer is the same on every screen.
 */
import type {
  Choice,
  Episode,
  EpisodeKind,
  Glimpse,
  Lang,
  Localized,
  PlayableMedia,
  Series,
  SubtitleCue,
  SubtitleTrack,
} from "./schema";

/** A shot flattened for one language: the shape the player works with. */
export interface FlatShot {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  still: string;
}

export type Playable =
  | { type: "episode"; id: string; episode: Episode; media: PlayableMedia }
  | { type: "glimpse"; id: string; choice: Choice; glimpse: Glimpse; media: PlayableMedia };

export const BRANCH_KIND: Record<Choice, EpisodeKind> = { A: "branchA", B: "branchB" };

export function otherChoice(choice: Choice): Choice {
  return choice === "A" ? "B" : "A";
}

export function localize<T>(value: Localized<T>, lang: Lang): T {
  return value[lang];
}

/** Which branch an episode belongs to, or null for a shared episode. */
export function branchOf(episode: Episode): Choice | null {
  if (episode.kind === "branchA") return "A";
  if (episode.kind === "branchB") return "B";
  return null;
}

export function sharedEpisodes(series: Series): Episode[] {
  return series.episodes.filter((e) => e.kind === "shared").sort((a, b) => a.number - b.number);
}

export function branchEpisodes(series: Series, choice: Choice): Episode[] {
  return series.episodes.filter((e) => e.kind === BRANCH_KIND[choice]).sort((a, b) => a.number - b.number);
}

/** Shared episodes followed by one branch: the full path a viewer watches. */
export function pathEpisodes(series: Series, choice: Choice): Episode[] {
  return [...sharedEpisodes(series), ...branchEpisodes(series, choice)];
}

export function firstEpisode(series: Series): Episode {
  return sharedEpisodes(series)[0];
}

/** The episode that ends on the cliffhanger and the question. */
export function lastSharedEpisode(series: Series): Episode {
  const shared = sharedEpisodes(series);
  return shared[shared.length - 1];
}

/** The last episode of a branch: finishing it finishes that ending. */
export function endingEpisode(series: Series, choice: Choice): Episode {
  const branch = branchEpisodes(series, choice);
  return branch[branch.length - 1];
}

export function getEpisode(series: Series, episodeId: string): Episode | undefined {
  return series.episodes.find((e) => e.id === episodeId);
}

/** Which glimpse an id names, or null. */
export function glimpseChoice(series: Series, playableId: string): Choice | null {
  if (series.glimpses.A.id === playableId) return "A";
  if (series.glimpses.B.id === playableId) return "B";
  return null;
}

/** Look up anything the player can play (an episode or a glimpse) by id. */
export function findPlayable(series: Series, playableId: string): Playable | undefined {
  const episode = getEpisode(series, playableId);
  if (episode) return { type: "episode", id: episode.id, episode, media: episode };
  const choice = glimpseChoice(series, playableId);
  if (choice) {
    const glimpse = series.glimpses[choice];
    return { type: "glimpse", id: glimpse.id, choice, glimpse, media: glimpse };
  }
  return undefined;
}

/** Every id the player route accepts for a series: episodes, then the two glimpses. */
export function playableIds(series: Series): string[] {
  return [...series.episodes.map((e) => e.id), series.glimpses.A.id, series.glimpses.B.id];
}

/** The episode after this one on the same path (shared -> shared, branch -> same branch), or null. */
export function nextEpisodeOnPath(series: Series, episodeId: string): Episode | null {
  const episode = getEpisode(series, episodeId);
  if (!episode) return null;
  const run = series.episodes.filter((e) => e.kind === episode.kind).sort((a, b) => a.number - b.number);
  const index = run.findIndex((e) => e.id === episode.id);
  return run[index + 1] ?? null;
}

/** The episode before this one on a viewer's path. For the first branch episode that is the last shared one. */
export function previousEpisodeOnPath(series: Series, episodeId: string): Episode | null {
  const episode = getEpisode(series, episodeId);
  if (!episode) return null;
  const branch = branchOf(episode);
  const path = branch ? pathEpisodes(series, branch) : sharedEpisodes(series);
  const index = path.findIndex((e) => e.id === episode.id);
  return index > 0 ? path[index - 1] : null;
}

/** Rail label: "1", "2", then "3A", "4A" after the branch point. */
export function episodeLabel(episode: Episode): string {
  const branch = branchOf(episode);
  return branch ? `${episode.number}${branch}` : String(episode.number);
}

/** How many episodes a viewer watches on one path. */
export function pathLength(series: Series, choice: Choice = "A"): number {
  return pathEpisodes(series, choice).length;
}

/** The cliffhanger frame: the question card and the share card sit over this, never over a branch frame. */
export function cliffhangerStill(series: Series): string {
  const shots = lastSharedEpisode(series).shots;
  return shots[shots.length - 1].still;
}

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

/** The shots of an episode or glimpse with one language's timings. */
export function shotsFor(media: PlayableMedia, lang: Lang): FlatShot[] {
  return media.shots.map((shot, index) => ({
    id: shot.id,
    index,
    startMs: shot.timing[lang].startMs,
    endMs: shot.timing[lang].endMs,
    still: shot.still,
  }));
}

/**
 * Index of the shot on screen at `positionMs`. Before the first shot it is 0,
 * in a gap it is the shot before the gap, after the last shot it is the last.
 */
export function shotIndexAt(media: PlayableMedia, lang: Lang, positionMs: number): number {
  let index = 0;
  for (let i = 0; i < media.shots.length; i++) {
    if (media.shots[i].timing[lang].startMs <= positionMs) index = i;
    else break;
  }
  return index;
}

export function shotAt(media: PlayableMedia, lang: Lang, positionMs: number): FlatShot {
  return shotsFor(media, lang)[shotIndexAt(media, lang, positionMs)];
}

/** Start of a shot in one language, or null if the id is unknown. */
export function shotStartMs(media: PlayableMedia, lang: Lang, shotId: string): number | null {
  const shot = media.shots.find((s) => s.id === shotId);
  return shot ? shot.timing[lang].startMs : null;
}

/**
 * Where to continue after the audio language changes. The two dubs differ in
 * length, so the viewer stays at the same SHOT, not the same second: this
 * returns the start of the current shot in the new language.
 */
export function positionAfterLanguageSwitch(media: PlayableMedia, from: Lang, to: Lang, positionMs: number): number {
  if (from === to) return positionMs;
  const index = shotIndexAt(media, from, positionMs);
  return media.shots[index].timing[to].startMs;
}

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

/** The cue on screen at `positionMs`, or null between lines. */
export function cueAt(track: SubtitleTrack, positionMs: number): SubtitleCue | null {
  for (const cue of track.cues) {
    if (positionMs >= cue.startMs && positionMs < cue.endMs) return cue;
    if (cue.startMs > positionMs) break;
  }
  return null;
}

/**
 * Index of the word being spoken at `positionMs`, for the highlight. Between
 * two words it stays on the word just spoken. -1 before the first word.
 */
export function wordIndexAt(cue: SubtitleCue, positionMs: number): number {
  let index = -1;
  for (let i = 0; i < cue.words.length; i++) {
    if (cue.words[i].startMs <= positionMs) index = i;
    else break;
  }
  return index;
}

const SUPPORTING_SPEAKERS: Record<string, Record<string, Localized>> = {
  series1: { chhoti: { hi: "छोटी", en: "Chhoti" } },
  series2: { door1_man: { hi: "रामसेवक", en: "Ramsevak" } },
};

/** The speaker's display name in the audio language, or the supplied fallback. */
export function speakerName(series: Series, speakerId: string, lang: Lang, fallback = speakerId): string {
  return series.cast.find((member) => member.id === speakerId)?.name[lang]
    ?? SUPPORTING_SPEAKERS[series.id]?.[speakerId]?.[lang]
    ?? fallback;
}

// ---------------------------------------------------------------------------
// Placeholders (plan 7.8)
// ---------------------------------------------------------------------------

export interface PlaceholderItem {
  seriesId: string;
  /** "series" for series-level text and art, otherwise an episode, glimpse or cast id. */
  id: string;
  kind: "series" | "episode" | "glimpse" | "cast";
  note?: string;
}

/** Everything in a series that is still a stand-in, for the presenter drawer and the morning report. */
export function listPlaceholders(series: Series): PlaceholderItem[] {
  const items: PlaceholderItem[] = [];
  if (series.placeholder) items.push({ seriesId: series.id, id: "series", kind: "series" });
  for (const member of series.cast) {
    if (member.placeholder) items.push({ seriesId: series.id, id: member.id, kind: "cast" });
  }
  for (const episode of series.episodes) {
    if (episode.placeholder) {
      items.push({ seriesId: series.id, id: episode.id, kind: "episode", note: episode.placeholderNote });
    }
  }
  for (const choice of ["A", "B"] as const) {
    const glimpse = series.glimpses[choice];
    if (glimpse.placeholder) {
      items.push({ seriesId: series.id, id: glimpse.id, kind: "glimpse", note: glimpse.placeholderNote });
    }
  }
  return items;
}
