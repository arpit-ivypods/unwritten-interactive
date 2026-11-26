# Unwritten app: contracts

Written by the P1 Tech lead, 26 Nov 2026. This is the agreement between the content track and the product track, and between the five engineers who build the app in parallel. Where this file and the code disagree, the code in `app/src/content/schema.ts` and `app/src/state/rules.ts` wins, and this file should be corrected.

Plan: `docs/unwritten-poc-plan.md` (section 9 overrides earlier sections). Design system: `docs/design-system/project/`.

## 1. Where things are

| Path | What | Owner |
|---|---|---|
| `app/` | The Next.js app | all |
| `app/public/media/catalog.json` | Which series are live, and the three "coming next" teasers | content |
| `app/public/media/<seriesId>/series.json` | The manifest for one series | content |
| `app/public/media/<seriesId>/...` | Videos, stills, subtitles, voice samples | content |
| `app/src/content/` | Manifest types, validator, helpers, loader | tech lead |
| `app/src/state/` | Stores, product rules, presenter helpers | tech lead |
| `app/src/lib/routes.ts` | Every URL | tech lead |
| `app/scripts/` | `make-placeholders.mjs`, `check-content.mjs`, `install-playable.mjs` | tech lead |
| `app/e2e/` | Playwright tests; `state.ts` seeds localStorage | test engineer (helpers: tech lead) |

## 2. Commands

