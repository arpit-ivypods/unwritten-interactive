export const meta = {
  name: 'phase4-episodes',
  description: 'Phase 4 episode pipeline (one lane per episode): storyboard -> anchors -> check -> frames -> check/retake -> edit (shared toolchain) -> render 4 cuts -> screen -> one fix pass; prep and Arbiter gate per wave',
  phases: [{ title: 'Prep' }, { title: 'Storyboard' }, { title: 'Anchors' }, { title: 'Frames' }, { title: 'Edit' }, { title: 'Screen' }, { title: 'Fix' }, { title: 'Gate' }],
}
const ROOT = '<repo>'
const A = args || {}
const EPS = A.episodes || ['s1e01', 's2e01']
const PREP = A.prep !== false
const GATE = A.gate || 'Gate 4 (wave 1: first episode of each series)'
const ser = ep => ep.startsWith('s1') ? 'series1' : 'series2'
const CTX = `Project root: ${ROOT}. Plan: docs/unwritten-poc-plan.md (section 9 overrides). Governing decisions in docs/decisions.md: D-010, D-012, D-013, D-014, D-015, D-017, D-0M2, D-0M4, D-018/D-019/D-020 (length: 150 s ceiling per cut), D-021 (Gate 3: style frames, two sheet faces per frame max), D-022 (voice final), D-023 (Gate 4: retakes are part of the frame stage; Series 1 right-cuff rule; a reframing of a wide cannot stand in for a close; one frames/review.json format). Frames ONLY via ${ROOT}/production/scripts/codex-frame.sh (skill frame-generation). If the Read tool returns only one line of a file, read it with Bash. Use your own scratch folder; never shared scratch files. Do not call ElevenLabs.`
const R = { type: 'object', properties: { ok: { type: 'boolean' }, summary: { type: 'string' }, fixes: { type: 'array', items: { type: 'object', properties: { owner: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['owner', 'issue', 'fix'] } } }, required: ['ok', 'summary'] }
const CHECK = { type: 'object', properties: { ok: { type: 'boolean' }, rejects: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'reason', 'fix'] } }, summary: { type: 'string' } }, required: ['ok', 'rejects', 'summary'] }

if (PREP) {
  phase('Prep')
  await parallel([
    ...['series1', 'series2'].map(s => () => agent(`${CTX}
You are S6 Art director. D-021: rewrite the character and wardrobe descriptions (character locks, wardrobe locks) in content/${s}/style.json from the APPROVED sheets in content/${s}/refs (age, face shape, hair side, jewellery, marks exactly as the sheets show, in picture-side terms). Add the series style frame from D-021 to style.json as style_frame with the rule "copy only the rendering, not the room, props or light". Do not regenerate anything. Return ok and summary.`, { label: `style-locks:${s}`, phase: 'Prep', agentType: 'art-director', model: 'opus', effort: 'high', schema: R })),
    ...['series1', 'series2'].map(s => () => agent(`${CTX}
You are S9 Visual checker. D-021: targeted full-resolution check of the assets regenerated in the Phase 3 retake round in content/${s}/refs (manifest.jsonl rows with attempt 2), plus the four new points D-021 lists for the checker. Crop with ffmpeg. Return ok and rejects with exact prompt fixes (they will be applied by the art director only if blocking).`, { label: `sheet-check:${s}`, phase: 'Prep', agentType: 'visual-checker', model: 'opus', effort: 'high', schema: CHECK })),
    () => agent(`${CTX}
You are S13 Editor acting as pipeline toolsmith (the only step allowed to edit production/scripts and production/remotion, D-0M4). Generalise the proof-scene assembly scripts into one shared episode toolchain in production/scripts/episode/:
- build_timeline.py <episode_dir> <lang>: reads shots.json, voice/manifest.jsonl (latest take per line, _t2 preferred, trim_in_s honoured, retake verdicts in voice/review.json), sound/cues.json + the series library content/<series>/sound/lib and manifest.jsonl (use each cue's usable window from its qc notes when given), and an optional edit.json for per-episode overrides (line gains, cutoffs, music in/out). Lays out lines on measured speech (silencedetect, D-014), shots follow the voice, writes timeline.<lang>.json for production/remotion.
- build_subs.py <episode_dir> <lang>: D-014 rules (split at pauses >= 300 ms on punctuation, word times from local whisper.cpp only when counts match, else by graphemes; no cue across a cut; >= 2 frames apart; <= 17 graphemes/s); writes subs.<lang>.json in the app's subtitle format (check app/src/content/schema.ts and docs/contracts.md).
- make_review.py <episode_dir> <lang>: timeline.<lang>.review.json with burned subtitles.
- assemble.sh <episode_dir>: runs all of the above for hi and en, renders render/<ep>.{hi,en}.mp4 and .review.mp4 with production/scripts/render.sh, masters (±0.5 LU of -14 LUFS, <= -1 dBTP), verifies durations, LUFS, md5 differ, subtitle checks; prints a JSON summary.
Base them on content/proof/photoreal/{build_timeline.py,build_subs.py,make_review.py,wordtime.py} and content/proof/flat2d equivalents. Test on BOTH proof scenes (output to a scratch copy, not over the proof renders) and confirm results match the proof cuts within a frame. Document in production/scripts/episode/README.md. Return ok and summary.`, { label: 'toolsmith:episode-toolchain', phase: 'Prep', agentType: 'editor', model: 'opus', effort: 'high', schema: R }),
  ])
}

