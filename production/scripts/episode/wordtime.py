"""Episode toolchain: word and segment timing for one spoken line (D-014 rules 2-5).
Copied unchanged in logic from content/proof/photoreal/wordtime.py.
Shared by build_timeline.py (cut on a word) and build_subs.py (cues).

Inputs are times in any one unit (build_timeline passes frames):
  S, E     first and last speech of the take (ffmpeg silencedetect, -40 dB)
  pauses   internal silences >= 300 ms, [(p0, p1)], inside (S, E)
  asr      optional local whisper.cpp words [(text, t0, t1)], same unit

Rules:
  - Each pause is matched to a word boundary. If the boundary closest to the
    pause's position (by grapheme share of the line) ends in punctuation and
    lies within 0.25 of it, the line is split there (rule 3). Otherwise the
    pause only moves the word timing (no split).
  - A line whose script starts with a non-verbal tag ([laughs], [chuckles],
    [sighs] ...) may match its first pause to boundary 0: the sound before
    that pause is the laugh/sigh and the words start after it.
  - Inside each run between pauses, words are spread by grapheme count
    (rule 4, Devanagari counted in clusters).
  - Transcription replaces rule 4 for a segment only where the number of ASR
    words whose midpoint falls in the segment equals the script's (rule 5).
    The segment's first-word start and last-word end stay on the measured
    speech, so no cue boundary depends on transcription.
"""
import re
import unicodedata

PUNCT_END = re.compile(r"[.,!?…।—]+[\"'”’)]*$")
NONVERBAL = ("laugh", "chuckle", "sigh", "breath", "gasp", "scoff", "exhale")
MATCH_TOL = 0.25


def glen(s):
    """Grapheme-ish count: combining marks add nothing, a virama joins the next consonant."""
    n, join = 0, False
    for ch in s:
        if unicodedata.category(ch) in ("Mn", "Mc", "Me") or ch in "‌‍":
            join = ch == "्"
            continue
        if join:
            join = False
            continue
        n += 1
    return n


def strip_tags(t):
    return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", t)).strip()


def lead_nonverbal(raw):
    m = re.match(r"^\s*((?:\[[^\]]*\]\s*)+)", raw)
    return bool(m) and any(k in m.group(1).lower() for k in NONVERBAL)


def _spread(words, w, i0, i1, t0, t1, out):
    tot = sum(w[i0:i1]) or 1
    t = t0
    for i in range(i0, i1):
        d = (t1 - t0) * w[i] / tot
        out[i] = [t, t + d]
        t += d


