#!/usr/bin/env bash
# codex-frame.sh - the one mechanical Codex frame runner (D-010, D-013, D-015).
#
#   codex-frame.sh <frames_dir> <shot_id> <prompt_file> [ref1.png ... ref5.png]
#
# What it does, per call:
#   - Takes a per-shot lock <frames_dir>/.lock.<shot_id> (mkdir). Held by a live
#     process -> exit 5. A lock left by a dead process is reclaimed.
#   - Waits for a slot in a shared counting semaphore so all callers together run at
#     most N codex calls at once. N = $UW_CODEX_SLOTS (default 2, capped at 3).
#     A timeout or rate-limit result drops one lane for 10 minutes (N-1, never < 1).
#   - Runs codex exec (prompt first, -i refs last, </dev/null) with a 10-minute ceiling,
#     logging to <shot>.a<attempt>.codex.log. attempt = rows for this shot in
#     manifest.jsonl + 1.
#   - Reads the session id from that log, copies the png only from
#     ~/.codex/generated_images/<that id>/ to <shot>.raw.png, upscales to <shot>.png
#     (scale=-2:2560:flags=lanczos,crop=1440:2560) and verifies 1440x2560 with sips.
#     An existing <shot>.png / <shot>.raw.png is kept as <shot>.prev<N>.png /
#     <shot>.prev<N>.raw.png first. Nothing is deleted.
#   - Appends one JSON row per attempt to <frames_dir>/manifest.jsonl.
#
# Status and exit codes:
#   ok       exit 0
#   failed   retried up to $UW_CODEX_RETRIES (default 3) times, waits 30/60/120 s;
#            exit 1 if every attempt failed
#   usage    exit 2 (bad arguments, missing files, more than 5 refs)
#   quota    exit 3, no retry; writes $SLOT_DIR/QUOTA, which makes every other caller
#            exit 3 at once until a person or the orchestrator removes it
#   refused  exit 4, never retried. Needs BOTH no image in this session's folder AND
#            refusal wording in Codex's final message.
#   locked   exit 5 (another runner holds this shot)
#
# The prompt text is echoed into the log by Codex, so refusal and quota wording is
# matched only outside the echoed prompt (and outside MCP transport noise).
set -uo pipefail

ROOT="<repo>"
SLOT_DIR="${UW_CODEX_SLOT_DIR:-$ROOT/work/codex-slots}"
TIMEOUT_S="${UW_CODEX_TIMEOUT:-600}"
RETRIES="${UW_CODEX_RETRIES:-3}"
MODEL="gpt-6.1-sol"
GEN_DIR="$HOME/.codex/generated_images"

die_usage() { echo "codex-frame.sh: $*" >&2; echo "usage: codex-frame.sh <frames_dir> <shot_id> <prompt_file> [ref1.png ... ref5.png]" >&2; exit 2; }

