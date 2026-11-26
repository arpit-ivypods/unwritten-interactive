# Handoff — Unwritten POC build (for the next orchestrator session)

_Written 26 Nov 2026, afternoon IST, by the orchestrator of the first build session. Read this first, then `docs/build-session-brief.md`, `docs/unwritten-poc-plan.md` (section 9 overrides), `docs/decisions.md` (D-000 to the latest), `docs/morning-report.md`._

## The owner's standing instructions
- Build exactly as the brief and plan say; you are the orchestrator: brief agents, read results, decide what runs next. You do not write scripts, frames or app code yourself. Makers never check their own work. Mechanical steps are scripts.
- **No Fable.** The owner asked to stop using Fable (limit). Every former Fable role runs on **Opus at the same effort** (D-0M1). Pin `model` and `effort` on every call.
- The owner is now awake and engaged. Their verdict on s2e01: picture, flow and direction are fine; **dialogue does not make sense** (e.g. "Arre, talkies?" answers a line nobody heard). Story is fine. They chose a **dialogue-only clarity pass** (Option 1 of `docs/clarity-review.md`), with a permanent cold-viewer gate (D-024). They want to see s2e01's new dialogue old-vs-new before it is re-voiced.
- Security rules from the brief still apply (no keys, no purchases, nothing deployed off this Mac, no deleting work).

## Harness facts you need (learned the hard way)
- **Workflow sessions cannot reach the ElevenLabs connector** (MCP tools are dropped). All voice, sound and generation runs go through **Agent-tool subagents** (`voice-runner` sonnet low, `sound-designer` opus medium, `voice-director` opus high). Never re-call a generate to retry a pending one; refetch with `creative_get_generations` (free).
- **Connector transcription text cannot be read back.** All voice reviews use local **whisper.cpp** (`/opt/homebrew/bin/whisper-cli`, models in `~/.whisper-models/`, ggml-small; large-v3-q5_0 also on disk) plus ffmpeg voiced-ratio measures. Scripts from earlier reviews are in the old session scratchpad (`s10_d022_r2/`, `s10_s1e01_review/`); copy, don't edit.
- **Frames only via** `production/scripts/codex-frame.sh <frames_dir> <shot> <prompt_file> <refs...>` (locks, shared 2-3 Codex slots in `work/codex-slots`, quota pause file `work/codex-slots/QUOTA`). Measured ~76-120 s per story frame.
- **Episode assembly only via** `production/scripts/episode/assemble.sh <episode_dir>` (README there). Only a "toolsmith" editor step may edit `production/scripts` or `production/remotion` (D-0M4).
- A plugin hook cuts the Read tool to one line for many agents; tell agents to read with Bash/Grep if that happens.
- Agents without a shell cannot run Codex; `storyboard-artist` and `visual-checker` now have Bash. Read-only critics (script-critic) cannot write files: save their output yourself if needed.
- Commit with `git -c user.name="Unwritten build" -c user.email="build@localhost" commit ...` and the Co-Authored-By line; retry `git add` if a Codex lock vanishes mid-add (lock and temp files are git-ignored).

## Where things stand (approximate, ~60% by work)
| Area | State |
|---|---|
| Proof scenes | Done, real audio, screened 8/10 and 7/10 (D-0M4) |
| Bibles, branch maps | Approved (D-005 to D-007, D-016). Story unchanged by the clarity pass |
| Scripts | **Being rewritten for clarity** (workflow `clarity-pass`, see below). Old versions saved as `script.*.prev.json` |
| Visual bibles | Approved (D-021): 47 + 52 refs, style frames |
| Casting | Both series cast (provisional for ear checks) |
| Voice | Final for the OLD scripts in all 17 episodes (D-022 retakes done). **Changed lines must be re-voiced** after the clarity gate (`content/revoice-clarity.json` will list them) |
| Sound | Series libraries (122 cues) and all episode one-off cues generated |
| Episodes | s2e01: all 37 shots real, rendered, screened 8/10 (old dialogue). s1e01: all shots real (s05 approved), renders, NOT yet edited/screened with final dialogue. Wave 2 (s1e02, s1a01, s1b01, s2e02, s2e03): frames-only run in progress |
| Remaining episodes | s1a02, s1a03, s1b02, s1b03, s2a01, s2a02, s2a03, s2b01, s2b02, s2b03: storyboards and frames not started (wave 3 and 4) |
| Glimpses (4) | Not started (cut from branch episode 1s by S14 after those exist) |
| App | All 13 screens, player, presenter drawer, Studio on placeholder episodes; unit 328 pass; e2e 142/142 (Chromium only). Real episodes not installed (`app/scripts/install-playable.mjs` exists). Open: `app/public/media/series1/series.json` ballot meanings are stale (one with यह) |
| Docs | `docs/decisions.md` current; `docs/morning-report.md` current; `README.md` not written |
| Credits | ElevenLabs about 67,900 of ~730,000 used. Codex: no quota message yet; allowance unknown |