Run everything from `app/` with pnpm.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3210 |
| `pnpm build` | Production build. Must pass |
| `pnpm start` | Serves the production build on port 3210 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates route types, then `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest), about 3 seconds |
| `pnpm test:e2e` | Playwright against `pnpm dev` (reuses a dev server already on 3210) |
| `pnpm test:e2e:prod` | Builds, serves on port 3211, runs Playwright |
| `pnpm placeholders` | Regenerates placeholder media and manifests (section 6) |
| `pnpm content:check` | Checks everything under `public/media` against the contract |

Checked on 26 Nov: lint, typecheck, 189 unit tests, build, and the e2e smoke test in both modes all pass on the scaffold.

### Working in parallel in one folder

- **One dev server.** Port 3210 is fixed. If `pnpm dev` fails with `EADDRINUSE`, a server is already running: use it. Do not start a second one on another port.
- **One build at a time.** A second `pnpm build` stops with "Another next build process is already running". Wait and retry. To check your own work without a build, run `pnpm typecheck && pnpm lint && pnpm test`.
- **Do not add dependencies.** Two `pnpm add` at once corrupt the lockfile. Already installed: `zustand`, `gsap`, `@gsap/react`, `zod`, `clsx`, `lucide-react`, `html-to-image`; for tests `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@playwright/test`, `@axe-core/playwright`. If something is truly missing, say so in your report and the orchestrator adds it.
- **Stay in your folders** (section 3). Shared files are owned by the tech lead and are built so you do not need to edit them.

### Next.js settings you must know

This is Next.js 16.4. Read `app/AGENTS.md` and the guide you need in `app/node_modules/next/dist/docs/` before writing code: several APIs differ from older versions.

- **Cache Components is off** (`next.config.ts`). `create-next-app` turns it on by default; I turned it off. With it on, a route stays mounted but hidden after navigation, so a hidden `<video>` keeps playing, and reading the clock during prerender is a build error. This app has no server data, so it gains nothing from it. Do not turn it back on.
- `params` is a Promise: `const { seriesId } = await props.params`. Type pages with the generated helper, `PageProps<"/series/[seriesId]">`.
- Every dynamic route has `generateStaticParams` (from `src/lib/staticParams.ts`) and `dynamicParams = false`, so unknown ids are a 404. Keep both when you replace a stub.
- The dev indicator is switched off so it cannot cover the dock in screenshots and tests.
- `package.json` has `"type": "module"`. Config files and scripts are ES modules.
- Next's telemetry is disabled in every script (`NEXT_TELEMETRY_DISABLED=1`). Nothing leaves this Mac.
- Server components may import pure modules (`@/content`, `@/content/helpers`, `@/state/rules`, `@/lib/routes`). Stores and hooks (`@/state`) are for client components only.

## 3. File ownership

Each engineer writes only inside their own folders. Stubs I left in your folders are yours to replace.

| Engineer | Owns | Stubs waiting for you |
|---|---|---|
| Design system (P2) | `app/src/styles/`, `app/src/components/ds/` | `src/styles/globals.css` (Tailwind import only), `src/styles/fonts.ts` (exports `fontClassName`, put on `<html>`) |
| Player (P3) | `app/src/components/player/`, `app/src/app/watch/` | `src/app/watch/[seriesId]/[playableId]/page.tsx` |
| Flows (P4) | `app/src/app/` (all routes except `watch/` and `studio/`), `app/src/components/flow/` | every other `page.tsx`; `src/components/flow/AppChrome.tsx` (wraps every page: nav, dock, welcome gate, presenter drawer) |
| Motion (P5) | `app/src/motion/` | `src/motion/MotionRoot.tsx` (wraps the app: GSAP registration, reduced motion) |
| Studio (P6) | `app/src/app/studio/`, `app/src/components/studio/` | `src/app/studio/page.tsx` |
| Test (P7) | `app/e2e/` (new spec files) | `e2e/smoke.spec.ts` and `e2e/state.ts` are mine; add your own files beside them |
| Tech lead (P1) | `app/src/content/`, `app/src/state/`, `app/src/lib/`, `app/src/test/`, `app/src/components/stub/`, `app/src/app/layout.tsx`, `app/scripts/`, config files, `app/public/media/` placeholders | |

Rules for the shared edges:

- **`src/app/layout.tsx` is not edited by anyone.** It imports `@/styles/globals.css`, `fontClassName` from `@/styles/fonts`, `MotionRoot`, `AppChrome` and `StoreHydration`. Change your own file; keep its name and export.
- `<html lang="en" data-theme="light">` and `<body class="uw">` are set in the layout. If the design-system engineer adds a dark theme switch, it sets `data-theme` on `<html>` from a client component in `components/ds/`.
- Motion wraps and enhances; it does not rewrite other people's components. If a component needs a hook or a ref for motion, the motion engineer asks its owner (through the orchestrator) or exports a hook from `src/motion/` for the owner to call.
  *Motion as built (added by the P5 Motion engineer, 26 Nov):* `src/motion/motion.css` keys off existing hooks, so these must stay stable or be updated together with it: `.flow-layout > .flow-side > *` (panels; the phone sheet is `.flow-sheet`), `data-screen="question|glimpses|ballot"` (the held ballot moment), `.flow-pair`, `.flow-series-dock`, `.flow-shelf`, `.flow-page`, `.flow-welcome`, `.uwp-info > .uw-glass`, `.uwp-controls-inner`, and `.uw-ambient--screen` with its `img.uw-ambient-img` (the room cross-fade between screens adds a temporary `img[data-motion-ghost]` there). Opt in from anywhere: `data-motion="rise"`, `data-motion="press"`, `data-motion-tilt`. Never put an opacity animation on a wrapper around glass. Under reduced motion, `--uw-motion` is 0 and `usePrefersReducedMotion()` from `@/motion` is true.
- Player and flows meet only through the state model and `stepHref` (section 8). Neither imports the other's components, except that flows may place the player's stage component on a screen if the player engineer exports one from `components/player/`.
- `src/components/stub/` goes away when no page imports `ScreenStub` any more. Whoever replaces the last stub deletes the folder.

## 4. Routes

Every screen in plan section 4. Build links with `routes.*` from `@/lib/routes`, never with string literals.

| # | Screen | Route | `routes.` | Owner | Reads from the state model |
|---|---|---|---|---|---|
| 1 | Welcome | `/welcome` | `welcome()` | flows | `setLanguage`, `markWelcomeSeen` |
| 2 | Home | `/` | `home()` | flows | `allSeries`, `teasers`, `useDayOneCountdown`, `useSeriesRules(series).next` |
| 3 | Series page | `/series/[seriesId]` | `series(id)` | flows | `useSeriesRules`: `history` (rail states), `next`, `access(id)` |
| 4 | Player | `/watch/[seriesId]/[playableId]` | `watch(id, playableId)` | player | section 8 |
| 5 | Question | `/series/[seriesId]/question` | `question(id)` | flows | `rules.question` |
| 6 | Glimpses | `/series/[seriesId]/glimpses` | `glimpses(id)` | flows | `progress.glimpsesWatched`, `rules.question.glimpsesAvailable` |
| 7 | Ballot | `/series/[seriesId]/ballot` | `ballot(id)` | flows | `rules.canCastBallot`, `castBallot`, `rules.tally` |
| 8 | Ending | `/series/[seriesId]/ending/[branch]` | `ending(id, "A" \| "B")` | flows | `rules.ending(branch)` |
| 9 | Keep or move | `/series/[seriesId]/keep-or-move` | `keepOrMove(id)` | flows | `rules.canMoveBallot`, `moveBallot`, `rules.tally` |
| 10 | Day-2 result | `/series/[seriesId]/result` | `result(id)` | flows | `rules.result` |
| 11 | My choices | `/my-choices` | `myChoices()` | flows | `useSeriesRules(series).history` for each series |
| 12 | Share card | `/series/[seriesId]/share` | `share(id)` | flows | `progress.ballot`, `cliffhangerStill(series)` |
| 13 | Studio | `/studio` (sub-routes are the studio engineer's choice, under `/studio/`) | `studio()` | studio | content only |
| 14 | Demo controls | not a route: a drawer in `AppChrome`, opened by a long press on the wordmark or by `?demo=1` on any URL | `DEMO_QUERY_FLAG` | flows | section 9 |

- `playableId` is an episode id (`s1e01`, `s1a02`) or a glimpse id (`s1ga`, `s1gb`). One player route plays both. `findPlayable(series, id)` tells you which.
- `[branch]` is `A` or `B`, upper case.
- A `Step` from the rules becomes a URL with `stepHref(seriesId, step)`.
- If the viewer opens a screen they cannot be on yet (the ballot before the question, the result on day 1), send them to `stepHref(seriesId, rules.next)`. Do it after `rules.hydrated` is true, never before.
- Welcome gate: once hydrated, a viewer with `welcomeSeen === false` goes to `/welcome` from any viewer screen. `/studio` is not gated.
- Nav destinations in the design system's NavBar preview are Tonight, Series, My choices and Studio. Tonight is `/`, My choices is `/my-choices`, Studio is `/studio`. There is no series index route: "Series" opens `routes.series(id)` for the series on the stage (default: the first in the catalog).

## 5. Content manifest

Types and the runtime validator: `app/src/content/schema.ts`. The app reads only these files.

### Rules that hold everywhere

- Times are whole milliseconds from the start of **that language's** video file.
- `hi` is Hinglish: Hindi in Devanagari, English words in Latin script, in the same line. `en` is the English adaptation. Every text field has both.
- Paths are site-absolute and start with `/media/<seriesId>/`. They are used as `src` as they are.
- **The Hinglish and English cuts of one episode have the same shots in the same order, with different timings and different total lengths.** This is why duration and shot timing are per language.

### Folder layout

```
app/public/media/
  catalog.json
  series1/
    series.json
    poster.jpg            3:4 character-led still for the series card
    backdrop.jpg          9:16 still that lights the room
    cast/<castId>.jpg     optional portrait
    cast/<castId>.hi.mp3  voice sample, Hinglish
    cast/<castId>.en.mp3  voice sample, English
    episodes/<episodeId>/
      hi.mp4  en.mp4      H.264, 1080x1920, 30 fps, no burned-in subtitles
      hi.json en.json     subtitles
      poster.jpg
      shots/<shotId>.jpg  one still per shot
    glimpses/<glimpseId>/ same files as an episode
