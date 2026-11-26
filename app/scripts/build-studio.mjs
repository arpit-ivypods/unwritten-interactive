#!/usr/bin/env node
/**
 * build-studio.mjs. OWNER: studio engineer (P6).
 *
 * Collects the real production artefacts of one or more productions under
 * content/ and writes the Studio manifest the /studio walkthrough reads:
 *
 *   app/public/media/studio/studio.json
 *   app/public/media/studio/<projectId>/...   (webp stills, mp3, mp4)
 *
 * Read-only towards content/: nothing there is changed. Everything under
 * public/media/studio is generated and is rewritten on every run (stale files
 * are removed).
 *
 * Usage (from app/):
 *   node scripts/build-studio.mjs
 *   node scripts/build-studio.mjs --source photoreal=content/proof/photoreal --source flat2d=content/proof/flat2d
 *   node scripts/build-studio.mjs --source s1e01=content/series1/episodes/s1e01:bible=content/series1/bible.json:label="Series 1, episode 1"
 *
 * A source is `id=dir` (dir relative to the repository root), optionally
 * followed by `:bible=path` and `:label=text`. A `bible.json` inside the
 * source dir is picked up on its own. Every artefact is optional: whatever
 * exists is shown, whatever is missing shows as not started.
 *
 * Files read in a source dir (all optional):
 *   bible.json, script.hi.json, script.en.json, review-notes.json,
 *   continuity.json, style.json, cast.json, shots.json,
 *   refs/*.png (+ refs/manifest.jsonl), frames/*.png (+ frames/manifest.jsonl),
 *   voice/takes.json, voice/manifest.jsonl, voice/review.json, voice/ab.json,
 *   voice/<lang>/*.mp3 (voice/placeholder/ is ignored),
 *   sound/cues.json, sound/manifest.jsonl, sound/*.mp3,
 *   subs.hi.json, subs.en.json, timeline.hi.json, timeline.en.json,
 *   timeline.*.review.json, screening.json, render/*.mp4
 *
 * Needs cwebp and ffmpeg/ffprobe on PATH (Homebrew). Images are resized to
 * 720 px wide webp; renders are re-encoded to 720x1280 H.264 for the page.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(APP, "..");
const OUT = path.join(APP, "public/media/studio");
const URL_BASE = "/media/studio";
const IMAGE_WIDTH = 720;

const DEFAULT_SOURCES = [
  { id: "photoreal", dir: "content/proof/photoreal", label: "Proof scene · photoreal" },
  { id: "flat2d", dir: "content/proof/flat2d", label: "Proof scene · flat 2D" },
];

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

const log = (...a) => console.log("[studio]", ...a);
const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn("[studio] warning:", msg);
};

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    warn(`could not parse ${rel(file)}: ${e.message}`);
    return null;
  }
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      warn(`bad line in ${rel(file)}`);
    }
  }
  return rows;
}

const rel = (p) => path.relative(ROOT, p);
const str = (v) => (typeof v === "string" ? v : v == null ? null : String(v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const arr = (v) => (Array.isArray(v) ? v : []);
const bool = (v) => v === true || v === "true";
/** Plain text from a string, or a { hi, en } pair (taking `lang`). */
const text = (v, lang = "en") => (typeof v === "string" ? v : v && typeof v === "object" ? (v[lang] ?? v.en ?? v.hi ?? null) : null);
const pair = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { hi: str(v.hi), en: str(v.en) } : typeof v === "string" ? { hi: null, en: v } : null);

function sha(file) {
  return createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}

function have(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Output files written in this run; everything else under OUT is removed at the end. */
const produced = new Set();

function upToDate(src, dst) {
  return fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs;
}

function outPath(projectId, ...parts) {
  const p = path.join(OUT, projectId, ...parts);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  produced.add(p);
  return p;
}

const urlOf = (p) => `${URL_BASE}/${path.relative(OUT, p).split(path.sep).join("/")}`;

const TOOLS = { cwebp: have("cwebp"), ffmpeg: have("ffmpeg"), ffprobe: have("ffprobe") };

/** PNG -> 720w webp. Returns the URL, or null. */
function image(projectId, src, group) {
  if (!src || !fs.existsSync(src)) return null;
  const name = path.basename(src, path.extname(src)) + ".webp";
  const dst = outPath(projectId, group, name);
  if (!upToDate(src, dst)) {
    if (TOOLS.cwebp) {
      execFileSync("cwebp", ["-quiet", "-q", "78", "-resize", String(IMAGE_WIDTH), "0", src, "-o", dst]);
    } else if (TOOLS.ffmpeg) {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", `scale=${IMAGE_WIDTH}:-2`, "-quality", "78", dst]);
    } else {
      throw new Error("Neither cwebp nor ffmpeg is on PATH: cannot convert images.");
    }
  }
  return urlOf(dst);
}

/** Audio is copied as it is (mp3). */
function audio(projectId, src, group) {
  if (!src || !fs.existsSync(src)) return null;
  const dst = outPath(projectId, group, path.basename(src));
  if (!upToDate(src, dst)) fs.copyFileSync(src, dst);
  return urlOf(dst);
}

function probe(file) {
  if (!TOOLS.ffprobe || !fs.existsSync(file)) return {};
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file],
      { encoding: "utf8" },
    );
    const j = JSON.parse(out);
    const v = arr(j.streams).find((s) => s.codec_type === "video");
    return { durationS: num(j.format?.duration), width: v?.width ?? null, height: v?.height ?? null, hasAudio: arr(j.streams).some((s) => s.codec_type === "audio") };
  } catch {
    return {};
  }
}

