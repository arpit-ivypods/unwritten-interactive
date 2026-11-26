#!/usr/bin/env python3
"""S12/S13 subtitle builder + validator (D-014). Usage: python3 -I build_subs.py
Exits non-zero on any failure.

Timing source: dialogue-placement.<lang>.json from build_timeline.py, which
holds each line's measured first and last speech, its internal pauses >= 300
ms (silencedetect, -40 dB) and per-word times (wordtime.py: grapheme spread
inside a segment; local whisper.cpp stamps only for a segment whose word
count matches the script).

Cues, in frames at 30 fps:
  1. one cue per segment: a line is split at a pause matched to punctuation
     (rule 3); a segment over 2 x 32 graphemes is split again at sentence breaks;
  2. a cue starts on its segment's first speech and ends on its last (rule 2);
  3. a cue may not end within 12 frames after a picture cut: it is clamped to
     the cut (rule 7; the cut-off l06 is clamped this way);
  4. cues of one line closer than 15 frames are joined up to 2 frames apart,
     so a line does not blink off during its own pause;
  5. a cue under 800 ms or above 17 graphemes a second is held longer, up to
     2 frames before the next cue and never past the next cut (rule 7);
  6. a cue still under 800 ms is merged into its neighbour of the same line;
  7. any two cues end up at least 2 frames apart.
Ms values sit half a frame before the frame they open or close, so the
burn-in (frame/fps*1000 compared with start <= t < end) shows exactly the
intended frames.
"""
import json
import math
import re
import sys
from pathlib import Path

D = Path(__file__).resolve().parent
sys.path.insert(0, str(D))
from wordtime import glen, strip_tags  # noqa: E402

FPS = 30
MAXL, MAXLINES, MIN_F, CPS = 32, 2, 24, 17
CUT_GUARD = 12      # frames: a cue may not end this close after a cut
JOIN_GAP = 15       # frames: same-line cues closer than this are joined
MIN_GAP = 2         # frames between any two cues


def fms(f):
    return max(0, int(round((f - 0.5) * 1000 / FPS)))


def wrap(t):
    if glen(t) <= MAXL:
        return [t]
    w = t.split(" ")
    best = None
    for i in range(1, len(w)):
        a, b = " ".join(w[:i]), " ".join(w[i:])
        if glen(a) <= MAXL and glen(b) <= MAXL:
            # balanced lines, but a sentence or clause break wins when both halves fit
            sc = abs(glen(a) - glen(b)) - (40 if re.search(r"[.!?…।]$", a) else 20 if a.endswith(",") else 0)
            if best is None or sc < best[0]:
                best = (sc, [a, b])
    return best[1] if best else None


def split_range(words, i0, i1):
    """Split words[i0:i1] into ranges that each wrap into <= 2 lines of 32."""
    text = " ".join(words[i0:i1])
    if wrap(text):
        return [(i0, i1)]
    # prefer a sentence break nearest the middle, else the middle word
    ks = [k for k in range(i0 + 1, i1) if re.search(r"[.!?…।]$", words[k - 1])] or list(range(i0 + 1, i1))
    mid = (i0 + i1) / 2
    k = min(ks, key=lambda k: abs(k - mid))
    return split_range(words, i0, k) + split_range(words, k, i1)


