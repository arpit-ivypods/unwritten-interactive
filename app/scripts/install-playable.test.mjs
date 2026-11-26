/**
 * The hand-over script, run for real against a scratch copy of the media
 * folder (never the app's own). Needs ffmpeg and ffprobe; skipped without them.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const APP_DIR = path.resolve(import.meta.dirname, "..");
const REAL_MEDIA = path.join(APP_DIR, "public", "media");
const hasFfmpeg = ["ffmpeg", "ffprobe"].every((tool) => spawnSync(tool, ["-version"]).status === 0);

let work;
let media;

const install = (args) =>
  spawnSync(process.execPath, [path.join(APP_DIR, "scripts", "install-playable.mjs"), "--media-dir", media, ...args], { encoding: "utf8" });
const manifest = () => JSON.parse(fs.readFileSync(path.join(media, "series1", "series.json"), "utf8"));
const file = (name) => path.join(work, name);
const writeJson = (name, value) => fs.writeFileSync(file(name), JSON.stringify(value));

function makeVideo(name, seconds) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-t", String(seconds), "-i", "testsrc2=s=1080x1920:r=30",
    "-f", "lavfi", "-t", String(seconds), "-i", "sine=f=330",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", file(name),
  ]);
}

const cue = (lang, text, words) => ({ lang, cues: [{ id: "c001", line_id: "l01", speaker: "kiran", startMs: 200, endMs: 1400, text, words }] });

describe.skipIf(!hasFfmpeg)("install-playable.mjs", () => {
  beforeAll(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "unwritten-install-"));
    media = path.join(work, "public", "media");
    fs.cpSync(REAL_MEDIA, media, { recursive: true, mode: fs.constants.COPYFILE_FICLONE });
    makeVideo("hi.mp4", 3);
    makeVideo("en.mp4", 2.5);
    // The Hinglish cut: 1.5 s + 1.5 s. The English cut: 1 s + 1.5 s. Same two shots.
    writeJson("timeline.hi.json", { shots: [{ id: "E1-001", durationSec: 1.5 }, { id: "E1-002", duration: 45 }] });
    writeJson("timeline.en.json", { shots: [{ id: "E1-001", durationSec: 1 }, { id: "E1-002", durationSec: 1.5 }] });
    writeJson("timeline.short.json", { shots: [{ id: "E1-001", durationSec: 1 }] });
    writeJson("subs.hi.json", cue("hi", "पूरी पुड़िया डाल दो।", [
      { text: "पूरी", startMs: 200, endMs: 500 },
      { text: "पुड़िया", startMs: 500, endMs: 900 },
      { text: "डाल", startMs: 900, endMs: 1150 },
      { text: "दो।", startMs: 1150, endMs: 1400 },
    ]));
    writeJson("subs.en.json", cue("en", "Pour it all in.", [
      { text: "Pour", startMs: 200, endMs: 500 },
      { text: "it", startMs: 500, endMs: 700 },
      { text: "all", startMs: 700, endMs: 1000 },
      { text: "in.", startMs: 1000, endMs: 1400 },
    ]));
    writeJson("subs.bad.json", cue("hi", "[whispers] पूरी पुड़िया", [{ text: "पूरी", startMs: 200, endMs: 1400 }]));
  }, 60_000);

  afterAll(() => {
    if (work) fs.rmSync(work, { recursive: true, force: true });
  });

  const common = () => ["--series", "series1", "--video-hi", file("hi.mp4"), "--video-en", file("en.mp4"), "--timeline-hi", file("timeline.hi.json")];

  it("refuses bad subtitles and leaves the folder and the manifest exactly as they were", () => {
    const before = manifest();
    const result = install([...common(), "--id", "s1e02", "--timeline-en", file("timeline.en.json"), "--subs-hi", file("subs.bad.json"), "--subs-en", file("subs.en.json")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("subtitle contract");
    expect(manifest()).toEqual(before);
    expect(fs.existsSync(path.join(media, "series1", "episodes", "s1e02", "hi.mp4"))).toBe(true);
    expect(fs.existsSync(path.join(media, "series1", "episodes", "s1e02.incoming"))).toBe(false);
  }, 60_000);

  it("refuses two cuts that do not have the same shots", () => {
    const before = manifest();
    const result = install([...common(), "--id", "s1e02", "--timeline-en", file("timeline.short.json")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("same shots");
    expect(manifest()).toEqual(before);
  }, 60_000);

  it("refuses an id the series does not have", () => {
    const result = install([...common(), "--id", "s9e99", "--timeline-en", file("timeline.en.json")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("s9e99");
  }, 60_000);

  it("installs an episode: per-language shots, stills, subtitles, placeholder off", () => {
    const result = install([
      ...common(), "--id", "s1e01", "--timeline-en", file("timeline.en.json"),
      "--subs-hi", file("subs.hi.json"), "--subs-en", file("subs.en.json"), "--title-hi", "पूरी पुड़िया", "--title-en", "The Whole Sachet",
    ]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("content check passed");
    const episode = manifest().episodes.find((e) => e.id === "s1e01");
    expect(episode).toMatchObject({ id: "s1e01", number: 1, kind: "shared", placeholder: false, title: { hi: "पूरी पुड़िया", en: "The Whole Sachet" } });
    expect(episode.placeholderNote).toBeUndefined();
    expect(Math.abs(episode.durationMs.hi - 3000)).toBeLessThan(100);
    expect(Math.abs(episode.durationMs.en - 2500)).toBeLessThan(100);
    expect(episode.shots.map((s) => s.id)).toEqual(["e1001", "e1002"]);
    expect(episode.shots[0].timing).toEqual({ hi: { startMs: 0, endMs: 1500 }, en: { startMs: 0, endMs: 1000 } });
    expect(episode.shots[1].timing.hi.startMs).toBe(1500);
    expect(episode.shots[1].timing.en.startMs).toBe(1000);
    for (const url of [episode.video.hi, episode.video.en, episode.subtitles.hi, episode.poster, ...episode.shots.map((s) => s.still)]) {
      expect(fs.existsSync(path.join(work, "public", url)), url).toBe(true);
    }
  }, 60_000);

  it("installs a glimpse; without subtitles it stays flagged as a placeholder, with the reason", () => {
    const result = install([...common(), "--id", "s1gb", "--timeline-en", file("timeline.en.json")]);
    expect(result.status).toBe(0);
    const glimpse = manifest().glimpses.B;
    expect(glimpse).toMatchObject({ id: "s1gb", placeholder: true });
    expect(glimpse.placeholderNote).toContain("No hi subtitles");
    expect(glimpse.shots).toHaveLength(2);
  }, 60_000);

  it("never touches the app's own media folder", () => {
    const real = JSON.parse(fs.readFileSync(path.join(REAL_MEDIA, "series1", "series.json"), "utf8"));
    expect(fs.existsSync(path.join(REAL_MEDIA, "series1", "episodes", "s1e01.incoming"))).toBe(false);
    expect(real.episodes.find((e) => e.id === "s1e01").shots.map((s) => s.id)).not.toEqual(["e1001", "e1002"]);
  });
});