/** Render -> 720x1280 H.264 for the page (byte-identical sources share one output). */
const videoByHash = new Map();
function video(projectId, src) {
  if (!src || !fs.existsSync(src)) return null;
  const hash = sha(src);
  const key = `${projectId}:${hash}`;
  if (videoByHash.has(key)) {
    const first = videoByHash.get(key);
    return { ...first, file: path.basename(src), duplicateOf: first.file };
  }
  const dst = outPath(projectId, "render", path.basename(src));
  if (!upToDate(src, dst)) {
    if (!TOOLS.ffmpeg) {
      fs.copyFileSync(src, dst);
    } else {
      execFileSync("ffmpeg", [
        "-v", "error", "-y", "-i", src,
        "-vf", "scale=720:-2", "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", dst,
      ]);
    }
  }
  const info = { src: urlOf(dst), file: path.basename(src), ...probe(src) };
  videoByHash.set(key, info);
  return { ...info, duplicateOf: null };
}

function listFiles(dir, pred) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (pred(p)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

/** Last manifest row per id, plus the number of attempts recorded. */
function genLog(rows, idKey) {
  const by = new Map();
  for (const r of rows) {
    const id = r[idKey];
    if (!id) continue;
    const prev = by.get(id);
    by.set(id, { last: r, attempts: (prev?.attempts ?? 0) + 1 });
  }
  return by;
}

// ---------------------------------------------------------------------------
// stages
// ---------------------------------------------------------------------------

function buildStory(src, scripts) {
  const bible = src.bible ? readJson(src.bible) : null;
  if (bible) {
    return {
      source: rel(src.bible),
      fromScript: false,
      title: pair(bible.title),
      genre: str(bible.genre),
      logline: pair(bible.logline),
      premise: str(bible.premise),
      tone: str(bible.tone),
      location: arr(bible.locations).map((l) => text(l.name)).filter(Boolean).join(" · ") || null,
      timeOfDay: text(bible.timeline?.season),
      characters: arr(bible.characters).map((c) => ({
        id: str(c.id),
        name: pair(c.name),
        age: num(c.age),
        role: text(c.role),
        look: text(c.look),
        note: text(c.want) ?? text(c.bio),
      })),
      endingQuestion: null,
      beats: [],
    };
  }
  const hi = scripts.hi;
  const en = scripts.en;
  const base = hi ?? en;
  if (!base) return null;
  const enChars = new Map(arr(en?.characters).map((c) => [c.id, c]));
  return {
    source: [scripts.hiFile, scripts.enFile].filter(Boolean).map(rel).join(", "),
    fromScript: true,
    title: { hi: str(hi?.title), en: str(en?.title) },
    genre: str(base.look) ?? null,
    logline: { hi: null, en: str(en?.logline ?? hi?.logline) },
    premise: null,
    tone: null,
    location: str(en?.location ?? hi?.location),
    timeOfDay: str(en?.time_of_day ?? hi?.time_of_day),
    characters: arr(base.characters).map((c) => {
      const e = enChars.get(c.id);
      return {
        id: str(c.id),
        name: { hi: str(c.name), en: str(e?.name ?? c.name) },
        age: num(c.age),
        role: str(e?.role ?? c.role),
        look: str(e?.look ?? c.look),
        note: str(e?.voice_note ?? c.voice_note),
      };
    }),
    endingQuestion: { hi: str(hi?.ending_question), en: str(en?.ending_question) },
    beats: arr(en?.beats ?? hi?.beats).map((b) => ({ id: str(b.id), action: str(b.action) })),
  };
}

function buildScript(scripts, reviewNotes, continuity) {
  const { hi, en } = scripts;
  if (!hi && !en) return null;
  const base = hi ?? en;
  const nameOf = new Map();
  for (const c of arr(en?.characters)) nameOf.set(c.id, { en: str(c.name), hi: null });
  for (const c of arr(hi?.characters)) nameOf.set(c.id, { ...(nameOf.get(c.id) ?? { en: null }), hi: str(c.name) });
  const enLines = new Map();
  for (const b of arr(en?.beats)) for (const l of arr(b.lines)) enLines.set(l.id, l);
  const hiLines = new Map();
  for (const b of arr(hi?.beats)) for (const l of arr(b.lines)) hiLines.set(l.id, l);
  const enBeats = new Map(arr(en?.beats).map((b) => [b.id, b]));

  const beats = arr(base.beats).map((b) => {
    const eb = enBeats.get(b.id);
    return {
      id: str(b.id),
      action: str(eb?.action ?? b.action),
      silentSeconds: num(b.silent_seconds),
      lines: arr(b.lines).map((l) => {
        const h = hiLines.get(l.id);
        const e = enLines.get(l.id);
        return {
          id: str(l.id),
          speaker: str(l.speaker),
          speakerName: nameOf.get(l.speaker) ?? null,
          targetSeconds: num(l.target_seconds),
          hi: h ? { text: str(h.text), tags: arr(h.emotion_tags).map(str) } : null,
          en: e ? { text: str(e.text), tags: arr(e.emotion_tags).map(str) } : null,
        };
      }),
    };
  });

  const critic = reviewNotes?.critic
    ? {
        pass: bool(reviewNotes.critic.pass),
        score: num(reviewNotes.critic.score),
        problems: arr(reviewNotes.critic.problems).map(str).filter(Boolean),
        fixCount: arr(reviewNotes.critic.fixes).length,
      }
    : null;
  const checksRaw = arr(continuity?.checks).length ? continuity.checks : arr(continuity?.shot_check?.checks);
  const continuityOut = continuity
    ? {
        owner: str(continuity.made_by ?? continuity.owner),
        checks: checksRaw.map((c) => ({ check: str(c.check), result: str(c.result), detail: str(c.detail) })),
      }
    : null;

  return {
    files: [scripts.hiFile, scripts.enFile].filter(Boolean).map(rel),
    totals: {
      hi: hi ? { title: str(hi.title), targetSeconds: num(hi.target_total_seconds ?? hi.total_target_seconds) } : null,
      en: en ? { title: str(en.title), targetSeconds: num(en.target_total_seconds ?? en.total_target_seconds) } : null,
    },
    languageNote: { hi: str(hi?.language_note), en: str(en?.language_note) },
    beats,
    lineCount: beats.reduce((n, b) => n + b.lines.length, 0),
    musicNote: str(en?.music_note ?? hi?.music_note),
    critic,
    continuity: continuityOut,
  };
}

function buildLook(projectId, dir, style) {
  const refDir = path.join(dir, "refs");
  const refPngs = listFiles(refDir, (p) => p.endsWith(".png") && !p.endsWith(".raw.png") && path.dirname(p) === refDir);
  if (!style && !refPngs.length) return { look: null, refImages: new Map() };
  const gen = genLog(readJsonl(path.join(refDir, "manifest.jsonl")), "shot_id");
  const refImages = new Map();
  for (const p of refPngs) refImages.set(path.basename(p, ".png"), image(projectId, p, "refs"));
  const used = new Set();
  const entry = (id, name, note, kind) => {
    used.add(id);
    const g = gen.get(id);
    return {
      id,
      kind,
      name: str(name) ?? id,
      note: str(note),
      image: refImages.get(id) ?? null,
      attempts: g?.attempts ?? 0,
      genSeconds: num(g?.last?.seconds),
    };
  };
  const characters = arr(style?.characters).map((c) => ({
    ...entry(c.id, c.name, c.wardrobe_lock, "character"),
    lead: bool(c.lead),
  }));
  const locations = arr(style?.locations).map((l) => entry(l.id, l.name, l.use_for ?? (arr(l.used_in_beats).length ? `Beats ${arr(l.used_in_beats).join(", ")}` : null), "location"));
  const props = arr(style?.key_props).map((p) => entry(p.id, p.name ?? p.id.replace(/_/g, " "), p.use_for ?? (arr(p.used_in_beats).length ? `Beats ${arr(p.used_in_beats).join(", ")}` : null), "prop"));
  const other = [...refImages.keys()].filter((id) => !used.has(id)).map((id) => entry(id, id.replace(/_/g, " "), null, "other"));
  const roles = style?.palette_roles ?? style?.palette_names ?? {};
  return {
    refImages,
    look: {
      file: style ? rel(path.join(dir, "style.json")) : null,
      summary: str(style?.look),
      styleBlock: str(style?.style_block),
      negativeRules: str(style?.negative_rules),
      palette: arr(style?.palette).map((hex) => ({ hex: str(hex), role: str(roles[hex]) })),
      characters,
      locations,
      props,
      other,
    },
  };
}

function buildStoryboard(projectId, dir, shotsJson) {
  const frameDir = path.join(dir, "frames");
  const gen = genLog(readJsonl(path.join(frameDir, "manifest.jsonl")), "shot_id");
  if (!shotsJson) return null;
  const shots = arr(shotsJson.shots).map((s) => {
    const png = path.join(frameDir, `${s.id}.png`);
    const g = gen.get(s.id);
    const frame = image(projectId, png, "frames");
    return {
      id: str(s.id),
      beatId: str(s.beat_id),
      lineIds: arr(s.line_ids).map(str),
      durationS: num(s.duration_s),
      framing: str(s.framing),
      action: str(s.action),
      cameraMove: str(s.camera_move),
      intensity: num(s.intensity),
      refs: arr(s.refs).map(str),
      onScreen: arr(s.on_screen ?? s.characters).map(str),
      lightState: str(s.light_state),
      note: str(s.note ?? s.subtitle_safe_note),
      subtitleSafe: s.subtitle_safe == null ? null : bool(s.subtitle_safe),
      prompt: str(s.prompt),
      frame,
      frameStatus: frame ? "ok" : g ? (str(g.last.status) ?? "failed") : "missing",
      attempts: g?.attempts ?? 0,
      genSeconds: num(g?.last?.seconds),
    };
  });
  return {
    file: rel(path.join(dir, "shots.json")),
    totalSeconds: num(shotsJson.total_duration_s),
    notes: arr(shotsJson.storyboard_notes ?? shotsJson.notes).map(str).filter(Boolean),
    shots,
    framesDone: shots.filter((s) => s.frame).length,
  };
}

/**
 * Resolve a path written in a scene file: absolute, repo-relative
 * ("content/..."), scene-relative ("voice/...") or voice-relative.
 */
function resolveIn(dir, p) {
  if (!p || typeof p !== "string") return null;
  const tries = path.isAbsolute(p) ? [p] : [path.resolve(ROOT, p), path.resolve(dir, p), path.resolve(dir, "voice", p)];
  return tries.find((f) => fs.existsSync(f)) ?? null;
}

const isPlaceholderPath = (f) => f.split(path.sep).includes("placeholder");

/**
 * Voice stage. The chosen take of a line is voice/<lang>/<line_id>.mp3. Retakes
 * and originals sit next to it (`<id>.t1.mp3` is the first take kept when a
 * retake replaced it, `<id>_t2.mp3` / `<id>.t2.mp3` are later takes, `<id>.v3.mp3`
 * the eleven_v3 comparison take). Anything under voice/placeholder/ is ignored.
 * Take numbers come from manifest.jsonl (`take`, default 1); the take in the cut
 * is the one byte-identical to the chosen file. Review verdicts come from
 * review.json and are attached to the take whose duration they measured.
 */
function buildVoice(projectId, dir) {
  const vdir = path.join(dir, "voice");
  const cast = readJson(path.join(dir, "cast.json"));
  const takesJson = arr(readJson(path.join(vdir, "takes.json")));
  const manifest = readJsonl(path.join(vdir, "manifest.jsonl")).filter((r) => !bool(r.placeholder) && !(r.file && String(r.file).split("/").includes("placeholder")));
  const review = arr(readJson(path.join(vdir, "review.json")));
  const ab = readJson(path.join(vdir, "ab.json"));
  const mp3s = listFiles(vdir, (p) => p.endsWith(".mp3") && !isPlaceholderPath(path.relative(vdir, p)));
  if (!cast && !takesJson.length && !mp3s.length) return null;

  const isV3 = (m) => /v3/.test(String(m ?? ""));
  const media = (f) => audio(projectId, f, path.join("voice", path.relative(vdir, path.dirname(f))));
  const durOf = (f) => probe(f).durationS ?? null;
  const shaCache = new Map();
  const hashOf = (f) => {
    if (!shaCache.has(f)) shaCache.set(f, sha(f));
    return shaCache.get(f);
  };

  // Directions from takes.json (v3 comparison directions belong to the A/B block).
  const lines = new Map();
  const lineOf = (lang, lineId) => {
    const k = `${lang}:${lineId}`;
    if (!lines.has(k)) lines.set(k, { lineId, lang, speaker: null, targetSeconds: null, directions: [] });
    return lines.get(k);
  };
  for (const t of takesJson) {
    if (!t.line_id || !t.lang || isV3(t.model) || isV3(t.take_suffix)) continue;
    const l = lineOf(str(t.lang), str(t.line_id));
    l.speaker ??= str(t.speaker);
    l.targetSeconds ??= num(t.target_seconds);
    l.directions.push({ suffix: str(t.take_suffix), text: str(t.text), note: str(t.note), model: str(t.model) });
  }

  // Manifest rows per line: v4 takes numbered, v3 rows kept for the A/B block.
  const rowsBy = new Map();
  for (const r of manifest) {
    if (!r.line_id || !r.lang || isV3(r.model)) continue;
    const k = `${r.lang}:${r.line_id}`;
    if (!rowsBy.has(k)) rowsBy.set(k, []);
    rowsBy.get(k).push(r);
  }

  for (const f of mp3s) {
    const parts = path.relative(vdir, f).split(path.sep);
    const lang = parts.length === 2 && (parts[0] === "hi" || parts[0] === "en") ? parts[0] : null;
    const m = path.basename(f).match(/^(l\d+)\.mp3$/);
    if (lang && m) lineOf(lang, m[1]);
  }

  for (const l of lines.values()) {
    const ldir = path.join(vdir, l.lang);
    const chosenFile = path.join(ldir, `${l.lineId}.mp3`);
    const rows = rowsBy.get(`${l.lang}:${l.lineId}`) ?? [];
    l.speaker ??= str(rows[0]?.speaker);
    // Take files on disk: take 1 is the kept original if a retake replaced it.
    const takeFiles = new Map(); // take -> file
    const t1 = path.join(ldir, `${l.lineId}.t1.mp3`);
    if (fs.existsSync(t1)) takeFiles.set(1, t1);
    for (const f of listFiles(ldir, (p) => new RegExp(`^${l.lineId}[._]t(\\d+)\\.mp3$`).test(path.basename(p)))) {
      takeFiles.set(Number(path.basename(f).match(/[._]t(\d+)\.mp3$/)[1]), f);
    }
    for (const r of rows) {
      const n = num(r.take) ?? 1;
      const f = resolveIn(dir, r.file);
      if (n > 1 && f && !takeFiles.has(n)) takeFiles.set(n, f);
    }
    const chosenExists = fs.existsSync(chosenFile);
    if (chosenExists && !takeFiles.has(1)) takeFiles.set(1, chosenFile);
    let chosenTake = null;
    if (chosenExists) {
      const h = hashOf(chosenFile);
      for (const [n, f] of [...takeFiles.entries()].sort((a, b) => b[0] - a[0])) {
        if (f === chosenFile || hashOf(f) === h) {
          chosenTake = n;
          break;
        }
      }
      chosenTake ??= Math.max(1, ...takeFiles.keys());
    }
    const rowFor = (n) => rows.find((r) => (num(r.take) ?? 1) === n) ?? null;

    // Review entries (v4 only) attached to the take whose duration they report.
    const reviews = review.filter((x) => x.line_id === l.lineId && x.lang === l.lang && !isV3(x.model));
    const reviewFor = (x) => {
      if (num(x.take) != null || num(x.take_no) != null) return num(x.take) ?? num(x.take_no);
      const d = num(x.duration_s);
      if (d != null) for (const n of [...takeFiles.keys()].sort((x, y) => x - y)) if (Math.abs((num(rowFor(n)?.duration_s) ?? -1) - d) < 0.005) return n;
      return 1;
    };

    l.takes = [...takeFiles.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, f]) => {
        const row = rowFor(n);
        const rv = reviews.find((x) => reviewFor(x) === n) ?? null;
        const file = n === chosenTake && chosenExists ? chosenFile : f;
        return {
          take: n,
          inCut: n === chosenTake,
          file: path.relative(dir, file),
          src: media(file),
          durationS: durOf(file) ?? num(row?.duration_s),
          model: str(row?.model),
          text: str(row?.text),
          review: rv
            ? {
                verdict: str(rv.verdict),
                reason: str(rv.reason),
                transcript: str(rv.transcript),
                speechS: num(rv.speech_s),
                targetS: num(rv.target_s),
                retakeText: str(rv.retake_text),
                retakeTake: num(rv.retake_take_no),
              }
            : null,
        };
      });
    l.chosen = l.takes.find((t) => t.inCut) ?? null;
  }

  const out = [...lines.values()].sort((a, b) => (a.lang === b.lang ? a.lineId.localeCompare(b.lineId) : a.lang === "hi" ? -1 : 1));

  // v4 / v3 pairs from ab.json. The v4 side was take 1: when a retake replaced
  // the line, the kept original (<id>.t1.mp3) is what was compared.
  let abOut = null;
  if (ab && arr(ab.pairs).length) {
    const CHECK = { check1: "words", check2: "tags", check3: "length", check4: "quiet tag", check_1_words: "words", check_2_tags: "tags", check_3_length: "length", check_4_quiet_tag: "quiet tag" };
    const side = (p, model) => {
      const raw = p[model];
      const named = resolveIn(dir, typeof raw === "string" ? raw : raw?.file);
      let f = named;
      if (model === "v4" && named) {
        const t1 = named.replace(/\.mp3$/, ".t1.mp3");
        if (fs.existsSync(t1)) f = t1;
      }
      const lang = f ? (path.relative(vdir, f).split(path.sep)[0] ?? null) : null;
      return {
        file: f ? path.relative(dir, f) : null,
        src: f ? media(f) : null,
        lang: lang === "hi" || lang === "en" ? lang : null,
        durationS: f ? durOf(f) : null,
        transcript: str(raw?.transcript),
        notes: str(raw?.notes),
      };
    };
    const pairs = arr(ab.pairs).map((p) => {
      const v4 = side(p, "v4");
      const v3 = side(p, "v3");
      let checks = [];
      if (p.v4?.checks && typeof p.v4.checks === "object") {
        checks = Object.keys(p.v4.checks).map((k) => ({ name: k.replace(/_/g, " "), v4: str(p.v4.checks[k]), v3: str(p.v3?.checks?.[k]), result: null }));
      } else {
        checks = Object.keys(p).filter((k) => /^check\d/.test(k)).map((k) => ({ name: CHECK[k] ?? k, v4: str(p[k]?.v4), v3: str(p[k]?.v3), result: str(p[k]?.result) }));
      }
      const lang = v4.lang ?? v3.lang ?? "hi";
      return {
        lineId: str(p.line_id),
        lang,
        speaker: str(p.speaker) ?? str(lineOf(lang, str(p.line_id)).speaker),
        text: str(p.text) ?? str(takesJson.find((t) => t.line_id === p.line_id && t.lang === lang)?.text),
        v4,
        v3,
        checks,
        winner: str(p.winner),
        score: str(p.score),
        note: str(p.caveat ?? p.note),
      };
    });
    const tallyRaw = Object.entries(ab.result ?? {}).find(([k]) => /tally/.test(k))?.[1] ?? Object.entries(ab).find(([k]) => /tally/.test(k))?.[1] ?? {};
    abOut = {
      file: rel(path.join(vdir, "ab.json")),
      decision: str(ab.decision),
      pairs,
      tally: Object.entries(tallyRaw).map(([k, v]) => ({ model: k.replace(/^eleven_/, ""), count: num(v) ?? 0 })),
      outcome: str(ab.result?.d009_status ?? ab.d009_effect),
      evidence: str(ab.result?.strength_of_evidence),
      notChecked: (Array.isArray(ab.not_checked ?? ab.not_verified) ? ab.not_checked ?? ab.not_verified : [ab.not_checked ?? ab.not_verified]).map(str).filter(Boolean),
    };
  }

  const inCut = out.filter((l) => l.chosen);
  return {
    castStatus: str(cast?.status),
    castNote: str(cast?.status_reason),
    cast: arr(cast?.characters).map((c) => ({ id: str(c.id), voiceName: str(c.voice_name), voiceId: str(c.voice_id), why: str(c.why) })),
    lines: out,
    reviewed: review.filter((x) => !isV3(x.model)).length,
    linesWithTake: inCut.length,
    retakesInCut: inCut.filter((l) => l.chosen.take > 1).length,
    flaggedInCut: inCut.filter((l) => l.chosen.review?.verdict && l.chosen.review.verdict !== "ok").length,
    recordedTakes: out.reduce((n, l) => n + l.takes.length, 0),
    ab: abOut,
  };
}

