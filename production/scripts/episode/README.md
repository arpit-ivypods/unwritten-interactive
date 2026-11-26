# Episode toolchain

One shared build for every episode. It is generalised from the two proof scenes' scripts
(`content/proof/photoreal/{build_timeline,build_subs,make_review,wordtime}.py` and the flat2d
versions). Everything that was hard-coded for one scene in those scripts is now data in the
episode's own `edit.json`. Only the toolsmith step edits this folder (D-0M4). Episode editors
change only their own episode folder, which in practice means `edit.json`.

```
shots.json + script.<lang>.json + voice/ + sound/cues.json + series library + frames/ + edit.json
  └─ build_timeline.py ─> timeline.<lang>.json (picture, audio, supers)  dialogue-placement.<lang>.json
       └─ build_subs.py ─> subs.<lang>.json                  (app SubtitleTrack)
            └─ make_review.py ─> timeline.<lang>.review.json (subtitles burned in, review only)
  assemble.sh: all of the above for hi and en, then render.sh, master, verify.py -> JSON summary
```

## Commands

```bash
production/scripts/episode/assemble.sh <episode_dir>        # everything, prints a JSON summary
python3 -I production/scripts/episode/build_timeline.py <episode_dir> <lang>
python3 -I production/scripts/episode/build_subs.py <episode_dir> <lang>
python3 -I production/scripts/episode/make_review.py <episode_dir> [hi] [en]
python3 -I production/scripts/episode/verify.py <episode_dir> [--remaster]
python3 -I production/scripts/episode/convert_frame_review.py <episode_dir> [--check]   # frames/review.json to the one format
production/scripts/episode/test/run_proof_test.sh <scratch_dir> [--render]   # regression test
```

`assemble.sh` environment variables: `LANGS="hi en"` (the default), and `NO_RENDER=1` to build
and verify only (verify then reports the renders as missing). Step output goes to
`<episode_dir>/render/assemble.log`. The script prints one JSON object and exits 0 only if every
step and every check passed.

Outputs, all in the episode folder: `timeline.{hi,en}.json`, `timeline.{hi,en}.review.json`,
`dialogue-placement.{hi,en}.json`, `subs.{hi,en}.json`, and
`render/<name>.{hi,en}.mp4` plus `render/<name>.{hi,en}.review.mp4`. `<name>` is
`edit.json` `render_name`, or else the folder name. The build also writes caches:
`voice/asr/` (whisper), `voice/fx/<name>/` (filtered lines), `edit/voice/` (cut-off stubs) and
`voice/placeholder/`.

## Inputs

| File | Used for |
|---|---|
| `shots.json` | `shots[]`: `id`, `line_ids`, `duration_s` (planned; used only for silent shots), `silent_lead_s`, `camera_move` (below), `intensity`, `focus` or `camera_focus`, `frame` or `frame_source` (second framings, reused assets: below), `action` (slate text) |
| `script.<lang>.json` | `beats[].lines[]`: `id`, `speaker`, `text` (tags are stripped for subtitles), `target_seconds`; `beats[].supers[]` (below) |
| `voice/takes.json` or `voice/takes.<lang>.json` | planned takes: `speaker`, `target_seconds` (else taken from the script) |
| `voice/manifest.jsonl`, `voice/review.json` | generated takes and review verdicts (below) |
| `sound/cues.json`, `sound/manifest.jsonl`, `sound/<cue_id>.mp3` | the cue sheet: every list of entries with a `cue_id` (`cues`, `music`, `library_cues`, `library_cues_used`, `new_cues`, `one_off_cues`) gives per-cue `gain_db`, `type`, `loop`, `file`, `status`; also `duck.under_dialogue_db`, `mix.music_duck_under_dialogue_db`. One-off cues: below |
| `content/<series>/sound/library.json`, `manifest.jsonl`, `lib/` | library cues for an episode under `content/<series>/episodes/<id>/` |
| `frames/<shot>.png`, `frames/manifest.jsonl`, `frames/review.json` | picture; a missing, failed or rejected frame becomes a slate (below) |
| `edit.json` (optional) | per-episode overrides (below) |

**Cue files** are looked up in this order: the episode's `sound/manifest.jsonl` `file` (relative to the
episode, else to the series folder, else `content/...` from the repo root), then the cue sheet entry's
`file` (one-off cues only), then `sound/<cue>.mp3` or `.wav`, then the series library manifest `file`, then
`content/<series>/sound/lib/<cue>.mp3`. **Gain** is the cue sheet's `gain_db`, then the library's, then
`mix.starting_gains_db[type]`.