def build(lang):
    script = json.load(open(D / f"script.{lang}.json"))
    place = json.load(open(D / f"dialogue-placement.{lang}.json"))
    tl = json.load(open(D / f"timeline.{lang}.json"))
    cuts = sorted(s["start"] for s in tl["shots"] if s["start"] > 0)
    END = max(s["start"] + s["duration"] for s in tl["shots"])
    P = {p["line_id"]: p for p in place["lines"]}
    lines = [(l["id"], l["speaker"], strip_tags(l["text"])) for b in script["beats"] for l in b["lines"]]
    cues = []
    for lid, spk, text in lines:
        p = P[lid]
        words = [w["text"] for w in p["words"]]
        assert " ".join(words) == text, (lang, lid)
        for seg in p["segments"]:
            for i0, i1 in split_range(words, seg["i0"], seg["i1"]):
                f0 = int(math.floor(p["words"][i0]["startFrame"] + 1e-6))
                f1 = int(math.ceil(p["words"][i1 - 1]["endFrame"] - 1e-6))
                cues.append(dict(line_id=lid, speaker=spk, i0=i0, i1=i1, f0=f0, f1=f1, speech=(f0, f1),
                                 timing=seg["source"], words=p["words"], notes=[]))
    cues.sort(key=lambda c: c["f0"])

    def text(c):
        return " ".join(w["text"] for w in c["words"][c["i0"]:c["i1"]])

    def next_cut(f):
        return min([c for c in cuts if c >= f] + [END])

    # 3. no cue ends just after a cut
    for c in cues:
        for k in cuts:
            if c["f0"] < k < c["f1"] and c["f1"] - k < CUT_GUARD:
                c["notes"].append(f"end clamped {c['f1']}->{k} (cut)")
                c["f1"] = k
    # 4. join same-line cues across their own short pause
    for a, b in zip(cues, cues[1:]):
        if a["line_id"] == b["line_id"] and 0 < b["f0"] - a["f1"] < JOIN_GAP and next_cut(a["f1"]) >= b["f0"]:
            a["notes"].append(f"held {a['f1']}->{b['f0'] - MIN_GAP} over the pause")
            a["f1"] = b["f0"] - MIN_GAP

    # 5/6. minimum duration and reading speed
    def need(c):
        return max(MIN_F, math.ceil(glen(text(c)) / CPS * FPS))

    def extend(c, nxt):
        want = c["f0"] + need(c)
        if c["f1"] >= want:
            return
        limit = min(nxt["f0"] - MIN_GAP if nxt else END, next_cut(c["f1"]))
        new = max(c["f1"], min(want, limit))
        if new > c["f1"]:
            c["notes"].append(f"held {c['f1']}->{new} (min {need(c)} frames)")
            c["f1"] = new

    changed = True
    while changed:
        changed = False
        for i, c in enumerate(cues):
            extend(c, cues[i + 1] if i + 1 < len(cues) else None)
        for i, c in enumerate(cues):
            if c["f1"] - c["f0"] >= MIN_F:
                continue
            for j in (i - 1, i + 1):
                if 0 <= j < len(cues) and cues[j]["line_id"] == c["line_id"]:
                    a, b = (cues[j], c) if j < i else (c, cues[j])
                    merged = " ".join(a["words"][k]["text"] for k in range(a["i0"], b["i1"]))
                    if wrap(merged) and not any(a["f0"] < k < b["f0"] for k in cuts):
                        a["notes"].append(f"merged with the {'next' if j > i else 'previous'} segment "
                                          f"({b['f1'] - b['f0'] if j < i else a['f1'] - a['f0']} frames alone)")
                        a["i1"], a["f1"] = b["i1"], b["f1"]
                        a["speech"] = (a["speech"][0], b["speech"][1])
                        a["timing"] = a["timing"] if a["timing"] == b["timing"] else "mixed"
                        cues.remove(b)
                        changed = True
                        break
            if changed:
                break
    # 7. at least 2 frames between cues
    for a, b in zip(cues, cues[1:]):
        if b["f0"] - a["f1"] < MIN_GAP:
            a["notes"].append(f"end {a['f1']}->{b['f0'] - MIN_GAP} (2-frame gap)")
            a["f1"] = b["f0"] - MIN_GAP

    out = []
    for n, c in enumerate(cues, 1):
        s, e = fms(c["f0"]), fms(c["f1"])
        ws = []
        rng = list(range(c["i0"], c["i1"]))
        for j, k in enumerate(rng):
            w = c["words"][k]
            ws0 = s if j == 0 else min(max(fms(w["startFrame"] + 0.5), s), e)
            ws.append({"text": w["text"], "startMs": ws0})
        for j in range(len(ws)):
            ws[j]["startMs"] = max(ws[j]["startMs"], ws[j - 1]["startMs"]) if j else ws[j]["startMs"]
        for j in range(len(ws)):
            ws[j]["endMs"] = ws[j + 1]["startMs"] if j + 1 < len(ws) else e
        out.append({"id": f"c{n:02d}", "line_id": c["line_id"], "speaker": c["speaker"],
                    "startMs": s, "endMs": e, "startFrame": c["f0"], "endFrame": c["f1"],
                    "speechFrames": list(c["speech"]), "wordTiming": c["timing"],
                    "text": "\n".join(wrap(text(c))), "words": ws, **({"notes": c["notes"]} if c["notes"] else {})})
    doc = {"lang": lang, "fps": FPS, "method": "D-014 (b): measured speech + silencedetect pauses; see build_subs.py",
           "cuts": cuts, "cues": out}
    return doc, lines, cuts, END, tl["durationFrames"]


