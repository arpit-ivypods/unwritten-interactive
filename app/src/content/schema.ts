/**
 * Content manifest contract for the Unwritten app.
 *
 * This file is the single source of truth for what the content track hands to
 * the product track. Prose version: docs/contracts.md.
 *
 *   app/public/media/catalog.json                 -> Catalog
 *   app/public/media/<seriesId>/series.json       -> Series
 *   app/public/media/<seriesId>/.../<lang>.json   -> SubtitleTrack
 *
 * Rules that hold everywhere:
 * - Times are integer milliseconds from the start of that language's video file.
 * - `hi` is Hinglish (Hindi in Devanagari, English words in Latin script, in the
 *   same line). `en` is the full English adaptation.
 * - Paths are site-absolute URLs under /media/<seriesId>/ (files live in
 *   app/public/media/<seriesId>/). They can be used as `src` directly.
 * - The Hinglish and English cuts of one episode have the SAME shots in the same
 *   order, but different timings and different total lengths.
 *
 * Keep this file free of `@/` imports and TypeScript-only syntax that needs a
 * compiler (enums, namespaces): plain Node imports it directly in
 * scripts/check-content.mjs.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const LANGS = ["hi", "en"] as const;
/** Audio language. `hi` = Hinglish (the default), `en` = English. */
export type Lang = (typeof LANGS)[number];

export const CHOICES = ["A", "B"] as const;
/** A is always violet and on the left, B always saffron and on the right. */
export type Choice = (typeof CHOICES)[number];

export const EPISODE_KINDS = ["shared", "branchA", "branchB"] as const;
export type EpisodeKind = (typeof EPISODE_KINDS)[number];

export const VISUAL_STYLES = ["photoreal", "illustration"] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

/** One value per audio language. */
export interface Localized<T = string> {
  hi: T;
  en: T;
}

// ---------------------------------------------------------------------------
// Series manifest
// ---------------------------------------------------------------------------

export interface ShotTiming {
  startMs: number;
  endMs: number;
}

/**
 * One shot of an episode. Used for the progress segments, previous/next shot,
 * the ambient backdrop (the room cross-fades to `still`) and for keeping the
 * viewer at the same shot when the audio language changes.
 */
export interface Shot {
  /** Unique inside its episode or glimpse, e.g. "s03". Same id in both cuts. */
  id: string;
  /** JPG/PNG/WebP still of this shot. Language independent. */
  still: string;
  /** Where the shot sits in each language's video file. */
  timing: Localized<ShotTiming>;
}

/** The media fields shared by episodes and glimpses. */
export interface PlayableMedia {
  /** H.264 MP4, 1080x1920, 30 fps, one file per language. No burned-in subtitles. */
  video: Localized<string>;
  /** Length of each language's video file. */
  durationMs: Localized<number>;
  /** SubtitleTrack JSON per language. */
  subtitles: Localized<string>;
  /** At least one. In playing order. */
  shots: Shot[];
  /** Still shown before play, on rails and on cards. Never a frame that reveals an outcome. */
  poster: string;
  /** True while this is a stand-in and not the finished render (plan 7.8). */
  placeholder: boolean;
  /** What is missing and how to replace it. Free text for the morning report. */
  placeholderNote?: string;
}

export interface Episode extends PlayableMedia {
  /** Lower-case letters and digits, unique in the series, e.g. "s1e01", "s1a02", "s1b03". */
  id: string;
  /**
   * Position on the viewer's path, starting at 1. Shared episodes are
   * 1..branchAfterEpisode. Both branches continue from branchAfterEpisode + 1,
   * so "s1a01" and "s1b01" are both number 3 when the choice is after episode 2.
   */
  number: number;
  kind: EpisodeKind;
  title: Localized;
}

export interface Glimpse extends PlayableMedia {
  /** Unique in the series and different from every episode id, e.g. "s1ga", "s1gb". */
  id: string;
}