```

Ids: `series1` has `s1e01`, `s1e02` (shared), `s1a01`-`s1a03`, `s1b01`-`s1b03`, glimpses `s1ga`, `s1gb`; choice after episode 2. `series2` has `s2e01`-`s2e03` (shared), `s2a01`-`s2a03`, `s2b01`-`s2b03`, glimpses `s2ga`, `s2gb`; choice after episode 3.

### `catalog.json`

```json
{ "schemaVersion": 1, "series": ["series1", "series2"], "teasers": [ { "id": "t1", "title": {"hi": "...", "en": "..."}, "hook": {"hi": "...", "en": "..."}, "visualStyle": "Photoreal", "placeholder": true } ] }
```

- `series`: live series in display order; the first is tonight's series.
- `teasers`: at most three "coming next" tiles. No episodes, no artwork, not links. They live here and not in `series.json` because they belong to no series.

### `series.json`

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `id` | string | Same as the folder name |
| `title`, `synopsis`, `question` | `{hi, en}` | The question is in the character's words |
| `questionContext` | `{hi, en}`, optional | One line under the question |
| `visualStyle` | `"photoreal"` or `"illustration"` | |
| `genre` | string, optional | English label for metadata lines |
| `choices` | `{A: {label, meaning?}, B: {label, meaning?}}` | `label` is the choice in the character's words. `meaning` (optional, `{hi, en}`) is its plain meaning, shown under the label on the ballot when the label is a code phrase (decisions D-003, point 3) |
| `cast[]` | `{id, name{hi,en}, role{hi,en}, voiceSample{hi,en}, portrait?, placeholder?}` | `id` is what subtitle cues use as `speaker` |
| `poster`, `backdrop` | image paths | |
| `branchAfterEpisode` | number | The last shared episode: 2 for series 1, 3 for series 2 |
| `episodes[]` | Episode | Shared first, then branch A, then branch B |
| `glimpses` | `{A: Glimpse, B: Glimpse}` | |
| `seededTallies` | `{A, B}` whole numbers | The viewer's own ballot is added on top |
| `placeholder` | boolean | True while series-level text, cast and art are stand-ins |

**Episode** = `{id, number, kind, title{hi,en}}` plus the media fields. `kind` is `shared`, `branchA` or `branchB`. `number` is the position on the viewer's path: shared episodes are 1..N, and both branches continue from N+1, so `s1a01` and `s1b01` are both number 3. **Glimpse** = `{id}` plus the media fields.

**Media fields** (episodes and glimpses):

| Field | Type | Notes |
|---|---|---|
| `video` | `{hi, en}` paths | `.mp4` |
| `durationMs` | `{hi, en}` numbers | Length of each file |
| `subtitles` | `{hi, en}` paths | `.json` |
| `shots[]` | `{id, still, timing: {hi: {startMs, endMs}, en: {startMs, endMs}}}` | At least one, in order, no overlap beyond 40 ms |
| `poster` | image path | Shown before play and on rails and cards. Never a frame that reveals an outcome |
| `placeholder` | boolean | Required |
| `placeholderNote` | string, optional | What is missing |

**Differences from the brief I was given, on purpose.** The brief listed one `duration` and shots as `{id, startMs, endMs, still}`. Because the two dubs differ in length (design system, LanguageSwitch; plan 7.4), the manifest carries `durationMs` and shot timing per language. `shotsFor(media, lang)` gives the player exactly the brief's flat shape, `{id, index, startMs, endMs, still}`. I also added `poster` per episode and `meaning` per choice.

### Subtitle files

```json
{ "lang": "hi",
  "cues": [ { "id": "c001", "line_id": "l07", "speaker": "kiran",
              "startMs": 1200, "endMs": 3400, "text": "रुको! यह file किसने खोली?",
              "words": [ {"text": "रुको!", "startMs": 1200, "endMs": 1600}, ... ] } ] }