**Episode one-off cues** (made for one episode, not in the series library) live in
`<episode>/sound/<cue_id>.mp3` with rows in `<episode>/sound/manifest.jsonl`, in the series manifest's row
format (`cue_id`, `file`, `type`, `status`, ...). A cue may have several rows (attempts): the latest row with
status `ok` wins. A cue whose rows all have another status is not taken from any fallback path: status
`placeholder` (plan 7.8's tagged placeholder) is cut in from its `file` and tagged; any other status
(`failed`) drops it. **Tagging (D-023):** `meta.placeholders.sound` lists every placeholder cue, every
placed cue with no file, and every cue the cue sheet marks `status: "dropped"`. `meta.sound_missing` gives
the reason for each one that is not in the mix.

**Usable window.** Some library cues hold more than the part you want. Their usable window is
`edit.json` `sound_windows[cue]` (`[a_s, b_s]`, or `null` for none) if given. Otherwise it is a
`usable_s` or `usable_window_s` field on the cue or its manifest row. Otherwise it is read from the
QC note when the note says "use [final|loop] A-B s". The window becomes the default `trimBefore`
and the end of the file for that cue, and a looped bed loops inside it. Windows that were applied
are listed in `meta.sound_windows` with the text they came from. This was tested on series2:
`sfx_wood_revolver_knock` "Use final 0-0.25 s" and `amb_godown_night` "Use loop 13.5-29 s".

## Voice takes (D-0M2, D-014)

1. The candidates for a line are the manifest rows for that line and language with status `ok`,
   a model in `voice_models` (default `["v4"]`) and an existing file. Rows with `take_suffix` or
   `role` are A/B takes and are never cut in.
2. A row's take number is its `take` field. Without one, it is `_t<n>` or `.t<n>` in the file
   name, and otherwise 1.
3. A `review.json` verdict applies to its `take`. Rows without a take number count as take 1,
   and later rows override earlier ones. `reject` or `fail` drops a take. `retake` drops it only
   if a later take exists; otherwise it stands and a note is logged.
4. The latest take that remains wins, so a `_t2` beats take 1. Its `trim_in_s` becomes
   `trimBefore`.
5. If no take is usable, the line becomes a silent placeholder of `target_seconds`. It is flagged
   in the clip, `meta.placeholders` and the subtitle cue.

**Measurement.** Length comes from ffprobe. Speech and pauses come from silencedetect at -40 dB:
first and last speech, plus internal pauses of 300 ms or more. Word times come from `wordtime.py`.
A line is split at a pause only where the pause meets punctuation. Inside a segment, words are
spread by grapheme count. Local whisper.cpp stamps (`ggml-small`) replace that spread only for a
segment whose word count matches the script.

## Layout (D-014 rule 6: shots follow the voice)

All spacing is measured from speech, not from clip edges. Speech is never sped up. Per shot:

- **Lead**, the frames from the cut to the first speech: `layout.lead[shot]` if given; else 0
  after a cut-off; else the largest of `silent_lead_s`, `lead_default` and `lead_min[shot]`. The
  first shot gets at least `first_lead` and never a negative clip start.
- **Gap** between lines in one shot: `gap["lA>lB"]` or `gap_default`. It is widened when needed so
  the previous line's last cue can be read at `read_cps` (17 graphemes a second) before the next
  line starts.
- **Tail**, from the last speech to the cut: `tail[shot]` or `tail_default`. It is at least
  `min_last_segment` frames after the last segment starts, and it is extended for `read_cps`.
- **Silent shot** (no lines): `silent_frames[shot]`, or its planned `duration_s`. It is extended to
  `silent_min_end[shot]` (an expression) if that is later.
- **Cut-off** (`cutoffs[]`): the shot ends `run` frames before the line's last speech, so the next
  shot's first line cuts it off. The next shot's lead is `next_lead` (default 0). `read_cps` keeps
  the last cue readable. `trunc: n` writes a stub cut `n` frames after the last-syllable onset.
  `clip: "speech"` stops the clip one frame after the last speech.
- **A line listed in two shots** (series1 storyboards: `s01` and `s02` both list `l01`, with
  `line_part` saying where it splits) is one take split over consecutive shots. It is placed once, in the
  first shot, and the picture cuts to the next shot on a word inside it (its `cut_on_word` entry). The
  line must be the last line of the earlier shot and the first line of the later one, in consecutive
  shots, or the build stops. A line can run over three or more shots, with one entry per cut. With no
  entry, the cut is on the first word after the line's next split pause, and a note says so.
- **Cut on a word** (`cut_on_word[]`): `{"line", "word", "occurrence"?, "position"?, "shot"?}`, each of
  `word`, `occurrence` and `position` once or per language. The cut lands on the onset of the chosen word:
  `position` is the word's number in the line (1-based, tags stripped; if `word` is given too it must
  match), else the `occurrence`-th match of `word` (1-based, default 1; case and edge punctuation
  ignored). A note warns when `word` occurs more than once and neither is given. For a line split over
  three or more shots, `shot` names the shot the cut starts; entries without it are used in order.
  A line listed only in the later shot (series2 storyboards: `s14` lists `l09`, `s13` lists none of it)
  is laid out at the end of the previous shot, as before. An entry that is never used gets a note.
