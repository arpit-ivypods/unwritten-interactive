#!/usr/bin/env python3
"""S13 Editor: subs.<lang>.json for the flat2d proof scene from the MEASURED
takes (D-014). Run after build_timeline.py:

    python3 -I content/proof/flat2d/build_subs.py

Inputs: dialogue-placement.<lang>.json (speech segments in frames, from
ffprobe + silencedetect), timeline.<lang>.json (meta.picture_cuts),
script.<lang>.json (text). Exits non-zero if a check fails.

Rules (D-014):
 2. A cue starts at the first speech of its segment and ends at the last.
 3. A line with an internal pause >= 300 ms is split there, and its text at the
    punctuation whose grapheme position best matches the pause's time position.
 4. Inside a segment, word times are spread by grapheme count ...
 5. ... unless local transcription (whisper.cpp ggml-small, word timestamps,
    cached in edit/whisper/) finds exactly as many words in the segment as the
    script has; then its word starts are used. No cue depends on it.
 7. Cut-off lines are clamped to the cut; a cue above 17 characters a second or
    shorter than 800 ms is held past its last speech, up to 2 frames before the
    next cue and never past the next picture cut; no cue outlasts a picture cut;
    cues are at least 2 frames apart. Devanagari is counted in clusters.
"""
import hashlib
import json
import math
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

FPS = 30
SCENE = Path(__file__).resolve().parent
MAXL, MAXLINES, CPS, MIN_F, GAP_F = 32, 2, 17.0, 24, 2
WHISPER_BIN = "whisper-cli"
WHISPER_MODEL = Path.home() / ".whisper-models" / "ggml-small.bin"
CACHE = SCENE / "edit" / "whisper"
PUNCT = tuple(".…।,!?—")


def ms(f):
    return int(math.floor(f * 1000 / FPS))


def glen(s):
    n, join = 0, False
    for ch in s:
        if unicodedata.category(ch) in ("Mn", "Mc", "Me") or ch in "‌‍":
            join = ch == "्"
            continue
        if join:
            join = False
            continue
        if ch == " ":
            continue
        n += 1
    return n


def strip_tags(t):
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", t)).strip()


def wrap(t):
    if glen(t) <= MAXL:
        return t
    w, best = t.split(" "), None
    for i in range(1, len(w)):
        a, b = " ".join(w[:i]), " ".join(w[i:])
        if glen(a) <= MAXL and glen(b) <= MAXL:
            sc = abs(glen(a) - glen(b)) - (3 if a.endswith(PUNCT) else 0)
            if best is None or sc < best[0]:
                best = (sc, a + "\n" + b)
    if best is None:
        raise SystemExit(f"cannot wrap {t!r} into {MAXLINES} lines of {MAXL}")
    return best[1]


def whisper_words(take, lang):
    """[(text, start_s, end_s)] for a take, cached by md5."""
    h = hashlib.md5(take.read_bytes()).hexdigest()
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"{lang}_{take.stem}.json"
    if out.exists():
        d = json.loads(out.read_text())
        if d.get("md5") == h:
            return d["words"]
    wav = CACHE / f"{lang}_{take.stem}.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(take), "-ar", "16000", "-ac", "1", str(wav)], check=True)
    base = CACHE / f"{lang}_{take.stem}.raw"
    subprocess.run([WHISPER_BIN, "-m", str(WHISPER_MODEL), "-f", str(wav), "-l", lang, "-ml", "1", "-sow",
                    "-oj", "-of", str(base)], check=True, capture_output=True)
    raw = json.loads(Path(str(base) + ".json").read_text())
    words = [(s["text"].strip(), s["offsets"]["from"] / 1000, s["offsets"]["to"] / 1000)
             for s in raw["transcription"] if s["text"].strip()]
    out.write_text(json.dumps({"md5": h, "model": WHISPER_MODEL.name, "words": words}, ensure_ascii=False, indent=1))
    wav.unlink()
    Path(str(base) + ".json").unlink()
    return words