def word_times(raw, S, E, pauses=(), asr=None, tol=3, asr_match="start", unit=1.0):
    """tol: slack in the caller's unit (3 = 0.1 s at 30 fps).

    asr_match "start" (default, photoreal proof): an ASR word belongs to the segment its start
    falls in; the segment is rejected if a stamp starts inside a pause or the Latin words disagree.
    asr_match "midpoint" (flat2d proof): every non-empty ASR word goes to the segment holding its
    midpoint, else the nearest one; accepted when the count matches and every word gets at least
    `unit` (one frame) of time."""
    words = strip_tags(raw).split(" ")
    n = len(words)
    w = [max(glen(x), 1) for x in words]
    tot = sum(w)
    cum = [0.0]
    for x in w:
        cum.append(cum[-1] + x / tot)
    punct = {k for k in range(1, n) if PUNCT_END.search(words[k - 1])}
    nv = lead_nonverbal(raw)
    notes = []
    assigned = []  # (k, p0, p1, kind)
    last_k = -1
    span = max(E - S, 1e-9)
    for p0, p1 in sorted(pauses):
        tf = ((p0 + p1) / 2 - S) / span
        cands = [k for k in punct | ({0} if nv else set()) if k > last_k]
        best = min(cands, key=lambda k: abs(cum[k] - tf), default=None)
        if best is not None and abs(cum[best] - tf) <= MATCH_TOL:
            kind = "lead" if best == 0 else "split"
        else:
            anyk = [k for k in range(1 if not nv else 0, n) if k > last_k]
            best = min(anyk, key=lambda k: abs(cum[k] - tf), default=None)
            kind = "timing"
            if best is None:
                notes.append(f"pause {p0:.1f}-{p1:.1f} not placed")
                continue
        assigned.append((best, p0, p1, kind))
        last_k = best
    # runs between pauses
    times = [None] * n
    starts = [S] + [p1 for _, _, p1, _ in assigned]
    ends = [p0 for _, p0, _, _ in assigned] + [E]
    ks = [0] + [k for k, *_ in assigned] + [n]
    for j in range(len(starts)):
        i0, i1 = ks[j], ks[j + 1]
        if i1 > i0:
            _spread(words, w, i0, i1, starts[j], ends[j], times)
    # segments: split only at punctuation-matched pauses
    cuts = [k for k, _, _, kind in assigned if kind == "split"]
    bounds = [0] + cuts + [n]
    segments = []
    for i0, i1 in zip(bounds, bounds[1:]):
        if i1 > i0:
            segments.append({"i0": i0, "i1": i1, "source": "graphemes"})
    # rule 5: ASR word timings where the count matches. Words are assigned to a
    # segment by their start time (whisper.cpp tends to stretch word ends into
    # silences). A segment is rejected if any ASR word starts inside a measured
    # pause (the stamps are then off), or if its Latin-script words disagree
    # with the script's on more than half of them.
    if asr and asr_match == "midpoint":
        bounds_ = [(times[sg["i0"]][0], times[sg["i1"] - 1][1]) for sg in segments]
        per = [[] for _ in segments]
        for t, a, b in asr:
            if not t.strip():
                continue
            mid = (a + b) / 2
            dist = [0 if x <= mid <= y else min(abs(mid - x), abs(mid - y)) for x, y in bounds_]
            per[dist.index(min(dist))].append((a, b))
        for seg, (t0, t1), inside in zip(segments, bounds_, per):
            nw = seg["i1"] - seg["i0"]
            if len(inside) == nw and nw > 1:
                st = [t0] + [min(t1, max(t0, a)) for a, _ in inside[1:]]
                if all(y - x >= unit for x, y in zip(st, st[1:] + [t1])):
                    for j, i in enumerate(range(seg["i0"], seg["i1"])):
                        times[i] = [st[j], st[j + 1] if j + 1 < len(st) else t1]
                    seg["source"] = "asr"
        asr = None
    if asr:
        aw = [(t, a, b) for t, a, b in asr if t.strip() and not re.fullmatch(r"[\[\(\*].*[\]\)\*]", t.strip())]
        in_pause = lambda a: any(p0 + tol < a < p1 - tol for _, p0, p1, _ in assigned)
        norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
        for seg in segments:
            t0, t1 = times[seg["i0"]][0], times[seg["i1"] - 1][1]
            inside = [x for x in aw if t0 - tol <= x[1] < t1]
            script_w = words[seg["i0"]:seg["i1"]]
            latin = [(s, x[0]) for s, x in zip(script_w, inside) if re.search(r"[A-Za-z]", s) and re.search(r"[A-Za-z]", x[0])]
            text_ok = not latin or sum(norm(s) == norm(a) for s, a in latin) * 2 >= len(latin)
            if (len(inside) == seg["i1"] - seg["i0"] and len(inside) > 1 and text_ok
                    and not any(in_pause(x[1]) for x in aw if t0 - tol <= x[1] < t1 + tol)):
                st = [min(max(a, t0), t1) for _, a, _ in inside]
                st[0] = t0
                for i in range(1, len(st)):
                    st[i] = max(st[i], st[i - 1])
                for j, i in enumerate(range(seg["i0"], seg["i1"])):
                    times[i] = [st[j], st[j + 1] if j + 1 < len(st) else t1]
                seg["source"] = "asr"
    for k, p0, p1, kind in assigned:
        notes.append(f"pause {kind} before word {k}")
    return {"words": [{"text": x, "start": a, "end": b} for x, (a, b) in zip(words, times)],
            "segments": segments, "pauses": [{"k": k, "p0": p0, "p1": p1, "kind": kind} for k, p0, p1, kind in assigned],
            "notes": notes}
