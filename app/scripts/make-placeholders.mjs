#!/usr/bin/env node
// Regenerate the placeholder content the app is built and tested against.
//
//   node scripts/make-placeholders.mjs [--force] [--proof-root <dir>] [--no-proof]
//   (or: pnpm placeholders)
//
// Writes app/public/media/catalog.json and, for series1 and series2,
// series.json plus every file it names: 20-second H.264 1080x1920 test videos
// (a dark card naming the series, the slot, the language and the shot), one
// still per shot, subtitle JSON with a Devanagari + Latin line, cast voice
// samples and stills. Everything written here is marked `placeholder: true`.
//
// Safe to rerun at any time:
// - An episode or glimpse whose series.json entry says `placeholder: false` is
//   finished work. Its entry and its files are left exactly as they are.
// - The same holds for the series-level text, cast and art when the series
//   says `placeholder: false`, and for catalog teasers.
// - --force ignores that and rewrites everything as placeholders.
//
// Only ten videos per language pair are actually rendered (per series: shared,
// branch A, branch B, glimpse A, glimpse B). Each episode gets its own COPY at
// its final path, so a finished render can later overwrite one episode without
// touching the others.
//
// If content/proof/photoreal/render/*.mp4 or content/proof/flat2d/render/*.mp4
// exist, they stand in for s1e01 / s2e01 (still flagged as placeholders).
//
// Needs ffmpeg and ffprobe on PATH. Card text is drawn with the Chromium that
// Playwright installs (pnpm exec playwright install chromium); without it the
// cards are plain colour.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(APP_DIR, "public");
const MEDIA_DIR = path.join(PUBLIC_DIR, "media");
const WORK_DIR = path.join(APP_DIR, "node_modules", ".cache", "unwritten-placeholders");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const NO_PROOF = args.includes("--no-proof");
const proofRootArg = args.indexOf("--proof-root");
const PROOF_ROOT = proofRootArg >= 0 ? path.resolve(args[proofRootArg + 1]) : path.resolve(APP_DIR, "..", "content", "proof");

const LANGS = ["hi", "en"];
const W = 1080;
const H = 1920;
const FPS = 30;

// The two cuts deliberately differ in shot timing and total length, as the real
// dubs will, so "stay on the same shot when the language changes" can be tested.
const SHOT_MS = {
  hi: [4000, 4000, 4000, 4000, 4000], // 20.0 s
  en: [3000, 4500, 3500, 4000, 4000], // 19.0 s
};
const SHOT_COUNT = SHOT_MS.hi.length;
const BLIP_HZ = { hi: 440, en: 660 };
const LANG_LABEL = { hi: "Audio: हिंदी (Hinglish)", en: "Audio: English" };

const SLOTS = {
  shared: { label: "Shared episodes", hue: 222 },
  branchA: { label: "Branch A", hue: 262 },
  branchB: { label: "Branch B", hue: 32 },
  glimpseA: { label: "Glimpse of choice A", hue: 282 },
  glimpseB: { label: "Glimpse of choice B", hue: 14 },
};

// ---------------------------------------------------------------------------
// Placeholder story text. Titles, questions, choices and cast names follow the
// loglines the Arbiter picked (docs/decisions.md D-003, D-004) so layouts are
// tested with realistic lines. None of it is final: the story team replaces
// it, and all of it is flagged placeholder. Episodes whose titles are not
// decided yet are "भाग N" / "Part N".
// ---------------------------------------------------------------------------

const part = (n) => ({ hi: `भाग ${n}`, en: `Part ${n}` });

