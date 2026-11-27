# Unwritten timeline format

One `timeline.json` describes one deliverable (episode, glimpse or proof scene,
one language). It drives the Remotion composition `Episode`: 1080x1920, 30 fps,
H.264. Duration and content come only from the timeline.

```
timeline.json ──prepare-timeline.mjs──> props.json + staged public/ ──remotion render──> raw.mp4 ──master-audio.sh──> out.mp4
```

`production/scripts/render.sh` runs the whole chain.

## Commands

```bash
# Render an episode (H.264 1080x1920 30 fps, audio mastered to -14 LUFS / -1 dBTP)
production/scripts/render.sh path/to/timeline.json path/to/out.mp4
#   STRICT=1      fail on any missing asset instead of slating / dropping it
#   KEEP_STAGE=1  keep production/remotion/.render/<job>/ (props.json, raw.mp4)
#   extra args go to `remotion render`, e.g. --frames=0-89 or --concurrency=4

# Preview in Remotion Studio
production/scripts/studio.sh path/to/timeline.json

# Frame prep: cover 1440x2560 with lanczos, centre-crop to exactly 1440x2560
production/scripts/upscale.sh in.png out.png

# Two-pass loudnorm of an MP4's audio, video stream copied untouched
production/scripts/master-audio.sh in.mp4 out.mp4 [I=-14] [TP=-1] [LRA=11]

# Only resolve a timeline (validation, warnings, props.json)
node production/scripts/prepare-timeline.mjs timeline.json <stageDir> [--strict]
```

Re-create and check the synthetic test: `production/remotion/test/make-test.sh`,
then `render.sh production/remotion/test/timeline.json production/remotion/test/out/test.mp4`,
then `production/remotion/test/verify.sh production/remotion/test/out/test.mp4`.

## Units and paths

- **Time is in frames at 30 fps.** Any time field `x` can be given as `xSec`
  (seconds) instead; it is rounded to the nearest frame. Example: `"start": 45`
  or `"startSec": 1.5`.
- **Asset paths** are absolute, or relative to the folder holding the
  timeline.json. `prepare-timeline.mjs` hard-links each file into a per-render
  public folder and rewrites the path, so assets can live anywhere on this disk.
  `http(s)://` URLs are passed through.

## Top level

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | file name | Shown in debug overlay and logs |
| `fps` | number | 30 | Must be 30 if given |
| `durationFrames` / `durationSec` | number | end of last shot | Total length. Audio past it is cut |
| `background` | CSS colour | `#000` | Shown in gaps between shots |
| `slateColor` | CSS colour | `#2b2b2b` | Colour for slates without `color`, incl. auto-slates for missing frames |
| `shots` | Shot[] | required | Picture track |
| `audio` | object | none | `dialogue`, `music`, `sfx`, `ducking` (below) |
| `subtitles` | Cue[] | none | `{startMs, endMs, text}`; only drawn when `debug.burnSubtitles` |
| `subtitlesFile` | path | none | JSON file with the same Cue[] (used if `subtitles` absent) |
| `debug.burnSubtitles` | bool | false | Burn subtitles in, **for review renders only**. The app draws subtitles; deliverables must not have them |
| `debug.showInfo` | bool | false | Overlay `id · frame · timecode · shot id` |
| `supers` | Super[] | none | Orientation supers (D-024 ruling 3), burned into every cut: `{id, kind, start, duration, text, fadeIn, fadeOut, position}` (times in frames, or `*Sec`). Text before ` · ` is the main line. A lower-third card; `position: "upper"` puts it in the top third. Fades default to 6 frames. See `production/scripts/episode/README.md`, "Supers" |

## Shot

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | index | Shot id, e.g. `"E1-012"` |
| `type` | `"image"` \| `"slate"` | `"image"` | |
| `image` | path | | Single oversized still, ideally exactly 1440x2560 (run `upscale.sh`). Other sizes are centre-cropped (warning if smaller or not 9:16) |
| `layers` | `{src, depth}[]` | | Parallax, back to front, used instead of `image`. Each layer is a full-frame image (foreground PNGs with alpha). `depth` multiplies the move: e.g. background `0.6`, foreground `1.5`. Default 1 |
| `plotText` | `{text, x, y, fontSize, lang?, space?, rotation?, color?, plate?}[]` | none | Localized text burned into an image shot. Coordinates centre the text block in the 9:16 frame (0..1), and font size is in output pixels. `space: "image"` (default) follows the base image move; `"screen"` fixes the text to the frame. Rotation is clockwise in degrees. The default text colour is white. `plate: true` adds a dark translucent background. |
| `start` / `startSec` | frames | end of previous shot | Absolute start |
| `duration` / `durationSec` | frames | required | Time on screen |
| `move` | Move | `hold` | Camera move (below) |
| `transitionIn` | `{type, frames}` | cut | `"cut"`, `"crossfade"` (previous shot is kept on screen underneath for `frames`, so do not shorten it), `"fade"` (from black). `frames` default 12 |
| `transitionOut` | `{type, frames}` | cut | `"cut"` or `"fade"` (to black) |
| `color` | CSS colour | `slateColor` | Slate card colour |
| `text` | string | `Shot <id> — in production` | Slate text override |
| `note` | string | | Smaller second line on a slate |