[[ $# -ge 3 ]] || die_usage "need at least 3 arguments"
FRAMES_DIR="$1"; SHOT="$2"; PROMPT_FILE="$3"; shift 3
[[ $# -le 5 ]] || die_usage "at most 5 reference images (got $#)"
[[ "$SHOT" =~ ^[A-Za-z0-9._-]+$ ]] || die_usage "bad shot_id: $SHOT"
mkdir -p "$FRAMES_DIR" || die_usage "cannot create $FRAMES_DIR"
FRAMES_DIR="$(cd "$FRAMES_DIR" && pwd)"
[[ -s "$PROMPT_FILE" ]] || die_usage "prompt file missing or empty: $PROMPT_FILE"
PROMPT_FILE="$(cd "$(dirname "$PROMPT_FILE")" && pwd)/$(basename "$PROMPT_FILE")"
REFS=()
for r in "$@"; do
  [[ -f "$r" ]] || die_usage "reference not found: $r"
  REFS+=("$(cd "$(dirname "$r")" && pwd)/$(basename "$r")")
done
for t in codex ffmpeg sips jq perl shasum; do
  command -v "$t" >/dev/null 2>&1 || die_usage "required tool not on PATH: $t"
done

SLOTS="${UW_CODEX_SLOTS:-2}"
[[ "$SLOTS" =~ ^[0-9]+$ ]] || SLOTS=2
(( SLOTS < 1 )) && SLOTS=1
(( SLOTS > 3 )) && SLOTS=3

MANIFEST="$FRAMES_DIR/manifest.jsonl"
PROMPT_SHA="$(shasum -a 256 "$PROMPT_FILE" | cut -c1-12)"
if [[ ${#REFS[@]} -gt 0 ]]; then
  REFS_JSON="$(printf '%s\n' "${REFS[@]}" | jq -R . | jq -sc .)"
else
  REFS_JSON="[]"
fi

now_epoch() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }
iso_of() { perl -MPOSIX=strftime -e '$t=shift; printf "%s.%03dZ", strftime("%Y-%m-%dT%H:%M:%S", gmtime(int $t)), int(($t-int $t)*1000+0.5)%1000' "$1"; }
pid_alive() { [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null; }

# ---------- per-shot lock ----------
LOCK="$FRAMES_DIR/.lock.$SHOT"
SLOT_HELD=""
cleanup() {
  [[ -n "$SLOT_HELD" ]] && rm -rf "$SLOT_HELD"
  [[ -d "$LOCK" && "$(cat "$LOCK/pid" 2>/dev/null)" == "$$" ]] && rm -rf "$LOCK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if ! mkdir "$LOCK" 2>/dev/null; then
  holder="$(cat "$LOCK/pid" 2>/dev/null)"
  if pid_alive "$holder"; then
    echo "codex-frame.sh: $SHOT is locked by pid $holder ($LOCK)" >&2; exit 5
  fi
  echo "codex-frame.sh: reclaiming stale lock for $SHOT (pid ${holder:-none} not running)" >&2
  rm -rf "$LOCK"
  mkdir "$LOCK" 2>/dev/null || { echo "codex-frame.sh: lost the race for $LOCK" >&2; exit 5; }
fi
echo "$$" > "$LOCK/pid"

# ---------- shared slot semaphore ----------
mkdir -p "$SLOT_DIR"
effective_slots() {
  local now drops=0 f exp
  now=$(date +%s)
  for f in "$SLOT_DIR"/drop.*; do
    [[ -e "$f" ]] || continue
    exp="${f##*/drop.}"; exp="${exp%%.*}"
    if [[ "$exp" =~ ^[0-9]+$ ]] && (( exp > now )); then drops=$((drops+1)); else rm -f "$f"; fi
  done
  local n=$((SLOTS - drops)); (( n < 1 )) && n=1
  echo "$n"
}
acquire_slot() {
  local waited=0 n i d holder
  while :; do
    [[ -e "$SLOT_DIR/QUOTA" ]] && return 3
    n=$(effective_slots)
    # count live holders; clear dead ones
    for d in "$SLOT_DIR"/slot.*; do
      [[ -d "$d" ]] || continue
      holder="$(cat "$d/pid" 2>/dev/null)"
      pid_alive "$holder" || rm -rf "$d"
    done
    for ((i=1; i<=n; i++)); do
      if mkdir "$SLOT_DIR/slot.$i" 2>/dev/null; then
        echo "$$" > "$SLOT_DIR/slot.$i/pid"
        echo "$FRAMES_DIR/$SHOT" > "$SLOT_DIR/slot.$i/who"
        SLOT_HELD="$SLOT_DIR/slot.$i"
        (( waited > 0 )) && echo "codex-frame.sh: $SHOT got slot $i after ${waited}s" >&2
        return 0
      fi
    done
    (( waited % 60 == 0 )) && echo "codex-frame.sh: $SHOT waiting for a codex slot ($n in use)" >&2
    sleep 5; waited=$((waited+5))
  done
}
release_slot() { [[ -n "$SLOT_HELD" ]] && rm -rf "$SLOT_HELD"; SLOT_HELD=""; }
drop_lane() { touch "$SLOT_DIR/drop.$(( $(date +%s) + 600 )).$$"; }

# ---------- helpers ----------
next_attempt() {
  local n=0
  [[ -f "$MANIFEST" ]] && n=$(jq -r --arg s "$SHOT" 'select(.shot_id==$s) | 1' "$MANIFEST" 2>/dev/null | wc -l | tr -d ' ')
  echo $((n + 1))
}

# Log text with the echoed prompt and MCP transport noise removed.
log_without_prompt() {
  perl -e '
    local $/; open my $L, "<", $ARGV[0] or exit; my $log = <$L>;
    open my $P, "<", $ARGV[1] or exit; my $p = <$P>; $p =~ s/\s+\z//;
    my $i = index($log, $p); substr($log, $i, length $p) = "" if $i >= 0 && length $p;
    print join("", grep { !/rmcp::|mcp_client|worker quit/ } split /^/m, $log);
  ' "$1" "$PROMPT_FILE"
}
# Codex final message: everything after the token count line, else the last "codex" block.
final_message() {
  perl -e '
    local $/; open my $L, "<", $ARGV[0] or exit; my $log = <$L>;
    if ($log =~ /\ntokens used\n[\d,]+\n?(.*)\z/s) { print $1; exit }
    my @b = split /\ncodex\n/, $log; print $b[-1] if @b > 1;
  ' "$1"
}

prev_index() {
  local n=1
  while [[ -e "$FRAMES_DIR/$SHOT.prev$n.png" || -e "$FRAMES_DIR/$SHOT.prev$n.raw.png" ]]; do n=$((n+1)); done
  echo "$n"
}

write_row() { # attempt session started_epoch ended_epoch status file error
  local secs
  secs=$(perl -e 'printf "%.1f", $ARGV[1]-$ARGV[0]' "$3" "$4")
  jq -nc --arg shot "$SHOT" --argjson attempt "$1" --arg sha "$PROMPT_SHA" --argjson refs "$REFS_JSON" \
    --arg sid "$2" --arg st "$(iso_of "$3")" --arg en "$(iso_of "$4")" --argjson secs "$secs" \
    --arg status "$5" --arg file "$6" --arg err "$7" \
    '{shot_id:$shot, attempt:$attempt, prompt_sha:$sha, refs:$refs,
      session_id:(if $sid=="" then null else $sid end), started:$st, ended:$en, seconds:$secs,
      status:$status, file:(if $file=="" then null else $file end),
      error:(if $err=="" then null else $err end)}' >> "$MANIFEST"
}

# One attempt. Sets STATUS, ERR, SID, OUTFILE, TRANSIENT_LANE.
run_attempt() {
  local attempt="$1" log rc img tmp w h n
  STATUS=failed; ERR=""; SID=""; OUTFILE=""; TRANSIENT_LANE=0
  log="$FRAMES_DIR/$SHOT.a$attempt.codex.log"
  [[ -e "$log" ]] && mv "$log" "$log.orphan.$(date +%s)"

  ( cd "$FRAMES_DIR" && perl -e '
      my $t = shift; my $pid = fork; die "fork: $!" unless defined $pid;
      if ($pid == 0) { setpgrp(0,0); exec @ARGV or exit 127 }
      local $SIG{ALRM} = sub { kill "TERM", -$pid; sleep 5; kill "KILL", -$pid; waitpid $pid, 0; exit 124 };
      alarm $t; waitpid $pid, 0; alarm 0; exit($? & 127 ? 128 + ($? & 127) : $? >> 8);
    ' "$TIMEOUT_S" codex exec --skip-git-repo-check -m "$MODEL" -c model_reasoning_effort=low \
        -C "$FRAMES_DIR" "$(cat "$PROMPT_FILE")" ${REFS[@]+-i "${REFS[@]}"} < /dev/null > "$log" 2>&1 )
  rc=$?

  SID="$(grep -m1 -E '^session id: ' "$log" 2>/dev/null | sed -E 's/^session id: *//; s/[[:space:]]+$//')"
  img=""
  if [[ -n "$SID" && -d "$GEN_DIR/$SID" ]]; then
    img="$(ls -t "$GEN_DIR/$SID"/*.png 2>/dev/null | head -1)"
  fi

  local body final
  body="$(log_without_prompt "$log")"
  final="$(final_message "$log")"

  if [[ -n "$img" ]]; then
    n=""
    if [[ -e "$FRAMES_DIR/$SHOT.png" || -e "$FRAMES_DIR/$SHOT.raw.png" ]]; then n=$(prev_index); fi
    tmp="$FRAMES_DIR/.$SHOT.tmp.$$.png"
    if ffmpeg -y -loglevel error -i "$img" -vf "scale=-2:2560:flags=lanczos,crop=1440:2560" "$tmp" 2>>"$log"; then
      w=$(sips -g pixelWidth "$tmp" 2>/dev/null | awk '/pixelWidth/{print $2}')
      h=$(sips -g pixelHeight "$tmp" 2>/dev/null | awk '/pixelHeight/{print $2}')
      if [[ "$w" == 1440 && "$h" == 2560 ]]; then
        if [[ -n "$n" ]]; then
          [[ -e "$FRAMES_DIR/$SHOT.png" ]] && mv "$FRAMES_DIR/$SHOT.png" "$FRAMES_DIR/$SHOT.prev$n.png"
          [[ -e "$FRAMES_DIR/$SHOT.raw.png" ]] && mv "$FRAMES_DIR/$SHOT.raw.png" "$FRAMES_DIR/$SHOT.prev$n.raw.png"
        fi
        cp "$img" "$FRAMES_DIR/$SHOT.raw.png"
        mv "$tmp" "$FRAMES_DIR/$SHOT.png"
        STATUS=ok; OUTFILE="$FRAMES_DIR/$SHOT.png"; return
      fi
      ERR="upscale produced ${w}x${h}, not 1440x2560 (source $img)"
    else
      ERR="ffmpeg upscale failed on $img"
    fi
    rm -f "$tmp"; STATUS=failed; return
  fi

  # No image in this session's folder.
  if grep -qiE "usage limit|quota|allowance|insufficient_quota|exceeded your (current|monthly)|out of credits|upgrade to (plus|pro)" <<<"$body"; then
    STATUS=quota
    ERR="$(grep -iE -m1 "usage limit|quota|allowance|insufficient_quota|exceeded your|out of credits|upgrade to" <<<"$body" | cut -c1-400)"
    return
  fi
  if [[ -n "$final" ]] && grep -qiE "can.?t (help|create|generate|make|produce|assist)|cannot (help|create|generate|make|produce|assist)|unable to (help|create|generate|make|produce)|not able to (create|generate|make|produce)|won.?t be able|content polic|safety (polic|system|guideline)|against (the |our )?polic|violat|refus|not allowed|declin" <<<"$final"; then
    STATUS=refused; ERR="$(tr '\n' ' ' <<<"$final" | cut -c1-400)"; return
  fi
  STATUS=failed
  if (( rc == 124 )); then
    ERR="timeout after ${TIMEOUT_S}s"; TRANSIENT_LANE=1
  elif grep -qiE "rate.?limit|too many requests|http 429|status 429|error 429" <<<"$body"; then
    ERR="rate limit: $(grep -iE -m1 "rate.?limit|too many requests|http 429|status 429|error 429" <<<"$body" | cut -c1-300)"; TRANSIENT_LANE=1
  elif [[ -z "$SID" ]]; then
    ERR="no session id in log (exit $rc): $(tail -3 "$log" | tr '\n' ' ' | cut -c1-300)"
  elif [[ -n "$final" ]]; then
    ERR="no image in $GEN_DIR/$SID (exit $rc); final message: $(tr '\n' ' ' <<<"$final" | cut -c1-300)"
  else
    ERR="no image in $GEN_DIR/$SID (exit $rc): $(tail -3 "$log" | tr '\n' ' ' | cut -c1-300)"
  fi
}

# ---------- main loop ----------
WAITS=(${UW_CODEX_WAITS:-30 60 120})   # override only for tests
try=0
while :; do
  acquire_slot; arc=$?
  if (( arc == 3 )); then
    echo "codex-frame.sh: $SHOT not run, quota stop file present ($SLOT_DIR/QUOTA)" >&2; exit 3
  fi
  attempt=$(next_attempt)
  t0=$(now_epoch)
  run_attempt "$attempt"
  t1=$(now_epoch)
  release_slot
  write_row "$attempt" "$SID" "$t0" "$t1" "$STATUS" "$OUTFILE" "$ERR"
  echo "codex-frame.sh: $SHOT attempt $attempt $STATUS $(perl -e 'printf "%.1f", $ARGV[1]-$ARGV[0]' "$t0" "$t1")s${ERR:+ - $ERR}" >&2
  case "$STATUS" in
    ok)      echo "$OUTFILE"; exit 0 ;;
    refused) exit 4 ;;
    quota)   { date -u +%Y-%m-%dT%H:%M:%SZ; echo "$FRAMES_DIR/$SHOT attempt $attempt"; echo "$ERR"; } > "$SLOT_DIR/QUOTA"; exit 3 ;;
  esac
  (( TRANSIENT_LANE )) && drop_lane
  if (( try >= RETRIES )); then exit 1; fi
  w=${WAITS[$try]:-120}; try=$((try+1))
  echo "codex-frame.sh: $SHOT retry $try of $RETRIES in ${w}s" >&2
  sleep "$w"
done
