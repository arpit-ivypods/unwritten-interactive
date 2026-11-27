import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cueAt, wordIndexAt } from "@/content/helpers";
import { parseSubtitleTrack } from "@/content/schema";
import type { SubtitleCue, SubtitleTrack } from "@/content/schema";
import {
  activeWordAt,
  cueIndexAt,
  plateWords,
  speakerChangesAt,
  subtitleFrame,
  subtitleFrameFromKey,
  subtitleFrameKey,
} from "./subtitleTiming";

function cue(id: string, speaker: string, startMs: number, words: Array<[string, number, number]>, endMs?: number): SubtitleCue {
  return {
    id,
    line_id: `l-${id}`,
    speaker,
    startMs,
    endMs: endMs ?? words[words.length - 1][2],
    text: words.map((w) => w[0]).join(" "),
    words: words.map(([text, s, e]) => ({ text, startMs: s, endMs: e })),
  };
}

/**
 * c1 kiran   1000-3000  "रुको! यह file किसने खोली?"   (a pause between "यह" and "file")
 * c2 kiran   3000-4000  "अभी बताओ।"                    (starts the instant c1 ends, same speaker)
 * c3 aditya  5000-6500  "मैंने नहीं।"
 * c4 kiran   8000-9000  "झूठ।"                          (the cue runs 200 ms past its last word)
 */
const track: SubtitleTrack = {
  lang: "hi",
  cues: [
    cue("c1", "kiran", 1000, [
      ["रुको!", 1000, 1400],
      ["यह", 1400, 1600],
      ["file", 1900, 2300],
      ["किसने", 2300, 2700],
      ["खोली?", 2700, 3000],
    ]),
    cue("c2", "kiran", 3000, [
      ["अभी", 3000, 3400],
      ["बताओ।", 3400, 4000],
    ]),
    cue("c3", "aditya", 5000, [
      ["मैंने", 5200, 5800],
      ["नहीं।", 5800, 6500],
    ]),
    cue("c4", "kiran", 8000, [["झूठ।", 8000, 8800]], 9000),
  ],
};

describe("cueIndexAt", () => {
  it("is -1 before the first line, between lines and after the last", () => {
    expect(cueIndexAt(track, 0)).toBe(-1);
    expect(cueIndexAt(track, 999)).toBe(-1);
    expect(cueIndexAt(track, 4000)).toBe(-1);
    expect(cueIndexAt(track, 4500)).toBe(-1);
    expect(cueIndexAt(track, 7000)).toBe(-1);
    expect(cueIndexAt(track, 9000)).toBe(-1);
    expect(cueIndexAt(track, 60_000)).toBe(-1);
  });

  it("shows a cue from its start up to, not including, its end", () => {
    expect(cueIndexAt(track, 1000)).toBe(0);
    expect(cueIndexAt(track, 2999)).toBe(0);
    expect(cueIndexAt(track, 5000)).toBe(2);
    expect(cueIndexAt(track, 6499)).toBe(2);
    expect(cueIndexAt(track, 6500)).toBe(-1);
    expect(cueIndexAt(track, 8999)).toBe(3);
  });

  it("hands over at the exact millisecond when two cues touch", () => {
    expect(cueIndexAt(track, 2999)).toBe(0);
    expect(cueIndexAt(track, 3000)).toBe(1);
  });

  it("copes with an empty track and with negative positions", () => {
    expect(cueIndexAt({ lang: "hi", cues: [] }, 500)).toBe(-1);
    expect(cueIndexAt(track, -50)).toBe(-1);
  });

  it("agrees with the content helper at every 50 ms of the track", () => {
    for (let ms = 0; ms <= 9500; ms += 50) {
      const index = cueIndexAt(track, ms);
      expect(index < 0 ? null : track.cues[index].id, `at ${ms} ms`).toBe(cueAt(track, ms)?.id ?? null);
    }
  });
});

