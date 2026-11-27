/**
 * Subtitle timing for the player. OWNER: player. Pure: no React, no DOM.
 *
 * The player samples the video clock many times a second and asks one
 * question: what is on the subtitle plate right now? The answer is a
 * `SubtitleFrame`: which cue, which word is being spoken, and whether the
 * speaker tag is shown. Times are milliseconds of the video file of the audio
 * language, the same clock the cue timings use (docs/contracts.md, section 5).
 *
 * Rules (design system, Subtitles):
 * - A cue is on screen from its startMs up to, not including, its endMs.
 * - The highlight is on whole words. Between two words it stays on the word
 *   just spoken; before the first word of a cue nothing is highlighted.
 * - Marked phone and off-screen cues show the label when the track supplies one.
 *   Otherwise the speaker tag is shown when the speaker changes: on the first cue of
 *   the track and on every cue whose speaker differs from the cue before it.
 *   A long line split into several cues shows the tag once.
 * - A cue's text may hold the subtitler's line break ("\n") between two
 *   words. The plate keeps it: the highlighted words are drawn on the same
 *   two lines as the text, not re-wrapped as one run.
 */
import type { SubtitleCue, SubtitleTrack } from "@/content/schema";

export interface SubtitleFrame {
  /** Position of the cue in `track.cues`. */
  cueIndex: number;
  cue: SubtitleCue;
  /** Index into `cue.words` of the word being spoken, or -1 before the first word. */
  activeWord: number;
  /** Show the speaker tag above this line. */
  showSpeaker: boolean;
}

/** Index of the cue on screen at `positionMs`, or -1 between lines and outside the track. */
export function cueIndexAt(track: SubtitleTrack, positionMs: number): number {
  const cues = track.cues;
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (positionMs < cue.startMs) return -1;
    if (positionMs < cue.endMs) return i;
  }
  return -1;
}

/**
 * Index of the word being spoken at `positionMs`. Between two words it stays
 * on the word just spoken; before the first word it is -1. A cue with no word
 * timings never highlights anything.
 */
export function activeWordAt(cue: SubtitleCue, positionMs: number): number {
  let index = -1;
  for (let i = 0; i < cue.words.length; i++) {
    if (cue.words[i].startMs <= positionMs) index = i;
    else break;
  }
  return index;
}

/** Whether this cue needs a label, as marked for off-screen voices or inferred for other lines. */
export function speakerChangesAt(track: SubtitleTrack, cueIndex: number): boolean {
  const cue = track.cues[cueIndex];
  if (!cue) return false;
  if (cue.heard_as) return cue.speaker_label !== undefined;
  const previous = track.cues[cueIndex - 1];
  return !previous || previous.speaker !== cue.speaker;
}

/** Everything the subtitle plate shows at `positionMs`, or null when no line is on screen. */
export function subtitleFrame(track: SubtitleTrack | null | undefined, positionMs: number): SubtitleFrame | null {
  if (!track) return null;
  const cueIndex = cueIndexAt(track, positionMs);
  if (cueIndex < 0) return null;
  const cue = track.cues[cueIndex];
  return {
    cueIndex,
    cue,
    activeWord: activeWordAt(cue, positionMs),
    showSpeaker: speakerChangesAt(track, cueIndex),
  };
}

/**
 * A short string that changes exactly when the plate has to be redrawn: a new
 * cue, a new highlighted word, or nothing. The player subscribes to this and
 * not to the clock, so the plate re-renders a few times a second, not sixty.
 */
export function subtitleFrameKey(track: SubtitleTrack | null | undefined, positionMs: number): string {
  const frame = subtitleFrame(track, positionMs);
  return frame ? `${frame.cueIndex}:${frame.activeWord}` : "";
}

/** The frame a key from `subtitleFrameKey` stands for. */
export function subtitleFrameFromKey(track: SubtitleTrack | null | undefined, key: string): SubtitleFrame | null {
  if (!track || key === "") return null;
  const [cuePart, wordPart] = key.split(":");
  const cueIndex = Number(cuePart);
  const cue = track.cues[cueIndex];
  if (!cue) return null;
  return { cueIndex, cue, activeWord: Number(wordPart), showSpeaker: speakerChangesAt(track, cueIndex) };
}

/** A word of a cue as the plate draws it: `breakBefore` when the text starts a new line at this word. */
export interface PlateWord {
  text: string;
  breakBefore: boolean;
}

/**
 * The words of a cue with the line breaks of its text. The words spell the
 * text (contracts, section 5), so each one is found in it in order; a word
 * whose gap from the word before holds a "\n" starts a new line. A word that
 * cannot be found (a cue that breaks the contract) gets no break and does not
 * move the search, so the rest still line up.
 */
export function plateWords(cue: SubtitleCue): PlateWord[] {
  let cursor = 0;
  return cue.words.map((word, i) => {
    const at = cue.text.indexOf(word.text, cursor);
    if (at < 0) return { text: word.text, breakBefore: false };
    const breakBefore = i > 0 && cue.text.slice(cursor, at).includes("\n");
    cursor = at + word.text.length;
    return { text: word.text, breakBefore };
  });
}