## Running at handoff (check their results first)
1. **`clarity-pass` workflow** (script `workflows/scripts/clarity-pass-*.js` in the old session dir): D-024 ruling and skill updates (done), viewer ledgers per series, rewrite of all 17 scripts (Hindi, then English mirror, beats/frames kept, unchanged lines byte-identical), cold-viewer gate C1 on 8 paths (2 series x 2 branches x 2 languages), one fix round, continuity, Arbiter clarity gate. Output: rewritten `script.*.json`, `content/<series>/viewer-ledger.json`, `content/revoice-clarity.json` (changed line ids), a new D- entry.
2. **Wave 2 frames-only** (pipeline `phase4-episodes-v2.js`, args `{episodes:[s1e02,s1a01,s1b01,s2e02,s2e03], framesOnly:true}`): storyboard, anchors, checks, frames, retakes, completeness. Edit/screen are skipped on purpose until new dialogue is voiced.
Orchestrator notes on dialogue breaks were added to `docs/clarity-cold-viewers.md` (s2e01: 20 items; s1e01: 15 items) for the rewriters.

## Update at session end (26 Nov ~16:40 IST)
- **Clarity pass finished and passed (D-025):** all 8 C1 readings 8.0-8.5; 339 lines to re-voice (~21,000 credits), list in `content/revoice-clarity.json`; six word fixes F1-F6 in D-025 must be applied (rows marked `awaits`) before voicing.
- **Owner review:** s2e01 old vs new dialogue is in `docs/s2e01-dialogue-old-vs-new.md` and was shown to the owner. Wait for their OK (or changes) before re-voicing.
- **Concept note updated** (`outputs/Unwritten-Interactive-Concept-Note.html`, v1 kept).
- **Wave 2 frames-only run:** all 139 frames generated; finished (run `wf_2e71f5b2-f89`, all 5 lanes completed frames-only, every shot has a picture). Still check each wave-2 episode's `frames/review.json` for rejected frames without a retake.

