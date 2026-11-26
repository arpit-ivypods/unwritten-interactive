import { describe, expect, it } from "vitest";
import { makeSeries } from "@/test/fixtures";
import { validateCatalog, validateSeries, validateSubtitleTrack } from "./schema";
import type { Series, SubtitleTrack } from "./schema";

/** A deep copy that a test can break in one place. */
function broken(change: (series: Series) => void): unknown {
  const copy = structuredClone(makeSeries());
  change(copy);
  return copy;
}

function errorsOf(input: unknown): string[] {
  const result = validateSeries(input);
  return result.ok ? [] : result.errors;
}

describe("validateSeries", () => {
  it("accepts a well-formed series", () => {
    expect(validateSeries(makeSeries())).toMatchObject({ ok: true });
    expect(validateSeries(makeSeries({ shared: 3, branch: 3 }))).toMatchObject({ ok: true });
  });

  it("rejects things that are not a series at all", () => {
    expect(validateSeries(null).ok).toBe(false);
    expect(validateSeries({}).ok).toBe(false);
    expect(validateSeries("series1").ok).toBe(false);
  });

  it("names the field that is wrong", () => {
    const errors = errorsOf(broken((s) => ((s.title as { en: unknown }).en = "")));
    expect(errors.join("\n")).toContain("title.en");
  });

  it("needs both languages everywhere", () => {
    expect(errorsOf(broken((s) => delete (s.question as Partial<Series["question"]>).hi)).join("\n")).toContain("question.hi");
    expect(errorsOf(broken((s) => delete (s.episodes[0].video as Partial<Series["episodes"][0]["video"]>).en)).join("\n")).toContain("episodes[0].video.en");
    expect(errorsOf(broken((s) => delete (s.choices.B.label as Partial<Series["title"]>).en)).join("\n")).toContain("choices.B.label.en");
  });

  it("takes an optional plain meaning under a choice, in both languages", () => {
    expect(validateSeries(broken((s) => (s.choices.A.meaning = { hi: "सब ठीक है।", en: "All clear." }))).ok).toBe(true);
    expect(validateSeries(broken((s) => (s.choices.A.meaning = { hi: "सब ठीक है।" } as Series["title"]))).ok).toBe(false);
  });

  it("needs both glimpses and both tallies", () => {
    expect(validateSeries(broken((s) => delete (s.glimpses as Partial<Series["glimpses"]>).B)).ok).toBe(false);
    expect(validateSeries(broken((s) => delete (s.seededTallies as Partial<Series["seededTallies"]>).A)).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.seededTallies.A = -1))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.seededTallies.B = 1.5))).ok).toBe(false);
  });

  it("only accepts the three episode kinds", () => {
    expect(validateSeries(broken((s) => ((s.episodes[0] as { kind: string }).kind = "bonus"))).ok).toBe(false);
  });

  it("checks the numbering around the branch point", () => {
    expect(errorsOf(broken((s) => (s.branchAfterEpisode = 3))).join("\n")).toContain("branchAfterEpisode");
    expect(errorsOf(broken((s) => (s.episodes[2].number = 9))).join("\n")).toContain("branchA");
    expect(errorsOf(broken((s) => (s.episodes = s.episodes.filter((e) => e.kind !== "branchB")))).join("\n")).toContain("no branchB episode");
  });

  it("wants shared episodes first, then branch A, then branch B", () => {
    const errors = errorsOf(broken((s) => s.episodes.reverse()));
    expect(errors.join("\n")).toContain("shared first");
  });

  it("rejects duplicate ids, including a glimpse reusing an episode id", () => {
    expect(errorsOf(broken((s) => (s.episodes[1].id = s.episodes[0].id))).join("\n")).toContain("more than once");
    expect(errorsOf(broken((s) => (s.glimpses.A.id = s.episodes[0].id))).join("\n")).toContain("more than once");
    expect(errorsOf(broken((s) => (s.episodes[0].shots[1].id = "s01"))).join("\n")).toContain("shot id");
  });

  it("keeps every path inside the series' own media folder", () => {
    expect(errorsOf(broken((s) => (s.episodes[0].video.hi = "/media/other/episodes/xe01/hi.mp4"))).join("\n")).toContain("must be under /media/demo/");
    expect(validateSeries(broken((s) => (s.poster = "poster.jpg"))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.poster = "/media/demo/../secret.jpg"))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.episodes[0].video.hi = "/media/demo/episodes/xe01/hi.mov"))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.episodes[0].subtitles.en = "/media/demo/episodes/xe01/en.vtt"))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.cast[0].voiceSample.hi = "/media/demo/cast/meera.hi.txt"))).ok).toBe(false);
  });

  it("checks shots against each language's own video", () => {
    expect(errorsOf(broken((s) => (s.episodes[0].shots[1].timing.en.endMs = 7900))).join("\n")).toContain("after the 7000 ms video");
    expect(validateSeries(broken((s) => (s.episodes[0].shots[1].timing.hi.endMs = 8200))).ok).toBe(true);
    expect(errorsOf(broken((s) => (s.episodes[0].shots[1].timing.hi.startMs = 3000))).join("\n")).toContain("before the previous shot ends");
    expect(validateSeries(broken((s) => (s.episodes[0].shots[1].timing.hi.startMs = 3970))).ok).toBe(true);
    expect(validateSeries(broken((s) => (s.episodes[0].shots[0].timing.hi = { startMs: 500, endMs: 500 }))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.episodes[0].shots = []))).ok).toBe(false);
    expect(validateSeries(broken((s) => (s.episodes[0].shots[0].timing.hi.startMs = 0.5))).ok).toBe(false);
  });

  it("requires the placeholder flag on every episode and glimpse", () => {
    expect(validateSeries(broken((s) => delete (s.episodes[0] as Partial<Series["episodes"][0]>).placeholder)).ok).toBe(false);
    expect(validateSeries(broken((s) => delete (s.glimpses.A as Partial<Series["glimpses"]["A"]>).placeholder)).ok).toBe(false);
  });
});