- **Hard cut to black** at the end, followed by `end_black` black, silent frames.

These checks fail the build (exit 1, listed in `meta.checks.layout_problems`): speech past its own
shot (except a cut-off's `run`), a negative clip start, or speech overlapping speech (except a
cut-off running under what cuts it). If the cut is longer than `max_seconds` (150, per
D-018/D-019/D-020), it is flagged in `meta.checks.length_ok`, and `verify.py` fails it.

## Picture: frames, second framings, reused assets, camera moves (D-010, D-023)

**`frames/review.json`, one format for both series (D-023 rule 4.9):**

```jsonc
{"schema": "frames-review/1", "episode": "s1e01", "by": "S9 ...",
 "frames": [
  {"shot": "s01", "verdict": "approved", "attempt": 1, "stage": "frame", "checks": {...}},
  {"shot": "s02", "verdict": "rejected", "attempt": 1, "why_rejected": "...", "fix": "..."},
  {"shot": "s02", "verdict": "approved with logged drift", "attempt": 2, "file_md5": "..."}   // the retake check adds a row
 ]}
```

- Verdicts: `approved` and `approved with logged drift` pass; `rejected` fails (a slate). `accepted...`
  (D-013 rule 11's better take) passes. The older words `pass` and `reject`, a bare list and `shot_id`
  are still read. Any other verdict makes the shot a slate, with a note.
- Per shot, the row with the highest `attempt` wins; a later row wins a tie.
- If that row judged an earlier take (its `attempt` is older than the frame manifest's latest ok attempt,
  or its `file_md5` is not the png on disk), it still applies. A rejected shot stays a slate until a row
  approves its retake. The shot is listed in `meta.frames_unchecked_takes`.
- A shown frame with no row is listed in `meta.frames_unreviewed` (the proofs have no review file).
- `convert_frame_review.py` rewrites an older file into this format. It keeps the original as
  `frames/review.prev.json` and changes no verdict.

**Second framings and reused assets** render from their source image with the shot's own move. They
are not slates, and they need no png of their own:

- A **second framing** is `frame.kind: "second_framing"` with `frame.source_shot` (series1), or
  `frame_source` / top-level `second_framings.<shot>.source` (series2). It shows
  `frames/<source>.png` and inherits the source's verdict: a second framing of a rejected frame is a
  slate until the source's retake is approved. It also takes its own review row if one exists. A
  `frames/<shot>.png` copy of the source (the old series2 workaround) is ignored, with a note.
- A **reused asset** is `frame.kind: "reused_asset"` with `frame.image` (for example the approved
  photograph at `content/series1/refs/photograph.png`). It is shown as it is. It is a slate only if the
  file is missing or its own review row rejects it.
- An absolute `frame.image` under a `content/` tree is read from this checkout's `content/`, so a scratch
  copy uses its own files. Images outside the episode folder are written relative to it
  (`../../refs/photograph.png`); `prepare-timeline.mjs` stages them.
- The largest custom-move `scale` of every second framing or reused asset is checked against
  `second_framings.<shot>.max_scale` or 1.3 (D-010). It is not a build failure: an overrun is listed in
  `meta.checks.second_framing_scale` and noted.
- `meta.frames` records, per shot, its kind, source, image, verdict and, for a slate, why.

**Camera moves are read from `shots.json` as written.** `camera_move` may be:

- a Move object (`{"preset": "custom", "easing", "from", "to"}` or `{"preset": "push-in", "intensity", "focus"}`; series1);
- a preset name with `intensity` and `focus` or `camera_focus` beside it;
- `"custom"` with the Move in the shot's `move` (series2).

A focus is added for `push-in`, `pull-out` and `drift`. `"custom"` with no from/to holds still, with a
note. `edit.json` `shots.<id>.move` still overrides (and the override is noted), but it is no longer
needed to copy a move.

## Subtitles (D-014; app format in `app/src/content/schema.ts`, `docs/contracts.md`)

`subs.<lang>.json` is the app's `SubtitleTrack` (`lang`, `cues[]` with `id`, `line_id`, `speaker`,
`startMs`, `endMs`, `text`, `words[]`), plus extra fields the app ignores: frames, speech frames,
the timing source, `validation`. The rules:

- There is one cue per segment. A segment longer than 2 × 32 graphemes (spaces count) is split
  again at sentence breaks.
- A cue starts on its segment's first speech.
- **No cue runs across a picture cut.** A cue that ends within 12 frames after a cut is clamped to
  the cut. A line that carries on over a cut (cut on a word) is split at the cut. If the part
  before the cut would be under 12 frames, it joins the next cue, which then starts on the cut.
- Cues of one line less than `subs.join_gap` frames apart (default 15) are held over the pause.
- A cue is held past its last speech until it reads at 17 graphemes a second or less, up to 2
  frames before the next cue and never past the next cut.
- Cues are at least 2 frames apart.
- `validate()` checks every rule above plus the app's own checks. The checks run frame by frame:
  no two cues on one frame, and each cue on exactly its frames. Any failure exits 1. A cue under
  800 ms is only a warning, because it is not a D-014 rule and the flat2d proof has one.

## Supers (D-024 ruling 3)

Orientation supers (a name and role, a place, a time) are picture text, not subtitles: `build_subs.py`
does not read them. They are burned into the clean cut and the review cut alike (ruling 3.6: the edit
draws them unless the app does; never both).

**Input:** `script.<lang>.json` `beats[].supers[]`: `{id, kind, with_line, on_shot, text, text_hi, text_en}`.
The cut uses `text_<lang>`, else `text`. A shot in `shots.json` may list supers it carries, as
`shots[].supers` (ids, or objects with `id`); that shot wins over the script's `on_shot` (ruling 3.5:
S7 copies each super onto its shot). `on_shot` may be a shot id, an id followed by prose
(`"s15 (the single)"`), or `"shot N ..."`, read as the N-th shot of the super's beat. A super object on a shot whose id no beat of
the script has is placed too, on that shot, from its own fields (`with_line`, `beat_id`, `text_<lang>`),
with a note.

**Start**, in order:

1. `edit.json` `supers.items.<id>.at` (an expression);
2. else the `with_line`, if the line is placed: on its first speech. If the line's shot started at
   most `snap_s` (0.5 s) before that speech, the super starts on the cut instead; if the next cut
   follows within `snap_s / 2`, on that cut. If the line plays over a shot that carries a plot
   overlay and `on_shot` is a placed shot without one, it starts on `on_shot`;
3. else the start of `on_shot`;
4. else the start of the beat's first shot (`shots[].beat_id`).

A super with none of these, or with no text in the cut's language, is listed in
`meta.supers.unplaced` with the reason.

**Hold:** `hold_s` (3.0 s), cut short at the first of: the end of the start shot's beat, the start of
the next shot that carries a plot overlay, and the picture end. An end at most 12 frames after a cut
moves back to the cut. A super never holds less than `min_s` (2.0 s, ruling 3.3); one that cannot get
that inside the limits holds `min_s` anyway and is flagged.

**Plot overlays** are `shots[].overlay` or `shots[].overlays` in `shots.json`, and any layer after the
first in `edit.json` `shots.<id>.layers` (the overlay layer). Ruling 3.3 keeps supers off them, so
these are flagged in `meta.checks.supers` (reported by `verify.py`, never failed): a super that starts
on such a shot, runs into one, is drawn over a slate, or overlaps another super in the same position
(drawn stacked). The build does not move a super off an overlay shot by itself, except in start rule 2.

**Output:** `timeline.<lang>.json` `supers[]`: `{id, kind, start, duration, text, fadeIn, fadeOut,
position?}` in frames. `meta.supers` has `burn`, `placed[]` (shot, start, duration, seconds, how it was
placed, what ended it, notes) and `unplaced[]`. The build prints one `supers placed` line per language.

