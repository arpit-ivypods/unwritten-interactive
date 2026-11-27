# Morning report — Unwritten POC build

_Last updated: 27 Nov 2026 (Codex session). Updated as the build goes._

## Codex session (27 Nov)

- **Scope (D-028):** only s2a01 and s2b01 remain in production. The seven previously screened episodes are installed. Claude accepted all 38 clarity re-voice takes for the two Series 2 branches.
- **Local app:** restarted `pnpm dev` on `127.0.0.1:3210` and confirmed HTTP 200. Cloudflare work is parked on its own branch.
- **Storyboards complete:** s2a01 has 34 planned shots and s2b01 has 35. Each calls for 28 new stills with second framings covering the rest. A separate S9 pass confirmed all dialogue lines and supers are mapped in both languages. Shot durations are projections from the accepted takes until assembly.
- **Uniform (s2b01)** passed independent screening at 8/10 in Hindi and English and is installed locally. It uses 28 approved source stills across 35 shots with seven retakes. The 128.23 s and 127.67 s masters and 720p previews are in the episode's render folder. The screening report records the remaining ear checks and brief writing-hand caption overlap.
- **Lockup (s2a01)** passed independent screening at 8/10 in both languages and is installed locally. It uses 28 approved source stills across 34 shots with four retakes. The 130.93 s and 129.83 s masters and 720p previews are in the episode's render folder. English l10 over the truck is on the ear list.
- **Viewer flow** ends each branch after episode 1 in both series. All eight old watch URLs return 404, while the source assets are kept. Both voting days and the second-ending ballot transition passed independent code review and the phone and desktop tests. Unit tests 371/371, typecheck passed, production E2E 142/142.
- **Toolsmith work** is installed in all nine episodes. The player shows italic phone and off-screen cues with localized first-speaker labels, and Series 1 has plot text on nine phone or clock shots. The builder supports per-language line splits and reads cue sheets containing prose gains. Both proof scenes reproduced byte-identical clean masters. The known English s1b01 reading-speed exception and review-only s1a01 s23 overlap are recorded in D-031.
- **Final app checks** passed with 375 unit tests, a clean typecheck and production build, 142 production browser tests, and zero media validation warnings. Direct Chromium checks verified subtitle styling and localized roles on phone and desktop in both languages. The local dev server was restarted after media installation.
- **Concept note** reflects all nine episodes, their branch endpoints and measured production costs. The refreshed file passed offline checks at eight viewport sizes, including the story lab, voting, the simulator and PNG export. The v1 file is preserved.
- **Tonight and Series follow-up (D-033)** adds both Live Now covers, all three Coming Next posters and nine cast portraits. The Day badge sits above the cards, and the ending cards show each branch's episode and access state. Five viewport checks, 375 unit tests, typecheck, media validation and 142 production browser tests passed.
- **Remaining work** is the four optional glimpse masters and any later owner ear review or publication. The excluded episodes remain outside the POC scope. See the final section of `docs/handoff.md` for review details and commits.
- **App baseline:** 362 unit tests passed before the branch-flow change.


## Session 2 summary (26 Nov evening) — read this first

**Stopped early on purpose:** you asked to stop when Claude usage runs out and not to use extra-usage credits. Weekly usage reached 95% (resets 1 Dec); extra usage is off. Everything below is committed.

| | Status |
|---|---|
| Dialogue clarity pass | Your OK on s2e01's new dialogue. D-025 fixes F1-F6 applied in both languages |
| Re-voice | Done for the 7 episodes that have frames: 165 takes + 4 retakes, ~9,600 ElevenLabs credits (D-026 waived 8 measure-only retakes). **Not done for the other 10 episodes** (174 lines left in `content/revoice-clarity.json`) |
| Name/place captions ("supers") | New layer in the episode build and Remotion |
| Finished episodes (edit + Gate 4 screening) | s1e01 8/8, s2e01 8/8 (D-027), s1e02 8/8, s1a01 8/8, s1b01 8/8, s2e02 8/8, s2e03 8/8 (hi/en). 720p previews beside each render: `content/<series>/episodes/<ep>/render/<ep>.<lang>.720p.mp4` |
| App | All 7 installed as real episodes. Fixed: two-line subtitles were drawn on one line. Ballot meanings synced to the bibles. Unit 362/362, typecheck clean, e2e 142/142 on a fresh production build (phone + desktop, day 1 + day 2, both languages) |
| Not started | Waves 3-4: s1a02, s1a03, s1b02, s1b03, s2a01-s2a03, s2b01-s2b03 (storyboards, ~250 frames, re-voice, edit, screening); the 4 glimpses; refreshed concept note |
| Restart needed | An old `pnpm dev` (port 3210, started 09:58) serves a stale manifest; restart it before watching in dev |