def split_text(words, segs):
    """Split the line's words into len(segs) parts at punctuation, matching pause positions in time."""
    k = len(segs) - 1
    if k == 0:
        return [words], None
    cand = [i + 1 for i, w in enumerate(words[:-1]) if w.endswith(PUNCT)]
    if len(cand) < k:
        return [words], f"{k} pause(s) but only {len(cand)} punctuation break(s): kept as one cue"
    g = [glen(w) for w in words]
    tot_g = sum(g)
    speech = sum(b - a for a, b in segs)
    tfrac, acc = [], 0
    for a, b in segs[:-1]:
        acc += b - a
        tfrac.append(acc / speech)
    best = None
    from itertools import combinations
    for combo in combinations(cand, k):
        err = sum(abs(sum(g[:c]) / tot_g - tf) for c, tf in zip(combo, tfrac))
        if best is None or err < best[0]:
            best = (err, combo)
    parts, prev = [], 0
    for c in best[1] + (len(words),):
        parts.append(words[prev:c])
        prev = c
    return parts, None


def assign(whisper, segs, clip0):
    """Every transcribed word goes to the segment containing its midpoint, else the nearest one."""
    out = [[] for _ in segs]
    for _, t0, t1 in whisper:
        mid = clip0 + (t0 + t1) / 2 * FPS
        dist = [0 if a <= mid <= b else min(abs(mid - a), abs(mid - b)) for a, b in segs]
        out[dist.index(min(dist))].append((clip0 + t0 * FPS, clip0 + t1 * FPS))
    return out


def word_times(ws, a, b, inside):
    """Word (start, end) frames-as-floats over [a, b]. Rule 5 if the transcript's word count for this
    segment matches the script's, else rule 4 (grapheme spread)."""
    if len(inside) == len(ws) and len(ws) > 1:
        starts = [a] + [min(b, max(a, t0)) for t0, _ in inside[1:]]
        if all(y - x >= 1 for x, y in zip(starts, starts[1:] + [b])):
            return [(x, y) for x, y in zip(starts, starts[1:] + [b])], "whisper"
    g = [max(glen(w), 1) for w in ws]
    tot, t, out = sum(g), a, []
    for x in g:
        d = (b - a) * x / tot
        out.append((t, t + d))
        t += d
    return out, "graphemes"


def build(lang):
    script = json.loads((SCENE / f"script.{lang}.json").read_text())
    place = json.loads((SCENE / f"dialogue-placement.{lang}.json").read_text())
    tl = json.loads((SCENE / f"timeline.{lang}.json").read_text())
    cuts = tl["meta"]["picture_cuts"]
    text = {l["id"]: strip_tags(l["text"]) for b in script["beats"] for l in b["lines"]}
    notes, cues = [], []
    for p in place:
        lid = p["line_id"]
        words = text[lid].split(" ")
        segs = p["segmentsFrames"]
        parts, why = split_text(words, segs)
        if why:
            notes.append(f"{lid}: {why}")
            segs = [[segs[0][0], segs[-1][1]]]
        whisper = whisper_words(SCENE / p["take"], lang)
        per_seg = assign(whisper, segs, p["clipFrames"][0])
        for ws, (a, b), inside in zip(parts, segs, per_seg):
            wt, src = word_times(ws, a, b, inside)
            cues.append({"line_id": lid, "speaker": p["speaker"], "a": a, "b": b, "speech": [a, b], "ws": ws, "wt": wt,
                         "src": src, "cutoff": p["cutoff"]})
    # timing constraints, in frames
    for i, c in enumerate(cues):
        nxt_cut = min(x for x in cuts if x > c["a"])
        if c["b"] > nxt_cut:
            notes.append(f"{c['line_id']}: speech runs {c['b'] - nxt_cut} frames past the cut at {nxt_cut}; cue clamped to the cut.")
            c["b"] = nxt_cut
        n = " ".join(c["ws"])
        need = max(MIN_F, math.ceil(glen(n) / CPS * FPS))
        if c["b"] - c["a"] < need:
            limit = nxt_cut
            if i + 1 < len(cues):
                limit = min(limit, cues[i + 1]["a"] - GAP_F)
            nb = max(c["b"], min(c["a"] + need, limit))
            if nb > c["b"]:
                notes.append(f"{c['line_id']} '{n[:24]}': held {nb - c['b']} frames past its last speech "
                             f"({'reading speed' if glen(n) / CPS * FPS > MIN_F else 'minimum 800 ms'}).")
            c["b"] = nb
    for a, b in zip(cues, cues[1:]):
        if b["a"] - a["b"] < GAP_F:
            a["b"] = b["a"] - GAP_F
    out = []
    for k, c in enumerate(cues, 1):
        s0, s1 = c["speech"]
        a, b = c["a"], c["b"]
        wt = c["wt"]
        if b < s1:  # clamped: squeeze the words into the shorter span
            wt = [(a + (x - a) * (b - a) / (s1 - a), a + (y - a) * (b - a) / (s1 - a)) for x, y in wt]
        elif b > s1:  # held: the last word stays on screen longer
            wt = wt[:-1] + [(wt[-1][0], b)]
        words = []
        for w, (x, y) in zip(c["ws"], wt):
            words.append({"text": w, "startMs": ms(x), "endMs": ms(y)})
        words[0]["startMs"], words[-1]["endMs"] = ms(a), ms(b)
        for w1, w2 in zip(words, words[1:]):
            w1["endMs"] = w2["startMs"]
        t = " ".join(c["ws"])
        out.append({"id": f"c{k:02d}", "line_id": c["line_id"], "speaker": c["speaker"], "startMs": ms(a), "endMs": ms(b),
                    "startFrame": a, "endFrame": b, "speechFrames": [s0, s1], "text": wrap(t), "words": words,
                    "wordTiming": c["src"]})
    return {"lang": lang, "fps": FPS, "method": "subs.method.md (D-014, measured takes)", "notes": notes, "cues": out}, text, cuts