```

- `speaker` is a cast `id`. The app shows that cast member's name in the audio language (`speakerName`). An id that is not in the cast is shown as written, and `content:check` warns.
- `text` is exactly what is spoken, **without emotion tags**: a `[whispers]` left in the text is a validation error.
- `words` are whole words in order; joined by spaces they must equal `text`. Each word lies inside its cue.
- Cues are in time order and end inside the video (250 ms tolerance).
- Two lines of about 32 characters at most (design system). Split a long script line into several cues with the same `line_id`.
- Optional top-level `"placeholder": true` marks timings that are evenly spaced and not measured.

### What the validator checks

Shape and types; both languages present everywhere; ids unique (a glimpse may not reuse an episode id); paths under `/media/<seriesId>/` with the right extension; shared episodes numbered 1..N with N = `branchAfterEpisode`; each branch numbered N+1.. without gaps and not empty; episodes listed shared, A, B; shots in order and inside each language's video. `pnpm content:check` adds: every file exists and is not empty; every subtitle file is valid and in the right language; each video is H.264, 1080x1920, and as long as the manifest says (300 ms slack).

### How the app loads content

`import { allSeries, getSeries, catalog, teasers, contentProblems } from "@/content"`. The manifests are imported at build time from `public/media`, so there is one copy.

- In `pnpm dev`, a changed `series.json` reloads the page.
- A production build must be rebuilt after a manifest changes. Videos, stills and subtitles can be swapped without a rebuild.
- A manifest that fails validation is still used, so the demo keeps running; the problems are logged and listed in `contentProblems`. `pnpm test` and `pnpm content:check` fail on them.
- Subtitles are fetched at play time: `fetchSubtitleTrack(url, durationMs)` from `@/content/subtitles`.

Helpers in `@/content/helpers` (all pure): `sharedEpisodes`, `branchEpisodes`, `pathEpisodes`, `firstEpisode`, `lastSharedEpisode`, `endingEpisode`, `nextEpisodeOnPath`, `previousEpisodeOnPath`, `episodeLabel` ("3A"), `branchOf`, `findPlayable`, `playableIds`, `cliffhangerStill`, `shotsFor`, `shotIndexAt`, `shotAt`, `shotStartMs`, `positionAfterLanguageSwitch`, `cueAt`, `wordIndexAt`, `speakerName`, `listPlaceholders`.

## 6. Placeholders and the hand-over from production

### What is there now

`pnpm placeholders` (`app/scripts/make-placeholders.mjs`) wrote everything under `app/public/media`: about 41 MB, 244 files, all flagged `placeholder: true`.

- **Videos:** a dark card naming the series, the slot (shared, branch A, branch B, glimpse A, glimpse B), the episodes it stands in for, the audio language and "Shot n of 5". A white marker crosses the bottom of the frame once per video, and a short tone marks each shot (440 Hz Hinglish, 660 Hz English), so playing, seeking and the language switch can be seen and heard.
- **Only 20 videos are rendered** (2 series x 5 slots x 2 languages). Each of the 42 deliverables has its own copy at its final path, so a finished render can replace one without touching the others.
- **The two cuts differ on purpose:** Hinglish is 20.0 s with shots of 4 s each; English is 19.0 s with shots of 3.0, 4.5, 3.5, 4.0 and 4.0 s. Use this to test "same shot, not same second".
- **Stills:** one per shot, a different tint per shot, so the room visibly changes with the shot.
- **Subtitles:** five cues per file, two speakers, Devanagari + Latin lines with per-word timings.
- **Story text** (titles, questions, choice labels, cast names) follows the loglines the Arbiter picked in D-003 and D-004 so layouts see realistic lines. It is not final, and it is flagged. Episode titles not yet decided are "भाग N" / "Part N". **The three teasers are invented by me** as stand-ins; the story team should replace them (the runner-up loglines would be a natural source).
- **Proof scenes:** if `content/proof/photoreal/render/*.mp4` or `content/proof/flat2d/render/*.mp4` exist when the script runs, they stand in for `s1e01` / `s2e01` (language picked by `hi` / `en` in the file name), with shot and subtitle timings spread evenly from the storyboard and script. Neither folder existed when I ran it, so both first episodes are test cards. I tested this path with synthetic files only.

The script is safe to rerun: an episode, glimpse, series-level block or teaser whose manifest entry says `placeholder: false` is left exactly as it is, files included. **`--force` ignores that and deletes finished files under `public/media`.** Do not use `--force` once real renders are in.

Episode video (`*.mp4` under `app/public/media`) is in `app/.gitignore`: placeholders are regenerated with one command and finished renders are copies of files the production track keeps. Manifests, subtitles and stills are not ignored. Reverse this in `app/.gitignore` if the videos should be committed.

### Replacing a placeholder with a finished episode

One command per episode or glimpse, from `app/`:

```bash
node scripts/install-playable.mjs --series series1 --id s1e01 \
  --video-hi <hi.mp4> --video-en <en.mp4> \
  --timeline-hi <hi timeline.json> --timeline-en <en timeline.json> \
  --subs-hi <hi subtitles.json> --subs-en <en subtitles.json> \
  [--title-hi "..."] [--title-en "..."] [--poster <image>] [--note "..."]
```

It reads the two authored Remotion timelines (`production/remotion/TIMELINE.md`) and resolves shot starts the way `prepare-timeline.mjs` does (frames at 30 fps, or `...Sec`; a shot without `start` follows the previous one), converts to milliseconds, copies the videos, measures them, grabs one still per shot from the middle of that shot in the Hinglish cut, validates and copies the subtitles, rewrites the entry in `series.json` with `placeholder: false`, and runs the content check.

- Timeline shot ids are normalised to the manifest's form: `E1-012` becomes `e1012`, `003` becomes `s003`.
- The two timelines must have the same shots in the same order, or it stops.
- If a subtitle file is not given, an empty track is written and the entry stays `placeholder: true` with the reason. `--note` does the same for anything else that is still missing (for example a slated shot).
- It builds the new folder beside the old one and swaps only when everything has passed, so a failure leaves the placeholder in place.
- Series-level text, cast and art, the tallies and the teasers have no script: edit `series.json` / `catalog.json` by hand, set `placeholder` to `false`, and run `pnpm content:check`.

Verified by `scripts/install-playable.test.mjs` against a scratch copy of the media folder, with synthetic videos and timelines. It has not been run on a real render, because none exists yet.

## 7. State model

Everything is on the device, in two localStorage keys. `import { ... } from "@/state"` in client components.

### Stored shapes (`src/state/types.ts`)

| Key | Shape |
|---|---|
| `unwritten:viewer` | `{ state: ViewerState, version: 1 }` |
| `unwritten:demo` | `{ state: DemoState, version: 1 }` |

```ts
ViewerState   = { language: "hi" | "en", subtitlesOn: boolean, welcomeSeen: boolean, series: Record<seriesId, SeriesProgress>, epoch: number }
SeriesProgress = { episodes: Record<episodeId, EpisodeProgress>, lastPlayableId: string | null,
                   glimpsesWatched: { A: boolean, B: boolean }, ballot: Ballot | null }
EpisodeProgress = { positionMs, lang, shotId, completed, completedAt, updatedAt }
Ballot        = { choice: "A" | "B", castAt, moved: boolean, movedAt, kept: boolean }
DemoState     = { day: 1 | "last-hour" | 2, winnerOverride: "A" | "B" | null, launchAt: number | null }
```

`epoch` goes up by one on every presenter rewrite (reset, preset, jump); see "Epochs" below. `kept` is true once the viewer chose "Keep my ballot" at keep-or-move. Both were added after the first version; stored data without them reads as `epoch: 0` and `kept: false`, so `STORAGE_VERSION` stays 1.

Defaults: Hinglish audio, subtitles on, welcome not seen, day 1, no forced winner. "Endings finished" and "other ending watched" are **derived** from episode completion (`endingsFinished`, `otherEndingWatched`), not stored, so they can never disagree with the progress.

### Hydration: the one rule every screen must follow

The server renders every page as a new viewer on day 1. The stores are filled from localStorage after the page mounts (`StoreHydration` in the root layout). **Wait for `useHydrated()` (or `rules.hydrated`) before showing anything that depends on stored state**, or a returning viewer sees a flash of the new-viewer screen, and a redirect fires for the wrong viewer. Show the stage's loading state until then.

Do not read the clock while rendering. `useNow()` and `useDayOneCountdown()` return `null` until the page has mounted.

If localStorage throws (some private modes, site data blocked, a full quota), the stores switch to memory for the rest of the page's life and hydration still finishes, so the app runs; it just forgets everything on reload (`fallbackStorage` in `src/state/storage.ts`).

### Actions

`useViewerStore`: `setLanguage`, `setSubtitlesOn`, `markWelcomeSeen`, `recordProgress(seriesId, episodeId, {positionMs, lang, shotId}, epoch?)`, `completeEpisode(seriesId, episodeId, epoch?)`, `markGlimpseWatched(seriesId, choice, epoch?)`, `castBallot(seriesId, choice)`, `moveBallot(seriesId)`, `keepBallot(seriesId)`, `applyPreset(seriesId, preset, choice?)`, `resetHistory()`, `resetEverything()`, `newEpoch()`.

`useDemoStore`: `setDay(day)`, `setWinnerOverride(choice | null)`, `reset()`.

`castBallot`, `moveBallot` and `keepBallot` enforce the rules themselves and return `{ok: true}` or `{ok: false, reason}`. A screen cannot cast a second ballot, vote on day 2, move a ballot twice or move it after keeping it, even if it calls them.

**Keeping is a decision too.** `keepBallot(seriesId)` is allowed exactly when `canMoveBallot` is, and is just as final for day 1: afterwards `canMoveBallot` answers `{allowed: false, reason: "kept"}`, so `rules.next`, `rules.after(...)` and `rules.ending(b).offerKeepOrMove` stop sending the viewer to keep-or-move. `MoveBallotBlock` is `"no-ballot" | "voting-closed" | "already-moved" | "kept" | "both-endings-not-finished"`. `rules.history` has `kept` beside `moved`.

**Epochs.** `useViewerStore.getState().epoch` goes up by one on `applyPreset`, `resetHistory`, `resetEverything`, `resetDemo()` and every `jumpToScreen(...)` (`newEpoch()` does only that). `recordProgress`, `completeEpisode` and `markGlimpseWatched` take an optional last argument `epoch`: when it is given and is not the store's current epoch, the call does nothing. A player passes the epoch it started in, so a save from a session that began before a reset, preset or jump (typically the save it makes as it unmounts) cannot write the old history back. Called without `epoch`, they behave as before. The epoch is stored, so a reset made in a second window also stops a player open in the first.

### Hooks

- `useSeriesRules(series)` returns every rule answered for the current viewer and day: `hydrated`, `progress`, `demo`, `isDayOne`, `isLastHour`, `isDayTwo`, `viewerKind`, `tally`, `splitVisible`, `official`, `questionReached`, `endingsFinished`, `otherEndingWatched`, `canCastBallot`, `canWatchOtherEnding`, `canMoveBallot`, `question`, `result`, `history`, `next`, `access(playableId)`, `after(playableId)`, `ending(branch)`. Use this; do not compare days or count ballots in a component.
- `useDayOneCountdown()` gives `{remainingMs, text: "21:44:58", closingSoon}`.
- `useHydrated()`, `useDemoState()`, `useSeriesProgress(seriesId)`, `useNow()`.

### The product rules (`src/state/rules.ts`, pure, tested in `rules.test.ts`)

| Plan section 2 rule | Function | Behaviour |
|---|---|---|
| Launch day | `isDayOne`, `isLastHour`, `isDayTwo`, `dayOneRemainingMs` | The day is whatever the presenter set. `"last-hour"` is day 1 for every rule; only the styling changes |
| Shared episodes | `episodeAccess`, `questionReached` | Always open. The question is reached when the last shared episode has been watched to the end |
| Glimpses | `glimpseAccess` | Open once the question is reached, on both days. **Never required for the ballot** (section 9) |
| The choice | `canCastBallot` | Day 1, once, after the question. Then only the chosen branch opens |
| The other ending | `canWatchOtherEnding`, `episodeAccess` | Only after the viewer's own ending is finished, only on day 1 |
| Changing the vote | `canMoveBallot`, `keepBallot` | Day 1, both endings finished, once. Keeping is final too: no move after "Keep" |
| Day 2 onwards | `officialBranch`, `episodeAccess`, `expiredEpisodeIds` | Only the official branch for new viewers. A viewer keeps each losing-branch episode they finished on day 1 |
| Late viewers | `questionView`, `resultView`, `isLateViewer` | Day 2, no ballot: shared episodes, the question with the result, both glimpses, the split, then the official branch. No ballot |
| Votes | `tally`, `winnerOf` | Seeded numbers plus the viewer's own ballot wherever it is now. A tie goes to A |
| Presenter's winner | `tally`, `officialBranch` | A forced winner is official whatever the numbers say |
| History | `historyEntry`, `resumePoint`, `continueStep` | What you chose, what won, what expired, where to resume |

`episodeAccess` returns `{state: "open" | "locked" | "expired", reason}`. Reasons: `shared`, `your-ending`, `other-ending-unlocked`, `official-ending`, `kept-from-day-one`, `glimpse` (open); `question-not-reached`, `vote-first`, `finish-your-ending-first`, `unknown` (locked); `not-the-official-ending` (expired). Map them to the design system: `locked` is the dashed rail pill, `expired` is the Expired stage state.

### Decisions I made where the plan is silent

These are mine, not the owner's. Each is one function, so each is cheap to change. They should be logged in `docs/decisions.md` by whoever keeps that file.

1. **"Keeps access to what they watched" is per episode, and "watched" means finished.** On day 2 a losing-branch episode is open only if the viewer watched it to the end on day 1. An episode they only started has expired. Alternative: keep the whole branch for anyone who started it. Change in `episodeAccess`.
2. **A forced winner also changes the split shown**, so the bar never contradicts the headline: the seeded numbers are swapped, and if the seeds are level the forced side gets the smallest lead that wins. Change in `tally`.
3. **The forced winner applies to every series**, because the drawer in the design system has one control for it.
4. **The countdown never reaches zero by itself.** The day changes only by hand (plan section 2), so the countdown is held inside the chosen phase: above one hour on day 1, between one second and one hour in the last hour. Picking a phase restarts it at 21:45:00 (day 1) or 00:45:00 (last hour). **When the app loads**, a day-1 or last-hour countdown that has run down to its floor (or whose start lies in the future) restarts its phase the same way, so a demo set up the day before does not sit at 01:00:01 or 00:00:01 (`launchAtOnLoad`, called by `ensureLaunch`). The day is never changed. This applies whether or not the presenter picked the phase: a presenter's pick that has run out would otherwise stay frozen too. Not handled: a tab left open without a reload for longer than the window still stops at the floor until the next load.
5. **No order is enforced inside the shared episodes or inside a branch.** A viewer can open episode 2 before episode 1. An ending counts as finished when its last episode is finished.
6. **On day 2 the official branch still waits for the shared episodes** (or an existing ballot).
7. **The split is visible after the viewer's own ballot on day 1, and to everyone on day 2** (TallyBar README). Nothing is called "official" on day 1.
8. **The reset button clears watch history only** (`resetHistory`): progress, glimpses, ballots. Language, subtitles and the welcome stay. `resetDemo()` also puts the clock back to day 1 with no forced winner. `resetEverything()` brings the welcome back too. All three start a new epoch.
9. **"Keep my ballot" is final for day 1**, like a move (`keepBallot`). The plan says only "keep or move"; the alternative, keeping the move open from My choices or the ballot page, adds a screen state for little demo value. Change in `canMoveBallot`.

## 8. Player and flows: the handshake

The player owns `/watch/[seriesId]/[playableId]`. It decides nothing about the story; it asks the rules.

1. **Wait** for `rules.hydrated`.
2. **Check access:** `rules.access(playableId)`. If `locked`, show why and link to `stepHref(seriesId, rules.next)`. If `expired`, show the Expired state with a button to `stepHref(seriesId, rules.result.enter)`.
3. **Start position:** `startPositionMs(media, progress.episodes[id], language)`. Glimpses always start at 0.
4. **While playing an episode:** call `recordProgress` about once a second, and on pause, on shot change and when the page is hidden. Each call writes localStorage. Do not call it for glimpses. **Pass the session's epoch** as the fourth argument: read `useViewerStore.getState().epoch` once when the session is created (after hydration, which is when the player creates sessions anyway) and pass that same number to every `recordProgress`, `completeEpisode` and `markGlimpseWatched` the session makes, including the save on unmount. Saves from an older epoch are then ignored (section 7, Epochs).
5. **Language switch:** `setLanguage(lang)`, swap the file, seek to `positionAfterLanguageSwitch(media, from, to, positionMs)`. Subtitles follow the audio language; `subtitlesOn` only hides them.
6. **Shots:** `shotsFor(media, language)` for the progress segments and previous/next; `shotAt(...)` for the still the room cross-fades to.
7. **Subtitles:** `fetchSubtitleTrack(media.subtitles[language], media.durationMs[language])`, then `cueAt` and `wordIndexAt`; the speaker tag is `speakerName(series, cue.speaker, language)`. If the fetch fails, play without subtitles.
8. **When it ends:** an episode calls `completeEpisode(seriesId, id, epoch)`; a glimpse calls `markGlimpseWatched(seriesId, choice, epoch)`. Then go to `stepHref(seriesId, rules.after(id))`. That is the next episode, the question, the two glimpses, the ending screen or keep-or-move: the player never works out which. Preload with `nextEpisodeOnPath(series, id)`.
9. **If a video cannot load:** show the Failed state with retry, and a way on to `stepHref(seriesId, rules.after(id))`, so one missing file never traps the viewer (plan 7.8).
10. `media.placeholder` is true for stand-ins; the presenter drawer can list them with `listPlaceholders(series)`.

Flows, screen by screen:

- **Question:** `rules.question`. `mode` is `vote`, `voted` or `result`. The primary button goes to `stepHref(seriesId, rules.question.primary)`. Never show the two choices here. If `!reached`, send the viewer to `primary`.
- **Glimpses:** two cards side by side linking to `routes.watch(id, series.glimpses.A.id)` and `.B.id`. Watched state from `progress.glimpsesWatched`. On day 2 (`rules.question.mode === "result"`) the cards stay and the ballot is replaced by the result.
- **Ballot:** enabled when `rules.canCastBallot.allowed`. The button needs only a selected option, **not** watched glimpses. After `castBallot` show the split (`rules.tally`, labelled "Simulated demo ballots") and continue to `rules.next`. `choices[x].meaning`, when present, goes under the label.
- **Ending:** `rules.ending(branch)`: `offerOtherEnding` (day 1 only) with `otherEndingStart`, `offerKeepOrMove`, `splitVisible`, `official`.
- **Keep or move:** only when `rules.canMoveBallot.allowed`. **Keep calls `keepBallot(seriesId)`** (it used to change nothing, so a viewer who kept was sent back here by every Continue). Move calls `moveBallot`. Neither may be offered again: on a later visit `canMoveBallot.reason` is `"already-moved"` or `"kept"`, and the screen should show the outcome for both (today it shows the outcome only for `"already-moved"` and redirects on `"kept"`).
- **Day-2 result:** `rules.result`: `official`, `tally`, `yourChoice`, `choseOfficial`, `keptEpisodeIds`, `expiredEpisodeIds`, `glimpsesAvailable`, `enter`.
- **My choices:** `rules.history` per series: `choice`, `moved`, `official`, `branches.A/B` with `watched`, `availability` (`open`, `locked`, `expired`, `partly-expired`), `keptEpisodeIds`, `expiredEpisodeIds`, and `resume`.
- **Share card:** needs a ballot. The frame is `cliffhangerStill(series)`, never a branch frame, never the result.

### The player as built (added by the P3 Player engineer, 26 Nov)

Code: `app/src/components/player/` and `app/src/app/watch/`. Nothing above changed; this is what the other engineers can rely on.

- **Hand-over at the branch point and everywhere else.** When playback ends the player calls `completeEpisode` or `markGlimpseWatched` and then `router.push(stepHref(seriesId, rules.after(id)))`. After the last shared episode that is `routes.question(id)`: the question screen takes over from there, and the player passes it nothing but the stored state. There is no callback to register.
- **"Ends" means three things:** the video played to its end; the viewer pressed "next shot" on the last shot; or the file would not load and the viewer chose the way on from the Failed state. All three mark the episode complete, otherwise the question screen would send the viewer straight back to an episode that cannot play (plan 7.8).
- **The player is mounted by the layout of `/watch`, not by the page** (`src/app/watch/layout.tsx` renders `PlayerHost`, which reads the route params). It stays mounted from one episode to the next and keeps the same `<video>` element, because iOS Safari only lets an element play with sound without a tap if that element was started by a tap before. Link to `routes.watch(...)` as usual; do not mount a second player on another route for auto-advance.
- **Starting.** On arrival the player tries to play with sound. If the browser refuses, the stage shows "Tap to play" and the tap starts it. The video is never muted. In Playwright either can happen on arrival: `page.evaluate` and `page.waitForFunction` count as a user gesture in Chromium, so a test should wait for `data-state` to be `needs-tap` or `playing` and press "Play with sound" only in the first case.
- **Chrome.** The screen is a full `uw-ambient` root with its own way back (a wordmark that links home, and "Back to the series"). It expects no nav and no dock around it, which is what `chromeFor` gives `/watch`.
- **Hooks for tests and motion**, on the stage element `[data-player-stage]`: `data-playable="<id>"`, `data-lang="hi|en"` and `data-state`, one of `loading` (stores not loaded), `locked`, `expired`, `starting`, `needs-tap`, `playing`, `paused`, `ended`, `failed`. The two side panels carry `data-player-panel="info" | "controls"`; the room's two cross-fading stills carry `data-room-layer="front" | "back"`.
- **Accessible names on the stage:** buttons "Previous shot", "Pause" / "Play", "Next shot", and "Play with sound" in the tap-to-play state. Groups "Audio" (`हिंदी`, `English`) and "Subtitles" (`On`, `Off`). Keyboard: Space or K, Left and Right arrows.
- **Previous shot** goes to the start of the shot on screen, or to the shot before it when pressed within 1.2 seconds of a shot's start.
- **Exports** from `@/components/player`: `PlayerHost`, `PlayerScreen` (`{ series, playable }`), `RoomBackdrop` (`{ still }`, the cross-fading room, to be the first child of a `uw-ambient` element), and the pure helpers in `subtitleTiming.ts`, `shotNav.ts` and `labels.ts`.

## 9. Presenter drawer

The drawer is a component in `components/flow/`, mounted in `AppChrome`, opened by a long press on the wordmark or `?demo=1`. Everything it does is already in the state model:

| Control | Call |
|---|---|
| Demo clock: day 1 / last hour / day 2 | `useDemoStore.getState().setDay(1 \| "last-hour" \| 2)` |
| Winning ending: by votes / A / B | `setWinnerOverride(null \| "A" \| "B")` |
| Viewer state | `applyPreset(seriesId, preset, choice)` with `VIEWER_PRESETS`: `new`, `at-question`, `voted`, `finished-own`, `seen-both` |
| Reset | `resetDemo()` (history cleared, day 1, no forced winner) |
| Jump to any screen | `router.push(jumpToScreen(screenId, seriesId, choice))` with `SCREEN_JUMPS` |

`jumpToScreen` does not bypass the rules. It starts a new epoch (so a player open on the page cannot save over the jump), then makes the viewer someone who could be on that screen (for example `ballot`: day 1, shared episodes finished, no ballot; `result`: day 2, a late viewer; `keep-or-move`: both endings finished), marks the welcome as seen (or, for `welcome`, unseen), and returns the URL. `SCREEN_JUMPS` lists all thirteen screens with their labels.

Changes made in one window reach other windows on the same device (the stores reload on the browser's `storage` event), so the drawer can be driven from a second window.

## 10. Tests

- **Unit (Vitest):** `*.test.ts(x)` beside the code. Default environment is Node. For a DOM, start the file with `// @vitest-environment jsdom`. `src/test/fixtures.ts` has a small valid series (`makeSeries`) and viewers at each stage (`viewers(series, choice)`), built with the real transitions.
- **End to end (Playwright):** `app/e2e/`. Two projects, `phone` (Pixel 7 emulation) and `desktop` (1440x900), in Playwright's own Chromium. I checked that it plays the H.264/AAC files on this Mac; `E2E_CHANNEL=chrome` switches to the installed Chrome. No WebKit project is set up: iOS Safari behaviour is not covered.
- **Seeding state in e2e** (`e2e/state.ts`):

  ```ts
  await seedState(page, { viewer: viewerAt("series1", "at-question"), demo: { day: 2 } });
  await page.goto(routes.question("series1"));
  ```

  `viewerAt(seriesId, preset, choice, overrides)` builds a viewer who has done the welcome. `readState(page)` reads back what the app saved. Do not import `@/content` in e2e files (Playwright's loader does not bundle JSON); use `loadSeries(id)`.
- The rule tests were checked by breaking 21 rules one at a time (for example "tie goes to B", "ballot allowed on day 2", "glimpses required"): every break made a test fail.

## 10a. Changes to the state model after the first version (P1 Tech lead, 26 Nov, review fixes)

All additive: code that does not use them compiles and behaves as before. Who has to act is in bold.

| Change | API | Who acts |
|---|---|---|
| A player left open could undo a reset, preset or jump by saving on unmount | `ViewerState.epoch`; optional last argument `epoch` on `recordProgress`, `completeEpisode`, `markGlimpseWatched`; `newEpoch()` | **Player (P3):** in `PlayerScreen`, read `useViewerStore.getState().epoch` when a session is created, keep it on the session, pass it to every save in `PlaybackSession` and to `completeEpisode` / `markGlimpseWatched` in `handleFinish`. Suggested, not required: add the epoch to the session key, so a reset with the player open restarts the session from the new resume point instead of carrying on without saving |
| "Keep my ballot" was not remembered | `Ballot.kept`, `keepBallot(seriesId)`, `MoveBallotBlock` gains `"kept"`, `HistoryEntry.kept` | **Flows (P4):** `KeepOrMoveScreen` `onKeep` calls `keepBallot(series.id)` (toast on `{ok: false}` as for a move); treat `reason === "kept"` like `"already-moved"` (show the outcome, "Ballot kept", instead of redirecting). My choices may show "Kept" from `history.kept` |
| Day-1 countdown froze at 01:00:01 once the real clock passed the window | `launchAtOnLoad(demo, now)` in rules; `ensureLaunch` uses it | Nobody |
| App stayed on Loading if localStorage threw | `fallbackStorage` in `storage.ts`; `hydrateStores` always ends hydrated | Nobody |
| Tests | e2e `readState(...).viewer` now also has `epoch` and `ballot.kept`; `toMatchObject` checks are unaffected, a `toEqual` on a whole stored ballot needs `kept` | Nobody today: no spec compares a whole stored ballot or viewer with `toEqual` (checked 26 Nov) |

## 11. Not done, not verified

- No screen exists. Every route renders `ScreenStub`, which shows the stored state and links to the other routes.
- The proof-scene path of the placeholder script and the installer have only been run on synthetic files.
- Fonts are not loaded and no design tokens are in the stylesheet: both are the design-system engineer's.
- The seeded tallies (series 1: A 6,241, B 5,873; series 2: A 3,120, B 3,987) are my placeholders. With them A is official in series 1 and B in series 2, so both outcomes appear without touching the drawer.
- I only skimmed the text of the direction C mockups (one ballot screen on phone, one premiere screen on desktop). They do not prescribe routes; the routes follow plan section 4 and the component READMEs.
- The DemoDrawer preview shows three viewer states (New, Voted, Seen both). The state model offers five; the drawer may show all five or those three.
