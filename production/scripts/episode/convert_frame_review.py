#!/usr/bin/env python3
"""Episode toolchain: rewrite an episode's frames/review.json in the one format for both series (D-023 rule 4.9).

    python3 -I production/scripts/episode/convert_frame_review.py <episode_dir> [--check]

The format is the series1 shape:
    {"schema": "frames-review/1", "episode": ..., "by": ..., "frames": [{"shot": "s01", "verdict": ..., "attempt": 1, ...}]}
Verdicts are "approved", "approved with logged drift" or "rejected". Rows keep every other field
(checks, why_rejected, fix, file_md5, source, stage). The older series2 file (a bare list, rows keyed
shot_id, verdicts "pass"/"reject", a free-text note row) is converted like this:
    shot_id -> shot; "pass" -> "approved"; "reject" -> "rejected"; a non-empty "reason" on a reject -> "why_rejected";
    rows without a shot id -> top-level "notes".
No verdict is changed. The original file is kept as frames/review.prev.json (never overwritten with
different content). --check only reports what would change.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import FRAME_REVIEW_SCHEMA, dump, frame_verdict  # noqa: E402

WORDS = {"pass": "approved", "reject": "rejected"}


def convert(doc, episode):
    changes = []
    if isinstance(doc, dict):
        out = {k: v for k, v in doc.items() if k != "frames"}
        rows = doc.get("frames") or []
    else:
        out = {"episode": episode,
               "by": "verdicts as written in the list-format file (see 'notes' and each row's 'source')"}
        rows = doc
        changes.append("bare list -> dict with a 'frames' list")
    if out.get("schema") != FRAME_REVIEW_SCHEMA:
        changes.append(f"schema tag {FRAME_REVIEW_SCHEMA!r} added")
    out = {"schema": FRAME_REVIEW_SCHEMA, **{k: v for k, v in out.items() if k != "schema"}}
    frames, notes = [], list(out.get("notes") or [])
    for r in rows:
        if not isinstance(r, dict):
            continue
        sid = r.get("shot") or r.get("shot_id")
        if not sid:
            notes.append(r.get("note") or r)
            changes.append("a row with no shot id moved to 'notes'")
            continue
        n = {"shot": sid, **{k: v for k, v in r.items() if k not in ("shot", "shot_id")}}
        if "shot_id" in r:
            changes.append(f"{sid}: shot_id -> shot")
        v = str(r.get("verdict", ""))
        if v.lower() in WORDS:
            n["verdict"] = WORDS[v.lower()]
            changes.append(f"{sid}: verdict {v!r} -> {n['verdict']!r}")
        if frame_verdict(n.get("verdict")) is None:
            changes.append(f"{sid}: verdict {n.get('verdict')!r} is not one the build knows (it will slate the shot)")
        if frame_verdict(n.get("verdict")) == "fail" and n.get("reason") and not n.get("why_rejected"):
            n["why_rejected"] = n.pop("reason")
        elif "reason" in n and not n["reason"]:
            n.pop("reason")
        frames.append(n)
    if notes:
        out["notes"] = notes
    out["frames"] = frames
    return out, changes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        raise SystemExit("usage: convert_frame_review.py <episode_dir> [--check]")
    ed = Path(args[0]).resolve()
    src = ed / "frames" / "review.json"
    if not src.exists():
        raise SystemExit(f"{src} does not exist")
    raw = src.read_text()
    doc = json.loads(raw)
    out, changes = convert(doc, ed.name)
    if not changes:
        print(f"{src}: already in the {FRAME_REVIEW_SCHEMA} format; nothing to do")
        return
    for c in changes:
        print("change:", c)
    if "--check" in sys.argv:
        return
    prev = ed / "frames" / "review.prev.json"
    if prev.exists() and prev.read_text() != raw:
        raise SystemExit(f"{prev} exists with different content; move it aside first")
    prev.write_text(raw)
    dump(src, out)
    print(f"wrote {src} ({len(out['frames'])} rows); the original is {prev}")


if __name__ == "__main__":
    main()