describe("activeWordAt", () => {
  const c1 = track.cues[0];
  const c3 = track.cues[2];

  it("highlights the word being spoken", () => {
    expect(activeWordAt(c1, 1000)).toBe(0);
    expect(activeWordAt(c1, 1399)).toBe(0);
    expect(activeWordAt(c1, 1400)).toBe(1);
    expect(activeWordAt(c1, 2300)).toBe(3);
    expect(activeWordAt(c1, 2999)).toBe(4);
  });

  it("stays on the word just spoken during a pause inside the line", () => {
    expect(activeWordAt(c1, 1600)).toBe(1);
    expect(activeWordAt(c1, 1899)).toBe(1);
    expect(activeWordAt(c1, 1900)).toBe(2);
  });

  it("highlights nothing before the first word of a cue", () => {
    expect(activeWordAt(c3, 5000)).toBe(-1);
    expect(activeWordAt(c3, 5199)).toBe(-1);
    expect(activeWordAt(c3, 5200)).toBe(0);
  });

  it("keeps the last word lit until the cue leaves", () => {
    expect(activeWordAt(track.cues[3], 8900)).toBe(0);
  });

  it("highlights nothing in a cue that has no word timings", () => {
    expect(activeWordAt({ ...c1, words: [] }, 2000)).toBe(-1);
  });

  it("agrees with the content helper", () => {
    for (const c of track.cues) {
      for (let ms = c.startMs; ms < c.endMs; ms += 25) expect(activeWordAt(c, ms)).toBe(wordIndexAt(c, ms));
    }
  });

  it("only ever moves forward through a cue", () => {
    for (const c of track.cues) {
      let last = -1;
      for (let ms = c.startMs; ms < c.endMs; ms += 10) {
        const index = activeWordAt(c, ms);
        expect(index).toBeGreaterThanOrEqual(last);
        last = index;
      }
      expect(last).toBe(c.words.length - 1);
    }
  });
});

describe("speakerChangesAt", () => {
  it("shows the tag on the first cue", () => {
    expect(speakerChangesAt(track, 0)).toBe(true);
  });

  it("does not repeat the tag while the same person keeps talking", () => {
    expect(speakerChangesAt(track, 1)).toBe(false);
  });

  it("shows the tag whenever the speaker changes, in both directions", () => {
    expect(speakerChangesAt(track, 2)).toBe(true);
    expect(speakerChangesAt(track, 3)).toBe(true);
  });

  it("follows the track's label markers for phone and off-screen voices", () => {
    const [first, next, other, last] = track.cues;
    const marked: SubtitleTrack = { ...track, cues: [
      first,
      { ...next, heard_as: "phone", speaker_label: "Meera" },
      { ...other, heard_as: "off_screen" },
      { ...last, heard_as: "off_screen", speaker_label: "Meera" },
    ] };
    expect(marked.cues.map((_, i) => speakerChangesAt(marked, i))).toEqual([true, true, false, true]);
  });

  it("is false for an index outside the track", () => {
    expect(speakerChangesAt(track, -1)).toBe(false);
    expect(speakerChangesAt(track, 99)).toBe(false);
  });
});

describe("subtitleFrame", () => {
  it("is null without a track and between lines", () => {
    expect(subtitleFrame(null, 1500)).toBeNull();
    expect(subtitleFrame(undefined, 1500)).toBeNull();
    expect(subtitleFrame(track, 4200)).toBeNull();
  });

  it("gives the cue, the spoken word and the speaker tag together", () => {
    expect(subtitleFrame(track, 2000)).toMatchObject({ cueIndex: 0, activeWord: 2, showSpeaker: true });
    expect(subtitleFrame(track, 2000)?.cue.words[2].text).toBe("file");
    expect(subtitleFrame(track, 3500)).toMatchObject({ cueIndex: 1, activeWord: 1, showSpeaker: false });
    expect(subtitleFrame(track, 5100)).toMatchObject({ cueIndex: 2, activeWord: -1, showSpeaker: true });
  });

  it("highlights whole words, never a single character", () => {
    for (let ms = 0; ms < 9000; ms += 40) {
      const frame = subtitleFrame(track, ms);
      if (!frame || frame.activeWord < 0) continue;
      const word = frame.cue.words[frame.activeWord];
      expect(frame.cue.text.split(" ")).toContain(word.text);
    }
  });
});