## Next steps, in order
1. Read the clarity-pass result. If the Arbiter gate passed, **show the owner s2e01 old vs new dialogue** (from `script.en.prev.json` / `script.en.json`, and Hindi) and get their OK before re-voicing. If they want changes, run a writer fix and C1 re-read on that episode.
2. Re-voice the changed lines per `content/revoice-clarity.json`: S10 writes takes for new/reworded lines (D-022 ladder: no quiet-family tags on voice-wanted lines), voice-runners generate (Agent tool), S10 reviews locally, retake per D-022.
3. Re-edit and screen s1e01 and s2e01 with the new voice (assemble.sh; s1e01 edit.json: replace s05's old move with the shots.json push-in; en l04/l05 cut on the second "the"; s33 lamp-hum filter). One full screening for s1e01; s2e01 a changed-items pass. Gate rule (D-023): 7/10 and no blocking fault.
4. Wave 2 edit + screen once its voice is redone; then waves 3-4 (the remaining 10 episodes) through the full pipeline (`phase4-episodes-v2.js` without framesOnly). Storyboards should time shots to the NEW voice.
5. Glimpses (S14) from the branch episode 1s; render both languages.
6. Install every finished episode and glimpse into the app (`app/scripts/install-playable.mjs`), fix the stale ballot meanings, rebuild Studio data (`node app/scripts/build-studio.mjs`), run the full e2e suite (phone + desktop, day 1 and day 2, both languages), code review, fix.
7. Release engineer writes `README.md` (how to run with `pnpm dev`, what is simulated). Final morning report and decisions.

## Concept note
- The owner asked to update `outputs/Unwritten-Interactive-Concept-Note.html` (their pre-build pitch). A writer is updating it with the POC's real series, pipeline, measured costs and lessons; the original is kept as `outputs/Unwritten-Interactive-Concept-Note.v1.html`. Check it opens and update it again once episodes are final.

## Owner's ear list (in `docs/morning-report.md`)
v4/v3 comparison pairs; casting ear checks per series; voice lines accepted at the take limit (s2b02 l32 both langs, s2b03 hi l17 'मुक़दमा', s1a01 hi l24 whisper, s2e02 en l34 borderline).

## Session 2 log (26 Nov evening IST)
- Owner OK'd s2e01's new dialogue as is ("OK, proceed"); three optional tweaks I raised (l32/l08 overlap, l12 lead-in, l19 wording) were not taken.
- Owner: **stop when Claude usage runs out; do not use extra-usage credits.** Weekly usage was 89% at session start, extra usage disabled. Commit and update this file after each step.
- D-025 F1-F6 being applied by S2 (hi) and S5 (en), Opus high.

### Session 2 progress (26 Nov ~20:30 IST, weekly Claude usage 94%)
- D-025 F1-F6 applied (both languages). Clarity re-voice done for the 7 episodes with frames (s1e01, s2e01, s1e02, s1a01, s1b01, s2e02, s2e03): 165 takes + 4 retakes, ~9,600 ElevenLabs credits; D-026 waived 8 measure-only retakes. Lists: `content/revoice-clarity-wave12.json`, `content/revoice-clarity-retakes.json`. **Re-voice for the other 10 episodes (174 rows of `content/revoice-clarity.json`) is NOT done.**
- Toolsmith added the supers (name/place captions) layer to the episode build (`production/scripts/episode/README.md` "Supers").
- S7 remapped shots.json for all 7 episodes.
- Edits: all 7 rendered (720p previews next to each render). Gate 4 screenings: s1e01 8/8, s2e01 8/8 (D-027), s1b01 8/8, s1e02 8/8. Running at this write: s1a01 screening, s2e03 screening, S9 on s2e02 s11 attempt 2 (then re-assemble s2e02 and screen it).
- Deferred fixes (not blocking): subtitle marking of off-screen/phone lines (italics + labels; do it in build_subs + app SubtitleTrack, no re-render needed); Series 1 has no plot-overlay text layer (clock times, "No network", caller names on phones); s1e02 b13 in-breath cue never generated; per-line subtitle split override in build_subs (s1b01 en c026 at 18.2 g/s accepted; s2e03 used a global pause_min_s 0.22); build_timeline should tolerate prose `mix.starting_gains_db`.
- Owner ear list adds: s1e01 en l11/l27; s2e01 l29 "SHO", phone-call level; s1b01 l27 attribution, hi "चौदह" l18/l25, hi l01, en l12; s1e02 hi l13 "थप्पड़", en l09 "wrist"; s1a01 l24 en whisper.
- Next if usage allows: install the 7 episodes into the app (`app/scripts/install-playable.mjs`), fix stale ballot meanings in `app/public/media/series1/series.json`, rebuild Studio, e2e. Waves 3-4 (10 episodes: storyboards, ~250 frames, voice, edit) wait for the usage reset (1 Dec).

### Session 2 end (26 Nov ~21:40 IST, weekly usage 95%, stopped by owner's rule)
- All 7 frame-ready episodes edited, screened 8/10 hi+en, installed in the app. Unit 362/362, e2e 142/142 (prod build). README.md written. Morning report has the session 2 summary and ear list.
- **Next session, in order:** (1) restart the stale `pnpm dev` on 3210; (2) S10 direct + runners for the 174 remaining clarity re-voice rows (10 episodes); (3) waves 3-4 through `phase4-episodes-v2.js` (storyboards time shots to the new voice; editor + screening as in this session, leaner screening brief works); (4) glimpses (S14); (5) install, e2e; (6) deferred fixes listed above; (7) refresh the concept note.

### Session 3 (26 Nov night, after usage reset) — scope cut and voice
- **Owner scope change:** each series ends at episode 1 after the cliffhanger (both branches). In scope: s1e01, s1e02, s1a01, s1b01 (done, installed); s2e01, s2e02, s2e03 (done, installed); **s2a01, s2b01 (voice done, picture to do)**. s1a02-03, s1b02-03, s2a02-03, s2b02-03 are out of scope.
- Claude did the ElevenLabs-only work: s2a01/s2b01 clarity re-voice (38 takes, 1,909 credits, all accepted; review.json rows make the build pick the .c1 takes); s1e02's b13 in-breath generated, placed at -16 dBFS, s1e02 re-rendered and reinstalled.
- **Codex does the rest** per `docs/codex/CODEX-HANDOFF.md`: s2a01/s2b01 storyboards (time to the new voice in voice/manifest.jsonl), frames, frame check, edit, screening, install; app ends each branch after episode 1; toolsmith polish; concept note.
- Ear list adds (s2a01/s2b01): s2b01 en l31 "trap", en l04 "first", en l24 laugh, en l15 chuckle; s2a01 hi l29, l21 "SHO", l25 "भरा", l30 "FIR"; s2b01 hi l05, en l07; s1e02 final in-breath (breath, not gasp?).