**Look** (`production/remotion/src/Episode.tsx`, one style for both series; neither `style.json`
gives type guidance): a lower-third card, left-aligned 72 px in (the outer 6 % the frames keep
clear), at most 860 px wide, its bottom edge 630 px above the frame bottom. That is about 100 px above
a two-line burned review subtitle (its box ends 360 px from the bottom) and well above the app's own
subtitles and controls. Text before ` · ` is the main line (56 px, bold, white); the rest is the
second line (40 px, 86 % white). The plate is the app's subtitle plate (`rgba(10,8,18,0.66)`) with an
8 px bar in the app's saffron (`#f6a21e`). It fades in and out over 6 frames, with a 14 px slide in.
Devanagari lines use Kohinoor Devanagari (the macOS system font the burned subtitles already fall back
to) with a line height of 1.36, and Latin lines use Helvetica Neue. Text wraps rather than truncates.

**`edit.json` `supers`:**

```jsonc
"supers": {
 "burn": true,          // false: placed and logged in meta, but not drawn (the app draws them, ruling 3.6)
 "hold_s": 3.0, "min_s": 2.0, "snap_s": 0.5, "fade": 6,
 "items": {
  "su4": {"at": "s16.start", "hold_s": 3.5},   // or "until": <expression>
  "su5": {"position": "upper"},                // top third (240 px down), for a frame whose lower third matters
  "su9": {"drop": "reason"},                   // listed in meta.supers.unplaced with the reason
  "su2": {"text": {"en": "..."}}               // override the script text for one cut
 }
}
```

## `edit.json`

Every key is optional. Times in expressions are frames, `"<n>s"` for seconds (each number rounded
to a frame) or `"<n>f"` for frames.

```jsonc
{
 "render_name": "s1e01",            // render/<name>.<lang>.mp4
 "slate_color": "#1d2430",
 "max_seconds": 150,
 "voice_models": ["v4"],
 "measure": {"silence_db": -40, "pause_min_s": 0.3, "merge_blip_ms": 0, "edge_tol_ms": 5},
 "words": {"asr_match": "start"},   // or "midpoint" (the flat2d proof's rule)
 "subs": {"join_gap": 15, "clamped_words": "keep"},   // or "squeeze"
 "layout": {
  "first_lead": 4, "lead_default": 5, "use_silent_lead": true, "lead": {"s01": 27}, "lead_min": {"s04": 4},
  "gap_default": 8, "gap": {"l02>l03": 6}, "tail_default": 6, "tail": {"s09": 12}, "min_last_segment": 24,
  "read_cps": 17, "end_black": 12,
  "silent_frames": {"s08": 75}, "silent_min_end": {"s07": "l08.speech_end + 1.33s + 0.6s"},
  "cutoffs": [{"line": "l06", "run": 3, "read_cps": 17, "next_lead": 0, "trunc": 7, "clip": "speech"}],
  "cut_on_word": [{"line": "l08", "word": {"hi": "driver", "en": "driver"}}]
 },
 "lines": {"l01": {"gain_db": {"hi": -4}}, "l04": {"segment_gain_db": {"hi": 5, "en": 8}}, "l05": {"fx": "phone"}},
 "voice_fx": {"phone": {"speakers": ["caller"]},
              "through_steel": {"chain": "lowpass=f=2800,volume=-4dB", "match_loudness": false}},
 "shots": {
  "s07": {"move": {"preset": "custom", "from": {...}, "to": {...}},
          "punch": {"line": "l10", "lead": 4, "id": "s07-punch", "first_move": {...}, "move": {...}},
          "jitter": {"cue": "sfx_phone_buzz", "scale": 1.012, "amp": 0.55, "step": 2, "seed": 8},
          "layers": [{"src": "frames/s08.png", "depth": 1}, {"src": "frames/s08-name.{lang}.png", "depth": 1}]}
 },
 "sound_windows": {"sfx_keypad_ring": [0, 1.0]},
 "ducking": {"amountDb": -8},
 "sound": [ /* placements, below */ ],
 "notes": ["free text copied into meta.notes"]
}
```