**Your ear/eye list from this session** (all optional; nobody has listened): s1e01 en l11 "Fine", l27; s2e01 l29 "SHO", the s18 phone call level; s1b01 l27 (who says it), hi "चौदह" l18/l25, hi l01, en l12; s1e02 hi l13 "थप्पड़", en l09 "wrist"; s1a01 hi l21/l19/l09, en l12, s30 hands on a phone; s2e02 hi l29 "कल", en l34; s2e03 en l25, hi l16.

**Known non-blocking gaps:** off-screen/phone lines not marked in subtitles (italics/labels); Series 1 phone/clock overlays not drawn; s1e02's final in-breath sound missing; five subtitle words with no highlight time; s2e03 s08 holds ~13 s (screening suggests a reframed split).

## At a glance (earlier, session 1)

| | Status |
|---|---|
| Finished | Setup (git, gitignore, keep-awake); harness check (D-000); Codex and ElevenLabs runner methods proven (D-001); Remotion toolchain (`production/remotion`, `production/scripts/render.sh`); Phase 1 loglines picked (D-003, D-004) and both bibles approved (D-005 to D-007); proof scenes: scripts, English, sheets, plates and 18 story frames per method, both styles, rendered in Hindi and English (picture only); Gate 0 picture method approved with changes (D-008, D-010, D-012 to D-015); five-frame retest passed (D-017); **Gate 0b closed (D-0M4): photoreal proof 8/10, flat 2D 7/10 with real audio**; both series cast (provisional, ear checks listed below); **voice final for all 17 episodes in both languages**; **Phase 2 scripts: all 17 pass Gate 2 in Hindi and English (D-018, D-019; the 4 held scripts passed their critic rerun at 8.0-8.3); no trim before voice, ceiling 150 s per cut; English has its own 1,300-character gate (D-020)**; wave 1 voice done for s1e01 and s2e01; app fix round 1 (e2e 142/142) |
| Placeholders | None in the proof scenes: both are finished with real voice, music and effects in Hindi and English (`content/proof/<style>/render/proof.{hi,en}.mp4` and `.review.mp4` with burned subtitles). App still runs on placeholder episodes until Phase 4. |
| Running | Phase 4 wave 1 (s1e01, s2e01): prep, storyboards, frames, edit, screening, Gate 4; voice generation for the remaining 9 episodes; local voice reviews |
| ElevenLabs credits used | about 66,700 of ~730,000: setup, proofs and casting 13,014; sound libraries 9,138; episode voice first takes about 41,300; retakes about 3,210. Totals from per-call `credit_costs` |
| Codex frames made | 56 generations in Phase 0 (26 sheets/plates, 18 story frames, 12 retakes or duplicates). No quota message seen. Measured 76 s (photoreal) and 104 s (flat 2D) per story frame; 55 s per sheet |
| Render | 25 s of render per finished minute (D-012) |
| App | All 13 screens, player, presenter drawer, Studio on placeholder episodes. Fix round 1 done: 328 unit tests pass, e2e 142/142 (phone + desktop), build passes, independent re-review found all 8 earlier findings fixed. Open (low): after a presenter reset from a second window, an already-open player keeps playing without saving; a tab left open past the countdown window freezes until reload. Not tested on Safari/iOS (Chromium only). |

## Needs your decision