const SERIES = [
  {
    id: "series1",
    n: 1,
    proofStyle: "photoreal",
    visualStyle: "photoreal",
    genre: "Con thriller",
    title: { hi: "नौवीं पहली रात", en: "The Ninth First Night" },
    synopsis: {
      hi: "आठ शादियाँ, और आठ बार सुबह से पहले गहने लेकर ग़ायब। नौवीं रात दूल्हे ने आँखें खोलीं और कहा: 'पूरी पुड़िया डाल दो।'",
      en: "Kiran has married eight men and vanished with the jewellery before each sunrise. On her ninth wedding night the groom opens his eyes and tells her to pour in the whole sachet.",
    },
    question: {
      hi: "मौसी को इसके हवाले करूँ, या इसे मौसी के?",
      en: "Do I hand Mausi to him, or him to Mausi?",
    },
    questionContext: { hi: "Phone speaker पर है। आदित्य उसके होंठ देख रहा है।", en: "The call is on speaker. Aditya is watching her mouth." },
    choices: {
      A: {
        label: { hi: "हाँ मौसी, पी लिया", en: "Yes, he drank it" },
        meaning: { hi: "बिल्लू को इशारा: तीन बजे गाड़ी ले आओ। मौसी आदित्य के हवाले।", en: "Signal to Billu: bring the car at three. Mausi is handed to Aditya." },
      },
      B: {
        label: { hi: "मौसी... दूध फट गया", en: "The milk has split" },
        meaning: { hi: "बिल्लू को इशारा: लड़कों को ऊपर ले आओ। आदित्य मौसी के हवाले।", en: "Signal to Billu: bring the boys up. Aditya is handed to Mausi." },
      },
    },
    cast: [
      { id: "kiran", name: { hi: "किरण", en: "Kiran" }, role: { hi: "दुल्हन। आज रात उसका नाम 'स्नेहा' है।", en: "The bride. Tonight her name is 'Sneha'." } },
      { id: "aditya", name: { hi: "आदित्य", en: "Aditya" }, role: { hi: "दूल्हा। Pharmacist, और चौदह महीने से तैयार।", en: "The groom. A pharmacist, fourteen months in the planning." } },
      { id: "mausi", name: { hi: "शकुन मौसी", en: "Shakun Mausi" }, role: { hi: "Marriage bureau चलाती हैं। दुल्हनें वही भेजती हैं।", en: "Runs the marriage bureau that sends the brides." } },
      { id: "billu", name: { hi: "बिल्लू", en: "Billu" }, role: { hi: "'भाई', जो गली में car लेकर खड़ा है।", en: "The 'brother', waiting in the lane with the car." } },
    ],
    branchAfterEpisode: 2,
    seededTallies: { A: 6241, B: 5873 },
    episodes: [
      { id: "s1e01", kind: "shared", number: 1, title: part(1) },
      { id: "s1e02", kind: "shared", number: 2, title: part(2) },
      { id: "s1a01", kind: "branchA", number: 3, title: part(3) },
      { id: "s1a02", kind: "branchA", number: 4, title: part(4) },
      { id: "s1a03", kind: "branchA", number: 5, title: part(5) },
      { id: "s1b01", kind: "branchB", number: 3, title: part(3) },
      { id: "s1b02", kind: "branchB", number: 4, title: part(4) },
      { id: "s1b03", kind: "branchB", number: 5, title: part(5) },
    ],
    glimpses: { A: "s1ga", B: "s1gb" },
  },
  {
    id: "series2",
    n: 2,
    proofStyle: "flat2d",
    visualStyle: "illustration",
    genre: "Cop caper",
    title: { hi: "Duplicate थाना", en: "The Duplicate Thana" },
    synopsis: {
      hi: "इमलीपुर में कोई नंदिनी के थाने नहीं आता। Railway line के उस पार, बंद पड़े talkies में, एक आदमी पूरी वर्दी पहनकर दूसरा थाना चला रहा है, और उससे अच्छा चला रहा है।",
      en: "Nobody in Imlipur brings a complaint to Nandini's thana. Across the railway line, in a shut-down cinema, a man in a perfect uniform runs a second police station, and runs it better.",
    },
    question: {
      hi: "इन्हें हथकड़ी लगाऊँ, या आज रात Inspector बनने दूँ?",
      en: "Do I cuff him, or let him be Inspector tonight?",
    },
    questionContext: { hi: "आधी रात को भैयाजी ने 'Inspector साहब' को godown बुलाया है। निराला के पास सिर्फ़ लकड़ी की revolver है।", en: "Bhaiyaji has called his 'Inspector' to the godown at midnight. All Nirala has is a wooden revolver." },
    choices: {
      A: { label: { hi: "हथकड़ी", en: "Cuff him" } },
      B: { label: { hi: "एक रात और", en: "One more night" } },
    },
    cast: [
      { id: "nandini", name: { hi: "नंदिनी जोशी", en: "Nandini Joshi" }, role: { hi: "Sub-Inspector। पहली posting का छठा हफ़्ता।", en: "Sub-Inspector. Six weeks into her first posting." } },
      { id: "nirala", name: { hi: "सुधीर निराला", en: "Sudhir Nirala" }, role: { hi: "'Inspector'। उसका थाना किसी record में नहीं है।", en: "'Inspector'. His thana is on nobody's record." } },
      { id: "tripathi", name: { hi: "दयाशंकर त्रिपाठी", en: "Dayashankar Tripathi" }, role: { hi: "असली SHO। चौदह महीने से एक भी FIR नहीं।", en: "The real SHO. Not one FIR in fourteen months." } },
      { id: "bhaiyaji", name: { hi: "भैयाजी", en: "Bhaiyaji" }, role: { hi: "Ration godown और आधा कस्बा इन्हीं का है।", en: "Owns the ration godown and most of the town." } },
      { id: "pushpa", name: { hi: "पुष्पा कुमारी", en: "Pushpa Kumari" }, role: { hi: "Head Constable। सब जानती हैं, बस किसी ने पूछा नहीं।", en: "Head Constable. Knows everything; nobody asked." } },
    ],
    branchAfterEpisode: 3,
    seededTallies: { A: 3120, B: 3987 },
    episodes: [
      { id: "s2e01", kind: "shared", number: 1, title: { hi: "Token सात", en: "Token Seven" } },
      { id: "s2e02", kind: "shared", number: 2, title: { hi: "Charge", en: "Handing Over" } },
      { id: "s2e03", kind: "shared", number: 3, title: { hi: "बारह बजे", en: "Midnight" } },
      { id: "s2a01", kind: "branchA", number: 4, title: part(4) },
      { id: "s2a02", kind: "branchA", number: 5, title: part(5) },
      { id: "s2a03", kind: "branchA", number: 6, title: part(6) },
      { id: "s2b01", kind: "branchB", number: 4, title: part(4) },
      { id: "s2b02", kind: "branchB", number: 5, title: part(5) },
      { id: "s2b03", kind: "branchB", number: 6, title: part(6) },
    ],
    glimpses: { A: "s2ga", B: "s2gb" },
  },
];