describe("subtitleFrameKey", () => {
  it("is empty when nothing is on screen", () => {
    expect(subtitleFrameKey(track, 0)).toBe("");
    expect(subtitleFrameKey(null, 2000)).toBe("");
  });

  it("changes exactly when the cue or the highlighted word changes", () => {
    const keys: string[] = [];
    for (let ms = 0; ms <= 9200; ms += 10) {
      const key = subtitleFrameKey(track, ms);
      if (keys[keys.length - 1] !== key) keys.push(key);
    }
    expect(keys).toEqual(["", "0:0", "0:1", "0:2", "0:3", "0:4", "1:0", "1:1", "", "2:-1", "2:0", "2:1", "", "3:0", ""]);
  });

  it("round-trips through subtitleFrameFromKey", () => {
    for (let ms = 0; ms <= 9200; ms += 35) {
      expect(subtitleFrameFromKey(track, subtitleFrameKey(track, ms))).toEqual(subtitleFrame(track, ms));
    }
  });

  it("gives null for a key that does not fit the track (a track swapped mid-flight)", () => {
    expect(subtitleFrameFromKey(track, "12:0")).toBeNull();
    expect(subtitleFrameFromKey(null, "0:0")).toBeNull();
  });
});

describe("plateWords", () => {
  it("gives every word with no break when the text is one line", () => {
    expect(plateWords(track.cues[0])).toEqual(track.cues[0].words.map((w) => ({ text: w.text, breakBefore: false })));
  });

  it("starts a new line at the word after the subtitler's line break", () => {
    const twoLines = { ...cue("c9", "aditya", 0, [["मेरा", 0, 100], ["भाई।", 100, 200], ["मौसी", 200, 300], ["ने", 300, 400]]), text: "मेरा भाई।\nमौसी ने" };
    expect(plateWords(twoLines).map((w) => w.breakBefore)).toEqual([false, false, true, false]);
  });

  it("finds a repeated word at its own place, not the first one", () => {
    const repeated = { ...cue("c9", "kiran", 0, [["no,", 0, 100], ["no,", 100, 200], ["no.", 200, 300]]), text: "no,\nno, no." };
    expect(plateWords(repeated).map((w) => w.breakBefore)).toEqual([false, true, false]);
  });

  it("never breaks before the first word, and survives a word missing from the text", () => {
    const leading = { ...cue("c9", "kiran", 0, [["एक", 0, 100], ["दो", 100, 200]]), text: "\nएक दो" };
    expect(plateWords(leading).map((w) => w.breakBefore)).toEqual([false, false]);
    const broken = { ...cue("c9", "kiran", 0, [["एक", 0, 100], ["XX", 100, 200], ["दो", 200, 300]]), text: "एक\nदो" };
    expect(plateWords(broken).map((w) => w.breakBefore)).toEqual([false, false, true]);
  });
});

/** Every subtitle file in public/media whose timings are measured, not the evenly spaced stand-ins. */
function installedTracks(): Array<{ file: string; track: SubtitleTrack }> {
  const root = path.resolve(import.meta.dirname, "../../../public/media");
  const found: Array<{ file: string; track: SubtitleTrack }> = [];
  for (const series of fs.readdirSync(root)) {
    for (const kind of ["episodes", "glimpses"]) {
      const kindDir = path.join(root, series, kind);
      if (!fs.existsSync(kindDir)) continue;
      for (const id of fs.readdirSync(kindDir)) {
        for (const lang of ["hi", "en"]) {
          const file = path.join(kindDir, id, `${lang}.json`);
          if (!fs.existsSync(file)) continue;
          const parsed = parseSubtitleTrack(JSON.parse(fs.readFileSync(file, "utf8")));
          if (!parsed.ok) throw new Error(`${file}: ${parsed.errors.join("\n")}`);
          if (!parsed.value.placeholder) found.push({ file: path.relative(root, file), track: parsed.value });
        }
      }
    }
  }
  return found;
}