def validate(doc, text, cuts):
    probs, cues = [], doc["cues"]
    for a, b in zip(cues, cues[1:]):
        if a["endMs"] > b["startMs"]:
            probs.append(f"overlap {a['id']}/{b['id']}")
        if b["startFrame"] - a["endFrame"] < GAP_F:
            probs.append(f"{a['id']}/{b['id']} under {GAP_F} frames apart")
    for c in cues:
        ls = c["text"].split("\n")
        if len(ls) > MAXLINES or any(glen(l) > MAXL for l in ls):
            probs.append(f"{c['id']} too long")
        if "[" in c["text"] or "]" in c["text"]:
            probs.append(f"{c['id']} has a tag")
        if any(c["startFrame"] < x < c["endFrame"] for x in cuts):
            probs.append(f"{c['id']} outlasts a picture cut")
        if c["startFrame"] != c["speechFrames"][0]:
            probs.append(f"{c['id']} does not start at first speech")
        if " ".join(w["text"] for w in c["words"]) != c["text"].replace("\n", " "):
            probs.append(f"{c['id']} words != text")
        if c["words"][0]["startMs"] != c["startMs"] or c["words"][-1]["endMs"] != c["endMs"]:
            probs.append(f"{c['id']} words do not span the cue")
        if any(w["endMs"] < w["startMs"] for w in c["words"]):
            probs.append(f"{c['id']} bad word timing")
    for lid, t in text.items():
        joined = " ".join(c["text"].replace("\n", " ") for c in cues if c["line_id"] == lid)
        if joined != t:
            probs.append(f"{lid} text mismatch: {joined!r} vs {t!r}")
    return probs


bad = 0
for lang in ("hi", "en"):
    doc, text, cuts = build(lang)
    probs = validate(doc, text, cuts)
    doc["checks"] = {"passed": not probs, "problems": probs,
                     "max_cps": round(max(glen(c["text"]) / ((c["endFrame"] - c["startFrame"]) / FPS) for c in doc["cues"]), 1),
                     "min_cue_ms": min(c["endMs"] - c["startMs"] for c in doc["cues"]),
                     "min_gap_frames": min(b["startFrame"] - a["endFrame"] for a, b in zip(doc["cues"], doc["cues"][1:]))}
    (SCENE / f"subs.{lang}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    print(lang, len(doc["cues"]), "cues;", "OK" if not probs else probs, {k: v for k, v in doc["checks"].items() if k != "problems"})
    for c in doc["cues"]:
        d = c["endMs"] - c["startMs"]
        print(f"  {c['id']} {c['line_id']} f{c['startFrame']}-{c['endFrame']} {c['startMs']}-{c['endMs']} ({d} ms, "
              f"{glen(c['text']) / (d / 1000):.1f} cps, {c['wordTiming']}) {c['text']!r}")
    for n in doc["notes"]:
        print("  NOTE", n)
    bad += bool(probs)
sys.exit(1 if bad else 0)
