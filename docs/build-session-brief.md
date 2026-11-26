# Build session brief — Unwritten POC

You are starting the build of the Unwritten POC in `<repo>`. You have none of the planning conversation; everything you need is in the files named here. The owner is asleep while you work. Do not stop to ask questions.

## Read first, in this order

1. `docs/unwritten-poc-plan.md` — the full functional and technical plan. Read all of it. **Section 9 is the decision table and overrides anything earlier that disagrees.** Section 5 has the agent roster, the model and effort for each agent, and how the harness is to be used. Section 7.8 is the failure policy.
2. `reports/AI micro drama production pipeline.md` — research behind the technical choices, including what is unverified.
3. The design system at https://claude.ai/artifact/9Yw2dAgQzsGQmFHHEEheT9 — read `project/README.md`, `project/tokens.json` and `project/components/bundle.css` with the Artifact tool, then the component previews you need. Direction C mockups: https://claude.ai/artifact/NaeZmVec8UGxNpP2Trhoqj.
4. Skills: Remotion in `.claude/skills/remotion-*` (start with `remotion-best-practices`); ElevenLabs API how-tos in `.agents/skills/` (reference only; there is no API key).

## What is being built

A finished, local, end-to-end demo of an interactive micro-drama viewer.

- Two brand-new series. Series 1: photoreal crime or con story, 5 episodes on any path, choice after episode 2. Series 2: flat 2D illustration with bold outlines, a small-town cop caper, 6 episodes on any path, choice after episode 3. About two minutes an episode: 17 episodes and 4 glimpses to produce.
- Vertical 9:16. Stills with slow camera moves and layered parallax. No image-to-video.
- Full voice cast in Hinglish (Hindi in Devanagari, English words in Latin script; the same text is spoken and shown as subtitles) and a full English version by the same cast. Music and sound effects.
- A Next.js 16 / React 19 / TypeScript / Tailwind v4 app with every screen in plan section 4, state on the device only, built on the design system. Includes the presenter drawer (day 1 / day 2 switch, reset history) and the Studio walkthrough.

## Your role and the models

You are the orchestrator, running on Opus 5.5. You brief agents, read their structured results and decide what runs next. You do not write scripts, generate frames or write app code yourself.

- Create one definition per agent in `.claude/agents/<name>.md` with the `model` and `effort` from the table in plan section 5 (`fable`, `opus` or `sonnet`), least-privilege `tools`, and the `skills` it needs. Because you are on Opus, an agent with no pinned model would run on Opus: **pin every agent explicitly**, especially the ones assigned to Fable.
- First, verify the harness: define one test agent per tier, run each once, and record in `docs/decisions.md` which model each actually ran on. If agent definition files are not picked up, pass `model` and `effort` on each call instead. If Fable is unavailable, use Opus at `xhigh` for those roles and record that.
- Use one workflow per phase (load the `workflow-authoring` skill before writing one). Episode production is a pipeline, one lane per episode. The owner has explicitly asked for a multi-agent build at this scale.
- Makers never check their own work. Mechanical steps (upscaling, loudness, rendering, downloads, manifest checks) are scripts, not agents.

## Tools that are known to work

- **Frames: Codex CLI only.** `codex exec --skip-git-repo-check -m gpt-6.1-sol -c model_reasoning_effort=low -C <dir> "<prompt>" < /dev/null`. Without `-m gpt-6.1-sol` the configured default model is rejected; without `< /dev/null` it hangs. Images are written to `~/.codex/generated_images/<session>/` at about 941×1672 and must be upscaled to at least 1440×2560. Sample: `production/proof/codex-test-01.jpg`. Do not edit the owner's Codex configuration.
- **Voice, sound effects, music: the ElevenLabs connector** (MCP tools named `creative_*` and `account_get_usage`; load them with ToolSearch). Pro plan, about 730,000 credits. Speech model `eleven_v4` with emotion tags in square brackets. One spoken line per call; each clip's length gives the subtitle timing. Results are links that expire: download every file as soon as it is made. There is deliberately no API key and no `.env`.
- **Assembly: Remotion**, rendering H.264 1080×1920 at 30 fps, one file per episode per language. Subtitles are timed JSON drawn by the app, not burned in.
- **Chrome browser tools** for anything the other tools cannot do or explain.

## Order of work

1. Set up: `git init`, `.gitignore`, agent definitions, project skills from plan section 5, `docs/decisions.md`, `docs/morning-report.md`. Ask the app to keep the Mac awake.
2. Phase 0, proof scenes: one roughly 30-second scene in each visual style, end to end with the real pipeline, with one character reference sheet reused across at least four shots, in both languages. Measure time and allowance per Codex frame, character consistency, credits per finished minute and render time. The Arbiter judges the result and fixes the method.
3. Phases 1–3: three loglines per series and the choice between them, bibles and branch maps, scripts with a separate critic and continuity check, English adaptation, visual bibles with character sheets and location plates, casting with voice tests.
4. Phase 4: all 17 episodes and 4 glimpses in both languages, with separate checkers for frames and finished episodes.
5. From step 3 onwards, in parallel: the app, first against placeholder episodes, then the real ones.
6. Test every path in plan section 4 at phone and desktop sizes, on day 1 and day 2, in both languages, and fix what fails.

## Rules while unattended

- No approvals from the owner. The Arbiter agent settles every open question by reasoning and research and logs the question, options, evidence and decision in `docs/decisions.md`.
- On failure follow plan section 7.8: retry (3 times), diagnose with a separate debugging agent, try up to two different approaches, use the browser, then put in a clearly marked placeholder and log it. About 30 minutes per stuck item. Never wait for an answer.
- Keep `docs/morning-report.md` current as you go: what is finished, what is a placeholder, what is still running, credits used, what needs the owner's decision; and one entry per issue with every attempt and how to rerun just that piece.
- Do not: enter passwords or keys, buy or upgrade anything, accept terms, solve CAPTCHAs, share or deploy anything off this Mac, delete work, or change permission settings. If a fix needs one of these, use a placeholder and list it under "Needs your decision".
- Report honestly. Never mark something done that was not verified.

## Done means

- The documented command (for example `pnpm dev`) serves the app locally.
- Both series play from the first episode to both endings in Hinglish and in English, with subtitles.
- Glimpses, ballot, the other ending, keep-or-move, the day-2 result, history, share card, Studio and presenter controls all work.
- The tests pass.
- `docs/decisions.md` records every Arbiter decision, `docs/morning-report.md` is complete, and a short `README.md` says how to run the demo and what is simulated.
