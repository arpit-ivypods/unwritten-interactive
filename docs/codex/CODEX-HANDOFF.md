# Codex handoff — Unwritten POC (updated 27 Nov 2026)

> **This file overrides any earlier paste prompt.** If a prompt asked for waves 3-4 or 10 episodes, ignore that: only s2a01 and s2b01 are in scope.

> **SCOPE CHANGE (owner, 26 Nov evening): each series ends at episode 1 after the cliffhanger, for both branches.** Needed episodes: Series 1 s1e01, s1e02, s1a01, s1b01 (all done); Series 2 s2e01, s2e02, s2e03 (done), **s2a01 and s2b01 (to do)**. Episodes s1a02, s1a03, s1b02, s1b03, s2a02, s2a03, s2b02, s2b03 are out of scope. Claude has finished and committed the s2a01 and s2b01 re-voice (all 38 new takes accepted; do not touch their `voice/` folders). Codex does their storyboards (time shots to the final takes in voice/manifest.jsonl), frames, frame check, edit + screening; the app must end each branch after episode 1 (no placeholder episodes 2-3 in the viewer flow); glimpses only if the app flow still uses them after the cut.

Read in order: `docs/handoff.md` (bottom two sections are newest), `docs/morning-report.md` (session 2 summary), `docs/decisions.md` (D-022 to D-027), `docs/unwritten-poc-plan.md` (section 9 overrides), `production/scripts/episode/README.md`.

## Roles and method
- Each role's brief is `.claude/agents/<role>.md`; method playbooks are `.claude/skills/<name>/SKILL.md` (frame-generation, voice-direction, script-critique, continuity-ledger, flow-testing). Read the role file before doing that role's work.
- The per-episode pipeline order (Claude workflow, for reference only): `docs/codex/phase4-episodes-v2.reference.js`.
- **Maker never checks own work.** Do the checking role (visual-checker, screening-reviewer, code-reviewer) in a separate Codex session or at least a separate, fresh pass that only reads files.
- Frames only via `production/scripts/codex-frame.sh <frames_dir> <shot> <prompt_file> <refs...>` (honours `work/codex-slots`, quota pause file `work/codex-slots/QUOTA`).
- Edits only via `production/scripts/episode/assemble.sh <episode_dir>`; episode editors change only their episode's `edit.json`. Only a toolsmith step edits `production/scripts` or `production/remotion`.
- Voice review and screening audio: local whisper.cpp (`/opt/homebrew/bin/whisper-cli`, `~/.whisper-models/ggml-small.bin`) + ffmpeg.
- Commit as you go: `git -c user.name="Unwritten build" -c user.email="build@localhost" commit ...`.
- Rules: no API keys entered, no purchases, nothing deployed or shared off this Mac, no deleting work (move aside instead). Log decisions in `docs/decisions.md` (next is D-028) and keep `docs/morning-report.md` current.

## Hard limit: no ElevenLabs from Codex
Voice and sound were generated through Claude's ElevenLabs connector. Codex has no access and must not use an API key. Done by Claude: the s2a01/s2b01 re-voice and the s1e02 in-breath cue (s1e02 re-rendered and reinstalled). Any further voice or sound need goes back to Claude.

## What Codex can do now, in order
1. **Dev server:** the stale one was stopped; start a fresh `pnpm dev` in `app/` (port 3210) when you need it.
2. **s2a01 and s2b01, full pipeline** (scripts final; voice final):
   - storyboard-artist: `shots.json` per episode (follow existing wave-2 shots.json and their `remap_notes` conventions; map every line id of both scripts; supers on shots). Time shots to the final voice takes already committed (`voice/manifest.jsonl` + `voice/review.json`: the build picks the highest take not dropped).
   - frame-runner: anchors first, then frames, via codex-frame.sh (refs and STATE per D-013).
   - visual-checker (separate pass): `frames/review.json` rows in the existing format; retake once per D-013 rule 11; run `python3 -I production/scripts/episode/convert_frame_review.py <ep_dir> --check`.
   - editor: `edit.json` + `assemble.sh` (both languages), 720p previews as in other episodes.
   - screening-reviewer (separate pass): `screening.json`, gate 7/10 and no blocking fault (D-023).
   - install with `app/scripts/install-playable.mjs`.
   - Commit after each episode.
2b. **App: end each branch after episode 1.** Remove episodes 2-3 of every branch from the viewer flow (no placeholder episodes reachable); keep day 1 / day 2 and voting logic working; update e2e; run the full suite.
3. **Toolsmith polish** (production/ only, keep `production/scripts/episode/test/run_proof_test.sh` passing):
   - subtitle marking of off-screen/phone lines (`heard_as`): italics + speaker labels in `build_subs.py` output and the app's SubtitleTrack (app draws subs; no re-render needed);
   - a plot-overlay text layer for Series 1 phone/clock overlays;
   - a per-line subtitle split override; tolerate prose `mix.starting_gains_db`.
   After the toolsmith step: rebuild subs for the 7 finished episodes, re-install them (`app/scripts/install-playable.mjs`), run `pnpm test`, `pnpm typecheck`, `pnpm build && E2E_PROD=1 pnpm exec playwright test` in `app/`.
4. **Concept note:** refresh `outputs/Unwritten-Interactive-Concept-Note.html` with the real state (7 finished episodes, measured costs, lessons; keep v1).

## Then stop
- Update `docs/handoff.md` and `docs/morning-report.md` with what Codex finished, and commit.
- Do NOT deploy or push to GitHub. The live site (https://unwritten-interactive.vercel.app) and the public repo are published from a separate sanitised copy (`../unwritten-public`); the owner asks Claude to republish (steps in `docs/handoff.md`, "Published").
- Do not touch branch `park/cloudflare-stream` (parked Cloudflare work).
- Any new voice or sound need goes back to Claude.
