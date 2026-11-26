#!/usr/bin/env python3
"""Episode toolchain: timeline.<lang>.review.json = timeline.<lang>.json with the
subs.<lang>.json cues burned in (debug.burnSubtitles). REVIEW ONLY, never a
deliverable: the app draws subtitles itself (plan 7.3).

    python3 -I production/scripts/episode/make_review.py <episode_dir> [hi] [en]

Line breaks: production/remotion/src/Episode.tsx draws subtitles with
whiteSpace 'pre-line' (D-012), so a cue's "\\n" is kept as written.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import dump, load  # noqa: E402


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: make_review.py <episode_dir> [hi] [en]")
    ED = Path(sys.argv[1]).resolve()
    for lang in sys.argv[2:] or ["hi", "en"]:
        tl = load(ED / f"timeline.{lang}.json")
        subs = load(ED / f"subs.{lang}.json")
        if tl is None or subs is None:
            raise SystemExit(f"{lang}: run build_timeline.py and build_subs.py first")
        tl["id"] = f"{tl['id']}-review"
        tl["debug"] = dict(tl.get("debug", {}), burnSubtitles=True)
        tl["subtitles"] = [{"startMs": c["startMs"], "endMs": c["endMs"], "text": c["text"]} for c in subs["cues"]]
        tl.setdefault("meta", {})["review"] = (f"REVIEW ONLY: timeline.{lang}.json + subs.{lang}.json cues burned in "
                                               "(debug.burnSubtitles). Not a deliverable.")
        out = ED / f"timeline.{lang}.review.json"
        dump(out, tl)
        print(f"wrote {out.name}: {len(tl['subtitles'])} cues")


if __name__ == "__main__":
    main()