export interface ChoiceOption {
  /** The choice in the character's own words: "सच बता दो", never "Option A". */
  label: Localized;
  /**
   * What the words mean, in plain terms, when the label is a phrase the
   * viewer could misread (a code phrase, for example). Shown under the label
   * on the ballot. Leave it out when the label explains itself.
   */
  meaning?: Localized;
}

export interface CastMember {
  /** Lower-case id. Subtitle cues name their speaker with this id. */
  id: string;
  name: Localized;
  /** One line on who this is in the story. */
  role: Localized;
  /** Short audio clip of the voice, per language (MP3, M4A or WAV). */
  voiceSample: Localized<string>;
  /** Optional face still. */
  portrait?: string;
  placeholder?: boolean;
}

export interface Series {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Lower-case, also the folder name under /media/. "series1", "series2". */
  id: string;
  title: Localized;
  synopsis: Localized;
  visualStyle: VisualStyle;
  /** Short genre label for metadata lines. Interface text, so English. */
  genre?: string;
  /** The question, in the character's words, shown when the last shared episode stops. */
  question: Localized;
  /** One line of context under the question. */
  questionContext?: Localized;
  choices: Record<Choice, ChoiceOption>;
  cast: CastMember[];
  /** Character-led still for the 3:4 series card. */
  poster: string;
  /** Still that lights the room when nothing from the series is playing. */
  backdrop: string;
  /** The choice comes after this episode number. The last shared episode. */
  branchAfterEpisode: number;
  /** Every episode of the series: shared, then branch A, then branch B. */
  episodes: Episode[];
  glimpses: Record<Choice, Glimpse>;
  /** Simulated ballots the tally starts from. The viewer's own ballot is added on top. */
  seededTallies: Record<Choice, number>;
  /** True while the series-level text, cast and art are stand-ins. */
  placeholder: boolean;
}

// ---------------------------------------------------------------------------
// Catalog (home screen)
// ---------------------------------------------------------------------------

/** An announced series with optional poster art and no episodes. */
export interface Teaser {
  id: string;
  title: Localized;
  /** The hook, one short line. */
  hook: Localized;
  /** Visual style label for the tile. Interface text, so English. */
  visualStyle: string;
  poster?: string;
  placeholder: boolean;
}

export interface Catalog {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Live series ids in display order. The first is tonight's series. */
  series: string[];
  /** At most three. */
  teasers: Teaser[];
}

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

export interface SubtitleWord {
  /** One whole word as shown, punctuation attached. Never a single character. */
  text: string;
  startMs: number;
  endMs: number;
}

const SUBTITLE_VOICE_MODES = ["off_screen", "phone"] as const;
export type SubtitleVoiceMode = (typeof SUBTITLE_VOICE_MODES)[number];

export interface SubtitleCue {
  /** Unique in the track, e.g. "c001". */
  id: string;
  /** The script line this cue comes from, e.g. "l07". One line may give several cues. */
  line_id: string;
  /** Cast member id of the speaker. The app shows that cast member's name. */
  speaker: string;
  heard_as?: SubtitleVoiceMode;
  /** First marked cue for this speaker in the scene; text is the fallback when the cast has no display name. */
  speaker_label?: string;
  startMs: number;
  endMs: number;
  /** Exactly what is spoken, without emotion tags. Two lines of about 32 characters at most. */
  text: string;
  /** Every word of `text`, in order, for the per-word highlight. */
  words: SubtitleWord[];
}

export interface SubtitleTrack {
  lang: Lang;
  cues: SubtitleCue[];
  /** True when the timings are evenly spaced stand-ins and not measured. */
  placeholder?: boolean;
}

// ---------------------------------------------------------------------------
// Runtime validation
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const ID_PATTERN = /^[a-z][a-z0-9]*$/;
const SERIES_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const VIDEO_EXT = /\.mp4$/i;
const JSON_EXT = /\.json$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav)$/i;
/** A shot or cue may end this far past the stated duration (container rounding). */
export const DURATION_TOLERANCE_MS = 250;
/** A shot may start this far before the previous one ends (frame rounding). */
export const SHOT_OVERLAP_TOLERANCE_MS = 40;