const lanes = await pipeline(EPS,
  ep => agent(`${CTX}
You are S7 Storyboard artist. Episode ${ep}: content/${ser(ep)}/episodes/${ep} (script.hi.json, script.en.json, voice/manifest.jsonl with MEASURED clip lengths, voice/review.json). Series: content/${ser(ep)}/bible.json, style.json (with the rewritten locks and style_frame), continuity.json, refs/ (sheets, pair sheets, plates, prop sheets).
Write shots.json for the episode and one prompt per frame in frames/prompts/<shot>.txt, following D-013 and D-017 exactly: refs at most 5 in order (character or pair sheets, plate, prop sheets, scene anchor; style_frame only on the first frame of each new scene), a STATE block from continuity.json per shot, picture-side wording, character lock from the approved sheet, camera move preset and scale <= 1.3 for second framings. Budget about 28 generated frames (D-010), extra shots as second framings of approved frames. Shot lengths follow the measured voice of the LONGER language; no set-up held past 8 s (D-018). Name the scene anchor shot of each scene and list anchors first in shots.json "generation_order". Return ok and summary: shot count, frames to generate, anchors, estimated seconds per language.`, { label: `board:${ep}`, phase: 'Storyboard', agentType: 'storyboard-artist', model: 'opus', effort: 'high', schema: R }),
  (b, ep) => agent(`${CTX}
You are S8 Frame runner. No creative decisions. Episode folder content/${ser(ep)}/episodes/${ep}. Generate ONLY the anchor frames listed in shots.json generation_order as anchors, in order, with:
  UW_CODEX_SLOTS=3 bash ${ROOT}/production/scripts/codex-frame.sh <abs frames dir> <shot> <abs prompt file> <abs refs in shots.json order>
Stop on exit 3 (quota). Return ok and per shot status and seconds.`, { label: `anchors:${ep}`, phase: 'Anchors', agentType: 'frame-runner', model: 'sonnet', effort: 'low', schema: R }),
  (a, ep) => agent(`${CTX}
You are S9 Visual checker. You made none of these. Episode content/${ser(ep)}/episodes/${ep}: judge the anchor frames against shots.json (STATE, refs), style.json, continuity.json and the sheets: identity vs sheet close-up (face crop), wardrobe and jewellery locks, props and their state, picture-side placement, hands, no text, faces above the bottom 25%. Crop with ffmpeg at full resolution.`, { label: `check-anchors:${ep}`, phase: 'Anchors', agentType: 'visual-checker', model: 'opus', effort: 'high', schema: CHECK }).then(c => ({ c, ep })),
  async ({ c, ep }) => {
    if (c && c.rejects && c.rejects.length) {
      await agent(`${CTX}
You are S7 Storyboard artist. The checker rejected these anchor frames in content/${ser(ep)}/episodes/${ep}: ${JSON.stringify(c.rejects)}
Apply each fix to frames/prompts/<shot>.txt (and shots.json if refs change), then regenerate each ONCE (D-013 rule 11) yourself in your shell with UW_CODEX_SLOTS=3 bash ${ROOT}/production/scripts/codex-frame.sh <abs frames dir> <shot> <abs prompt> <abs refs>. If your session has no shell, stop and say so in one line. After that the better take stands; log any drift in shots.json under that shot's "drift". Return ok and summary.`, { label: `retake-anchors:${ep}`, phase: 'Anchors', agentType: 'storyboard-artist', model: 'opus', effort: 'high', schema: R })
    }
    return agent(`${CTX}
You are S8 Frame runner. No creative decisions. Episode folder content/${ser(ep)}/episodes/${ep}. Generate every remaining frame in shots.json generation_order that does not yet have frames/<shot>.png at 1440x2560, in order, with UW_CODEX_SLOTS=3 bash ${ROOT}/production/scripts/codex-frame.sh <abs frames dir> <shot> <abs prompt file> <abs refs>. For second framings marked in shots.json as derived from another frame, do not generate (the editor crops them). Stop on exit 3. Return ok and per shot status and seconds.`, { label: `frames:${ep}`, phase: 'Frames', agentType: 'frame-runner', model: 'sonnet', effort: 'low', schema: R }).then(f => ({ ep, f }))
  },
  ({ ep }) => agent(`${CTX}
You are S9 Visual checker. You made none of these. Episode content/${ser(ep)}/episodes/${ep}: judge every frame in frames/ that is not an anchor against shots.json (STATE, refs), continuity.json, the sheets and the scene anchors: identity, wardrobe, props and state, picture side, hands, no text, faces above the bottom 25%, consistency with the anchor. Crop with ffmpeg.`, { label: `check-frames:${ep}`, phase: 'Frames', agentType: 'visual-checker', model: 'opus', effort: 'high', schema: CHECK }).then(c => ({ c, ep })),
  async ({ c, ep }) => {
    if (c && c.rejects && c.rejects.length) {
      await agent(`${CTX}
You are S7 Storyboard artist. The checker rejected these frames in content/${ser(ep)}/episodes/${ep}: ${JSON.stringify(c.rejects)}
Apply each fix to frames/prompts/<shot>.txt and regenerate each ONCE yourself in your shell with UW_CODEX_SLOTS=3 bash ${ROOT}/production/scripts/codex-frame.sh <abs frames dir> <shot> <abs prompt> <abs refs>. If your session has no shell, stop and say so in one line. After that the better take stands; log drift in shots.json. Return ok and summary.`, { label: `retake-frames:${ep}`, phase: 'Frames', agentType: 'storyboard-artist', model: 'opus', effort: 'high', schema: R })
      await agent(`${CTX}
You are S9 Visual checker. Check ONLY the frames just retaken in content/${ser(ep)}/episodes/${ep}: ${JSON.stringify(c.rejects.map(r => r.id))}. After this one retake the better take stands (D-013 rule 11): record the final verdict per shot in frames/review.json (the single format D-023 sets), with drift logged. Return ok and rejects (informational only).`, { label: `recheck-frames:${ep}`, phase: 'Frames', agentType: 'visual-checker', model: 'opus', effort: 'high', schema: CHECK })
    }
    await agent(`${CTX}
You are S8 Frame runner. No creative decisions. Episode folder content/${ser(ep)}/episodes/${ep}. Generate every frame in shots.json generation_order that still has no frames/<shot>.png at 1440x2560 (for example frames that waited on a retaken anchor), with UW_CODEX_SLOTS=3 bash ${ROOT}/production/scripts/codex-frame.sh. Then list every shot in shots.json and confirm each either has its own frame or is a second framing whose source frame exists. Return ok (no shot left without a picture) and the list of any that are still missing with the reason.`, { label: `frames-complete:${ep}`, phase: 'Frames', agentType: 'frame-runner', model: 'sonnet', effort: 'low', schema: R })
    return ep
  },
  ep => A.framesOnly ? { ep, e: null, framesOnly: true } : agent(`${CTX}
You are S13 Editor for episode ${ep} (content/${ser(ep)}/episodes/${ep}). Use ONLY the shared toolchain in production/scripts/episode/ (README.md there); put per-episode choices in the episode's edit.json; do not edit shared files (D-0M4). Run assemble.sh to produce render/${ep}.hi.mp4, render/${ep}.en.mp4 and both .review.mp4 cuts plus subs.hi.json and subs.en.json. Check: each cut <= 150 s (D-018/D-020; if over, shorten silences first and report the result), loudness, md5s differ, subtitle checks. Return ok and summary with durations, LUFS and any line or cue problems.`, { label: `edit:${ep}`, phase: 'Edit', agentType: 'editor', model: 'opus', effort: 'high', schema: R }).then(e => ({ ep, e })),
  (x) => x.framesOnly ? x : (({ ep, e }) => agent(`${CTX}
You are S15 Screening reviewer. You did not make this. Episode ${ep} (content/${ser(ep)}/episodes/${ep}). Editor report: ${JSON.stringify(e && e.summary)}
Precondition (D-015 rule 3): no placeholder rows in voice or sound manifests, renders above -30 LUFS, hi and en differ; otherwise stop and report picture-only.
Screen both language cuts and review cuts: sample frames at every shot and cue; local whisper.cpp transcription vs the scripts and subs; sync (cues within 0.2 s of speech); dialogue intelligible over music; ducking; music in/out and effects on their beats; continuity across shots vs continuity.json; the episode's opening and its cliffhanger land; length <= 150 s. Score /10 per area and overall. Write screening.json. Return ok (>= 7/10 and no blocking issue), summary, and fixes routed to owners (editor, sound, voice, frames, storyboard) with exact fixes. Say what you could not check.`, { label: `screen:${ep}`, phase: 'Screen', agentType: 'screening-reviewer', model: 'opus', effort: 'high', schema: R }).then(s => ({ ep, e, s })))(x),
  async (x) => { if (x.framesOnly) return { ep: x.ep, framesOnly: true }
    const { ep, e, s } = x
    const fx = (s && s.fixes) || []
    const edit = fx.filter(f => /edit|subtit|mix|sound/i.test(f.owner))
    const frames = fx.filter(f => /frame|storyboard|visual/i.test(f.owner))
    let fixed = null, re = null
    if (!(s && s.ok) && (edit.length || frames.length)) {
      if (frames.length) await agent(`${CTX}
You are S7 Storyboard artist. Screening fixes for frames in content/${ser(ep)}/episodes/${ep}: ${JSON.stringify(frames)}
Apply to the prompts and regenerate each affected frame once with UW_CODEX_SLOTS=3 bash ${ROOT}/production/scripts/codex-frame.sh. Return ok and summary.`, { label: `fix-frames:${ep}`, phase: 'Fix', agentType: 'storyboard-artist', model: 'opus', effort: 'high', schema: R })
      fixed = await agent(`${CTX}
You are S13 Editor for ${ep}. Screening fixes for you: ${JSON.stringify(edit)}. ${frames.length ? 'Some frames were also regenerated.' : ''} Apply through edit.json and the shared toolchain only, rerun assemble.sh, verify. Return ok and summary.`, { label: `fix-edit:${ep}`, phase: 'Fix', agentType: 'editor', model: 'opus', effort: 'high', schema: R })
      re = await agent(`${CTX}
You are S15 Screening reviewer. Look ONLY at what changed (D-015 rule 5) in ${ep}: fixes filed ${JSON.stringify(fx)}; editor report ${JSON.stringify(fixed && fixed.summary)}. Update screening.json with a changed-items section and final score. Return ok and summary.`, { label: `rescreen:${ep}`, phase: 'Fix', agentType: 'screening-reviewer', model: 'opus', effort: 'high', schema: R })
    }
    const voiceFixes = fx.filter(f => /voice/i.test(f.owner))
    return { ep, edit: e && e.summary, screen: s && { ok: s.ok, summary: s.summary }, fixed: fixed && fixed.summary, rescreen: re && { ok: re.ok, summary: re.summary }, voiceFixes }
  })

phase('Gate')
if (A.framesOnly) return { lanes, gate: null }
const gate = await agent(`${CTX}
You are A0 Arbiter. ${GATE}. Lane results (makers' and checkers' reports, not yours):
${JSON.stringify(lanes)}
Watch at least the opening and the last 20 s of each episode yourself via sampled frames if you have a shell, or the screening reports if not. Decide pass per episode, and whether the method changes before the next wave (frame budget, retake rate, length, any D-015 "would change it" condition). List voice fixes that need the orchestrator's ElevenLabs runner. Append one entry to docs/decisions.md with the next free D- number, same format. Return ok and summary.`, { label: 'arbiter:gate', phase: 'Gate', agentType: 'arbiter', model: 'opus', effort: 'xhigh', schema: R })
return { lanes, gate }