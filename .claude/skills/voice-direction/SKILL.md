---
name: voice-direction
description: ElevenLabs connector speech method for Unwritten - casting, per-line generation, download, credit tracking, retakes.
---
# Voice direction and voice running

Verified 26 Nov 2026 (probe: production/proof/probe/).

## Tools (load once with ToolSearch `select:` and full names)
`mcp__1b07c089-4902-4c55-b9e8-ee3a012cd04a__creative_list_voices`, `..._creative_generate_speech`, `..._creative_get_generations`, `..._creative_create_flow`, `..._account_get_usage`.

## Casting (voice director)
- `creative_list_voices {"languages":["hi"], "page_size":30, "cursor"?}`; page with `cursor` while `has_more`. Listing does not say which voices also do English; English mode uses the same voice reading the English script, judged by listening test.
- Cast with tagged test lines in both languages before committing. Record voice_id per character in `content/<series>/cast.json`.

## Generating a line (voice runner)
- One spoken line per call: `creative_generate_speech {prompt: <exact line text incl. [tags]>, model_id: "eleven_v4", voice_id, generations_count: 1, flow_id: <series flow>}`. No language parameter; pass the Hinglish text as written.
- Create one flow per series/episode with `creative_create_flow` and reuse its `flow_id`.
- The result has `pending[0].generation_id` and `credit_costs`. Then `creative_get_generations {flow_id, generation_ids:[id]}` -> `generations[0].full_res_url` once `status == "completed"` (usually immediate).
- Download at once: `curl -sS -o <file>.mp3 "<full_res_url>"` (quote the URL). Check with `ffprobe` (duration > 0).
- NEVER re-call generate to "retry" a pending result; that charges a second take. Only re-generate when a take is rejected or truly failed.

## Credits
- `account_get_usage` does NOT reflect these generations. Track the `credit_costs` value of every call in the voice manifest; ~35 credits per 28-character line (~1.25/char).

## Manifest
`content/<series>/<ep>/voice/manifest.jsonl`: {line_id, lang, take, voice_id, model, text, generation_id, credits, file, duration_s, status}.

## Failures
Retry transient errors 3x. If a line keeps failing: simpler tags or rewording (director decides), then eleven_v3, then second-choice voice. Placeholder: silent clip of the estimated length, `status: placeholder`.