const TEASERS = [
  {
    id: "t1",
    title: { hi: "आख़िरी Local", en: "The Last Local" },
    hook: { hi: "रात की आख़िरी train में एक seat हमेशा खाली रहती है।", en: "On the last train of the night, one seat is always left empty." },
    visualStyle: "Photoreal",
    placeholder: true,
  },
  {
    id: "t2",
    title: { hi: "शादी Cancel", en: "Wedding, Cancelled" },
    hook: { hi: "बारात दरवाज़े पर है और दुल्हन का phone switched off।", en: "The baraat is at the door and the bride's phone is switched off." },
    visualStyle: "2D illustration",
    placeholder: true,
  },
  {
    id: "t3",
    title: { hi: "Room 207", en: "Room 207" },
    hook: { hi: "Hostel की warden कहती है, उस कमरे में कोई नहीं रहता।", en: "The hostel warden says nobody lives in that room." },
    visualStyle: "Photoreal",
    placeholder: true,
  },
];

const SUBTITLE_LINES = {
  hi: [
    (id) => `यह ${id} का placeholder है।`,
    () => "असली episode अभी studio में बन रहा है।",
    () => "Subtitles ऐसे ही दिखेंगे: हिंदी और English साथ में।",
    () => "रुको! यह file किसने खोली?",
    () => "आगे क्या होगा? देखते रहिए।",
  ],
  en: [
    (id) => `This is a placeholder for ${id}.`,
    () => "The real episode is still in the studio.",
    () => "Subtitles will look like this, word by word.",
    () => "Wait! Who opened this file?",
    () => "What happens next? Keep watching.",
  ],
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const log = (...m) => console.log("[placeholders]", ...m);
const warn = (...m) => console.warn("[placeholders] WARN", ...m);

function run(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copy(src, dest) {
  mkdirp(path.dirname(dest));
  // A real copy, never a hard link: a finished render may later be written
  // over one episode's file and must not change the others.
  fs.copyFileSync(src, dest);
}

function writeJson(file, value) {
  mkdirp(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function readJsonIfAny(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function probeDurationMs(file) {
  const out = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Math.round(Number(out.trim()) * 1000);
}

function cumulative(durations) {
  let t = 0;
  return durations.map((d) => {
    const timing = { startMs: t, endMs: t + d };
    t += d;
    return timing;
  });
}

const shotId = (i) => `s${String(i + 1).padStart(2, "0")}`;
const url = (seriesId, ...parts) => `/media/${seriesId}/${parts.join("/")}`;
const diskPath = (mediaUrl) => path.join(PUBLIC_DIR, mediaUrl);

/** Spread a cue's time across its words by length, so longer words get longer. */
function timeWords(text, startMs, endMs) {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => w.length + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = startMs;
  return words.map((word, i) => {
    const wordStart = Math.round(t);
    t += ((endMs - startMs) * weights[i]) / total;
    return { text: word, startMs: wordStart, endMs: i === words.length - 1 ? endMs : Math.round(t) };
  });
}

// ---------------------------------------------------------------------------
// Cards (Chromium via Playwright; plain colour if it is not installed)
// ---------------------------------------------------------------------------

let browser = null;
let page = null;

async function openBrowser() {
  try {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  } catch (error) {
    browser = null;
    page = null;
    warn(`Chromium is not available, cards will be plain colour (${String(error.message).split("\n")[0]}).`);
    warn("Run: pnpm exec playwright install chromium");
  }
}

function hsl(hue, s, l) {
  return `hsl(${((hue % 360) + 360) % 360} ${s}% ${l}%)`;
}

/** Convert an hsl triple to 0xRRGGBB for ffmpeg's colour source (fallback only). */
function hslHex(hue, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `0x${f(0)}${f(8)}${f(4)}`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/**
 * Draw one card. `lines` is [{text, size, weight, opacity, lang}] from the top;
 * `footer` is the big line near the middle-bottom (kept above the subtitle band).
 */
async function drawCard({ file, width = W, height = H, hue, step = 0, lines, footer, type = "png" }) {
  mkdirp(path.dirname(file));
  const centre = 20 + step * 4;
  if (!page) {
    run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${hslHex(hue + step * 9, 48, centre - 6)}:s=${width}x${height}`, "-frames:v", "1", file]);
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
    body{font-family:"Helvetica Neue","Kohinoor Devanagari",Arial,sans-serif;color:#fff;box-sizing:border-box;
      padding:${Math.round(height * 0.085)}px ${Math.round(width * 0.085)}px;display:flex;flex-direction:column;gap:${Math.round(width * 0.026)}px;
      background:radial-gradient(120% 75% at 28% 22%, ${hsl(hue + step * 9, 52, centre)} 0%, ${hsl(hue + step * 9, 56, 7)} 72%), #0a0812}
    .tag{align-self:flex-start;font-size:${Math.round(width * 0.03)}px;font-weight:700;letter-spacing:.16em;
      border:2px solid rgba(255,255,255,.55);border-radius:999px;padding:.5em 1.1em;margin-bottom:${Math.round(width * 0.03)}px}
    .line{line-height:1.3}
    .footer{margin-top:auto;margin-bottom:${Math.round(height * 0.3)}px;font-size:${Math.round(width * 0.105)}px;font-weight:800;letter-spacing:-.02em}
  </style></head><body>
    <div class="tag">PLACEHOLDER</div>
    ${lines
      .map(
        (l) =>
          `<div class="line"${l.lang ? ` lang="${l.lang}"` : ""} style="font-size:${Math.round(width * l.size)}px;font-weight:${l.weight ?? 500};opacity:${l.opacity ?? 1}">${esc(l.text)}</div>`,
      )
      .join("\n")}
    ${footer ? `<div class="footer">${esc(footer)}</div>` : ""}
  </body></html>`;
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: file, type, ...(type === "jpeg" ? { quality: 84 } : {}) });
}

// ---------------------------------------------------------------------------
// Rendered masters: one per series x slot, hi + en video and the shot stills
// ---------------------------------------------------------------------------

function encodeVideo({ cards, durationsMs, hz, out }) {
  const totalSec = durationsMs.reduce((a, b) => a + b, 0) / 1000;
  const starts = cumulative(durationsMs).map((t) => t.startMs / 1000);
  const blips = starts.map((s) => `between(t,${s},${(s + 0.14).toFixed(2)})`).join("+");
  const inputs = [];
  cards.forEach((card, i) => {
    inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(durationsMs[i] / 1000), "-i", card);
  });
  const n = cards.length;
  const filter =
    `${cards.map((_, i) => `[${i}:v]`).join("")}concat=n=${n}:v=1:a=0,scale=${W}:${H},format=yuv420p[base];` +
    // A small marker that crosses the frame once per video, so playing and seeking are visible.
    `[base][${n + 1}:v]overlay=x='(W-w)*t/${totalSec}':y=H-96:shortest=1[v]`;
  mkdirp(path.dirname(out));
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    ...inputs,
    "-f", "lavfi", "-t", String(totalSec), "-i", `aevalsrc=exprs='0.14*sin(2*PI*${hz}*t)*(${blips})':s=48000`,
    "-f", "lavfi", "-t", String(totalSec), "-i", `color=c=white@0.85:s=36x36:r=${FPS},format=rgba`,
    "-filter_complex", filter,
    "-map", "[v]", "-map", `${n}:a`,
    "-c:v", "libx264", "-profile:v", "high", "-preset", "veryfast", "-crf", "27", "-r", String(FPS), "-g", String(FPS),
    "-force_key_frames", starts.join(","),
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2",
    "-movflags", "+faststart", "-t", String(totalSec),
    out,
  ]);
}

async function buildMaster(series, slot, standsFor) {
  const dir = path.join(WORK_DIR, series.id, slot);
  fs.rmSync(dir, { recursive: true, force: true });
  const { label, hue } = SLOTS[slot];
  const head = [
    { text: `Series ${series.n} · ${label}`, size: 0.05, weight: 800 },
    { text: `Stands in for ${standsFor.join(" · ")}`, size: 0.034, opacity: 0.8 },
  ];
  const stills = [];
  for (let i = 0; i < SHOT_COUNT; i++) {
    const still = path.join(dir, "shots", `${shotId(i)}.jpg`);
    await drawCard({
      file: still,
      type: "jpeg",
      hue,
      step: i,
      lines: [{ text: `${series.title.hi} / ${series.title.en}`, size: 0.075, weight: 800, lang: "hi" }, ...head],
      footer: `Shot ${i + 1} of ${SHOT_COUNT}`,
    });
    stills.push(still);
  }
  const videos = {};
  for (const lang of LANGS) {
    const cards = [];
    for (let i = 0; i < SHOT_COUNT; i++) {
      const card = path.join(dir, "cards", `${lang}-${shotId(i)}.png`);
      await drawCard({
        file: card,
        hue,
        step: i,
        lines: [
          { text: series.title[lang], size: 0.085, weight: 800, lang },
          ...head,
          { text: LANG_LABEL[lang], size: 0.044, weight: 700, lang: lang === "hi" ? "hi" : undefined },
        ],
        footer: `Shot ${i + 1} of ${SHOT_COUNT}`,
      });
      cards.push(card);
    }
    videos[lang] = path.join(dir, `${lang}.mp4`);
    encodeVideo({ cards, durationsMs: SHOT_MS[lang], hz: BLIP_HZ[lang], out: videos[lang] });
  }
  return { stills, videos };
}

// ---------------------------------------------------------------------------
// Writing one playable (episode or glimpse) at its final path
// ---------------------------------------------------------------------------

function writeSubtitles({ file, lang, playableId, timings, speakers, lines }) {
  const cues = timings.map((t, i) => {
    const text = lines[i % lines.length](playableId);
    const startMs = t.startMs + 300;
    const endMs = Math.max(startMs + 600, t.endMs - 300);
    return {
      id: `c${String(i + 1).padStart(3, "0")}`,
      line_id: `l${String(i + 1).padStart(2, "0")}`,
      speaker: speakers[i % speakers.length],
      startMs,
      endMs,
      text,
      words: timeWords(text, startMs, endMs),
    };
  });
  writeJson(file, { lang, placeholder: true, cues });
}

function installFromMaster({ series, folder, playableId, master }) {
  const base = [folder, playableId];
  const shots = master.stills.map((still, i) => {
    const stillUrl = url(series.id, ...base, "shots", `${shotId(i)}.jpg`);
    copy(still, diskPath(stillUrl));
    return {
      id: shotId(i),
      still: stillUrl,
      timing: { hi: cumulative(SHOT_MS.hi)[i], en: cumulative(SHOT_MS.en)[i] },
    };
  });
  const media = {
    video: { hi: url(series.id, ...base, "hi.mp4"), en: url(series.id, ...base, "en.mp4") },
    durationMs: { hi: 0, en: 0 },
    subtitles: { hi: url(series.id, ...base, "hi.json"), en: url(series.id, ...base, "en.json") },
    shots,
    poster: url(series.id, ...base, "poster.jpg"),
    placeholder: true,
    placeholderNote: "Generated test card. Replace with the finished render (docs/contracts.md, \"Replacing a placeholder\").",
  };
  copy(master.stills[0], diskPath(media.poster));
  for (const lang of LANGS) {
    copy(master.videos[lang], diskPath(media.video[lang]));
    media.durationMs[lang] = probeDurationMs(diskPath(media.video[lang]));
    writeSubtitles({
      file: diskPath(media.subtitles[lang]),
      lang,
      playableId,
      timings: cumulative(SHOT_MS[lang]),
      speakers: series.cast.map((c) => c.id),
      lines: SUBTITLE_LINES[lang],
    });
  }
  return media;
}

// ---------------------------------------------------------------------------
// Phase 0 proof scenes as the stand-in for the first episode
// ---------------------------------------------------------------------------

function findProofRenders(style) {
  if (NO_PROOF) return null;
  const dir = path.join(PROOF_ROOT, style, "render");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".mp4")).sort();
  if (files.length === 0) return null;
  const forLang = (lang) => files.find((f) => new RegExp(`(^|[^a-z])${lang}([^a-z]|$)`, "i").test(f));
  const hi = forLang("hi");
  const en = forLang("en");
  const any = hi ?? en ?? files[0];
  return { hi: path.join(dir, hi ?? any), en: path.join(dir, en ?? any), bothFound: Boolean(hi && en) };
}

