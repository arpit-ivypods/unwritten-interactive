#!/usr/bin/env node
// Check everything under app/public/media against the content contract.
//
//   node scripts/check-content.mjs [--no-probe] [--quiet] [--media-dir <dir>]
//   (or: pnpm content:check)
//
// Run it after copying finished renders in, and before a build. It checks:
// - catalog.json and every series.json against src/content/schema.ts
// - that every file a manifest names exists
// - every subtitle file (shape, order, words spell the text, inside the video)
// - with ffprobe (skip with --no-probe): each video is H.264, 1080x1920, and as
//   long as the manifest says
// It prints what is still a placeholder. Exit code 1 if anything is wrong.
//
// The schema is imported straight from the TypeScript source (Node 23.6+ strips
// the types), so this script and the app can never disagree.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog, validateSeries, validateSubtitleTrack } from "../src/content/schema.ts";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mediaDirArg = process.argv.indexOf("--media-dir");
/** --media-dir <dir> checks another copy of the media folder (used by tests). */
const MEDIA_DIR = mediaDirArg >= 0 ? path.resolve(process.argv[mediaDirArg + 1]) : path.join(APP_DIR, "public", "media");
const PUBLIC_DIR = path.dirname(MEDIA_DIR);
const PROBE = !process.argv.includes("--no-probe");
const QUIET = process.argv.includes("--quiet");
/** How far a video file's real length may be from the manifest's durationMs. */
const DURATION_SLACK_MS = 300;

const errors = [];
const warnings = [];
const placeholders = [];
let filesChecked = 0;

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${label}: cannot read ${path.relative(APP_DIR, file)} (${error.message})`);
    return null;
  }
}

function mustExist(mediaUrl, label) {
  filesChecked++;
  const file = path.join(PUBLIC_DIR, mediaUrl);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    errors.push(`${label}: file is missing: public${mediaUrl}`);
    return null;
  }
  if (fs.statSync(file).size === 0) {
    errors.push(`${label}: file is empty: public${mediaUrl}`);
    return null;
  }
  return file;
}

let ffprobeWorks = PROBE;
function probe(file) {
  if (!ffprobeWorks) return null;
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return JSON.parse(out);
  } catch (error) {
    if (error.code === "ENOENT") {
      ffprobeWorks = false;
      warnings.push("ffprobe is not on PATH: video codec, size and length were not checked");
      return null;
    }
    return { failed: true };
  }
}

function checkPlayable(series, label, playable) {
  for (const shot of playable.shots) mustExist(shot.still, `${label} shot ${shot.id}`);
  mustExist(playable.poster, `${label} poster`);
  const castIds = new Set(series.cast.map((c) => c.id));
  for (const lang of ["hi", "en"]) {
    const video = mustExist(playable.video[lang], `${label} video.${lang}`);
    if (video) {
      const info = probe(video);
      if (info?.failed) {
        errors.push(`${label} video.${lang}: ffprobe cannot read the file`);
      } else if (info) {
        const v = info.streams?.find((s) => s.codec_type === "video");
        const a = info.streams?.find((s) => s.codec_type === "audio");
        if (!v) errors.push(`${label} video.${lang}: no video stream`);
        else {
          if (v.codec_name !== "h264") errors.push(`${label} video.${lang}: codec is ${v.codec_name}, must be h264`);
          if (v.width !== 1080 || v.height !== 1920) errors.push(`${label} video.${lang}: is ${v.width}x${v.height}, must be 1080x1920`);
        }
        if (!a) warnings.push(`${label} video.${lang}: no audio stream`);
        const realMs = Math.round(Number(info.format?.duration) * 1000);
        if (Number.isFinite(realMs) && Math.abs(realMs - playable.durationMs[lang]) > DURATION_SLACK_MS) {
          errors.push(`${label} video.${lang}: file is ${realMs} ms long but durationMs.${lang} says ${playable.durationMs[lang]}`);
        }
      }
    }
    const subs = mustExist(playable.subtitles[lang], `${label} subtitles.${lang}`);
    if (subs) {
      const json = readJson(subs, `${label} subtitles.${lang}`);
      if (json) {
        const result = validateSubtitleTrack(json, playable.durationMs[lang]);
        if (!result.ok) {
          for (const e of result.errors) errors.push(`${label} subtitles.${lang}: ${e}`);
        } else {
          if (result.value.lang !== lang) errors.push(`${label} subtitles.${lang}: file says lang "${result.value.lang}"`);
          const unknown = [...new Set(result.value.cues.map((c) => c.speaker))].filter((s) => !castIds.has(s));
          if (unknown.length) warnings.push(`${label} subtitles.${lang}: speaker not in cast: ${unknown.join(", ")} (the app will show the id as written)`);
          if (result.value.cues.length === 0) warnings.push(`${label} subtitles.${lang}: no cues`);
        }
      }
    }
  }
  if (playable.placeholder) placeholders.push(`${label}${playable.placeholderNote ? `: ${playable.placeholderNote}` : ""}`);
}

function checkSeries(seriesId) {
  const file = path.join(MEDIA_DIR, seriesId, "series.json");
  const json = readJson(file, seriesId);
  if (!json) return;
  const result = validateSeries(json);
  if (!result.ok) {
    for (const e of result.errors) errors.push(`${seriesId}/series.json: ${e}`);
    return;
  }
  const series = result.value;
  if (series.id !== seriesId) errors.push(`${seriesId}/series.json: id is "${series.id}", must match the folder name`);
  mustExist(series.poster, `${seriesId} poster`);
  mustExist(series.backdrop, `${seriesId} backdrop`);
  if (series.placeholder) placeholders.push(`${seriesId} series text, cast and art`);
  for (const member of series.cast) {
    for (const lang of ["hi", "en"]) mustExist(member.voiceSample[lang], `${seriesId} cast ${member.id} voiceSample.${lang}`);
    if (member.portrait) mustExist(member.portrait, `${seriesId} cast ${member.id} portrait`);
  }
  for (const episode of series.episodes) checkPlayable(series, `${seriesId} ${episode.id}`, episode);
  for (const choice of ["A", "B"]) checkPlayable(series, `${seriesId} ${series.glimpses[choice].id}`, series.glimpses[choice]);
  return series;
}

const catalogJson = readJson(path.join(MEDIA_DIR, "catalog.json"), "catalog");
let seriesCount = 0;
if (catalogJson) {
  const result = validateCatalog(catalogJson);
  if (!result.ok) {
    for (const e of result.errors) errors.push(`catalog.json: ${e}`);
  } else {
    for (const seriesId of result.value.series) {
      if (checkSeries(seriesId)) seriesCount++;
    }
    for (const teaser of result.value.teasers) {
      if (teaser.placeholder) placeholders.push(`teaser ${teaser.id}`);
    }
  }
}

if (!QUIET) {
  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (placeholders.length) {
    console.log(`\n${placeholders.length} placeholder item(s):`);
    for (const p of placeholders) console.log(`  - ${p}`);
  }
}
if (errors.length) {
  console.error(`\ncontent check FAILED: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log(
  `\ncontent check passed: ${seriesCount} series, ${filesChecked} files` +
    `${ffprobeWorks ? ", videos probed" : ", videos NOT probed"}, ${warnings.length} warning(s), ${placeholders.length} placeholder(s)`,
);
