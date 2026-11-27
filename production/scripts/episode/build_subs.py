#!/usr/bin/env python3
"""Episode toolchain: subs.<lang>.json (the app's SubtitleTrack, app/src/content/schema.ts)
from dialogue-placement.<lang>.json and timeline.<lang>.json (run build_timeline.py first).

    python3 -I production/scripts/episode/build_subs.py <episode_dir> <lang>

Generalised from content/proof/photoreal/build_subs.py. Exits non-zero if a check fails.

Timing (D-014): build_timeline.py measured each take (first and last speech, pauses >= 300 ms
by silencedetect at -40 dB) and spread the words (wordtime.py: split at a pause only where it
meets punctuation; grapheme spread inside a segment; local whisper.cpp word stamps only for a
segment whose word count matches the script).

Cues, in frames at 30 fps:
  1. one cue per segment; a segment over 2 x 32 graphemes is split again at sentence breaks;
  2. a cue starts on its segment's first speech and ends on its last;
  3. no cue runs across a picture cut (D-014 rule 7): a cue that ends within 12 frames after a
     cut is clamped to the cut (cut-off lines); a line that carries on over a cut (cut on a word)
     is split at the cut, and a part under 12 frames before the cut joins the next cue, which
     then starts on the cut. The 800 ms minimum is waived (400 ms) for the part before the cut;
  4. cues of one line closer than 15 frames are joined up to 2 frames apart;
  5. a cue under 800 ms or above 17 graphemes a second is held longer, up to 2 frames before the
     next cue and never past the next cut;
  6. a cue still under 800 ms is merged into its neighbour of the same line;
  7. any two cues end up at least 2 frames apart.
Ms values sit half a frame before the frame they open or close, so a player comparing
start <= t < end shows exactly the intended frames.
"""
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import FPS, dump, load  # noqa: E402
from wordtime import glen, strip_tags  # noqa: E402

MAXL, MAXLINES, MIN_F, CPS = 32, 2, 24, 17
CUT_GUARD = 12
JOIN_GAP_DEFAULT = 15  # edit.json subs.join_gap overrides (0 = never hold a cue over a pause)
MIN_GAP = 2
TAG = re.compile(r"\[[^\]]*\]")
HEARD_AS = ("off_screen", "phone")
ROLE_LABELS = {
    "dsp": {"hi": "डीएसपी", "en": "DSP"},
    "neighbour_voice": {"hi": "पड़ोसी", "en": "Neighbour"},
}


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
            sc = abs(glen(a) - glen(b)) - (40 if re.search(r"[.!?…।]$", a) else 20 if a.endswith(",") else 0)
            if best is None or sc < best[0]:
                best = (sc, [a, b])
    return best[1] if best else None


def split_range(words, i0, i1):
    text = " ".join(words[i0:i1])
    if wrap(text) or i1 - i0 == 1:
        return [(i0, i1)]
    ks = [k for k in range(i0 + 1, i1) if re.search(r"[.!?…।]$", words[k - 1])] or list(range(i0 + 1, i1))
    mid = (i0 + i1) / 2
    k = min(ks, key=lambda k: abs(k - mid))
    return split_range(words, i0, k) + split_range(words, k, i1)


def split_overrides(config, lang):
    """One-based word counts after which a line must start a new cue."""
    if not isinstance(config, dict):
        raise SystemExit("subs.split_after_words must be an object keyed by line ID")
    selected = {}
    for lid, spec in config.items():
        option = f"subs.split_after_words.{lid}"
        if isinstance(spec, dict):
            if spec.keys() - {"hi", "en"}:
                raise SystemExit(f"{option} only accepts hi and en language keys")
            if lang not in spec:
                continue
            option += f".{lang}"
            spec = spec[lang]
        if (not isinstance(spec, list) or any(type(k) is not int or k < 1 for k in spec)
                or spec != sorted(set(spec))):
            raise SystemExit(f"{option} must be a strictly increasing list of positive word counts")
        selected[lid] = tuple(spec)
    return selected