function installFromProof({ series, playableId, renders }) {
  const style = series.proofStyle;
  const base = ["episodes", playableId];
  const storyboard = readJsonIfAny(path.join(PROOF_ROOT, style, "shots.json"));
  const planned = (storyboard?.shots ?? []).filter((s) => Number(s.duration_s) > 0);
  const plan = planned.length
    ? planned.map((s) => ({ id: String(s.id), weight: Number(s.duration_s), lineIds: s.line_ids ?? [] }))
    : Array.from({ length: SHOT_COUNT }, (_, i) => ({ id: shotId(i), weight: 1, lineIds: [] }));
  const totalWeight = plan.reduce((a, s) => a + s.weight, 0);

  const media = {
    video: { hi: url(series.id, ...base, "hi.mp4"), en: url(series.id, ...base, "en.mp4") },
    durationMs: { hi: 0, en: 0 },
    subtitles: { hi: url(series.id, ...base, "hi.json"), en: url(series.id, ...base, "en.json") },
    shots: [],
    poster: url(series.id, ...base, "poster.jpg"),
    placeholder: true,
    placeholderNote:
      `Phase 0 proof scene (${style}) standing in for ${playableId}. Shot and subtitle timings are spread evenly from the storyboard, not measured.` +
      (renders.bothFound ? "" : " Only one language render was found, so both languages play the same file."),
  };

  // Shot timings per language: storyboard durations scaled to the real file length.
  const timings = {};
  for (const lang of LANGS) {
    copy(renders[lang], diskPath(media.video[lang]));
    const durationMs = probeDurationMs(diskPath(media.video[lang]));
    media.durationMs[lang] = durationMs;
    let t = 0;
    timings[lang] = plan.map((s, i) => {
      const startMs = Math.round(t);
      t += (durationMs * s.weight) / totalWeight;
      return { startMs, endMs: i === plan.length - 1 ? durationMs : Math.round(t) };
    });
  }

  // Stills: one frame from the middle of each shot of the Hinglish cut.
  media.shots = plan.map((s, i) => {
    const id = /^[a-z][a-z0-9]*$/.test(s.id) ? s.id : shotId(i);
    const stillUrl = url(series.id, ...base, "shots", `${id}.jpg`);
    const mid = (timings.hi[i].startMs + timings.hi[i].endMs) / 2000;
    mkdirp(path.dirname(diskPath(stillUrl)));
    run("ffmpeg", ["-y", "-loglevel", "error", "-ss", mid.toFixed(3), "-i", diskPath(media.video.hi), "-frames:v", "1", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, "-q:v", "3", diskPath(stillUrl)]);
    return { id, still: stillUrl, timing: { hi: timings.hi[i], en: timings.en[i] } };
  });
  copy(diskPath(media.shots[0].still), diskPath(media.poster));

  // Subtitles: the script's lines, spread evenly inside the shot that carries them.
  const castIds = new Set(series.cast.map((c) => c.id));
  for (const lang of LANGS) {
    const script = readJsonIfAny(path.join(PROOF_ROOT, style, `script.${lang}.json`));
    const lineById = new Map();
    for (const beat of script?.beats ?? []) for (const line of beat.lines ?? []) lineById.set(line.id, line);
    const cues = [];
    plan.forEach((s, i) => {
      const lines = s.lineIds.map((lineId) => lineById.get(lineId)).filter(Boolean);
      if (lines.length === 0) return;
      const { startMs, endMs } = timings[lang][i];
      const slice = (endMs - startMs) / lines.length;
      lines.forEach((line, k) => {
        const text = String(line.text).replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
        if (!text) return;
        const cueStart = Math.round(startMs + slice * k + 80);
        const cueEnd = Math.round(startMs + slice * (k + 1) - 80);
        if (cueEnd <= cueStart) return;
        cues.push({
          id: `c${String(cues.length + 1).padStart(3, "0")}`,
          line_id: String(line.id),
          speaker: castIds.has(line.speaker) ? line.speaker : String(line.speaker ?? "unknown"),
          startMs: cueStart,
          endMs: cueEnd,
          text,
          words: timeWords(text, cueStart, cueEnd),
        });
      });
    });
    writeJson(diskPath(media.subtitles[lang]), { lang, placeholder: true, cues });
  }
  return media;
}

