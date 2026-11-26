#!/usr/bin/env bash
# Verify a rendered test clip: stream format, loudness, music ducking (220 Hz
# band) and camera smoothness (mean abs difference between consecutive frames).
#   verify.sh <clip.mp4>
set -euo pipefail
f="${1:-$(dirname "$0")/out/test.mp4}"
echo "== streams"
ffprobe -v error -show_entries stream=codec_type,codec_name,profile,width,height,r_frame_rate,nb_frames,pix_fmt,sample_rate,channels -of compact=p=0 "$f"
echo "== loudness (EBU R128)"
ffmpeg -hide_banner -nostats -i "$f" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | awk '/Summary:/{s=1} s && /I:|LRA:|Peak:/{gsub(/^ +/,""); print "  " $0}'
band() { ffmpeg -hide_banner -nostats -ss "$2" -t "$3" -i "$f" -vn -af "bandpass=f=$1:width_type=q:w=6,bandpass=f=$1:width_type=q:w=6,volumedetect" -f null - 2>&1 | sed -n 's/.*mean_volume: //p'; }
echo "== music band (220 Hz) per 0.1 s; dialogue L1 1.5-3.0 s, L2 4.0-5.0 s"
line=""
for t in $(seq 0 0.1 5.9); do line+=$(printf "%s:%s " "$t" "$(band 220 "$t" 0.1 | sed 's/ dB//')"); done
echo "$line" | tr ' ' '\n' | paste - - - - - - | sed 's/^/  /'
echo "== camera smoothness: mean |frame[n]-frame[n-1]| (luma), frames 10-70 (push-in) and 90-140 (pan)"
ffmpeg -hide_banner -nostats -i "$f" -vf "tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -an -f null - 2>/dev/null \
  | awk '/^frame:/{n=substr($1,7)+1} /YAVG/{split($0,b,"="); printf "%d %.3f\n", n, b[2]}' > "${TMPDIR:-/tmp}/verify_diff.$$" || true
awk '($1>=10 && $1<=70) || ($1>=90 && $1<=140){printf "%s:%s ", $1, $2} END{print ""}' "${TMPDIR:-/tmp}/verify_diff.$$" | tr ' ' '\n' | paste - - - - - - - - | sed 's/^/  /'
rm -f "${TMPDIR:-/tmp}/verify_diff.$$"