def build(ED, lang):
    sub_cfg = (load(ED / "edit.json", {}) or {}).get("subs") or {}
    JOIN_GAP = int(sub_cfg.get("join_gap", JOIN_GAP_DEFAULT))
    squeeze = sub_cfg.get("clamped_words", "keep") == "squeeze"
    overrides = split_overrides(sub_cfg.get("split_after_words", {}), lang)
    script = load(ED / f"script.{lang}.json")
    place = load(ED / f"dialogue-placement.{lang}.json")
    tl = load(ED / f"timeline.{lang}.json")
    END = max(s["start"] + s["duration"] for s in tl["shots"])
    cuts = sorted({c for c in tl.get("meta", {}).get("cuts", []) if 0 < c < END}
                  or {s["start"] for s in tl["shots"] if s["start"] > 0 and not s.get("subshot_of")})
    P = {p["line_id"]: p for p in place["lines"]}
    script_lines = {
        line["id"]: (line, beat.get("id", index))
        for index, beat in enumerate(script["beats"])
        for line in beat["lines"] if line["id"] in P
    }
    lines = [(lid, l["speaker"], strip_tags(l["text"])) for lid, (l, _) in script_lines.items()]
    unknown = overrides.keys() - script_lines.keys()
    if unknown:
        raise SystemExit(f"{lang}: subs.split_after_words lines are not placed: {', '.join(sorted(unknown))}")
    cues = []
    for lid, spk, text in lines:
        p = P[lid]
        words = [w["text"] for w in p["words"]]
        if " ".join(words) != text:
            raise SystemExit(f"{lang} {lid}: placement words do not spell the script text")
        segments = p["segments"]
        if lid in overrides:
            boundaries = overrides[lid]
            if boundaries and boundaries[-1] >= len(words):
                raise SystemExit(f"{lang} {lid}: a subtitle split must precede the last word ({len(words)})")
            edges = (0, *boundaries, len(words))
            ranges = zip(edges, edges[1:])
        else:
            ranges = ((seg["i0"], seg["i1"]) for seg in segments)
        for start, end in ranges:
            for i0, i1 in split_range(words, start, end):
                f0 = int(math.floor(p["words"][i0]["startFrame"] + 1e-6))
                f1 = int(math.ceil(p["words"][i1 - 1]["endFrame"] - 1e-6))
                sources = {seg["source"] for seg in segments if i0 < seg["i1"] and seg["i0"] < i1}
                cues.append(dict(line_id=lid, speaker=spk, i0=i0, i1=i1, f0=f0, f1=f1, speech=(f0, f1),
                                 timing=sources.pop() if len(sources) == 1 else "mixed",
                                 words=p["words"], notes=[], placeholder=p.get("placeholder", False)))
    cues.sort(key=lambda c: c["f0"])

    def text(c):
        return " ".join(w["text"] for w in c["words"][c["i0"]:c["i1"]])

    def next_cut(f):
        return min([c for c in cuts if c >= f] + [END])

    # 3a. a line that carries over a cut (cut on a word) is split at the cut: the words that start
    # before the cut stay with the outgoing shot, the rest start a new cue on the incoming shot.
    k_i = 0
    while k_i < len(cues):
        c = cues[k_i]
        k = next((k for k in cuts if c["f0"] < k < c["f1"] and c["f1"] - k >= CUT_GUARD), None)
        if k is None:
            k_i += 1
            continue
        j = next((i for i in range(c["i0"] + 1, c["i1"]) if c["words"][i]["startFrame"] >= k - 0.5), None)
        if j is None:  # the last word straddles the cut: clamp instead (rule 3)
            c["notes"].append(f"end clamped {c['f1']}->{k} (cut inside the last word)")
            c["f1"] = k
            k_i += 1
            continue
        b0 = max(k, int(math.floor(c["words"][j]["startFrame"] + 1e-6)))
        a = dict(c, i1=j, f1=k, speech=(c["f0"], k), notes=c["notes"] + [f"split at the cut at frame {k}"], cut_fragment=True)
        b = dict(c, i0=j, f0=b0, speech=(b0, c["speech"][1]), notes=[f"split at the cut at frame {k}"], cut_fragment=True)
        if k - c["f0"] < CUT_GUARD:  # too short to read alone: its words open the next cue on the cut
            b = dict(b, i0=c["i0"], f0=k, speech=(k, c["speech"][1]),
                     notes=[f"starts on the cut at frame {k}: the {k - c['f0']} frames before it are too short for a cue"])
            cues[k_i:k_i + 1] = [b]
        else:
            cues[k_i:k_i + 1] = [a, b]
        k_i += 1
    for c in cues:
        for k in cuts:
            if c["f0"] < k < c["f1"] and c["f1"] - k < CUT_GUARD:
                c["notes"].append(f"end clamped {c['f1']}->{k} (cut)")
                c["f1"] = k
        if c["f1"] > END:
            c["notes"].append(f"end clamped {c['f1']}->{END} (picture end)")
            c["f1"] = END
    for a, b in zip(cues, cues[1:]):
        if a["line_id"] == b["line_id"] and 0 < b["f0"] - a["f1"] < JOIN_GAP and next_cut(a["f1"]) >= b["f0"]:
            a["notes"].append(f"held {a['f1']}->{b['f0'] - MIN_GAP} over the pause")
            a["f1"] = b["f0"] - MIN_GAP

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
                    if b["i0"] in overrides.get(c["line_id"], ()):
                        continue
                    merged = " ".join(a["words"][k]["text"] for k in range(a["i0"], b["i1"]))
                    if wrap(merged) and not any(a["f0"] < k <= b["f0"] for k in cuts):
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
    for a, b in zip(cues, cues[1:]):
        if b["f0"] - a["f1"] < MIN_GAP:
            a["notes"].append(f"end {a['f1']}->{b['f0'] - MIN_GAP} (2-frame gap)")
            a["f1"] = b["f0"] - MIN_GAP

    heard_as = {lid: l["heard_as"] for lid, (l, _) in script_lines.items() if l.get("heard_as")}
    for lid, mode in heard_as.items():
        if mode not in HEARD_AS:
            raise SystemExit(f"{lang} {lid}: heard_as must be off_screen or phone")
    board = load(ED / "shots.json", {}) if heard_as else {}
    scenes = {shot["id"]: shot["scene"] for shot in board.get("shots", []) if shot.get("scene")}

    def scene_at(c):
        f = c["f0"]
        shot = next((s for s in tl["shots"] if s["start"] <= f < s["start"] + s["duration"]), None)
        lid = c["line_id"]
        scene = scenes.get(shot.get("subshot_of") or shot["id"]) if shot is not None else None
        scene = scene or scenes.get(P[lid].get("shot"))
        return ("scene", scene) if scene else ("beat", script_lines[lid][1])

    marked_speakers = set()
    out = []
    for n, c in enumerate(cues, 1):
        s, e = fms(c["f0"]), fms(c["f1"])
        ws = []
        s1 = c["speech"][1]
        for j, k in enumerate(range(c["i0"], c["i1"])):
            w = c["words"][k]
            wf = w["startFrame"]
            if squeeze and c["f1"] < s1 and s1 > c["f0"]:  # clamped cue: squeeze the words into it
                wf = c["f0"] + (wf - c["f0"]) * (c["f1"] - c["f0"]) / (s1 - c["f0"])
            ws0 = s if j == 0 else min(max(fms(wf + 0.5), s), e)
            ws.append({"text": w["text"], "startMs": ws0})
        for j in range(1, len(ws)):
            ws[j]["startMs"] = max(ws[j]["startMs"], ws[j - 1]["startMs"])
        for j in range(len(ws)):
            ws[j]["endMs"] = ws[j + 1]["startMs"] if j + 1 < len(ws) else e
        lines_ = wrap(text(c)) or [text(c)]
        cue = {"id": f"c{n:03d}", "line_id": c["line_id"], "speaker": c["speaker"],
               "startMs": s, "endMs": e, "startFrame": c["f0"], "endFrame": c["f1"],
               "speechFrames": list(c["speech"]), "wordTiming": c["timing"],
               "text": "\n".join(lines_), "words": ws}
        if c["line_id"] in heard_as:
            cue["heard_as"] = heard_as[c["line_id"]]
            speaker = c["speaker"]
            key = (scene_at(c), speaker)
            if key not in marked_speakers:
                cue["speaker_label"] = ROLE_LABELS.get(speaker, {}).get(lang, speaker.replace("_", " "))
                marked_speakers.add(key)
        if c["placeholder"]:
            cue["placeholder"] = True
        if c.get("cut_fragment"):
            cue["cutFragment"] = True
        if c["notes"]:
            cue["notes"] = c["notes"]
        out.append(cue)
    doc = {"lang": lang, "fps": FPS,
           "method": "D-014 (b): measured speech + silencedetect pauses; production/scripts/episode/build_subs.py",
           "cuts": cuts, "cues": out}
    if out and all(c.get("placeholder") for c in out):
        doc["placeholder"] = True
    return doc, lines, cuts, END, tl["durationFrames"]


