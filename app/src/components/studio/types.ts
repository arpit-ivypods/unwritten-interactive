/**
 * Shape of public/media/studio/studio.json, written by scripts/build-studio.mjs.
 * OWNER: studio engineer. Every field the script cannot fill is null or [].
 */

export type Pair = { hi: string | null; en: string | null };
export type StageKey = "story" | "script" | "look" | "storyboard" | "voice" | "sound" | "edit" | "screening" | "final";
export type StageStatus = { state: "waiting" | "running" | "done"; label: string; summary: string | null };

export interface StudioStory {
  source: string;
  fromScript: boolean;
  title: Pair | null;
  genre: string | null;
  logline: Pair | null;
  premise: string | null;
  tone: string | null;
  location: string | null;
  timeOfDay: string | null;
  characters: Array<{ id: string; name: Pair | null; age: number | null; role: string | null; look: string | null; note: string | null }>;
  endingQuestion: Pair | null;
  beats: Array<{ id: string; action: string | null }>;
}

export interface ScriptLine {
  id: string;
  speaker: string | null;
  speakerName: Pair | null;
  targetSeconds: number | null;
  hi: { text: string | null; tags: Array<string | null> } | null;
  en: { text: string | null; tags: Array<string | null> } | null;
}

export interface StudioScript {
  files: string[];
  totals: { hi: { title: string | null; targetSeconds: number | null } | null; en: { title: string | null; targetSeconds: number | null } | null };
  languageNote: Pair;
  beats: Array<{ id: string; action: string | null; silentSeconds: number | null; lines: ScriptLine[] }>;
  lineCount: number;
  musicNote: string | null;
  critic: { pass: boolean; score: number | null; problems: string[]; fixCount: number } | null;
  continuity: { owner: string | null; checks: Array<{ check: string | null; result: string | null; detail: string | null }> } | null;
}

export interface LookEntry {
  id: string;
  kind: "character" | "location" | "prop" | "other";
  name: string;
  note: string | null;
  image: string | null;
  attempts: number;
  genSeconds: number | null;
  lead?: boolean;
}

export interface StudioLook {
  file: string | null;
  summary: string | null;
  styleBlock: string | null;
  negativeRules: string | null;
  palette: Array<{ hex: string | null; role: string | null }>;
  characters: LookEntry[];
  locations: LookEntry[];
  props: LookEntry[];
  other: LookEntry[];
}

export interface StoryboardShot {
  id: string;
  beatId: string | null;
  lineIds: Array<string | null>;
  durationS: number | null;
  framing: string | null;
  action: string | null;
  cameraMove: string | null;
  intensity: number | null;
  refs: Array<string | null>;
  onScreen: Array<string | null>;
  lightState: string | null;
  note: string | null;
  subtitleSafe: boolean | null;
  prompt: string | null;
  frame: string | null;
  frameStatus: string;
  attempts: number;
  genSeconds: number | null;
}

export interface StudioStoryboard {
  file: string;
  totalSeconds: number | null;
  notes: string[];
  shots: StoryboardShot[];
  framesDone: number;
}

export interface VoiceTake {
  take: number;
  /** True for the take in voice/<lang>/<line_id>.mp3, the one the cut uses. */
  inCut: boolean;
  file: string;
  src: string | null;
  durationS: number | null;
  model: string | null;
  text: string | null;
  review: {
    verdict: string | null;
    reason: string | null;
    transcript: string | null;
    speechS: number | null;
    targetS: number | null;
    retakeText: string | null;
    retakeTake: number | null;
  } | null;
}

export interface VoiceLine {
  lineId: string;
  lang: string;
  speaker: string | null;
  targetSeconds: number | null;
  directions: Array<{ suffix: string | null; text: string | null; note: string | null; model: string | null }>;
  takes: VoiceTake[];
  chosen: VoiceTake | null;
}

