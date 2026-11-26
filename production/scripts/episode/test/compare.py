#!/usr/bin/env python3
"""Compare a toolchain build (scratch copy) with a proof scene's checked-in cut.

    python3 -I compare.py <proof_dir> <test_dir> [tol_frames=1]

Per language: total length, every shot (start, duration, picture, move), every
dialogue clip (start, duration, trim, gain, file md5), every music and sfx clip
(start, duration, trim, gain, fades), ducking, and every subtitle cue (frames,
text, word times). Prints JSON; exits 1 if anything is off by more than tol.
"""
import hashlib
import json
import sys
from pathlib import Path

proof, test = Path(sys.argv[1]), Path(sys.argv[2])
TOL = int(sys.argv[3]) if len(sys.argv) > 3 else 1


def md5(p):
    return hashlib.md5(Path(p).read_bytes()).hexdigest()


def j(p):
    return json.loads(Path(p).read_text())


def num_diff(a, b, keys, where, out, tol=TOL):
    for k in keys:
        x, y = a.get(k, 0), b.get(k, 0)
        if isinstance(x, (int, float)) and isinstance(y, (int, float)):
            d = abs(x - y)
            out["max_frame_diff"] = max(out["max_frame_diff"], d) if k != "volume" else out["max_frame_diff"]
            if (k == "volume" and d > 1e-4) or (k != "volume" and d > tol):
                out["problems"].append(f"{where}.{k}: proof {x} vs toolchain {y}")
        elif x != y:
            out["problems"].append(f"{where}.{k}: proof {x!r} vs toolchain {y!r}")


report = {"proof": str(proof), "test": str(test), "tolerance_frames": TOL, "langs": {}}
bad = False
for lang in ("hi", "en"):
    out = {"problems": [], "max_frame_diff": 0, "notes": []}
    A, B = j(proof / f"timeline.{lang}.json"), j(test / f"timeline.{lang}.json")
    num_diff(A, B, ["durationFrames"], "timeline", out)
    sa, sb = {s["id"]: s for s in A["shots"]}, {s["id"]: s for s in B["shots"]}
    if set(sa) != set(sb):
        out["problems"].append(f"shot ids differ: only proof {sorted(set(sa) - set(sb))}, only toolchain {sorted(set(sb) - set(sa))}")
    for k in sa:
        if k in sb:
            num_diff(sa[k], sb[k], ["start", "duration"], f"shot {k}", out)
            for f in ("image", "layers", "type", "move", "subshot_of"):
                if sa[k].get(f) != sb[k].get(f):
                    out["problems"].append(f"shot {k}.{f}: proof {sa[k].get(f)!r} vs toolchain {sb[k].get(f)!r}")
    for bus in ("dialogue", "music", "sfx"):
        ca, cb = {c["id"]: c for c in A["audio"][bus]}, {c["id"]: c for c in B["audio"][bus]}
        if set(ca) != set(cb):
            out["problems"].append(f"{bus} ids differ: only proof {sorted(set(ca) - set(cb))}, only toolchain {sorted(set(cb) - set(ca))}")
        for k in ca:
            if k not in cb:
                continue
            num_diff(ca[k], cb[k], ["start", "duration", "trimBefore", "volume", "fadeIn", "fadeOut"], f"{bus} {k}", out)
            if ca[k].get("duck") != cb[k].get("duck"):
                out["problems"].append(f"{bus} {k}.duck: {ca[k].get('duck')} vs {cb[k].get('duck')}")
            pa, pb = proof / ca[k]["src"], test / cb[k]["src"]
            if not pb.exists() or md5(pa) != md5(pb):
                out["problems"].append(f"{bus} {k}: audio differs ({ca[k]['src']} vs {cb[k]['src']})")
            elif ca[k]["src"] != cb[k]["src"]:
                out["notes"].append(f"{bus} {k}: same audio (md5), path {ca[k]['src']} -> {cb[k]['src']}")
    da, dbk = A["audio"]["ducking"], B["audio"]["ducking"]
    if da != dbk:
        out["problems"].append(f"ducking: {da} vs {dbk}")
    # subtitles, compared line by line
    UA, UB = j(proof / f"subs.{lang}.json"), j(test / f"subs.{lang}.json")
    cuts = [c for c in B["meta"]["cuts"] if c < max(s["start"] + s["duration"] for s in B["shots"])]
    out["intended_deviations"] = []
    wmax = 0
    by = lambda cues: {l: [c for c in cues if c["line_id"] == l] for l in dict.fromkeys(c["line_id"] for c in cues)}
    la, lb = by(UA["cues"]), by(UB["cues"])
    if list(la) != list(lb):
        out["problems"].append(f"subs: lines differ {list(la)} vs {list(lb)}")
    for lid in la:
        xa, xb = la[lid], lb.get(lid, [])
        spans = [k for x in xa for k in cuts if x["startFrame"] < k < x["endFrame"]]
        if len(xa) != len(xb):
            msg = (f"{lid}: proof {[(x['startFrame'], x['endFrame'], x['text']) for x in xa]} vs toolchain "
                   f"{[(x['startFrame'], x['endFrame'], x['text']) for x in xb]}")
            if spans and any(x.get("cutFragment") for x in xb):
                out["intended_deviations"].append(f"proof cue runs across the cut at {spans} (D-014 rule 7); split at the cut: " + msg)
            else:
                out["problems"].append("subs " + msg)
            continue
        for x, y in zip(xa, xb):
            w = f"cue {lid} {x['id']}"
            if x["text"].replace("\n", " ") != y["text"].replace("\n", " "):
                out["problems"].append(f"{w}: proof {x['text']!r} vs {y['text']!r}")
                continue
            if x["text"] != y["text"]:
                out["notes"].append(f"{w}: same words, line break differs: {x['text']!r} vs {y['text']!r}")
            num_diff(x, y, ["startFrame", "endFrame"], w, out)
            for wa, wb in zip(x["words"], y["words"]):
                wmax = max(wmax, abs(wa["startMs"] - wb["startMs"]), abs(wa["endMs"] - wb["endMs"]))
    out["subs_max_word_ms_diff"] = wmax
    if wmax > 1000 / 30 * TOL + 1:
        out["problems"].append(f"subs: a word time differs by {wmax} ms (> {TOL} frame)")
    out["ok"] = not out["problems"]
    bad |= not out["ok"]
    report["langs"][lang] = out
report["ok"] = not bad
print(json.dumps(report, ensure_ascii=False, indent=1))
sys.exit(1 if bad else 0)
