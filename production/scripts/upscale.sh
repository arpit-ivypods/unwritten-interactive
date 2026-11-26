#!/usr/bin/env bash
# Scale any frame to cover 1440x2560 (lanczos) and centre-crop to exactly 1440x2560.
#   upscale.sh <in> <out> [WIDTHxHEIGHT]
# Alpha is kept when the input has it and the output is .png/.webp.
set -euo pipefail
if [[ $# -lt 2 ]]; then echo "usage: upscale.sh <in> <out> [1440x2560]" >&2; exit 2; fi
in="$1"; out="$2"; size="${3:-1440x2560}"
W="${size%x*}"; H="${size#*x}"
[[ -f "$in" ]] || { echo "upscale.sh: no such file: $in" >&2; exit 1; }
mkdir -p "$(dirname "$out")"

pix=$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of csv=p=0 "$in")
ext="${out##*.}"; ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
fmt=()
case "$ext" in
  png|webp)
    case "$pix" in
      rgba*|bgra*|argb|abgr|ya*|yuva*|gbrap*|pal8) fmt=(-pix_fmt rgba) ;;
      *) fmt=(-pix_fmt rgb24) ;;
    esac ;;
  jpg|jpeg) fmt=(-q:v 2 -pix_fmt yuvj444p) ;;
esac

ffmpeg -hide_banner -loglevel error -y -i "$in" \
  -vf "scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos+accurate_rnd+full_chroma_int,crop=${W}:${H}" \
  -frames:v 1 -update 1 "${fmt[@]}" "$out"

got=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$out")
echo "upscale: $in -> $out ($got)"
[[ "$got" == "${W}x${H}" ]] || { echo "upscale.sh: wrong output size $got" >&2; exit 1; }
