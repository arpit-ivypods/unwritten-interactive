---
name: frame-generation
description: Exact Codex CLI frame generation method for Unwritten frames - the codex-frame.sh runner, references, naming, upscale, status rules, retries, lanes, manifest.
---
# Frame generation (S8 Frame runner)

Method verified 26 Nov 2026 on this Mac (probe: production/proof/probe-codex/). Runner rules: D-010; reference rules: D-013; process: D-015 (docs/decisions.md).

## The runner: always use `production/scripts/codex-frame.sh`
Never call `codex exec` by hand for a frame. One call per shot:
```
production/scripts/codex-frame.sh <frames_dir> <shot_id> <prompt_file> [ref1.png ... ref5.png]
```
- Write the prompt to a file first (e.g. `<frames_dir>/<shot>.prompt.txt`). Refs are image paths, at most 5, in the order the prompt labels them.
- Prints the absolute path of `<shot>.png` on success. Exit codes: `0` ok, `1` failed after all retries, `2` usage error, `3` quota (stop the batch), `4` refused (do not retry; send to the storyboard artist), `5` shot locked by another runner.
- Verified 26 Nov with one real call (work/codex-test, shot `mug`, no refs: 27.7 s, ok, 1440x2560) and offline tests of every status path with a fake `codex`.

What it does for you (do not re-implement any of this):
- **Lock:** `mkdir <frames_dir>/.lock.<shot_id>`; a second runner for the same shot exits 5. A lock left by a dead process is reclaimed.
- **Lanes:** a shared counting semaphore in `work/codex-slots/` (`slot.1..N`) caps concurrent Codex calls across all episodes and both series. N = `$UW_CODEX_SLOTS`, default 2, hard max 3. Callers wait for a free slot. A timeout or rate-limit result drops one lane for 10 minutes (`drop.<expiry>` files, never below 1). Stepping 2 -> 3 (after 20 clean generations in a row, kept only if throughput rises) is the orchestrator's call, by setting `UW_CODEX_SLOTS=3`.
- **Command** (prompt first, `-i` refs last because `-i` is variadic; stdin from /dev/null or it hangs; 10-minute ceiling, the process group is killed on timeout):
  `cd <frames_dir>; codex exec --skip-git-repo-check -m gpt-6.1-sol -c model_reasoning_effort=low -C "$PWD" "<prompt>" -i refs... < /dev/null > <shot>.a<attempt>.codex.log 2>&1`
- **Own log per attempt:** `<shot>.a<attempt>.codex.log`, attempt = existing manifest rows for that shot + 1.
- **Collecting:** session id read from that attempt's own log; the png is copied only from `~/.codex/generated_images/<that id>/` to `<shot>.raw.png` (~941x1672), upscaled with `ffmpeg -vf "scale=-2:2560:flags=lanczos,crop=1440:2560"` to `<shot>.png`, verified 1440x2560 with `sips`.
- **Never deletes work:** an existing `<shot>.png` / `<shot>.raw.png` is moved to `<shot>.prev<N>.png` / `<shot>.prev<N>.raw.png` before the new one is written.
- **Manifest:** one JSON line per attempt in `<frames_dir>/manifest.jsonl` with real UTC ISO times: `{shot_id, attempt, prompt_sha (sha256, 12 chars), refs (absolute paths), session_id, started, ended, seconds, status, file, error}`. `seconds` is the Codex call only, not time spent waiting for a slot.

## Status rules (D-010)
- `ok`: an image was found in this attempt's own session folder and upscaled to 1440x2560.
- `refused`: ONLY if there is no image in its own session folder AND Codex's final message has refusal wording. Never retried. Codex echoes the prompt into the log, so the runner ignores the prompt text when matching (a prompt saying "no weapons" or "cannot" is not a refusal).
- `quota`: allowance/quota/usage-limit wording. No retry, exit 3, and the runner writes `work/codex-slots/QUOTA`, which makes every other caller exit 3 immediately. That file stays until the orchestrator removes it after the route is cleared (plan 7.8: the route pauses for all lanes).
- `failed`: anything else. Retried up to 3 times with 30 s, 60 s, 120 s waits (each retry is a new manifest row), then exit 1 and the plan 7.8 ladder takes over.

## Prompts and references (D-013)
- Start the prompt with: "Use your image generation tool to create ONE new vertical 9:16 image." Do not ask Codex to save the file; its sandbox is read-only.
- Always `-m gpt-6.1-sol` (default model is rejected). Never edit ~/.codex config.
- References on every call, up to 5: each character's sheet (or the pair sheet), the location plate, the sheet of every prop in shot, and the scene anchor. Over 5: drop the plate first when the anchor shows the same setting. Label them in the prompt by order: "Image 1 is the character reference sheet for <name>; Image 2 is the location plate for <place>".
- Every shot prompt carries the STATE block from the continuity file. Sides in picture terms ("frame left").

## Planning times (D-010, measured)
- Story frames: 76 s mean photoreal, 104 s mean flat 2D (90 s across both). References cost time: 1 ref 57-88 s, 3 refs 105-120 s, one 181 s.
- Sheets and plates: 55 s mean (35-95 s).
- Plan on 120 s per story frame (references on every call) and 55 s per sheet. The old 41 s figure was one sample and is superseded.

## Resume
- Skip any shot whose `<shot>.png` exists and is 1440x2560 unless told to regenerate. The runner itself always regenerates when called, so the skip is the caller's check.

## Failures (plan 7.8)
- Never change the prompt yourself. You make no creative decisions.
- `refused` (exit 4): report the row and the log excerpt in `error` so the storyboard artist restages.
- `quota` (exit 3): stop the whole batch and report immediately.
- `failed` after retries (exit 1): report; the debugger step diagnoses. No blind re-runs.