def validate(doc, lines, cuts, END, total):
    probs = []
    cues = doc["cues"]
    # what the burn-in shows, frame by frame (Episode.tsx Subtitles logic)
    shown = {}
    for f in range(total):
        t = f / FPS * 1000
        vis = [c["id"] for c in cues if c["startMs"] <= t < c["endMs"]]
        if len(vis) > 1:
            probs.append(f"frame {f}: {vis} overlap")
        for v in vis:
            shown.setdefault(v, []).append(f)
    for c in cues:
        fr = shown.get(c["id"], [])
        if fr != list(range(c["startFrame"], c["endFrame"])):
            probs.append(f"{c['id']} burns frames {fr[:1]}..{fr[-1:]} not [{c['startFrame']},{c['endFrame']})")
    for a, b in zip(cues, cues[1:]):
        if b["startFrame"] - a["endFrame"] < MIN_GAP:
            probs.append(f"{a['id']}/{b['id']} gap {b['startFrame'] - a['endFrame']} frames")
    for c in cues:
        f0, f1 = c["startFrame"], c["endFrame"]
        for k in cuts:
            if f0 < k < f1 and f1 - k < CUT_GUARD:
                probs.append(f"{c['id']} outlasts cut {k} by {f1 - k} frames")
        if f1 > END:
            probs.append(f"{c['id']} past picture end")
        if f0 != c["speechFrames"][0]:
            probs.append(f"{c['id']} starts {f0 - c['speechFrames'][0]} frames off its first speech")
        ls = c["text"].split("\n")
        dur = f1 - f0
        if len(ls) > MAXLINES or any(glen(l) > MAXL for l in ls):
            probs.append(f"{c['id']} too long")
        if dur < MIN_F:
            probs.append(f"{c['id']} short {dur} frames")
        cps = glen(c["text"].replace("\n", "")) / (dur / FPS)
        if cps > CPS:
            probs.append(f"{c['id']} cps {cps:.1f}")
        if "[" in c["text"] or "]" in c["text"]:
            probs.append(f"{c['id']} has tag")
        if " ".join(w["text"] for w in c["words"]) != c["text"].replace("\n", " "):
            probs.append(f"{c['id']} words!=text")
        if any(w["endMs"] < w["startMs"] for w in c["words"]) or c["words"][-1]["endMs"] != c["endMs"]:
            probs.append(f"{c['id']} bad word timing")
    for lid, _, text in lines:
        joined = " ".join(c["text"].replace("\n", " ") for c in cues if c["line_id"] == lid)
        if joined != text:
            probs.append(f"{lid} text mismatch: {joined!r} vs {text!r}")
    return probs


bad = 0
for lang in ("hi", "en"):
    doc, lines, cuts, END, total = build(lang)
    p = validate(doc, lines, cuts, END, total)
    doc["validation"] = {"ok": not p, "problems": p, "checked": [
        "per-frame burn-in: no two cues on one frame, each cue on exactly its frames",
        "cues >= 2 frames apart", f"no cue ends within {CUT_GUARD} frames after a cut",
        "cue start = first speech of its segment", "<= 2 lines of <= 32 graphemes", "duration >= 800 ms",
        f"<= {CPS} graphemes/s", "no tags", "words = text", "per-line text = script minus tags"]}
    (D / f"subs.{lang}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(lang, len(doc["cues"]), "cues;", "OK" if not p else p)
    bad += bool(p)
    for c in doc["cues"]:
        print(f"  {c['id']} {c['line_id']} f{c['startFrame']}-{c['endFrame']} {c['startMs']}-{c['endMs']}ms "
              f"speech{c['speechFrames']} [{c['wordTiming']}] {c['text']!r} {c.get('notes', '')}")
sys.exit(1 if bad else 0)