1. _Resolved, no action needed:_ the ElevenLabs route works from the orchestrator's own subagents (see Issue 1). No API key is needed.
2. **Voice model by ear (D-009, D-0M2).** v4 was kept (v3 won 2 of 6 measurable pairs, 4 needed). Listen to the six pairs and override if you prefer v3: `content/proof/photoreal/voice/hi/l01|l08|l10.mp3` vs `.v3.mp3`, and `content/proof/flat2d/voice/hi/l07|l08|l12.mp3` vs `.v3.mp3` (the flat 2D l12 v3 take is fully voiced, as the line asks; the v4 one is not). Files listed in each scene's `voice/ab.json`.
4. **Voice lines accepted at the take limit (hear these).** `content/series2/episodes/s2b02/voice/{hi,en}/l32.mp3` (Tripathi's cliffhanger; borderline voiced; one more take is allowed if you want it treated as protected); `content/series2/episodes/s2b03/voice/hi/l17.mp3` (check that 'मुक़दमा' is said, not 'वो क़दमा'; if wrong, the line needs new wording); `content/series1/episodes/s1a01/voice/hi/l24.mp3` (meant to be whispered; the v3 take is voiced; take 1 `l24.t1.mp3` is the more whispered option); `content/series2/episodes/s2e02/voice/en/l34.mp3` (passes at exactly the 0.6 line). Each episode's `voice/review.json` also has an `ear_check` list.
3. **Casting by ear.** Both series are cast (all first choices kept) from listings, pitch/level measures and local whisper.cpp transcripts; nobody has heard a voice. Hear these first, in order (files under `content/series*/casting/<character>/`):
   - **Series 1** (`content/series1/cast.json` → `ear_check`): kiran_t3 (came out whispered; fix is a simpler tag); Kiran vs Mausi t2/t2 (Mausi measures slightly above Kiran; if alike, Mausi goes to backup Kahani G); constable_t1 (glitch in one word); billu_t2 (pitch jump, possible squeal); chhoti_t1 and t3 (shrill or too young?); one English take per character for accent.
   - **Series 2** (`content/series2/cast.json` → `ear_check`): door3_man_t1_hi with nirala_t1_hi (Mukesh and Nirala cannot be told apart by measure; if alike, Mukesh goes to backup Indal Patel); defence_lawyer_t2_hi ("हाँ" may be a laugh); bhaiyaji_t2_hi; nandini_t2_hi; tripathi_t2_hi; magistrate_t2_hi with nandini_t1_hi (similar pitch in the court episode).

## Issues

### Issue 1 — Proof-scene audio never generated (Phase 0b)
- **What:** all casting, voice, sound, voice-review and screening sessions in the Phase 0 workflow started without `ToolSearch` and without the `creative_*` tools, though the agent files list them. Result: `cast.json` uncast in both scenes, 44+ silent voice clips, 23 silent sound cues, screening failed twice at 3/10 (silence only; picture holds).
- **Attempts:** 1) workflow casting session (no tools); 2) workflow voice runner (no tools); 3) same for sound; 4) two screening rounds and two editor fix rounds, which could not fix audio. Debug finding (Arbiter D-008/D-015): harness drops MCP tools for workflow sessions.
- **Fix that worked (attempt 5):** Agent-tool subagents (not workflow sessions) reach the connector. Both scenes cast, 50 takes and 23 cues generated, no failures. All voice and sound runs go this route from now on.
- **Rerun just this:** cast and voice each proof scene from a session that can call the connector, using `content/proof/<style>/voice/takes.json`, then `production/scripts/render.sh content/proof/<style>/timeline.hi.json content/proof/<style>/render/proof.hi.mp4` (and `.en`).

### Issue 2 — Prop and left/right continuity in proof frames
- **What:** faces held (8/10 both styles) but props drifted (bag, phone, laddoo, key, seat tear) and sides flipped five times; prop sheets existed but were never attached.
- **Fix decided:** D-013 (prop refs on every call, scene anchors, STATE block, picture-side wording, frame check with crops).
- **Retest result (D-017): passed 5 of 5** (bar 4 of 5). Bag, phone, laddoo and key hand right in every regenerated frame. One fault stuck: flat 2D s07, Bablu reads too tall beside Meenu after three prompt rewrites; accepted under rule 11. Fix for the series: pair line-up sheets are now a Phase 3 gate.
- **Tooling:** `production/scripts/codex-frame.sh` is the one frame runner (per-shot lock, shared 2-3 Codex slots, per-attempt logs, quota pause file `work/codex-slots/QUOTA`). Rerun one frame: `bash production/scripts/codex-frame.sh <frames_dir> <shot_id> <prompt_file> <refs...>`.