- **Lead and tail tied to a pulsed cue.** For a phone buzz: `lead: {"after_pulse": {"cue": ..., "from": "s08.start"}, "plus": 1}`
  starts the first speech after the pulse running at the cut has ended.
  `tail: {"frames": 30, "in_pulse": {"cue": ..., "from": ..., "frames": 9}}` makes the cut land at
  least 9 frames into a pulse. A pulse is an RMS level within 10.5 dB of the file's peak.
- **`voice_fx`** ships one built-in chain, `phone`: band-pass 300-3400 Hz with light tanh
  saturation, loudness-matched to the clean take (from the photoreal proof). Any other effect is
  an ffmpeg `chain`. It applies by speaker (`speakers`) or by line (`lines.<id>.fx`).

**Sound placements** (`sound[]`). If `sound` is absent, `place` entries on the cue sheet are
used: `cues[].place[]` or `cues[].uses[].place`. Cues on the sheet with no placement are not
mixed. They are listed in `meta.sound_unplaced`, and `verify.py` reports them.

| Key | Meaning |
|---|---|
| `cue` | cue id |
| `kind` | `point` (default; plays the file once) or `bed` (from `from` to `to`, optionally looped) |
| `at` / `from`, `until` / `to` | expressions |
| `trim`, `len` | head trim and maximum length (expressions; the default trim is the usable window's start) |
| `db` / `gain_db` | gain relative to the cue's `gain_db` / absolute gain (`db` may be per language) |
| `fade_in`, `fade_out` | frames |
| `loop` | bed loops the file (default: the cue's `loop`) |
| `segments` | `[{"from", "to", "db"}]`: gain changes inside a bed, or splits of a point clip (4-frame crossfades) |
| `filter` | an ffmpeg audio chain (`"lowpass=f=200"`), or `{"lowpass_hz", "highpass_hz", "poles" (default 2), "volume_db"}`. The cue is filtered once into `edit/sound/<cue>.<hash>.wav` (same length, so windows and loops hold), and that file is placed. Use it with `db` for a low-passed, lowered stretch of a bed. Listed in `meta.sound_filters` |
| `loop_xf`, `window_s` | bed looping `window_s` of the file with an `loop_xf`-frame crossfade at each join, for files that are not seamless loops |
| `end_on_grid` | `{"grid": "2.5s", "max": "20s"}`: trim the head so the clip's end falls on the file's bar line |
| `fill_tail` | a point that ends before `until` repeats its last part, crossfaded, up to it |
| `bus` | `music` or `sfx` (default: `mus*` types and ids go to music) |
| `duck` | music clip flag passed to Remotion |
| `id` | `#suffix` (appended to the cue id) or a full id |

**Expressions** may use numbers and `s`/`f` units, `+ - *`, `min()`, `max()`, and `len(<cue>)` (the
cue's frames inside its window). Names: `start`, `end` (picture end), `total`;
`<shot>.start|end|dur`; and `<line>.clip_start|clip_end|speech_start|speech_end|split<k>_start|split<k>_end`,
where `split<k>` is the k-th pause that splits the line into subtitle segments.

## Verification (`verify.py`, run by `assemble.sh --remaster`)

The checks, per language and for both the clean and the review cut:

- The video is H.264, 1080x1920, 30 fps, with exactly `durationFrames` frames.
- Loudness is within ±0.5 LU of -14 LUFS, and true peak is -1 dBTP or lower (D-0M4). These are
  measured with the loudnorm pass, to two decimals.
- A file outside that tolerance is run through `master-audio.sh` once more and measured again.
  The before and after values are in `remastered`.

Across files, the Hindi and English cuts must differ (md5), and each language's clean and review
cuts must differ. For subtitles, `subs.<lang>.json` validation must be ok, the review timeline must
burn exactly those cues, and no cue may end after the video. The cut must be 150 s or less. The
summary also lists placeholders and unplaced cues. It also lists, without failing on them,
`sound_missing`, `frames_unchecked_takes`, `frames_unreviewed`, `second_framing_scale` and `supers`
(how many are burned and placed, the unplaced ones and the `meta.checks.supers` flags).

## Tested (26 Nov, supers for D-024)

On a scratch copy of s2e01 (`content/series2` without the other episodes), with the rewritten scripts,
the re-voiced takes and the old `shots.json`. Its `edit.json` `cut_on_word` entries for l09 and l15 no
longer match the rewritten lines and stop the build, so they were removed in the copy only.

- `assemble.sh` with `NO_RENDER=1`: every build step passed in both languages, and `subs.*.json`
  validate (44 hi and 41 en cues). verify's only problems are the stale renders copied into the scratch
  folder, which have the old length.
- Against a build of the same copy with the toolchain before this step, `timeline.{hi,en}.json` are
  identical apart from the new `supers` key, `meta.supers`, `meta.checks.supers` and the super notes.
- All six supers are placed in both cuts. su1, su2, su4 and su5 start on the cut 5 frames before their
  line's speech and hold 3.0 s. su3 (no line) starts on s10. su6's line l29 is in no shot yet, so it
  starts on its `on_shot` s12.
- Four flags in each cut: su2 starts on s05 (`ov_fake_board`); su3 gets only 1.8 s before s11 (token
  overlay layer); su6 gets only 1.0 s before s13 (`ov_shield`), so both hold 2.0 s into those shots; su4
  starts on s15, which has the `ov_shield` layer in `edit.json`.
- Stills of the review cut (subtitles burned in) at hi frame 1540 and en frame 1600 (su4, the longest
  text: `render/super-check.{hi,en}.png` in s2e01). Devanagari conjuncts (त्रि, प्र, ठी) are drawn
  correctly, and the super sits about 100 px clear of a two-line English subtitle. The stills were looked
  at, not measured. Stills of su1 and su5 (hi) and an `"upper"` super stacked with a lower one were also
  looked at.
- A synthetic call covered `"shot N (...)"` `on_shot` prose, the overlay rule in start rule 2, a
  `shots[].supers` override, the beat-start fallback, a super with no text, and stacked supers.
- Proof scenes (`test/run_proof_test.sh`, with and without `--render`): compare ok in both languages, as
  before, and all four clean renders are byte-identical to the proof renders. The proofs have no supers,
  so this shows the new layer draws nothing when there are none. (The `--render` run came before the
  last `build_timeline.py` edits, which touch only super placement; the run without `--render` came
  after them.)

## Tested (26 Nov, toolsmith step for D-023)

The toolsmith step ran on scratch copies of both wave-1 episodes, frozen at one moment. The only
changed input was `frames/review.json`, converted by `convert_frame_review.py`.

- **s2e01**, the old toolchain against this one on the same snapshot: hi and en timelines are
  identical except the eight second-framing shots (s04, s08, s21, s24, s25, s27, s33, s35). Their
  `image` is now the source frame, not the copied png; each copy was md5-identical to its source.
  `subs.*.json` and `dialogue-placement.*.json` are identical. The same six shots are slates (s14,
  s16, s20, s26, s28, s29). s14's retake (attempt 2) landed during the step and has no review row,
  so s14 and s20 stay slates and s14 is in `meta.frames_unchecked_takes`.
- **s1e01** (it crashed before): builds in both languages at 106.00 s hi and 99.50 s en. The six
  slates are the four rejects (s02, s03, s20, s21) and the two second framings of rejects (s05,
  s25). The seven other second framings and the photograph (s31) show their source image. Shot
  timing, moves, every dialogue, music and sfx clip, and the 46 hi and 44 en subtitle cues equal the
  editor's earlier scratch diagnostic, which was built from hand-altered inputs. The only extra is
  `sfx_s1e01_bare_feet`, whose file landed during the step.
- **Moves:** with every `shots.<id>.move` removed from both `edit.json` files, all four timelines are
  identical.
- **Cut-on-word:** `occurrence` 2 of "the" in en l04 and l05 cuts on "The key" / "The house" (5 and
  6 frames earlier than "key" / "house"); `position` 3 in en l02 cuts on "I". A synthetic three-shot
  split (l05 over s10-s12, with a `shot`-named entry) builds without layout problems. A
  non-consecutive listing stops the build with a message.
- **Filter:** a `{"lowpass_hz": 180}` bed of `amb_bedroom_night` under s33 at `db: -12` came out at
  the same 29.0 s, with energy above 1 kHz down from -54.7 to -79.5 dB mean.
- **One-off cues:** with test manifest rows, a failed-then-ok cue used the ok row; a `placeholder` row
  was cut in and tagged; a `failed`-only cue was dropped and tagged; a library cue marked
  `status: "dropped"` on the cue sheet was tagged.
- **Renders** (`assemble.sh` on the scratch copies, so no real render was touched): every step and
  verify check passed for both episodes. s1e01: 3180/2985 frames, -14.13/-14.15 LUFS, -1.04/-1.04 dBTP,
  46/44 subtitle cues valid. s2e01: 3281/3266 frames, -14.24/-14.36 LUFS, -1.16/-1.14 dBTP, 42/37 cues
  valid. In all four, hi and en differ and clean and review differ. Render time was about 55 s a file
  (Remotion about 40 s, mastering about 13 s). Frames pulled from the s1e01 hi render show the
  photograph at s31 and the s14-derived lane at s16 as pictures, not slates.
- **Proof scenes** (`test/run_proof_test.sh --render`): compare ok in both languages with a 0-frame
  difference, the same intended deviations as before, and all four clean renders byte-identical to the
  proof renders.

## Tested (26 Nov, first build)

`test/run_proof_test.sh <scratch> --render` rebuilds both proof scenes in a scratch copy. It uses
`test/proof-photoreal.edit.json` and `test/proof-flat2d.edit.json`, which hold the constants of the
two proof builders as data. `test/compare.py` checks the result against the checked-in cuts with a
tolerance of 1 frame.

- **Timelines**, both scenes and both languages: every shot, dialogue clip, music and sfx clip,
  trim, gain, fade and ducking value is identical (0-frame difference). Dialogue audio is
  md5-identical, including the regenerated phone-filter WAVs and the flat2d cut-off stubs.
- **Clean renders** (`proof.{hi,en}.mp4`) are byte-identical to the proof renders. Loudness is
  -14.44/-14.49 LUFS and -1.09/-1.10 dBTP for photoreal hi/en, and -14.26/-14.25 LUFS and
  -1.07/-1.04 dBTP for flat2d hi/en.
- **Subtitles:** cue frames are identical. Flat2d word times are within 30 ms, under one frame;
  the proof used floor ms where this toolchain uses half a frame early.

Intended differences from the proof subtitles:

1. Photoreal l08 (hi and en): the proof's cue ran 42 frames (hi) and 31 frames (en) across the
   s05/s06 cut-on-word cut, which D-014 rule 7 forbids. The proof's validator only checked cues
   that ended within 12 frames after a cut. The toolchain splits the cue at the cut: hi 686-701 and
   703-745, en 682-712 and 714-746.
2. Line breaks in three flat2d cues (hi l07, en l07, en l09). The flat2d builder counted graphemes
   without spaces, so a 34-grapheme Hindi line (spaces counted) stayed on one line. The toolchain counts spaces and
   prefers sentence breaks. No timing changes.
3. Cue ids are `c001`..., as in `docs/contracts.md`; the proofs used `c01`.

Review renders differ from the proof's only by these burned-in cues; SSIM against the proof review
renders is 0.997-0.999.

A scratch copy of series2 `s2b02` was also built and its Hindi cut rendered (synthetic
one-shot-per-beat `shots.json`, no frames, so every shot is a slate). This exercised
`takes.<lang>.json`, library cues reached through `../../sound/lib`, QC windows, a missing cue, and
the reading-room gap. Result: 113 s; subtitles valid in both languages; the Hindi render had 3382
frames as planned, at -14.2 LUFS and -1.2 dBTP.

## Not verified

- Supers have not been watched in motion (fade and slide) or on a phone. Their width and position were
  judged on 1080x1920 stills only, on flat 2D frames; no Series 1 (photoreal) frame was tried.
- The supers' font is a macOS system font (Kohinoor Devanagari). A render on another OS would need it,
  or a bundled font.

- Nothing in the toolsmith step has been listened to or watched in motion. That includes the
  filtered bed, the earlier cut on "The" in en l04 and l05, and the second framings' crops.
- D-023 rule 3 items the toolsmith brief did not cover, still open: an `edit.json` override of where a
  line's subtitle splits; slates in the cut's own language that wrap rather than truncate (the
  80-character cut of `action` is still in `build_timeline.py`; the slate text itself is in
  `production/remotion`); and the overlay layer.
- Also open: the s2e01 editor's note that the cut-on-word cut is placed at round(onset) while
  `read_end` counts from floor(onset). The editor works around it with `tail.s20: 8`.
- Nothing has been listened to: not the mix, not the QC windows, not the reading-room gaps.
- The cue sheets' prose anchors ("on l02, as she drops the phone") are not parsed. Each episode
  editor writes the placements into `edit.json` `sound[]`.
- Expression errors drop the cue with a note rather than failing the build.
- Render time beyond 113 s of content: the s2b02 test took 29 s in Remotion plus 14 s mastering.
