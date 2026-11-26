# Unwritten

Unwritten is an interactive Hinglish micro-drama proof of concept. There are two series. After the question episode of a series, viewers vote on what happens next, and the winning branch plays. Everything is available in two languages (Hindi and English subtitles/audio, `hi` and `en`).

## Run the app locally

```bash
cd app
pnpm install
pnpm exec playwright install chromium   # once, for e2e tests and placeholder cards
pnpm dev                                # http://localhost:3210
```

Production build: `pnpm build && pnpm start` (also port 3210).

If `pnpm dev` was already running when episodes were installed, restart it. The server render can serve a stale manifest.

Episode videos (`app/public/media/**/*.mp4`) are not in git. On a fresh checkout run `pnpm placeholders` (needs ffmpeg) for stand-ins. `pnpm content:check` checks `public/media` against the content contract.

## Presenter drawer (demo controls)

Open it by long-pressing the wordmark, pressing Shift + D, or adding `?demo=1` to any URL. Escape closes it. It sets the launch day (day 1, last hour, day 2), can force a winning branch, and lists the placeholder episodes. Details: `docs/contracts.md` (item 14 and the state sections).

## Tests

From `app/`:

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (vitest) |
| `pnpm typecheck` | `next typegen` then `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test:e2e` | Playwright against the dev server |
| `E2E_PROD=1 pnpm test:e2e` (or `pnpm test:e2e:prod`) | Playwright against a fresh production build on port 3211 |

## What is real and what is simulated

- Simulated: votes, tallies (seeded numbers plus your own ballot), and day 1 / day 2. All of it lives in the browser's localStorage and is driven by the presenter drawer. There is no backend and nothing is sent anywhere.
- Not deployed: the app runs locally only.

## Current content

Seven real episodes are installed: s1e01, s1e02, s1a01, s1b01, s2e01, s2e02, s2e03. Each passed screening at 8/10 in both languages. The other 10 episodes and the 4 glimpses are still placeholder videos, and the app marks them as stand-ins.

## Production pipeline

Episodes are built outside the app and installed into it.

- Plan: `docs/unwritten-poc-plan.md` (section 9 overrides earlier sections)
- Decisions log: `docs/decisions.md`
- Episode build: `production/scripts/episode/assemble.sh <episode_dir>`, see `production/scripts/episode/README.md`
- Frame generation: `production/scripts/codex-frame.sh`
- Installing into the app: `app/scripts/install-playable.mjs`
- App engineering contract: `docs/contracts.md`

## About this public repository
This is a snapshot of the working project. To keep it small, the production media is not included: frame images, voice takes, sound files and full-resolution episode renders stay with the production machine. Everything else is here: the app, the episode build toolchain, the scripts, shot lists, manifests, reviews and decision logs. The app ships 720p web copies of the finished episodes in `app/public/media`.