export interface VoiceAbSide {
  file: string | null;
  src: string | null;
  lang: string | null;
  durationS: number | null;
  transcript: string | null;
  notes: string | null;
}

export interface VoiceAb {
  file: string;
  decision: string | null;
  pairs: Array<{
    lineId: string | null;
    lang: string;
    speaker: string | null;
    text: string | null;
    v4: VoiceAbSide;
    v3: VoiceAbSide;
    checks: Array<{ name: string; v4: string | null; v3: string | null; result: string | null }>;
    winner: string | null;
    score: string | null;
    note: string | null;
  }>;
  tally: Array<{ model: string; count: number }>;
  outcome: string | null;
  evidence: string | null;
  notChecked: string[];
}

export interface StudioVoice {
  castStatus: string | null;
  castNote: string | null;
  cast: Array<{ id: string | null; voiceName: string | null; voiceId: string | null; why: string | null }>;
  lines: VoiceLine[];
  reviewed: number;
  linesWithTake: number;
  retakesInCut: number;
  flaggedInCut: number;
  recordedTakes: number;
  ab: VoiceAb | null;
}

export interface SoundCue {
  id: string;
  type: string | null;
  role: string | null;
  model: string | null;
  shot: string | null;
  startS: number | null;
  endS: number | null;
  gainDb: number | null;
  loop: boolean;
  prompt: string | null;
  note: string | null;
  audio: string | null;
  placeholder: boolean;
  placeholderKind: string | null;
}

export interface StudioSound {
  status: string | null;
  statusNote: string | null;
  loudness: string | null;
  rules: string[];
  cues: SoundCue[];
  realCues: number;
  placeholderCues: number;
}

export interface TimelineClip {
  id: string;
  start: number;
  duration: number;
  placeholder: boolean;
}

export interface StudioTimeline {
  lang: string;
  file: string;
  fps: number;
  durationFrames: number | null;
  seconds: number | null;
  plannedSeconds: number | null;
  builtBy: string | null;
  shots: Array<{ id: string; start: number; duration: number; image: string | null; move: string | null }>;
  lanes: Array<{ kind: "dialogue" | "music" | "sfx"; clips: TimelineClip[] }>;
  notes: string[];
  slated: string[];
}

export interface StudioVideo {
  src: string;
  file: string;
  lang: string | null;
  durationS?: number | null;
  width?: number | null;
  height?: number | null;
  hasAudio?: boolean;
  duplicateOf: string | null;
}

export interface StudioEdit {
  timelines: StudioTimeline[];
  subs: Partial<Record<"hi" | "en", { file: string; cues: number }>>;
  reviewCuts: StudioVideo[];
}

export interface StudioScreening {
  file: string;
  reviewer: string | null;
  round: number | null;
  date: string | null;
  overall: number | null;
  verdict: string | null;
  pass: boolean | null;
  summary: string | null;
  filesScreened: Array<string | null>;
  scores: Array<{ name: string; score: number | null; basis: string | null }>;
  holdsUp: string[];
  checksRun: string[];
  checksNotRun: string[];
  shots: Array<{ shot: string | null; t: string | null; note: string | null }>;
  items: Array<{ text: string | null; owner: string | null; severity: string | null; fix: string | null }>;
}

export interface StudioProject {
  id: string;
  label: string;
  source: string;
  title: Pair;
  look_kind: "photoreal" | "flat2d";
  still: string | null;
  story: StudioStory | null;
  script: StudioScript | null;
  look: StudioLook | null;
  storyboard: StudioStoryboard | null;
  voice: StudioVoice | null;
  sound: StudioSound | null;
  edit: StudioEdit | null;
  screening: StudioScreening | null;
  final: { renders: StudioVideo[] } | null;
  stages: Record<StageKey, StageStatus>;
  placeholders: string[];
}

export interface StudioManifest {
  version: number;
  generatedAt: string;
  generator: string;
  projects: StudioProject[];
  warnings: string[];
}
