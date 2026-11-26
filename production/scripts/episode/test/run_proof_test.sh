#!/usr/bin/env bash
# Regression test: rebuild both proof scenes with the episode toolchain in a scratch
# copy and compare with the checked-in proof cuts (never writes into content/proof).
#
#   production/scripts/episode/test/run_proof_test.sh <scratch_dir> [--render]
#
# 1. copies content/proof/{photoreal,flat2d} to <scratch_dir>/content/proof/ without
#    their render/, timelines, subs, placements or scene scripts, and drops in
#    test/proof-<scene>.edit.json as edit.json;
# 2. runs build_timeline.py, build_subs.py and make_review.py for hi and en
#    (with --render: assemble.sh, which also renders, masters and verifies);
# 3. compare.py: shots, dialogue, music, sfx, ducking and subtitle cues within 1 frame;
# 4. with --render: the clean renders must be byte-identical to the proof renders.
set -uo pipefail
if [[ $# -lt 1 ]]; then echo "usage: run_proof_test.sh <scratch_dir> [--render]" >&2; exit 2; fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS="$(cd "$HERE/.." && pwd)"
REPO="$(cd "$TOOLS/../../.." && pwd)"
mkdir -p "$1"
OUT="$(cd "$1" && pwd)/content/proof"
render=0; [[ "${2:-}" == "--render" ]] && render=1
rc=0
for s in photoreal flat2d; do
  rm -rf "${OUT:?}/$s"; mkdir -p "$OUT"
  cp -Rp "$REPO/content/proof/$s" "$OUT/$s"
  (cd "$OUT/$s" && rm -rf render __pycache__ timeline.*.json subs.*.json dialogue-placement.*.json build_*.py make_review.py wordtime.py)
  cp "$HERE/proof-$s.edit.json" "$OUT/$s/edit.json"
  if [[ $render == 1 ]]; then
    "$TOOLS/assemble.sh" "$OUT/$s" > "$OUT/$s.assemble.json" || rc=1
  else
    for lang in hi en; do
      python3 -I "$TOOLS/build_timeline.py" "$OUT/$s" "$lang" > /dev/null || rc=1
      python3 -I "$TOOLS/build_subs.py" "$OUT/$s" "$lang" > /dev/null || rc=1
      python3 -I "$TOOLS/make_review.py" "$OUT/$s" "$lang" > /dev/null || rc=1
    done
  fi
  python3 -I "$HERE/compare.py" "$REPO/content/proof/$s" "$OUT/$s" > "$OUT/$s.compare.json" || rc=1
  python3 -I -c 'import json,sys; r=json.load(open(sys.argv[1])); print(sys.argv[2], "compare ok" if r["ok"] else "compare FAILED", {l: {"max_frame_diff": v["max_frame_diff"], "word_ms": v["subs_max_word_ms_diff"], "problems": len(v["problems"]), "intended_deviations": len(v["intended_deviations"])} for l, v in r["langs"].items()})' "$OUT/$s.compare.json" "$s"
  if [[ $render == 1 ]]; then
    for f in proof.hi proof.en; do
      if cmp -s "$REPO/content/proof/$s/render/$f.mp4" "$OUT/$s/render/$f.mp4"; then echo "$s $f.mp4 byte-identical to the proof render"
      else echo "$s $f.mp4 DIFFERS from the proof render"; rc=1; fi
    done
  fi
done
exit $rc