def validate(doc, lines, cuts, END, total):
    """D-014 rules plus the app's validateSubtitleTrack (schema.ts)."""
    probs, warns = [], []
    cues = doc["cues"]
    if doc.get("lang") not in ("hi", "en"):
        probs.append("lang must be hi or en")
    shown = {}
    for f in range(total):
        t = f / FPS * 1000
        vis = [c["id"] for c in cues if c["startMs"] <= t < c["endMs"]]
        if len(vis) > 1:
            probs.append(f"frame {f}: {vis} overlap")
        for v in vis:
            shown.setdefault(v, []).append(f)
    ids = [c["id"] for c in cues]
    if len(set(ids)) != len(ids):
        probs.append("duplicate cue ids")
    for a, b in zip(cues, cues[1:]):
        if b["startFrame"] - a["endFrame"] < MIN_GAP:
            probs.append(f"{a['id']}/{b['id']} gap {b['startFrame'] - a['endFrame']} frames (< {MIN_GAP})")
        if b["startMs"] < a["startMs"]:
            probs.append(f"{b['id']} starts before {a['id']} (cues must be in time order)")
    for c in cues:
        fr = shown.get(c["id"], [])
        if fr != list(range(c["startFrame"], c["endFrame"])):
            probs.append(f"{c['id']} burns frames {fr[:1]}..{fr[-1:]} not [{c['startFrame']},{c['endFrame']})")
        f0, f1 = c["startFrame"], c["endFrame"]
        for k in cuts:
            if f0 < k < f1:
                probs.append(f"{c['id']} runs across the cut at frame {k}")
        if f1 > END:
            probs.append(f"{c['id']} past picture end")
        if c["endMs"] > total * 1000 / FPS + 250:
            probs.append(f"{c['id']} ends after the video")
        if c["endMs"] <= c["startMs"]:
            probs.append(f"{c['id']} endMs not after startMs")
        if f0 != c["speechFrames"][0] and not (c.get("cutFragment") and f0 in cuts):
            probs.append(f"{c['id']} starts {f0 - c['speechFrames'][0]} frames off its first speech")
        ls = c["text"].split("\n")
        dur = f1 - f0
        if len(ls) > MAXLINES or any(glen(l) > MAXL for l in ls):
            probs.append(f"{c['id']} over {MAXLINES} lines of {MAXL} graphemes")
        if dur < (CUT_GUARD if c.get("cutFragment") else MIN_F):
            warns.append(f"{c['id']} short: {dur} frames (under 800 ms; no room before the next cue or cut)")
        cps = glen(c["text"].replace("\n", "")) / (dur / FPS) if dur > 0 else 1e9
        if cps > CPS:
            probs.append(f"{c['id']} reads at {cps:.1f} graphemes/s (> {CPS})")
        if TAG.search(c["text"]):
            probs.append(f"{c['id']} still has an emotion tag")
        if not c["words"]:
            probs.append(f"{c['id']} has no words")
            continue
        if " ".join(w["text"] for w in c["words"]) != re.sub(r"\s+", " ", c["text"]).strip():
            probs.append(f"{c['id']} words do not spell the text")
        for w in c["words"]:
            if w["endMs"] < w["startMs"] or w["startMs"] < c["startMs"] or w["endMs"] > c["endMs"]:
                probs.append(f"{c['id']} word {w['text']!r} outside its cue or reversed")
        if c["words"][-1]["endMs"] != c["endMs"] or c["words"][0]["startMs"] != c["startMs"]:
            probs.append(f"{c['id']} words do not span the cue")
    for lid, _, text in lines:
        joined = " ".join(c["text"].replace("\n", " ") for c in cues if c["line_id"] == lid)
        if joined != text:
            probs.append(f"{lid} text mismatch: {joined!r} vs {text!r}")
    return probs, warns


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_subs.py <episode_dir> <lang>")
    ED, lang = Path(sys.argv[1]).resolve(), sys.argv[2]
    doc, lines, cuts, END, total = build(ED, lang)
    p, warns = validate(doc, lines, cuts, END, total)
    durs = [c["endFrame"] - c["startFrame"] for c in doc["cues"]]
    doc["validation"] = {
        "ok": not p, "problems": p, "warnings": warns,
        "max_cps": round(max((glen(c["text"].replace("\n", "")) / (d / FPS) for c, d in zip(doc["cues"], durs) if d > 0),
                             default=0), 1),
        "min_cue_frames": min(durs, default=0),
        "min_gap_frames": min((b["startFrame"] - a["endFrame"] for a, b in zip(doc["cues"], doc["cues"][1:])), default=None),
        "checked": ["per-frame burn-in: no two cues on one frame, each cue on exactly its frames",
                    f"cues >= {MIN_GAP} frames apart and in time order", "no cue across a picture cut",
                    "cue start = first speech of its segment", f"<= {MAXLINES} lines of <= {MAXL} graphemes",
                    "duration >= 800 ms where there is room (a warning, not a failure)", f"<= {CPS} graphemes/s", "no emotion tags", "words spell the text",
                    "words inside their cue", "ends inside the video (250 ms)", "per-line text = script minus tags"]}
    dump(ED / f"subs.{lang}.json", doc)
    print(lang, len(doc["cues"]), "cues;", "OK" if not p else p, *(["warnings:", warns] if warns else []))
    for c in doc["cues"]:
        print(f"  {c['id']} {c['line_id']} f{c['startFrame']}-{c['endFrame']} {c['startMs']}-{c['endMs']}ms "
              f"speech{c['speechFrames']} [{c['wordTiming']}] {c['text']!r} {c.get('notes', '')}")
    sys.exit(1 if p else 0)


if __name__ == "__main__":
    main()
