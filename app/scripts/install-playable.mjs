#!/usr/bin/env node
// Put one finished episode or glimpse into the app and update series.json.
// This is the hand-over from the production track to the app: one command per
// episode, instead of editing the manifest by hand.
//
//   node scripts/install-playable.mjs --series series1 --id s1e01 \
//     --video-hi out/s1e01.hi.mp4      --video-en out/s1e01.en.mp4 \
//     --timeline-hi s1e01.hi/timeline.json --timeline-en s1e01.en/timeline.json \
//     --subs-hi subs/s1e01.hi.json     --subs-en subs/s1e01.en.json \
//     [--title-hi "..."] [--title-en "..."] [--poster frame.jpg] [--note "..."]
//
// What it does:
// 1. Reads the two Remotion timelines (the authored timeline.json files, see
//    production/remotion/TIMELINE.md) and works out each shot's start and end
//    in milliseconds for each language. Both cuts must have the same shots in
//    the same order.
// 2. Copies the videos to public/media/<series>/<episodes|glimpses>/<id>/ and
//    measures their length with ffprobe.
// 3. Grabs one still per shot from the middle of that shot in the Hinglish
//    video (shots/<shotId>.jpg). The poster is --poster, or the first still.
// 4. Validates and copies the subtitle files (the cue format in
//    src/content/schema.ts). If one is not given, an empty track is written.
// 5. Rewrites that episode's (or glimpse's) entry in series.json and sets
//    `placeholder: false`. It stays `placeholder: true`, with a note, if
//    subtitles were missing or --note was given.
// 6. Runs the content check.
// Everything is checked and built beside the old folder first; the old folder
// and series.json are replaced only when the new one is complete.
//
// Rebuild (`pnpm build`) afterwards if the app is being served from a
// production build; `pnpm dev` picks the change up by itself.
//
// --media-dir <dir> works on another copy of the media folder (used by tests).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSeries, validateSubtitleTrack } from "../src/content/schema.ts";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 30;
const LANGS = ["hi", "en"];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) fail(`unexpected argument: ${key}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`${key} needs a value`);
    out[key.slice(2)] = value;
    i++;
  }
  return out;
}

function fail(message) {
  console.error(`[install] ${message}`);
  process.exit(1);
}

const opt = parseArgs(process.argv.slice(2));
for (const required of ["series", "id", "video-hi", "video-en", "timeline-hi", "timeline-en"]) {
  if (!opt[required]) fail(`--${required} is required (see the top of scripts/install-playable.mjs)`);
}
const MEDIA_DIR = path.resolve(opt["media-dir"] ?? path.join(APP_DIR, "public", "media"));
if (path.basename(MEDIA_DIR) !== "media") fail("--media-dir must be a folder named media");
const PUBLIC_DIR = path.dirname(MEDIA_DIR);
const seriesId = opt.series;
const playableId = opt.id;

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const mustExist = (file, what) => {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`${what} not found: ${file}`);
  return path.resolve(file);
};
const probeMs = (file) => Math.round(Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).trim()) * 1000);
const toMs = (frames) => Math.round((frames * 1000) / FPS);

/** Frames for a timeline field given as `<key>` (frames) or `<key>Sec` (seconds): the rule in TIMELINE.md. */
function frames(obj, key) {
  if (obj[key] !== undefined && obj[key] !== null) return Math.round(Number(obj[key]));
  const seconds = obj[`${key}Sec`];
  if (seconds !== undefined && seconds !== null) return Math.round(Number(seconds) * FPS);
  return undefined;
}

/** Manifest shot ids are lower-case letters and digits starting with a letter: "E1-012" -> "e1012", "003" -> "s003". */
function shotIdFrom(raw, index) {
  const cleaned = String(raw ?? index + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleaned) return `s${String(index + 1).padStart(2, "0")}`;
  return /^[a-z]/.test(cleaned) ? cleaned : `s${cleaned}`;
}

/** Shot starts and ends from an authored timeline, the same way prepare-timeline.mjs resolves them. */
function shotsOf(timelineFile) {
  const timeline = JSON.parse(fs.readFileSync(timelineFile, "utf8"));
  let cursor = 0;
  const shots = (timeline.shots ?? []).map((raw, index) => {
    const start = frames(raw, "start") ?? cursor;
    const duration = frames(raw, "duration");
    if (!duration || duration <= 0) fail(`${timelineFile}: shot ${raw.id ?? index + 1} has no duration`);
    cursor = start + duration;
    return { id: shotIdFrom(raw.id, index), startMs: toMs(start), endMs: toMs(start + duration) };
  });
  if (shots.length === 0) fail(`${timelineFile}: no shots`);
  return shots.sort((a, b) => a.startMs - b.startMs);
}

// --- read the manifest and find the entry ------------------------------------

const manifestFile = path.join(MEDIA_DIR, seriesId, "series.json");
const manifest = JSON.parse(fs.readFileSync(mustExist(manifestFile, "series.json"), "utf8"));
const episode = manifest.episodes?.find((e) => e.id === playableId) ?? null;
const glimpseKey = ["A", "B"].find((choice) => manifest.glimpses?.[choice]?.id === playableId) ?? null;
if (!episode && !glimpseKey) fail(`${seriesId}/series.json has no episode or glimpse with id "${playableId}"`);
const folder = episode ? "episodes" : "glimpses";
const url = (...parts) => `/media/${seriesId}/${folder}/${playableId}/${parts.join("/")}`;
const disk = (mediaUrl) => path.join(PUBLIC_DIR, mediaUrl);

// --- shots ---------------------------------------------------------------------

const videoIn = { hi: mustExist(opt["video-hi"], "--video-hi"), en: mustExist(opt["video-en"], "--video-en") };
const timelineShots = { hi: shotsOf(mustExist(opt["timeline-hi"], "--timeline-hi")), en: shotsOf(mustExist(opt["timeline-en"], "--timeline-en")) };
const idsHi = timelineShots.hi.map((s) => s.id).join(",");
const idsEn = timelineShots.en.map((s) => s.id).join(",");
if (idsHi !== idsEn) fail(`the two timelines do not have the same shots in the same order:\n  hi: ${idsHi}\n  en: ${idsEn}`);
if (new Set(timelineShots.hi.map((s) => s.id)).size !== timelineShots.hi.length) fail(`shot ids are not unique after normalising: ${idsHi}`);

// --- measure the videos, check the subtitles: nothing is written yet --------------

const durationMs = { hi: probeMs(videoIn.hi), en: probeMs(videoIn.en) };

// A shot cannot outlast its video: trim the last shot to the measured length.
for (const lang of LANGS) {
  for (const shot of timelineShots[lang]) {
    shot.endMs = Math.min(shot.endMs, durationMs[lang]);
    if (shot.endMs <= shot.startMs) fail(`shot ${shot.id} (${lang}) starts at ${shot.startMs} ms, after the ${durationMs[lang]} ms video ends`);
  }
}

const notes = [];
const subtitleJson = {};
for (const lang of LANGS) {
  const given = opt[`subs-${lang}`];
  if (!given) {
    subtitleJson[lang] = { lang, placeholder: true, cues: [] };
    notes.push(`No ${lang} subtitles were delivered.`);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(mustExist(given, `--subs-${lang}`), "utf8"));
  const result = validateSubtitleTrack(json, durationMs[lang]);
  if (!result.ok) fail(`${given} does not match the subtitle contract:\n  - ${result.errors.join("\n  - ")}`);
  if (result.value.lang !== lang) fail(`${given} says lang "${result.value.lang}", expected "${lang}"`);
  subtitleJson[lang] = json;
}
if (opt.note) notes.push(opt.note);
const posterIn = opt.poster ? mustExist(opt.poster, "--poster") : null;

// --- build the new folder beside the old one, swap only when it is complete -------

const targetDir = path.join(MEDIA_DIR, seriesId, folder, playableId);
const incomingDir = `${targetDir}.incoming`;
/** Where a /media/... URL is written while the folder is being built. */
const incoming = (mediaUrl) => path.join(incomingDir, path.relative(targetDir, disk(mediaUrl)));
fs.rmSync(incomingDir, { recursive: true, force: true });
fs.mkdirSync(path.join(incomingDir, "shots"), { recursive: true });

const video = { hi: url("hi.mp4"), en: url("en.mp4") };
const subtitles = { hi: url("hi.json"), en: url("en.json") };
const poster = url("poster.jpg");
let shots;
try {
  for (const lang of LANGS) {
    fs.copyFileSync(videoIn[lang], incoming(video[lang]));
    fs.writeFileSync(incoming(subtitles[lang]), JSON.stringify(subtitleJson[lang], null, 2) + "\n");
  }
  // One still per shot, from the middle of that shot in the Hinglish cut.
  shots = timelineShots.hi.map((shot, i) => {
    const still = url("shots", `${shot.id}.jpg`);
    const middle = (shot.startMs + shot.endMs) / 2000;
    run("ffmpeg", ["-y", "-loglevel", "error", "-ss", middle.toFixed(3), "-i", incoming(video.hi), "-frames:v", "1", "-q:v", "3", incoming(still)]);
    if (!fs.existsSync(incoming(still))) throw new Error(`could not grab a still for shot ${shot.id} at ${middle.toFixed(2)} s`);
    return {
      id: shot.id,
      still,
      timing: {
        hi: { startMs: shot.startMs, endMs: shot.endMs },
        en: { startMs: timelineShots.en[i].startMs, endMs: timelineShots.en[i].endMs },
      },
    };
  });
  if (posterIn) run("ffmpeg", ["-y", "-loglevel", "error", "-i", posterIn, "-frames:v", "1", "-q:v", "3", incoming(poster)]);
  else fs.copyFileSync(incoming(shots[0].still), incoming(poster));
} catch (error) {
  fs.rmSync(incomingDir, { recursive: true, force: true });
  fail(`nothing was changed: ${String(error.message).split("\n")[0]}`);
}

// --- the manifest entry ------------------------------------------------------------

const media = { video, durationMs, subtitles, shots, poster, placeholder: notes.length > 0 };
if (notes.length) media.placeholderNote = notes.join(" ");

if (episode) {
  const title = { hi: opt["title-hi"] ?? episode.title.hi, en: opt["title-en"] ?? episode.title.en };
  const index = manifest.episodes.indexOf(episode);
  manifest.episodes[index] = { id: episode.id, number: episode.number, kind: episode.kind, title, ...media };
} else {
  manifest.glimpses[glimpseKey] = { id: playableId, ...media };
}

const checked = validateSeries(manifest);
if (!checked.ok) {
  fs.rmSync(incomingDir, { recursive: true, force: true });
  fail(`nothing was changed: the updated series.json would not be valid:\n  - ${checked.errors.join("\n  - ")}`);
}
fs.rmSync(targetDir, { recursive: true, force: true });
fs.renameSync(incomingDir, targetDir);
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

console.log(
  `[install] ${seriesId} ${playableId}: ${shots.length} shots, hi ${durationMs.hi} ms, en ${durationMs.en} ms, ` +
    `${media.placeholder ? `still a placeholder (${media.placeholderNote})` : "placeholder: false"}`,
);

try {
  execFileSync(process.execPath, [path.join(APP_DIR, "scripts", "check-content.mjs"), "--quiet", "--media-dir", MEDIA_DIR], { stdio: "inherit" });
} catch {
  process.exit(1);
}
