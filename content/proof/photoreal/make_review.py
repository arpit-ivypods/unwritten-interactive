#!/usr/bin/env python3
"""S13 Editor: write timeline.<lang>.review.json = timeline.<lang>.json with the
subs.<lang>.json cues burned in (debug.burnSubtitles). REVIEW ONLY, never a
deliverable: the app draws subtitles itself.

    python3 -I content/proof/photoreal/make_review.py [hi] [en]

Line breaks: the burn-in component (production/remotion/src/Episode.tsx,
Subtitles) sets whiteSpace 'pre-line' (D-012), so a cue's authored "\n" is
kept as written. The earlier no-break-space workaround is removed: cue text
goes into the review timeline unchanged.
"""
import json
import sys
from pathlib import Path

SCENE = Path(__file__).resolve().parent

for lang in sys.argv[1:] or ["hi", "en"]:
    tl = json.loads((SCENE / f"timeline.{lang}.json").read_text())
    subs = json.loads((SCENE / f"subs.{lang}.json").read_text())
    tl["id"] = f"{tl['id']}-review"
    tl["debug"] = dict(tl.get("debug", {}), burnSubtitles=True)
    tl["subtitles"] = [{"startMs": c["startMs"], "endMs": c["endMs"], "text": c["text"]} for c in subs["cues"]]
    tl.setdefault("meta", {})["review"] = (f"REVIEW ONLY: timeline.{lang}.json + subs.{lang}.json cues burned in "
                                           "(debug.burnSubtitles). Cue text unchanged; Episode.tsx keeps its line "
                                           "breaks with whiteSpace pre-line. Not a deliverable.")
    out = SCENE / f"timeline.{lang}.review.json"
    out.write_text(json.dumps(tl, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {out.name}: {len(tl['subtitles'])} cues")
