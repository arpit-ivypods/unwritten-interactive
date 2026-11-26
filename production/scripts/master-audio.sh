#!/usr/bin/env bash
# Two-pass EBU R128 loudnorm of an MP4's audio to -14 LUFS integrated, -1 dBTP,
# remuxing the video stream untouched (-c:v copy).
#   master-audio.sh <in.mp4> <out.mp4> [I=-14] [TP=-1] [LRA=11]
set -euo pipefail
if [[ $# -lt 2 ]]; then echo "usage: master-audio.sh <in.mp4> <out.mp4> [I] [TP] [LRA]" >&2; exit 2; fi
in="$1"; out="$2"; I="${3:--14}"; TP="${4:--1}"; LRA="${5:-11}"
[[ "$in" != "$out" ]] || { echo "master-audio.sh: in and out must differ" >&2; exit 2; }
mkdir -p "$(dirname "$out")"

if [[ -z "$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$in")" ]]; then
  echo "master-audio: WARN no audio stream in $in, copying as is" >&2
  ffmpeg -hide_banner -loglevel error -y -i "$in" -c copy -movflags +faststart "$out"
  exit 0
fi

# Pass 1: measure.
json=$(ffmpeg -hide_banner -nostats -i "$in" -map 0:a:0 \
  -af "loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json" -f null - 2>&1 \
  | awk '/^\{/{f=1} f{print} /^\}/{f=0}')
get() { echo "$json" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
mI=$(get input_i); mTP=$(get input_tp); mLRA=$(get input_lra); mT=$(get input_thresh); off=$(get target_offset)
if [[ -z "$mI" || "$mI" == "-inf" ]]; then
  echo "master-audio: WARN audio is silent (input_i=$mI); copying without normalisation" >&2
  ffmpeg -hide_banner -loglevel error -y -i "$in" -c copy -movflags +faststart "$out"
  exit 0
fi
echo "master-audio: measured I=${mI} LUFS TP=${mTP} dBTP LRA=${mLRA} LU"

# Pass 2: apply (linear when possible), resample back to 48 kHz, copy video.
# The AAC encode after loudnorm can overshoot the true-peak target by a few
# tenths of a dB, so the encoded file is measured and, if it is over TP, pass 2
# is redone with the limiter target lowered by the overshoot (+0.1 dB), up to
# two more times. A file already within TP is written once, as before.
tp_target="$TP"
for attempt in 1 2 3; do
  ffmpeg -hide_banner -loglevel error -y -i "$in" -map 0:v:0 -map 0:a:0 -c:v copy \
    -af "loudnorm=I=${I}:TP=${tp_target}:LRA=${LRA}:measured_I=${mI}:measured_TP=${mTP}:measured_LRA=${mLRA}:measured_thresh=${mT}:offset=${off}:linear=true:print_format=none" \
    -ar 48000 -c:a aac -b:a 256k -movflags +faststart "$out"
  oTP=$(ffmpeg -hide_banner -nostats -i "$out" -map 0:a:0 -af "loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json" -f null - 2>&1 \
    | sed -n 's/.*"input_tp" : "\([^"]*\)".*/\1/p')
  over=$(awk -v o="$oTP" -v t="$TP" 'BEGIN{d=o-t; print (d>0)?d:0}')
  if [[ "$over" == "0" ]]; then break; fi
  echo "master-audio: encoded true peak ${oTP} dBTP is over ${TP}; redoing pass 2 (attempt $((attempt + 1)))" >&2
  tp_target=$(awk -v a="$tp_target" -v d="$over" 'BEGIN{printf "%.2f", a-d-0.1}')
done
echo "master-audio: encoded true peak ${oTP} dBTP (limiter target ${tp_target})"

# Report the result.
ffmpeg -hide_banner -nostats -i "$out" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 \
  | awk '/Summary:/{f=1} f && /I:|Peak:|LRA:/{gsub(/^ +/,""); printf "master-audio: output %s\n", $0}'