// ---------------------------------------------------------------------------
// Series-level stand-ins: poster, backdrop, cast
// ---------------------------------------------------------------------------

async function installSeriesArt(series, voiceMasters) {
  const poster = url(series.id, "poster.jpg");
  const backdrop = url(series.id, "backdrop.jpg");
  const lines = [
    { text: `${series.title.hi} / ${series.title.en}`, size: 0.085, weight: 800, lang: "hi" },
    { text: `Series ${series.n} · ${series.genre}`, size: 0.05, weight: 700 },
  ];
  await drawCard({ file: diskPath(poster), type: "jpeg", width: 1080, height: 1440, hue: SLOTS.shared.hue + series.n * 40, lines, footer: "Poster" });
  await drawCard({ file: diskPath(backdrop), type: "jpeg", hue: SLOTS.shared.hue + series.n * 40, step: 2, lines, footer: "Backdrop" });
  const cast = [];
  for (const [i, member] of series.cast.entries()) {
    const portrait = url(series.id, "cast", `${member.id}.jpg`);
    await drawCard({
      file: diskPath(portrait),
      type: "jpeg",
      width: 720,
      height: 720,
      hue: 200 + i * 70,
      lines: [{ text: `${member.name.hi} / ${member.name.en}`, size: 0.085, weight: 800, lang: "hi" }],
    });
    const voiceSample = {};
    for (const lang of LANGS) {
      voiceSample[lang] = url(series.id, "cast", `${member.id}.${lang}.mp3`);
      copy(voiceMasters[lang], diskPath(voiceSample[lang]));
    }
    cast.push({ ...member, voiceSample, portrait, placeholder: true });
  }
  return { poster, backdrop, cast };
}

