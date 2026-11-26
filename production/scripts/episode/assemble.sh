#!/usr/bin/env bash
# Episode toolchain: build, render, master and verify one episode in both languages.
#
#   production/scripts/episode/assemble.sh <episode_dir>
#
# Steps, for hi then en:
#   build_timeline.py -> timeline.<lang>.json + dialogue-placement.<lang>.json
#   build_subs.py     -> subs.<lang>.json (fails the run if a subtitle check fails)
#   make_review.py    -> timeline.<lang>.review.json (subtitles burned in, review only)
# then production/scripts/render.sh (Remotion + master-audio.sh, -14 LUFS / -1 dBTP) for
#   render/<name>.<lang>.mp4 and render/<name>.<lang>.review.mp4
# and verify.py --remaster (frames, loudness +/-0.5 LU, true peak, md5s differ, subtitles,
# 150 s ceiling). <name> is edit.json render_name, else the folder name.
#
# Prints one JSON summary on stdout; step output goes to render/assemble.log.
# Env: LANGS="hi en"   NO_RENDER=1 (build and verify only; verify then reports missing files)
set -uo pipefail
if [[ $# -ne 1 ]]; then echo "usage: assemble.sh <episode_dir>" >&2; exit 2; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$(cd "$HERE/.." && pwd)"
DIR="$(cd "$1" && pwd)"
LANGS="${LANGS:-hi en}"
mkdir -p "$DIR/render"
LOG="$DIR/render/assemble.log"
: > "$LOG"
name="$(python3 -I -c 'import json,sys,pathlib; p=pathlib.Path(sys.argv[1])/"edit.json"; d=json.loads(p.read_text()) if p.exists() else {}; print(d.get("render_name") or pathlib.Path(sys.argv[1]).name)' "$DIR")"

failed=()
step() {  # step <label> <command...>
  local label="$1"; shift
  local t0=$SECONDS
  echo "== $label" >>"$LOG"
  if "$@" >>"$LOG" 2>&1; then
    echo "assemble: $label ok ($((SECONDS - t0)) s)" >&2
  else
    echo "assemble: $label FAILED ($((SECONDS - t0)) s), see $LOG" >&2
    failed+=("$label")
    return 1
  fi
}

for lang in $LANGS; do
  step "timeline $lang" python3 -I "$HERE/build_timeline.py" "$DIR" "$lang" || continue
  step "subs $lang" python3 -I "$HERE/build_subs.py" "$DIR" "$lang"
  step "review timeline $lang" python3 -I "$HERE/make_review.py" "$DIR" "$lang" || continue
  if [[ "${NO_RENDER:-0}" != "1" ]]; then
    step "render $lang" "$SCRIPTS/render.sh" "$DIR/timeline.$lang.json" "$DIR/render/$name.$lang.mp4"
    step "render $lang review" "$SCRIPTS/render.sh" "$DIR/timeline.$lang.review.json" "$DIR/render/$name.$lang.review.mp4"
  fi
done

echo "== verify" >>"$LOG"
summary="$(python3 -I "$HERE/verify.py" "$DIR" --remaster 2>>"$LOG")"
vrc=$?
python3 -I - "$summary" "$LOG" "${failed[@]+"${failed[@]}"}" <<'EOF'
import json, sys
s = json.loads(sys.argv[1]) if sys.argv[1].strip() else {"ok": False, "problems": ["verify.py printed nothing"]}
s["failed_steps"] = sys.argv[3:]
s["log"] = sys.argv[2]
s["ok"] = bool(s.get("ok")) and not s["failed_steps"]
print(json.dumps(s, ensure_ascii=False, indent=1))
EOF
[[ $vrc -eq 0 && ${#failed[@]} -eq 0 ]]