describe("validateCatalog", () => {
  const teaser = { id: "t1", title: { hi: "आख़िरी Local", en: "The Last Local" }, hook: { hi: "एक seat खाली है।", en: "One seat is empty." }, visualStyle: "Photoreal", placeholder: true };

  it("accepts two series and up to three teasers", () => {
    expect(validateCatalog({ schemaVersion: 1, series: ["series1", "series2"], teasers: [teaser, { ...teaser, id: "t2" }, { ...teaser, id: "t3" }] }).ok).toBe(true);
  });

  it("rejects a fourth teaser, a repeated id, and an empty series list", () => {
    const four = [1, 2, 3, 4].map((n) => ({ ...teaser, id: `t${n}` }));
    expect(validateCatalog({ schemaVersion: 1, series: ["series1"], teasers: four }).ok).toBe(false);
    expect(validateCatalog({ schemaVersion: 1, series: ["series1"], teasers: [teaser, teaser] }).ok).toBe(false);
    expect(validateCatalog({ schemaVersion: 1, series: ["series1", "series1"], teasers: [] }).ok).toBe(false);
    expect(validateCatalog({ schemaVersion: 1, series: [], teasers: [] }).ok).toBe(false);
    expect(validateCatalog({ schemaVersion: 2, series: ["series1"], teasers: [] }).ok).toBe(false);
  });
});

describe("validateSubtitleTrack", () => {
  const track = (): SubtitleTrack => ({
    lang: "hi",
    cues: [
      {
        id: "c001",
        line_id: "l01",
        speaker: "meera",
        startMs: 300,
        endMs: 2300,
        text: "रुको! यह file किसने खोली?",
        words: [
          { text: "रुको!", startMs: 300, endMs: 700 },
          { text: "यह", startMs: 700, endMs: 1000 },
          { text: "file", startMs: 1000, endMs: 1400 },
          { text: "किसने", startMs: 1400, endMs: 1900 },
          { text: "खोली?", startMs: 1900, endMs: 2300 },
        ],
      },
      {
        id: "c002",
        line_id: "l02",
        speaker: "meera",
        startMs: 2600,
        endMs: 3600,
        text: "बताओ।",
        words: [{ text: "बताओ।", startMs: 2600, endMs: 3600 }],
      },
    ],
  });
  const withCue = (change: (t: SubtitleTrack) => void): SubtitleTrack => {
    const t = track();
    change(t);
    return t;
  };

  it("accepts a Devanagari + Latin line with word timings", () => {
    expect(validateSubtitleTrack(track(), 8000)).toMatchObject({ ok: true });
    expect(validateSubtitleTrack({ lang: "en", cues: [] }).ok).toBe(true);
  });

  it("rejects an unknown language or a missing field", () => {
    expect(validateSubtitleTrack({ lang: "hinglish", cues: [] }).ok).toBe(false);
    expect(validateSubtitleTrack(withCue((t) => delete (t.cues[0] as Partial<SubtitleTrack["cues"][0]>).line_id)).ok).toBe(false);
    expect(validateSubtitleTrack(withCue((t) => delete (t.cues[0] as Partial<SubtitleTrack["cues"][0]>).speaker)).ok).toBe(false);
    expect(validateSubtitleTrack(withCue((t) => (t.cues[0].words = []))).ok).toBe(false);
  });

  it("rejects cues out of order, past the end of the video, or with a repeated id", () => {
    expect(validateSubtitleTrack(withCue((t) => t.cues.reverse())).ok).toBe(false);
    expect(validateSubtitleTrack(track(), 3000).ok).toBe(false);
    expect(validateSubtitleTrack(withCue((t) => (t.cues[1].id = "c001"))).ok).toBe(false);
  });

  it("rejects words that leave their cue or do not spell the text", () => {
    expect(validateSubtitleTrack(withCue((t) => (t.cues[0].words[4].endMs = 2400))).ok).toBe(false);
    expect(validateSubtitleTrack(withCue((t) => (t.cues[0].words[2].text = "फ़ाइल"))).ok).toBe(false);
    expect(validateSubtitleTrack(withCue((t) => t.cues[0].words.pop())).ok).toBe(false);
  });

  it("rejects a line that still carries an emotion tag", () => {
    const tagged = withCue((t) => {
      t.cues[1].text = "[whispers] बताओ।";
      t.cues[1].words = [
        { text: "[whispers]", startMs: 2600, endMs: 3000 },
        { text: "बताओ।", startMs: 3000, endMs: 3600 },
      ];
    });
    const result = validateSubtitleTrack(tagged);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("emotion tag");
  });
});