function buildVoiceMasters() {
  const masters = {};
  for (const lang of LANGS) {
    masters[lang] = path.join(WORK_DIR, `voice-${lang}.mp3`);
    mkdirp(WORK_DIR);
    // Two soft notes; the English sample is pitched higher so the switch is audible.
    const hz = BLIP_HZ[lang] / 2;
    run("ffmpeg", [
      "-y", "-loglevel", "error", "-f", "lavfi", "-t", "1.6",
      "-i", `aevalsrc=exprs='0.2*sin(2*PI*${hz}*t)*between(t,0,0.6)+0.2*sin(2*PI*${hz * 1.5}*t)*between(t,0.8,1.4)':s=44100`,
      "-af", "afade=t=out:st=1.3:d=0.3", "-c:a", "libmp3lame", "-b:a", "64k", masters[lang],
    ]);
  }
  return masters;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function slotOfEpisode(kind) {
  return kind; // "shared" | "branchA" | "branchB" are slot names too
}

async function buildSeries(series, voiceMasters) {
  const manifestFile = path.join(MEDIA_DIR, series.id, "series.json");
  const existing = FORCE ? null : readJsonIfAny(manifestFile);
  const existingEpisode = (id) => existing?.episodes?.find?.((e) => e.id === id && e.placeholder === false) ?? null;
  const existingGlimpse = (choice) => (existing?.glimpses?.[choice]?.placeholder === false ? existing.glimpses[choice] : null);
  const keepSeriesLevel = existing?.placeholder === false;

  // Which slots still need a rendered master?
  const needed = new Map();
  for (const e of series.episodes) {
    if (existingEpisode(e.id)) continue;
    const slot = slotOfEpisode(e.kind);
    needed.set(slot, [...(needed.get(slot) ?? []), e.id]);
  }
  for (const choice of ["A", "B"]) {
    if (!existingGlimpse(choice)) needed.set(`glimpse${choice}`, [series.glimpses[choice]]);
  }
  const masters = {};
  for (const [slot, ids] of needed) {
    log(`${series.id}: rendering the ${slot} card (${ids.join(", ")})`);
    masters[slot] = await buildMaster(series, slot, ids);
  }

  const proof = findProofRenders(series.proofStyle);
  const episodes = [];
  for (const e of series.episodes) {
    const kept = existingEpisode(e.id);
    if (kept) {
      log(`${series.id}: ${e.id} is finished work, left untouched`);
      episodes.push(kept);
      continue;
    }
    fs.rmSync(path.join(MEDIA_DIR, series.id, "episodes", e.id), { recursive: true, force: true });
    let media = null;
    if (proof && e.number === 1) {
      try {
        media = installFromProof({ series, playableId: e.id, renders: proof });
        log(`${series.id}: ${e.id} uses the ${series.proofStyle} proof scene`);
      } catch (error) {
        warn(`${series.id}: could not use the proof scene for ${e.id} (${String(error.message).split("\n")[0]}); using the test card.`);
        fs.rmSync(path.join(MEDIA_DIR, series.id, "episodes", e.id), { recursive: true, force: true });
      }
    }
    media ??= installFromMaster({ series, folder: "episodes", playableId: e.id, master: masters[slotOfEpisode(e.kind)] });
    episodes.push({ id: e.id, number: e.number, kind: e.kind, title: e.title, ...media });
  }

  const glimpses = {};
  for (const choice of ["A", "B"]) {
    const kept = existingGlimpse(choice);
    if (kept) {
      log(`${series.id}: glimpse ${choice} is finished work, left untouched`);
      glimpses[choice] = kept;
      continue;
    }
    const id = series.glimpses[choice];
    fs.rmSync(path.join(MEDIA_DIR, series.id, "glimpses", id), { recursive: true, force: true });
    glimpses[choice] = { id, ...installFromMaster({ series, folder: "glimpses", playableId: id, master: masters[`glimpse${choice}`] }) };
  }

  let top;
  if (keepSeriesLevel) {
    log(`${series.id}: series text, cast and art are finished work, left untouched`);
    top = {
      title: existing.title,
      synopsis: existing.synopsis,
      visualStyle: existing.visualStyle,
      genre: existing.genre,
      question: existing.question,
      questionContext: existing.questionContext,
      choices: existing.choices,
      cast: existing.cast,
      poster: existing.poster,
      backdrop: existing.backdrop,
      seededTallies: existing.seededTallies,
      placeholder: false,
    };
  } else {
    // Clear the stand-in cast files of the previous run (the cast list may have changed).
    for (const member of existing?.cast ?? []) {
      if (member?.placeholder !== true) continue;
      for (const file of [member.voiceSample?.hi, member.voiceSample?.en, member.portrait]) {
        if (typeof file === "string" && file.startsWith(`/media/${series.id}/cast/`)) fs.rmSync(diskPath(file), { force: true });
      }
    }
    const art = await installSeriesArt(series, voiceMasters);
    top = {
      title: series.title,
      synopsis: series.synopsis,
      visualStyle: series.visualStyle,
      genre: series.genre,
      question: series.question,
      questionContext: series.questionContext,
      choices: series.choices,
      cast: art.cast,
      poster: art.poster,
      backdrop: art.backdrop,
      seededTallies: series.seededTallies,
      placeholder: true,
    };
  }

  const manifest = {
    schemaVersion: 1,
    id: series.id,
    title: top.title,
    synopsis: top.synopsis,
    visualStyle: top.visualStyle,
    genre: top.genre,
    question: top.question,
    questionContext: top.questionContext,
    choices: top.choices,
    cast: top.cast,
    poster: top.poster,
    backdrop: top.backdrop,
    branchAfterEpisode: series.branchAfterEpisode,
    episodes,
    glimpses,
    seededTallies: top.seededTallies,
    placeholder: top.placeholder,
  };
  writeJson(manifestFile, manifest);
  log(`${series.id}: wrote ${path.relative(APP_DIR, manifestFile)}`);
}

function buildCatalog() {
  const file = path.join(MEDIA_DIR, "catalog.json");
  const existing = FORCE ? null : readJsonIfAny(file);
  const realTeasers = (existing?.teasers ?? []).filter((t) => t.placeholder === false);
  const teasers = [...realTeasers, ...TEASERS.filter((t) => !realTeasers.some((r) => r.id === t.id))].slice(0, 3);
  writeJson(file, { schemaVersion: 1, series: SERIES.map((s) => s.id), teasers });
  log(`wrote ${path.relative(APP_DIR, file)}`);
}

async function main() {
  for (const tool of ["ffmpeg", "ffprobe"]) {
    try {
      run(tool, ["-version"]);
    } catch {
      console.error(`[placeholders] ${tool} is not on PATH. Install ffmpeg and run again.`);
      process.exit(2);
    }
  }
  mkdirp(WORK_DIR);
  await openBrowser();
  try {
    const voiceMasters = buildVoiceMasters();
    for (const series of SERIES) await buildSeries(series, voiceMasters);
    buildCatalog();
  } finally {
    await browser?.close();
  }
  fs.rmSync(WORK_DIR, { recursive: true, force: true });

  // Hand over to the contract check: it must pass on what was just written.
  try {
    execFileSync(process.execPath, [path.join(APP_DIR, "scripts", "check-content.mjs")], { stdio: "inherit" });
  } catch {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[placeholders] failed:", error);
  process.exit(1);
});