const text = z.string().trim().min(1, "must not be empty");
const ms = z.number().int("must be a whole number of milliseconds").nonnegative();
const id = z.string().regex(ID_PATTERN, "must be lower-case letters and digits, starting with a letter");

const localized = <T extends z.ZodType>(inner: T) => z.object({ hi: inner, en: inner });

const mediaPath = (ext: RegExp, what: string) =>
  z
    .string()
    .startsWith("/media/", "must be a site-absolute path starting with /media/")
    .refine((p) => !p.includes("..") && !p.includes("//") && !/[?#\s]/.test(p), "must be a plain path")
    .refine((p) => ext.test(p), `must be ${what}`);

const videoPath = mediaPath(VIDEO_EXT, "an .mp4 file");
const jsonPath = mediaPath(JSON_EXT, "a .json file");
const imagePath = mediaPath(IMAGE_EXT, "a .jpg, .png or .webp file");
const audioPath = mediaPath(AUDIO_EXT, "an .mp3, .m4a or .wav file");

const shotTimingSchema = z
  .object({ startMs: ms, endMs: ms })
  .refine((t) => t.endMs > t.startMs, "endMs must be after startMs");

const shotSchema = z.object({
  id,
  still: imagePath,
  timing: localized(shotTimingSchema),
});

const playableShape = {
  video: localized(videoPath),
  durationMs: localized(ms.positive()),
  subtitles: localized(jsonPath),
  shots: z.array(shotSchema).min(1, "needs at least one shot"),
  poster: imagePath,
  placeholder: z.boolean(),
  placeholderNote: z.string().optional(),
};

const episodeSchema = z.object({
  id,
  number: z.number().int().positive(),
  kind: z.enum(EPISODE_KINDS),
  title: localized(text),
  ...playableShape,
});

const glimpseSchema = z.object({ id, ...playableShape });

const castMemberSchema = z.object({
  id,
  name: localized(text),
  role: localized(text),
  voiceSample: localized(audioPath),
  portrait: imagePath.optional(),
  placeholder: z.boolean().optional(),
});

const tally = z.number().int().nonnegative();

const seriesSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().regex(SERIES_ID_PATTERN, "must be lower-case letters, digits and hyphens"),
  title: localized(text),
  synopsis: localized(text),
  visualStyle: z.enum(VISUAL_STYLES),
  genre: z.string().optional(),
  question: localized(text),
  questionContext: localized(text).optional(),
  choices: z.object({
    A: z.object({ label: localized(text), meaning: localized(text).optional() }),
    B: z.object({ label: localized(text), meaning: localized(text).optional() }),
  }),
  cast: z.array(castMemberSchema),
  poster: imagePath,
  backdrop: imagePath,
  branchAfterEpisode: z.number().int().positive(),
  episodes: z.array(episodeSchema).min(1),
  glimpses: z.object({ A: glimpseSchema, B: glimpseSchema }),
  seededTallies: z.object({ A: tally, B: tally }),
  placeholder: z.boolean(),
}) satisfies z.ZodType<Series>;

const teaserSchema = z.object({
  id,
  title: localized(text),
  hook: localized(text),
  visualStyle: text,
  poster: imagePath.optional(),
  placeholder: z.boolean(),
});

const catalogSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  series: z.array(z.string().regex(SERIES_ID_PATTERN)).min(1),
  teasers: z.array(teaserSchema).max(3, "at most three teasers"),
}) satisfies z.ZodType<Catalog>;

const subtitleWordSchema = z
  .object({ text, startMs: ms, endMs: ms })
  .refine((w) => w.endMs >= w.startMs, "endMs must not be before startMs");

const subtitleCueSchema = z
  .object({
    id: text,
    line_id: text,
    speaker: text,
    heard_as: z.enum(SUBTITLE_VOICE_MODES).optional(),
    speaker_label: text.optional(),
    startMs: ms,
    endMs: ms,
    text,
    words: z.array(subtitleWordSchema).min(1, "needs at least one word"),
  })
  .refine((c) => c.endMs > c.startMs, "endMs must be after startMs");