function buildSound(projectId, dir) {
  const sdir = path.join(dir, "sound");
  const cues = readJson(path.join(sdir, "cues.json"));
  const manifest = new Map(readJsonl(path.join(sdir, "manifest.jsonl")).map((r) => [r.cue_id, r]));
  if (!cues && !manifest.size) return null;
  const list = arr(cues?.cues).map((c) => {
    const m = manifest.get(c.id);
    const f = path.join(sdir, `${c.id}.mp3`);
    return {
      id: str(c.id),
      type: str(c.type),
      role: str(c.role),
      model: str(c.model),
      shot: str(c.shot),
      startS: num(c.start_s),
      endS: num(c.end_s),
      gainDb: num(c.gain_db),
      loop: bool(c.loop),
      prompt: str(c.prompt),
      note: str(c.mix_note ?? c.note ?? c.trim_note),
      audio: audio(projectId, f, "sound"),
      placeholder: m ? bool(m.placeholder) : false,
      placeholderKind: str(m?.placeholder_kind),
    };
  });
  return {
    status: str(cues?.status),
    statusNote: str(cues?.status_note),
    loudness: str(cues?.mix?.loudness_target),
    rules: arr(cues?.mix?.rules).map(str).filter(Boolean),
    cues: list,
    realCues: list.filter((c) => c.audio && !c.placeholder).length,
    placeholderCues: list.filter((c) => c.placeholder).length,
  };
}

