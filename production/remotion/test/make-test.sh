#!/usr/bin/env bash
# Regenerate the synthetic test assets (images via ffmpeg, upscaled; tones as audio).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
S=../../scripts
mkdir -p src assets
q=(-hide_banner -loglevel error -y)
# Under-size sources on purpose so upscale.sh is exercised.
ffmpeg "${q[@]}" -f lavfi -i "testsrc2=size=1080x1920:rate=1" -frames:v 1 -update 1 src/a.png
ffmpeg "${q[@]}" -f lavfi -i "gradients=s=900x1600:c0=0x1d3557:c1=0xe63946:x0=0:y0=0:x1=900:y1=1600:nb_colors=2,drawgrid=width=90:height=90:thickness=3:color=white@0.7" -frames:v 1 -update 1 src/b.png
ffmpeg "${q[@]}" -f lavfi -i "color=c=black:s=1080x1920,format=rgba,geq=r='255':g='190':b='20':a='if(lt(hypot(X-540,Y-1250),230),255,if(between(X,120,260)*between(Y,700,1900),255,0))'" -frames:v 1 -update 1 src/fg.png
"$S/upscale.sh" src/a.png assets/a.png
"$S/upscale.sh" src/b.png assets/b.png
"$S/upscale.sh" src/fg.png assets/fg.png
# Audio: sine tones at -18 dBFS peak (ffmpeg's default sine amplitude is 1/8).
ffmpeg "${q[@]}" -f lavfi -i "sine=frequency=880:duration=1.5:sample_rate=48000" -af "afade=t=in:d=0.02,afade=t=out:st=1.48:d=0.02" -ac 1 assets/dialogue1.wav
ffmpeg "${q[@]}" -f lavfi -i "sine=frequency=660:duration=1.0:sample_rate=48000" -af "afade=t=in:d=0.02,afade=t=out:st=0.98:d=0.02" -ac 1 assets/dialogue2.wav
ffmpeg "${q[@]}" -f lavfi -i "sine=frequency=220:duration=3:sample_rate=48000" -ac 2 assets/music.wav
ffmpeg "${q[@]}" -f lavfi -i "anoisesrc=d=0.3:c=pink:a=0.3:r=48000" -af "afade=t=out:st=0.1:d=0.2" -ac 2 assets/sfx.wav
echo "test assets ready in $(pwd)/assets"