### Issue 3 — A voice file was overwritten with corrupt data (s1e01 hi l02)
- **What:** at 11:02 IST `content/series1/episodes/s1e01/voice/hi/l02.mp3` was replaced by an unreadable file (no manifest row, so not a runner). Most likely a parallel review or edit session wrote a converted copy over the original.
- **Fix:** restored from the committed version (4.72 s, plays). The corrupt file is kept in the session scratchpad. A scan of every episode voice file and both sound libraries found no other unreadable file.
- **Prevention:** reviewers and editors are told to work on copies in their own scratch folders; voice files are written only by voice runners.
- **Rerun just this:** `git checkout -- content/series1/episodes/s1e01/voice/hi/l02.mp3`.

### Issue 4 — v4 whispers on quiet tags
- **What:** across both series, lines tagged `[quietly]` (and some `[low voice]`) came out whispered or breathy for several voices, Kiran most of all. Reviews flag about 60 such lines across the 17 episodes. Words are right in all of them.
- **Ruling (D-022):** retake without the quiet tag ([calm] if no tag is left, then the bare line), level set in the mix; Kiran keeps her voice. 69 retakes over two rounds; all lines final. Kiran's backup-voice test is not triggered (all her lines pass on [calm] or the bare line).

### Issue 5 — Owner: dialogue and story are unclear (s2e01)
- **What:** the owner watched s2e01 and found the flow, picture and direction fine, but the opening dialogue, the storyline and how the lines connect unclear.
- **Diagnosis:** `docs/clarity-review.md` (script doctor) and `docs/clarity-cold-viewers.md` (five cold viewers). Plots hold; every episode has 3-7 lines a newcomer cannot decode. Causes: gates checked scripts against the bible, not against what a viewer hears; the character measure cut set-up lines; names, roles and jargon never introduced.
- **Owner's choice:** story is fine; dialogue-only pass (Option 1). Running: clarity ruling and skill updates, a viewer ledger per series, rewrite of all 17 scripts keeping every beat and frame, English mirror, cold-viewer gate C1 on every path in both languages, one fix round, continuity, Arbiter gate. Then changed lines are re-voiced (estimated 25,000-35,000 credits). Wave 2 frames resumed in frames-only mode in the meantime.
- **Wave 1 fix round** (toolchain, frame retakes) continues, because picture is not the problem.

## Notes

- **Sound libraries:** both done (63 + 59 cues, no failures). Several cues miss their brief by loudness shape (listed per cue in `content/series*/sound/manifest.jsonl` → `qc` / `qc_note`); editors use the usable stretch. Nobody has heard them.

- **Gate 2 holds (resolved):** s1a02, s2e02, s2a01, s2b01 were first not read because their critics stopped at a tool check my brief caused; rerun with a clearer brief, all four pass.
- **Harness quirk:** a plugin hook cuts the Read tool to one line for many agents; they work around it with Grep or a shell. Results are unaffected but slower.
- **App data to fix in integration:** `app/public/media/series1/series.json` still carries the old ballot meanings (one with यह), flagged three times by the Arbiter.

- **Flat 2D proof open items (not blocking):** the end sting is probably masked by the phone buzz, the keyring is still quiet, the held music note under l08 is a loop of a quiet layer nobody has heard. Ear check: `content/proof/flat2d/render/proof.hi.mp4` from shot s06 to s08. Edit settings live in `content/proof/flat2d/build_timeline.py` (CUTOFF, LINE_DB, SEG1_DB, HELD_*); rerun it, then `build_subs.py`, `make_review.py`, `production/scripts/render.sh`.
- **Pace (D-0M3):** real takes make scenes about 30% longer than planned; Gate 2 decides whether scripts are trimmed.

- **Model change (D-0M1):** at the owner's request Fable is no longer used; all former Fable roles run on Opus at the same effort from ~05:00 IST. Work in flight was stopped and resumed from cache.

- Agent files in `.claude/agents/` are now loaded by the app; every call still pins `model` and `effort` explicitly (D-002).
- Decision numbering: Gate 0 is D-008 to D-015; D-007 (Series 1 bible round 2) sits after them in the file.

## Known conflicts resolved

- Design system BallotSheet README says the cast button waits until both glimpses are watched. Plan section 9 says glimpses are optional. The app follows section 9.