**Missing frames:** if `image` or any layer file does not exist, the shot is
rendered as a slate (`Shot <id> — in production`, colour `color` or
`slateColor`) and a `WARN` line is printed. With `STRICT=1` it is an error.

### Move

| Field | Type | Default | Meaning |
|---|---|---|---|
| `preset` | see below | `hold` | |
| `intensity` | 0..1 | 0.5 | Amount of zoom / travel |
| `easing` | `linear` \| `ease-in` \| `ease-out` \| `ease-in-out` | `ease-in-out` | Applied over the whole time the shot is on screen (including a cross-fade tail) |
| `focus` | `{x, y}` 0..1 | `{0.5, 0.5}` | Zoom origin for push-in / pull-out / drift (e.g. a face) |
| `from`, `to` | `{scale, x, y}` | | Only for `custom`. `scale` ≥ 1 relative to "image covers frame"; `x`,`y` in -1..1 of the travel that scale allows |

Presets (scale is relative to the image just covering the frame; 1.333 is the
most the 1440x2560 source allows before it is enlarged past native resolution):

| Preset | Motion at intensity `i` |
|---|---|
| `push-in` | scale 1 → 1 + 0.24·i, about `focus` |
| `pull-out` | scale 1 + 0.24·i → 1 |
| `pan-left` / `pan-right` | scale 1 + 0.3·i, camera travels across the full margin left / right |
| `tilt-up` / `tilt-down` | same, vertically |
| `drift` | slow diagonal float with a small zoom (1.04+0.04·i → +0.06·i) |
| `hold` | static |
| `custom` | `from` → `to` |

Zoom is interpolated geometrically (constant perceived speed). Translation is
always clamped so a frame edge is never revealed.

## Audio

All clips: `src` (path), `start`/`startSec` (absolute, default 0),
`duration`/`durationSec` (default: the file's length minus `trimBefore`,
probed with ffprobe), `trimBefore`/`trimBeforeSec` (skip the start of the
file), `volume` (linear gain, 1 = unchanged), optional `id`.

| List | Extra fields | Notes |
|---|---|---|
| `audio.dialogue[]` | | Placed at exact frames. Every dialogue clip ducks the music |
| `audio.music[]` | `fadeIn`, `fadeOut` (frames), `loop` (bool), `duck` (bool, default true) | `volume` default 0.5. With `loop` and no `duration`, runs to the end of the episode |
| `audio.sfx[]` | `fadeIn`, `fadeOut` | `volume` default 1 |
| `audio.ducking` | `enabled` (true), `amountDb` (-10), `attack` (8 frames), `release` (15 frames), `holdGap` (20 frames) | Music gain drops by `amountDb` while any dialogue plays. The ramp down finishes as the line starts; the ramp up starts as it ends (smoothstep, no clicks). Lines closer than `holdGap` stay ducked through the gap |

Clips that run past the episode end are cut (warning, except music). Missing
audio files are dropped with a `WARN` (error with `STRICT=1`).

Final mix: Remotion renders AAC 320k, then `master-audio.sh` runs a two-pass
EBU R128 loudnorm to -14 LUFS integrated, -1 dBTP, LRA 11 (linear mode when
the measurements allow it), 48 kHz AAC 256k, video copied.

## Resolved props (what Remotion receives)

`prepare-timeline.mjs` writes the same structure with everything resolved:
all times in frames, every shot has `start` and `duration`, every audio clip
has `duration`, paths are relative to the staged public folder, missing frames
are slates. Type definitions: `src/types.ts`. A timeline that already uses
only frame fields, explicit durations and paths inside a `--public-dir` can be
passed straight to `remotion render ... --props=timeline.json`.

## Example

```json
{
  "id": "S1-E1-hi",
  "durationSec": 6,
  "slateColor": "#3a3a5c",
  "shots": [
    {"id": "001", "image": "frames/001.png", "durationSec": 2.5,
     "move": {"preset": "push-in", "intensity": 0.8, "focus": {"x": 0.5, "y": 0.4}},
     "transitionIn": {"type": "fade", "frames": 9}},
    {"id": "002", "duration": 75,
     "layers": [{"src": "frames/002-bg.png", "depth": 0.6}, {"src": "frames/002-fg.png", "depth": 1.6}],
     "move": {"preset": "pan-right", "intensity": 0.7},
     "transitionIn": {"type": "crossfade", "frames": 12}},
    {"id": "003", "type": "slate", "color": "#5a2a82", "duration": 30,
     "transitionIn": {"type": "crossfade", "frames": 10}, "transitionOut": {"type": "fade", "frames": 10}}
  ],
  "audio": {
    "dialogue": [{"id": "L1", "src": "audio/L1.mp3", "startSec": 1.5},
                 {"id": "L2", "src": "audio/L2.mp3", "start": 120}],
    "music": [{"id": "bed", "src": "audio/bed.mp3", "loop": true, "volume": 0.6, "fadeIn": 15, "fadeOut": 30}],
    "sfx": [{"id": "whoosh", "src": "audio/whoosh.wav", "start": 75, "volume": 0.5}],
    "ducking": {"amountDb": -10, "attack": 8, "release": 15}
  },
  "subtitlesFile": "subs/S1-E1-hi.json",
  "debug": {"burnSubtitles": false}
}
```

The working version of this example is `test/timeline.json`.