const subtitleTrackSchema = z.object({
  lang: z.enum(LANGS),
  cues: z.array(subtitleCueSchema),
  placeholder: z.boolean().optional(),
}) satisfies z.ZodType<SubtitleTrack>;

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  let out = "";
  for (const key of path) {
    if (typeof key === "number") out += `[${key}]`;
    else out += out ? `.${String(key)}` : String(key);
  }
  return out || "(root)";
}

function structural<T>(schema: z.ZodType<T>, input: unknown): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`),
  };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}

function checkPlayable(where: string, seriesId: string, p: PlayableMedia, errors: string[]): void {
  const prefix = `/media/${seriesId}/`;
  const paths: Array<[string, string]> = [
    [`${where}.video.hi`, p.video.hi],
    [`${where}.video.en`, p.video.en],
    [`${where}.subtitles.hi`, p.subtitles.hi],
    [`${where}.subtitles.en`, p.subtitles.en],
    [`${where}.poster`, p.poster],
    ...p.shots.map((s, i): [string, string] => [`${where}.shots[${i}].still`, s.still]),
  ];
  for (const [at, value] of paths) {
    if (!value.startsWith(prefix)) errors.push(`${at}: must be under ${prefix}`);
  }
  for (const dup of duplicates(p.shots.map((s) => s.id))) {
    errors.push(`${where}.shots: shot id "${dup}" is used more than once`);
  }
  for (const lang of LANGS) {
    const limit = p.durationMs[lang] + DURATION_TOLERANCE_MS;
    p.shots.forEach((shot, i) => {
      const t = shot.timing[lang];
      if (t.endMs > limit) {
        errors.push(`${where}.shots[${i}].timing.${lang}: ends at ${t.endMs} ms, after the ${p.durationMs[lang]} ms video`);
      }
      const prev = i > 0 ? p.shots[i - 1].timing[lang] : null;
      if (prev && t.startMs < prev.endMs - SHOT_OVERLAP_TOLERANCE_MS) {
        errors.push(`${where}.shots[${i}].timing.${lang}: starts at ${t.startMs} ms, before the previous shot ends (${prev.endMs} ms)`);
      }
    });
  }
}

/**
 * Validate a parsed series.json. Checks the shape and then the rules a shape
 * cannot express: ids, numbering around the branch point, shot order, paths.
 */
export function validateSeries(input: unknown): ValidationResult<Series> {
  const shape = structural<Series>(seriesSchema, input);
  if (!shape.ok) return shape;
  const s = shape.value;
  const errors: string[] = [];
  const prefix = `/media/${s.id}/`;

  for (const [at, value] of [
    ["poster", s.poster],
    ["backdrop", s.backdrop],
  ] as const) {
    if (!value.startsWith(prefix)) errors.push(`${at}: must be under ${prefix}`);
  }

  s.cast.forEach((member, i) => {
    for (const lang of LANGS) {
      if (!member.voiceSample[lang].startsWith(prefix)) {
        errors.push(`cast[${i}].voiceSample.${lang}: must be under ${prefix}`);
      }
    }
    if (member.portrait && !member.portrait.startsWith(prefix)) {
      errors.push(`cast[${i}].portrait: must be under ${prefix}`);
    }
  });
  for (const dup of duplicates(s.cast.map((c) => c.id))) {
    errors.push(`cast: id "${dup}" is used more than once`);
  }

  const playableIds = [...s.episodes.map((e) => e.id), s.glimpses.A.id, s.glimpses.B.id];
  for (const dup of duplicates(playableIds)) {
    errors.push(`episodes/glimpses: id "${dup}" is used more than once`);
  }

  s.episodes.forEach((e, i) => checkPlayable(`episodes[${i}]`, s.id, e, errors));
  for (const choice of CHOICES) checkPlayable(`glimpses.${choice}`, s.id, s.glimpses[choice], errors);

  // Numbering: shared episodes are 1..N, each branch continues N+1.. without gaps.
  const n = s.branchAfterEpisode;
  const numbersOf = (kind: EpisodeKind) => s.episodes.filter((e) => e.kind === kind).map((e) => e.number);
  const expectRun = (kind: EpisodeKind, from: number) => {
    const numbers = numbersOf(kind);
    if (numbers.length === 0) {
      errors.push(`episodes: there is no ${kind} episode`);
      return;
    }
    numbers.forEach((num, i) => {
      if (num !== from + i) {
        errors.push(`episodes: ${kind} episodes must be numbered ${from}, ${from + 1}, ... in order (found ${numbers.join(", ")})`);
      }
    });
  };
  expectRun("shared", 1);
  if (numbersOf("shared").length !== n) {
    errors.push(`branchAfterEpisode: is ${n} but there are ${numbersOf("shared").length} shared episodes`);
  }
  expectRun("branchA", n + 1);
  expectRun("branchB", n + 1);

  // Order in the array: shared, then branch A, then branch B.
  const order: Record<EpisodeKind, number> = { shared: 0, branchA: 1, branchB: 2 };
  for (let i = 1; i < s.episodes.length; i++) {
    if (order[s.episodes[i].kind] < order[s.episodes[i - 1].kind]) {
      errors.push(`episodes[${i}]: episodes must be listed shared first, then branch A, then branch B`);
      break;
    }
  }

  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value: s };
}

/** Validate a parsed catalog.json. */
export function validateCatalog(input: unknown): ValidationResult<Catalog> {
  const shape = structural<Catalog>(catalogSchema, input);
  if (!shape.ok) return shape;
  const errors: string[] = [];
  for (const dup of duplicates(shape.value.series)) errors.push(`series: "${dup}" is listed more than once`);
  for (const dup of duplicates(shape.value.teasers.map((t) => t.id))) errors.push(`teasers: id "${dup}" is used more than once`);
  return errors.length ? { ok: false, errors } : shape;
}

/**
 * Check only the shape of a parsed subtitle file: enough for the player to
 * draw it. `validateSubtitleTrack` is the full check.
 */
export function parseSubtitleTrack(input: unknown): ValidationResult<SubtitleTrack> {
  return structural<SubtitleTrack>(subtitleTrackSchema, input);
}

/**
 * Validate a parsed subtitle file. Pass `durationMs` (the length of that
 * language's video) to also check that no cue runs past the end.
 */
export function validateSubtitleTrack(input: unknown, durationMs?: number): ValidationResult<SubtitleTrack> {
  const shape = parseSubtitleTrack(input);
  if (!shape.ok) return shape;
  const track = shape.value;
  const errors: string[] = [];
  for (const dup of duplicates(track.cues.map((c) => c.id))) errors.push(`cues: id "${dup}" is used more than once`);
  track.cues.forEach((cue, i) => {
    const prev = i > 0 ? track.cues[i - 1] : null;
    if (prev && cue.startMs < prev.startMs) errors.push(`cues[${i}]: starts before the cue ahead of it; cues must be in time order`);
    if (durationMs !== undefined && cue.endMs > durationMs + DURATION_TOLERANCE_MS) {
      errors.push(`cues[${i}]: ends at ${cue.endMs} ms, after the ${durationMs} ms video`);
    }
    cue.words.forEach((word, w) => {
      if (word.startMs < cue.startMs || word.endMs > cue.endMs) {
        errors.push(`cues[${i}].words[${w}]: is outside its cue (${cue.startMs}-${cue.endMs} ms)`);
      }
      if (w > 0 && word.startMs < cue.words[w - 1].startMs) {
        errors.push(`cues[${i}].words[${w}]: starts before the word ahead of it`);
      }
    });
    const joined = cue.words.map((w) => w.text).join(" ");
    if (normaliseSpaces(joined) !== normaliseSpaces(cue.text)) {
      errors.push(`cues[${i}]: the words do not spell the text ("${joined}" vs "${cue.text}")`);
    }
    if (/\[[^\]]*\]/.test(cue.text)) {
      errors.push(`cues[${i}]: text still contains an emotion tag in square brackets`);
    }
  });
  return errors.length ? { ok: false, errors } : shape;
}

function normaliseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