function buildEdit(projectId, dir, frameUrls) {
  const timelines = [];
  for (const lang of ["hi", "en"]) {
    const file = path.join(dir, `timeline.${lang}.json`);
    const t = readJson(file);
    if (!t) continue;
    const fps = num(t.fps) ?? 30;
    const clip = (c) => ({ id: str(c.id), start: num(c.start) ?? 0, duration: num(c.duration) ?? 0, placeholder: bool(c.placeholder) });
    const placeholderIds = new Set([...arr(t.meta?.placeholders?.dialogue), ...arr(t.meta?.placeholders?.sound)]);
    const lane = (kind, items) => ({
      kind,
      clips: arr(items).map((c) => {
        const x = clip(c);
        return { ...x, placeholder: x.placeholder || placeholderIds.has(String(x.id).split("#")[0]) };
      }),
    });
    timelines.push({
      lang,
      file: rel(file),
      fps,
      durationFrames: num(t.durationFrames),
      seconds: num(t.durationFrames) != null ? Math.round((t.durationFrames / fps) * 1000) / 1000 : null,
      plannedSeconds: num(t.meta?.planned_seconds),
      builtBy: str(t.meta?.built_by),
      shots: arr(t.shots).map((s) => ({
        id: str(s.id),
        start: num(s.start) ?? 0,
        duration: num(s.duration) ?? 0,
        image: frameUrls.get(String(s.id)) ?? null,
        move: str(s.move?.preset),
      })),
      lanes: [lane("dialogue", t.audio?.dialogue), lane("music", t.audio?.music), lane("sfx", t.audio?.sfx)],
      notes: arr(t.meta?.notes).map(str).filter(Boolean),
      slated: arr(t.meta?.placeholders?.frames_slated).map(str),
    });
  }
  const subs = {};
  for (const lang of ["hi", "en"]) {
    const s = readJson(path.join(dir, `subs.${lang}.json`));
    if (s) subs[lang] = { file: rel(path.join(dir, `subs.${lang}.json`)), cues: arr(s.cues).length, sample: arr(s.cues).slice(0, 3).map((c) => ({ start: num(c.start ?? c.startMs), end: num(c.end ?? c.endMs), text: str(c.text ?? arr(c.lines).join(" ")) })) };
  }
  const reviewCuts = listFiles(path.join(dir, "render"), (p) => /\.review\.mp4$/.test(p)).map((p) => {
    const v = video(projectId, p);
    return v ? { ...v, lang: path.basename(p).split(".")[1] ?? null } : null;
  }).filter(Boolean).sort((a, b) => (a.lang === "hi" ? -1 : b.lang === "hi" ? 1 : 0));
  if (!timelines.length && !Object.keys(subs).length && !reviewCuts.length) return null;
  return { timelines, subs, reviewCuts };
}