describe("the installed subtitle files", () => {
  const dir = path.resolve(import.meta.dirname, "../../../public/media/series1/episodes/s1e01");
  const load = (lang: "hi" | "en"): SubtitleTrack => {
    const parsed = parseSubtitleTrack(JSON.parse(fs.readFileSync(path.join(dir, `${lang}.json`), "utf8")));
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    return parsed.value;
  };

  const tracks = installedTracks();

  it("there are real (measured) tracks to check", () => {
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks.some(({ track }) => track.cues.some((c) => c.text.includes("\n")))).toBe(true);
  });

  /**
   * A word is on the plate from its start to the next word's start (the last
   * one to the cue's end). Forced alignment sometimes gives a word no time at
   * all (start = end = the next start); such a word can never light, so it is
   * listed here instead of failing the highlight check. It is a content-timing
   * fault, not a player one.
   */
  const KNOWN_ZERO_SPAN_WORDS = [
    "series1/episodes/s1b01/en.json c037 I",
    "series1/episodes/s1b01/hi.json c042 हाँ,",
    "series2/episodes/s2e01/en.json c032 a",
    "series2/episodes/s2e01/en.json c039 all",
    "series2/episodes/s2e02/hi.json c011 हैं।",
  ];
  const spanMs = (c: SubtitleCue, i: number) => (c.words[i + 1]?.startMs ?? c.endMs) - c.words[i].startMs;

  it("only the known words have no time on the plate", () => {
    const zero = tracks.flatMap(({ file, track }) =>
      track.cues.flatMap((c) => c.words.flatMap((w, i) => (spanMs(c, i) <= 0 ? [`${file} ${c.id} ${w.text}`] : []))),
    );
    expect(zero.sort()).toEqual([...KNOWN_ZERO_SPAN_WORDS].sort());
  });

  it.each(tracks.map(({ file, track }) => [file, track] as const))("%s: every word with time on the plate gets the highlight once, in order", (_file, subs) => {
    expect(subs.cues.length).toBeGreaterThan(0);
    for (const [cueIndex, c] of subs.cues.entries()) {
      // A 10 ms grid plus every word start, so a short word cannot fall between samples.
      const times = new Set<number>();
      for (let ms = c.startMs; ms < c.endMs; ms += 10) times.add(ms);
      for (const w of c.words) if (w.startMs >= c.startMs && w.startMs < c.endMs) times.add(w.startMs);
      const seen: number[] = [];
      for (const ms of [...times].sort((a, b) => a - b)) {
        const frame = subtitleFrame(subs, ms);
        expect(frame?.cueIndex).toBe(cueIndex);
        const word = frame?.activeWord ?? -1;
        if (word >= 0 && seen[seen.length - 1] !== word) seen.push(word);
      }
      expect(seen, c.id).toEqual(c.words.flatMap((_, i) => (spanMs(c, i) > 0 ? [i] : [])));
    }
  });

  it.each(tracks.map(({ file, track }) => [file, track] as const))("%s: the plate draws exactly the cue text, line breaks included", (_file, subs) => {
    for (const c of subs.cues) {
      const drawn = plateWords(c)
        .map((w, i) => (i === 0 ? "" : w.breakBefore ? "\n" : " ") + w.text)
        .join("");
      expect(drawn, c.id).toBe(c.text);
    }
  });

  it("hi: the lines are Devanagari with English words in Latin script", () => {
    const subs = load("hi");
    expect(subs.cues.some((c) => /[ऀ-ॿ]/.test(c.text) && /[A-Za-z]/.test(c.text))).toBe(true);
  });

  it("the two languages have different timings, so a frame is never reused across a language switch", () => {
    const hi = load("hi");
    const en = load("en");
    const differs = hi.cues.some((c, i) => en.cues[i] && (en.cues[i].startMs !== c.startMs || en.cues[i].endMs !== c.endMs));
    expect(differs).toBe(true);
  });
});
