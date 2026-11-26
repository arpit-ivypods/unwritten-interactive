#!/usr/bin/env bash
# Render an Unwritten timeline to a mastered MP4 (H.264, 1080x1920, 30 fps,
# AAC 48 kHz, -14 LUFS / -1 dBTP).
#   render.sh <timeline.json> <out.mp4> [extra `remotion render` flags]
# Env: STRICT=1      fail on missing assets instead of slating/dropping them
#      KEEP_STAGE=1  keep production/remotion/.render/<job> (props + raw render)
set -euo pipefail
if [[ $# -lt 2 ]]; then echo "usage: render.sh <timeline.json> <out.mp4> [remotion flags]" >&2; exit 2; fi
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RDIR="$(cd "$SCRIPTS/../remotion" && pwd)"
timeline="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
mkdir -p "$(dirname "$2")"
out="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
shift 2

now() { node -e 'process.stdout.write(String(Date.now()))'; }
secs() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", (b-a)/1000}'; }

job="$(basename "$timeline" .json)-$(date +%Y%m%d-%H%M%S)-$$"
stage="$RDIR/.render/$job"
mkdir -p "$stage"
cleanup() { [[ "${KEEP_STAGE:-0}" == "1" ]] || rm -rf "$stage"; }
trap cleanup EXIT

t0=$(now)
node "$SCRIPTS/prepare-timeline.mjs" "$timeline" "$stage" ${STRICT:+--strict}

t1=$(now)
cd "$RDIR"
pnpm exec remotion render src/index.ts Episode "$stage/raw.mp4" \
  --props="$stage/props.json" \
  --public-dir="$stage/public" \
  --codec=h264 --crf=18 --pixel-format=yuv420p \
  --image-format=jpeg --jpeg-quality=95 \
  --audio-codec=aac --audio-bitrate=320k --enforce-audio-track \
  --license-key=free-license \
  --overwrite "$@" 2>&1 \
  | awk '/^(Rendered|Encoded) [0-9]+\/[0-9]+/ { split($2, p, "/"); if (p[1] % 300 && p[1] != p[2]) next } { print; fflush() }'

t2=$(now)
"$SCRIPTS/master-audio.sh" "$stage/raw.mp4" "$out"
t3=$(now)

v=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of csv=p=0 "$out")
a=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$out")
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")
echo "render: wrote $out"
echo "render: video $v | audio $a | ${d}s"
echo "render: time prepare $(secs "$t0" "$t1")s, remotion $(secs "$t1" "$t2")s, master $(secs "$t2" "$t3")s, total $(secs "$t0" "$t3")s"