function buildScreening(dir) {
  const s = readJson(path.join(dir, "screening.json"));
  if (!s) return null;
  const items = arr(s.problems ?? s.issues ?? s.fixes ?? s.findings);
  const scores = s.scores && typeof s.scores === "object" ? s.scores : {};
  return {
    file: rel(path.join(dir, "screening.json")),
    reviewer: str(s.reviewer),
    round: num(s.round),
    date: str(s.date),
    overall: num(s.scores?.overall?.score ?? s.scores?.overall),
    verdict: str(s.verdict ?? s.result ?? (s.pass == null ? null : bool(s.pass) ? "pass" : "fail")),
    pass: s.pass == null ? null : bool(s.pass),
    summary: str(s.summary ?? s.note),
    filesScreened: arr(s.files_screened).map(str),
    scores: Object.entries(scores).filter(([k]) => k !== "overall").map(([k, v]) => ({
      name: k.replace(/_/g, " "),
      score: num(v?.score ?? v),
      basis: str(v?.basis),
    })),
    holdsUp: arr(s.what_holds_up).map(str).filter(Boolean),
    checksRun: arr(s.checks_run).map(str).filter(Boolean),
    checksNotRun: arr(s.checks_not_run).map(str).filter(Boolean),
    shots: arr(s.shot_by_shot).map((x) => ({ shot: str(x.shot), t: str(x.t), note: str(x.note) })),
    items: items.map((i) =>
      typeof i === "string"
        ? { text: i, owner: null, severity: null, fix: null }
        : { text: str(i.issue ?? i.text ?? i.note ?? JSON.stringify(i)), owner: str(i.owner ?? i.agent), severity: str(i.severity), fix: str(i.fix) },
    ),
  };
}

function buildFinal(projectId, dir) {
  const renders = listFiles(path.join(dir, "render"), (p) => p.endsWith(".mp4") && !/\.review\.mp4$/.test(p))
    .map((p) => {
      const v = video(projectId, p);
      const m = path.basename(p).match(/\.(hi|en)\.mp4$/);
      return v ? { ...v, lang: m ? m[1] : null } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.lang === "hi" ? -1 : b.lang === "hi" ? 1 : 0));
  return renders.length ? { renders } : null;
}

// ---------------------------------------------------------------------------
// one project
// ---------------------------------------------------------------------------

function stageState(kind, p) {
  const S = (state, label, summary) => ({ state, label, summary });
  switch (kind) {
    case "story":
      return p.story ? S("done", "Done", p.story.fromScript ? "Taken from the scene script (no bible.json for a proof scene)" : "Series bible") : S("waiting", "Not started", null);
    case "script": {
      const sc = p.script;
      if (!sc) return S("waiting", "Not started", null);
      const both = sc.totals.hi && sc.totals.en;
      return both ? S("done", "Done", `${sc.lineCount} lines in Hinglish and English`) : S("running", "One language", `${sc.lineCount} lines, ${sc.totals.hi ? "Hinglish" : "English"} only`);
    }
    case "look": {
      const lk = p.look;
      if (!lk) return S("waiting", "Not started", null);
      const all = [...lk.characters, ...lk.locations];
      const done = all.filter((x) => x.image).length;
      return done === all.length && all.length ? S("done", "Done", `${lk.characters.length} character sheets, ${lk.locations.length} location plates`) : S("running", `${done} of ${all.length}`, "Some sheets or plates are missing");
    }
    case "storyboard": {
      const sb = p.storyboard;
      if (!sb) return S("waiting", "Not started", null);
      return sb.framesDone === sb.shots.length ? S("done", "Done", `${sb.shots.length} shots, every frame drawn`) : S("running", `${sb.framesDone} of ${sb.shots.length} frames`, `${sb.shots.length - sb.framesDone} frames not drawn yet`);
    }
    case "voice": {
      const v = p.voice;
      if (!v) return S("waiting", "Not started", null);
      const total = v.lines.length;
      if (!v.linesWithTake) return S("waiting", "Not recorded", `${total} lines directed, no audio yet`);
      const parts = [`${v.linesWithTake} of ${total} lines have a take in the cut`];
      if (v.retakesInCut) parts.push(`${v.retakesInCut} of them retakes`);
      if (v.flaggedInCut) parts.push(`${v.flaggedInCut} still flagged in review`);
      return S(v.linesWithTake === total ? "done" : "running", v.linesWithTake === total ? "Recorded" : "Partly recorded", parts.join(", "));
    }
    case "sound": {
      const s = p.sound;
      if (!s) return S("waiting", "Not started", null);
      if (s.realCues) return S(s.placeholderCues ? "running" : "done", s.placeholderCues ? "Partly made" : "Done", `${s.realCues} of ${s.cues.length} cues made`);
      if (s.placeholderCues) return S("running", "Placeholder", `${s.cues.length} cues written, all silent stand-ins`);
      return S("waiting", "Not made", `${s.cues.length} cues written`);
    }
    case "edit": {
      const e = p.edit;
      if (!e || !e.timelines.length) return S("waiting", "Not started", null);
      const ph = e.timelines.some((t) => t.lanes.some((l) => l.clips.some((c) => c.placeholder)));
      return S("done", "Done", `${e.timelines.length} timeline${e.timelines.length > 1 ? "s" : ""}${ph ? ", cut on placeholder audio" : ""}`);
    }
    case "screening":
      if (!p.screening) return S("waiting", "Not screened", "No screening report yet");
      if (p.screening.pass === false) return S("running", "Failed · fixes filed", `${p.screening.items.length} problems filed to their owners`);
      return S(
        "done",
        p.screening.pass ? `Passed${p.screening.overall != null ? ` · ${p.screening.overall}/10` : ""}` : "Done",
        p.screening.summary ??
          ([p.screening.round != null ? `Round ${p.screening.round}` : null, p.screening.overall != null ? `overall ${p.screening.overall}/10` : null, p.screening.items.length ? `${p.screening.items.length} problems filed` : null].filter(Boolean).join(", ") ||
            null),
      );
    case "final":
      return p.final ? S("done", "Done", `${p.final.renders.length} render${p.final.renders.length > 1 ? "s" : ""}`) : S("waiting", "Not rendered", null);
    default:
      return S("waiting", "Not started", null);
  }
}

function buildProject(src) {
  const dir = path.resolve(ROOT, src.dir);
  if (!fs.existsSync(dir)) {
    warn(`source ${src.id}: ${src.dir} does not exist; skipped`);
    return null;
  }
  if (!src.bible && fs.existsSync(path.join(dir, "bible.json"))) src.bible = path.join(dir, "bible.json");
  else if (src.bible) src.bible = path.resolve(ROOT, src.bible);
  log(`${src.id}: ${src.dir}`);

  const scripts = {
    hi: readJson(path.join(dir, "script.hi.json")),
    en: readJson(path.join(dir, "script.en.json")),
  };
  scripts.hiFile = scripts.hi ? path.join(dir, "script.hi.json") : null;
  scripts.enFile = scripts.en ? path.join(dir, "script.en.json") : null;
  const style = readJson(path.join(dir, "style.json"));
  const shotsJson = readJson(path.join(dir, "shots.json"));
  const reviewNotes = readJson(path.join(dir, "review-notes.json"));
  const continuity = readJson(path.join(dir, "continuity.json"));

  const p = { id: src.id, label: src.label ?? src.id, source: rel(dir) };
  p.story = buildStory(src, scripts);
  p.script = buildScript(scripts, reviewNotes, continuity);
  const { look } = buildLook(src.id, dir, style);
  p.look = look;
  p.storyboard = buildStoryboard(src.id, dir, shotsJson);
  const frameUrls = new Map((p.storyboard?.shots ?? []).filter((s) => s.frame).map((s) => [s.id, s.frame]));
  p.voice = buildVoice(src.id, dir);
  p.sound = buildSound(src.id, dir);
  p.edit = buildEdit(src.id, dir, frameUrls);
  p.screening = buildScreening(dir);
  p.final = buildFinal(src.id, dir);

  p.title = p.story?.title ?? { hi: null, en: src.label ?? src.id };
  p.look_kind = str(style?.id)?.includes("flat") || src.dir.includes("flat2d") ? "flat2d" : "photoreal";
  p.still = frameUrls.values().next().value ?? look?.locations.find((l) => l.image)?.image ?? null;
  p.stages = Object.fromEntries(
    ["story", "script", "look", "storyboard", "voice", "sound", "edit", "screening", "final"].map((k) => [k, stageState(k, p)]),
  );

  const placeholders = [];
  if (p.voice && p.voice.linesWithTake < p.voice.lines.length) placeholders.push(`Voice: ${p.voice.lines.length - p.voice.linesWithTake} of ${p.voice.lines.length} lines have no recorded take`);
  if (p.sound?.placeholderCues) placeholders.push(`Sound: ${p.sound.placeholderCues} of ${p.sound.cues.length} cues are silent stand-ins`);
  if (p.storyboard && p.storyboard.framesDone < p.storyboard.shots.length) placeholders.push(`Frames: ${p.storyboard.shots.length - p.storyboard.framesDone} of ${p.storyboard.shots.length} not drawn`);
  for (const r of p.final?.renders ?? []) if (r.duplicateOf) placeholders.push(`Final cut: ${r.file} is byte-identical to ${r.duplicateOf}`);
  p.placeholders = placeholders;
  return p;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const sources = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--source") continue;
    const spec = argv[++i];
    if (!spec || !spec.includes("=")) throw new Error(`--source needs id=dir, got ${spec}`);
    const [head, ...opts] = spec.split(/:(?=[a-z]+=)/);
    const [id, dir] = [head.slice(0, head.indexOf("=")), head.slice(head.indexOf("=") + 1)];
    const s = { id, dir };
    for (const o of opts) {
      const k = o.slice(0, o.indexOf("="));
      const v = o.slice(o.indexOf("=") + 1).replace(/^"|"$/g, "");
      if (k === "bible") s.bible = v;
      if (k === "label") s.label = v;
    }
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`source id must be lower-case letters, digits or dashes: ${id}`);
    sources.push(s);
  }
  return sources.length ? sources : DEFAULT_SOURCES.map((s) => ({ ...s }));
}

function cleanStale() {
  if (!fs.existsSync(OUT)) return;
  for (const f of listFiles(OUT, () => true)) {
    if (f === path.join(OUT, "studio.json")) continue;
    if (!produced.has(f)) fs.rmSync(f);
  }
  // empty dirs
  const prune = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) prune(path.join(d, e.name));
    if (d !== OUT && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
  };
  prune(OUT);
}

function main() {
  const sources = parseArgs(process.argv.slice(2));
  fs.mkdirSync(OUT, { recursive: true });
  const projects = sources.map(buildProject).filter(Boolean);
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    generator: "app/scripts/build-studio.mjs",
    projects,
    warnings,
  };
  fs.writeFileSync(path.join(OUT, "studio.json"), JSON.stringify(manifest, null, 1) + "\n");
  cleanStale();
  log(`wrote ${rel(path.join(OUT, "studio.json"))}: ${projects.length} project(s), ${produced.size} media file(s), ${warnings.length} warning(s)`);
  for (const p of projects) {
    log(`  ${p.id}: ${Object.entries(p.stages).map(([k, s]) => `${k}=${s.state}`).join(" ")}`);
    for (const ph of p.placeholders) log(`    placeholder: ${ph}`);
  }
}

main();
