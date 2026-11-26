#!/usr/bin/env python3
"""S13 Editor: build timeline.<lang>.json and dialogue-placement.<lang>.json for
the flat2d proof scene from shots.json, frames/, voice/ and sound/, using the
MEASURED voice takes (D-014 rules 2, 6, 7).

    python3 -I content/proof/flat2d/build_timeline.py
    python3 -I content/proof/flat2d/build_subs.py      # then the subtitles

All times are integer frames at 30 fps.

Voice (D-009, brief): per (line_id, lang) the latest eleven_v4 row of
voice/manifest.jsonl wins and voice/<lang>/<line_id>.mp3 is that take (checked
by md5). The eleven_v3 rows are the D-009 A/B comparison takes and are not used.

Measurement (D-014 rule 2): length with ffprobe; silences with ffmpeg
silencedetect (-40 dB, 50 ms), joining silences split by under 30 ms of sound.
Speech runs from the end of the leading silence to the start of the trailing
one. Internal silences of 300 ms or more are pauses (rule 3; build_subs.py
splits cues there).

Picture (rule 6): each language gets its own shot lengths from its own takes.
Lines are spaced speech-to-speech (LEAD after a cut, GAP between turns, TAIL
before the next cut), so shots lengthen when takes run long; speech is never
sped up (no atempo was needed: no line has to fit a fixed cut).
"""
import hashlib
import json
import math
import os
import random
import re
import subprocess
from array import array
from pathlib import Path

FPS = 30
SCENE = Path(__file__).resolve().parent
LANGS = ["hi", "en"]
EDIT = SCENE / "edit"


def F(sec):
    return int(round(sec * FPS))


def ms(frames):
    """Frame -> ms, floored, so a cue ending at frame f is not shown on frame f."""
    return int(math.floor(frames * 1000 / FPS))


def db(x):
    return round(10 ** (x / 20), 4)


def load(p, default=None):
    p = SCENE / p
    if not p.exists():
        return default
    if p.suffix == ".jsonl":
        return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    return json.loads(p.read_text())


def md5(p):
    return hashlib.md5(Path(p).read_bytes()).hexdigest()


def probe_s(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True).stdout.strip()
    return float(out)


def probe_frames(path):
    return int(math.floor(probe_s(path) * FPS))  # floor: never claim audio past the file end


def silences(path, dur):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
                          "silencedetect=noise=-40dB:d=0.05", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([-\d.e]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([-\d.e]+)", err)]
    en += [dur] * (len(st) - len(en))
    out = []
    for a, b in zip(st, en):
        a = max(0.0, a)
        if out and a - out[-1][1] < 0.03:  # a blip under 30 ms is not speech
            out[-1][1] = b
        else:
            out.append([a, b])
    return out


def envelope(path, win=1 / FPS):
    sr = 48000
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True).stdout
    a = array("h")
    a.frombytes(raw[: len(raw) // 2 * 2])
    n = int(round(sr * win))
    env = []
    for i in range(0, len(a) - n + 1, n):
        seg = a[i:i + n]
        r = math.sqrt(sum(x * x for x in seg) / n) / 32768.0
        env.append(20 * math.log10(r) if r > 0 else -120.0)
    return env


def measure(path):
    dur = probe_s(path)
    sil = silences(path, dur)
    s0 = sil[0][1] if sil and sil[0][0] <= 0.001 else 0.0
    s1 = sil[-1][0] if sil and sil[-1][1] >= dur - 0.03 else dur
    pauses = [(a, b) for a, b in sil if a > s0 + 0.001 and b < s1 - 0.001 and b - a >= 0.3]
    return {"file_s": round(dur, 3), "speech_s": [round(s0, 3), round(s1, 3)],
            "pauses_s": [[round(a, 3), round(b, 3)] for a, b in pauses],
            "frames": int(math.floor(dur * FPS)), "sp0": int(math.floor(s0 * FPS)), "sp1": int(math.ceil(s1 * FPS)),
            "pause_frames": [[int(math.ceil(a * FPS)), int(math.floor(b * FPS))] for a, b in pauses]}


class Log(list):
    def append(self, m):
        if m not in self:
            super().append(m)


log = Log()

shots_doc = load("shots.json")
shots = shots_doc["shots"]
takes = load("voice/takes.json", [])
manifest = load("voice/manifest.jsonl", []) or []
cues_doc = load("sound/cues.json")
cues = {c["id"]: c for c in cues_doc["cues"]}
sound_manifest = {r["cue_id"]: r for r in (load("sound/manifest.jsonl", []) or [])}
frames_manifest = load("frames/manifest.jsonl", []) or []

# ---------------------------------------------------------------- voice takes

plan = {(t["line_id"], t["lang"]): t for t in takes if t.get("model") == "eleven_v4"}

# Cut-offs: the line's last syllable is cut by what follows. TRUNC: the stub is
# kept for this many frames from its onset (a stretched "maa" is cut to "ma"),
# written as a short-faded wav under edit/voice/. RUN: frames the speech runs
# past the cut, under what cuts it.
CUTOFF = {"l06": {"shot": "s04", "run": 2, "trunc": 7},   # l07 cuts him off on the s04/s05 cut
          "l11": {"shot": "s07", "run": 2, "trunc": None}}  # first buzz pulse cuts him off on the s07/s08 cut
# Line gains in dB (QC notes in voice/review.json; measured speech RMS in meta).
LINE_DB = {("l01", "hi"): -4.0,   # take 2 dropped [hushed] and came out at Bablu's plain level (-20.5 dB); review: lower it in the mix
           ("l07", "hi"): 4.0, ("l07", "en"): 4.0,  # her loudest line measured no louder than her plain lines
           ("l08", "hi"): 3.0, ("l08", "en"): 5.0,  # whole take sits low (en first half -31.5 dB)
           ("l12", "hi"): 2.0, ("l12", "en"): 2.0}  # ending question over the buzz
# First segment ("बस..." / "Just...") of l04 measured 11 / 15 dB under the rest: lift it so it stays audible.
SEG1_DB = {("l04", "hi"): 5.0, ("l04", "en"): 8.0}


def latest_v4(line_id, lang):
    rows = [r for r in manifest if r.get("line_id") == line_id and r.get("lang") == lang
            and str(r.get("status")).lower() == "ok" and "v4" in str(r.get("model"))]
    return rows[-1] if rows else None


def cut_stub(line_id, lang, src, meas, trunc):
    """Truncate a cut-off line trunc frames after its last syllable onset. Returns (path, end_frame)."""
    env = envelope(src)
    end = meas["sp1"]
    onset = None
    for i in range(min(end, len(env) - 1), 1, -1):
        if env[i] >= -30 and env[i - 1] < -33:
            onset = i
            break
    if onset is None:
        log.append(f"{line_id} {lang}: no last-syllable onset found; not truncated.")
        return src, end
    cut = min(end, onset + trunc)
    out = EDIT / "voice" / lang / f"{line_id}.cut.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    t = cut / FPS
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-t", f"{t:.4f}",
                    "-af", f"afade=t=out:st={t - 0.02:.4f}:d=0.02", "-ar", "44100", "-ac", "1", str(out)], check=True)
    log.append(f"{line_id} {lang}: cut-off stub onset at {onset / FPS:.2f} s in the take; truncated at {t:.2f} s "
               f"(onset + {trunc} frames, 20 ms fade) into {os.path.relpath(out, SCENE)}; the take's speech ran to {end / FPS:.2f} s.")
    return out, cut


lines = {}
for (line_id, lang), t in sorted(plan.items()):
    chosen = SCENE / "voice" / lang / f"{line_id}.mp3"
    row = latest_v4(line_id, lang)
    if not chosen.exists():
        raise SystemExit(f"missing chosen take {chosen}")
    if row is None or md5(SCENE / row["file"]) != md5(chosen):
        log.append(f"{line_id} {lang}: voice/{lang}/{line_id}.mp3 differs from the latest ok v4 manifest row; using the file (brief).")
    rows_all = [r for r in manifest if r.get("line_id") == line_id and r.get("lang") == lang]
    if rows_all and "v3" in str(rows_all[-1].get("model")):
        log.append(f"{line_id} {lang}: the last manifest row is the eleven_v3 A/B take {rows_all[-1]['file']}; "
                   "D-009 keeps v4 (ab.json: tie or v4 win), so the v4 take is used.")
    m = measure(chosen)
    src, sp1 = chosen, m["sp1"]
    if line_id in CUTOFF and CUTOFF[line_id]["trunc"]:
        src, sp1 = cut_stub(line_id, lang, chosen, m, CUTOFF[line_id]["trunc"])
        clip_frames = sp1
    elif line_id in CUTOFF:
        clip_frames = min(m["frames"], sp1 + 1)  # hard stop: no tail after the cut-off syllable
    else:
        clip_frames = m["frames"]
    lines[(line_id, lang)] = dict(file=src, take=chosen, speaker=t["speaker"], meas=m, sp0=m["sp0"], sp1=sp1,
                                  clip_frames=clip_frames, target=t["target_seconds"], take_row=row)

# ---------------------------------------------------------------- spacing

LEAD_DEFAULT = 5        # frames from a cut to the first speech in a shot
LEAD = {"s01": 27,      # torch click (0.0 s) + locker creak (0.4-0.9 s), then l01 (script: silence before l01)
        "s03": 30,      # chai clink + one second on the laddoo before l04 (script b03)
        "s04": 10,      # a beat before the deadpan "laddoo?"
        "s05": 0,       # l07 starts on the cut: Meenu cuts l06 off
        "s06": 8,
        "s07": 21}      # keyring jingle (trimmed cue, peak 0.3-0.6 s) before l09
GAP_DEFAULT = 8         # frames from one speaker's last speech to the next speech in the same shot
GAP = {"l02>l03": 6,    # he answers at once
       "l09>l10": 5,    # she finishes his sentence
       "l10>l11": 6}
TAIL_DEFAULT = 8        # frames after a shot's last speech before the cut
S08_FRAMES = F(2.5)     # silent beat (script b07), kept at its planned length
S09_HOLD = 30           # one beat on her face after l12 (script b08) ...
MID_BUZZ = 9            # ... then the cut to black lands at least this many frames into a buzz pulse
END_BLACK = 12          # black + silence after the last shot
PUNCH_LEAD = 4          # s07 punch-in cut, frames before l10's first speech

FOCUS_PRESETS = {"push-in", "pull-out", "drift"}
MOVE_OVERRIDE = {
    "s06": {"preset": "custom", "easing": "ease-in-out",
            "from": {"scale": 1.27, "x": 1.0, "y": -1.0},
            "to": {"scale": 1.27, "x": 0.5, "y": 1.0}},
}
PUNCH = {"s07": {"line": "l10", "id": "s07-punch",
                 "first_move": {"preset": "push-in", "intensity": 0.5},
                 "move": {"preset": "custom", "easing": "ease-in-out",
                          "from": {"scale": 1.55, "x": 1.0, "y": 0.17},
                          "to": {"scale": 1.6, "x": 1.0, "y": 0.26}}}}
JITTER = {"s08": {"scale": 1.012, "amp": 0.55, "step": 2, "cue": "sfx_s08_phone_buzz", "seed": 8}}


def gap(a, b):
    return GAP.get(f"{a}>{b}", GAP_DEFAULT)


def cue_src(cid):
    return SCENE / "sound" / f"{cid}.mp3"


def pulse_pattern(cid):
    env = envelope(cue_src(cid))
    peak = max(env)
    on = [e >= peak - 10.5 for e in env]  # at or above 30 % of peak RMS amplitude
    return on


BUZZ_ON = pulse_pattern("sfx_s08_phone_buzz")


def buzz_on(rel):
    return BUZZ_ON[rel % len(BUZZ_ON)]


def layout(lang):
    """Per-language picture and dialogue placement."""
    pic, dlg, cursor = [], [], 0
    for s in shots:
        start, ids = cursor, s["line_ids"]
        placed = []
        if s["id"] == "s08":
            dur = S08_FRAMES
        else:
            if s["id"] == "s09":
                buzz0 = next(p["start"] for p in pic if p["shot"]["id"] == "s08")
                f = start
                while buzz_on(f - buzz0):          # wait for the pulse running at the cut to end
                    f += 1
                lead = f + 1 - start               # first speech one frame into the gap
            else:
                lead = LEAD.get(s["id"], LEAD_DEFAULT)
            t = start + lead
            for i, lid in enumerate(ids):
                L = lines[(lid, lang)]
                if i:
                    t = placed[-1]["sp1"] + gap(ids[i - 1], lid)
                clip = t - L["sp0"]
                placed.append(dict(line_id=lid, shot=s["id"], L=L, clip=clip, sp0=t, sp1=clip + L["sp1"]))
            last = placed[-1]
            if last["line_id"] in CUTOFF and CUTOFF[last["line_id"]]["shot"] == s["id"]:
                end = last["sp1"] - CUTOFF[last["line_id"]]["run"]
            elif s["id"] == "s09":
                end = last["sp1"] + S09_HOLD
                buzz0 = next(p["start"] for p in pic if p["shot"]["id"] == "s08")
                while not all(buzz_on(end - k - buzz0) for k in range(0, MID_BUZZ + 1)):
                    end += 1
            else:
                end = last["sp1"] + TAIL_DEFAULT
            dur = end - start
        pic.append(dict(shot=s, start=start, duration=dur))
        dlg += placed
        cursor = start + dur
    return pic, dlg, cursor


# ---------------------------------------------------------------- sound

def vol(cid, extra_db=0.0):
    return db(cues[cid]["gain_db"] + extra_db)


XF = 4


def bed(cid, start, end, segments=(), fade_in=0, fade_out=1, base_db=None):
    """Looped bed from start to end with gain segments [(t0, t1, extra_db)], crossfaded over XF frames."""
    L = probe_frames(cue_src(cid))
    cuts = sorted({start, end, *[max(start, min(end, x)) for a, b, _ in segments for x in (a, b)]})
    merged = []
    for a, b in zip(cuts, cuts[1:]):
        if b <= a:
            continue
        g = 0.0
        for s0, s1, extra in segments:
            if s0 <= a and b <= s1:
                g = extra
        if merged and merged[-1][2] == g:
            merged[-1][1] = b
        else:
            merged.append([a, b, g])
    clips = []
    for a, b, g in merged:
        a2 = a
        while a2 < b:
            o = (a2 - start) % L
            seg_end = min(b, a2 + (L - o))
            clips.append(dict(a=a2, b=seg_end, trim=o, g=g, wrap=(seg_end < b)))
            a2 = seg_end
    base = cues[cid]["gain_db"] if base_db is None else base_db
    out = []
    for k, c in enumerate(clips):
        nxt = clips[k + 1] if k + 1 < len(clips) else None
        prv = clips[k - 1] if k else None
        dur = c["b"] - c["a"]
        clip = {"id": f"{cid}#{k}" if len(clips) > 1 else cid, "src": f"sound/{cid}.mp3",
                "start": c["a"], "duration": dur, "volume": db(base + c["g"])}
        if c["trim"]:
            clip["trimBefore"] = c["trim"]
        fi = fade_in if prv is None else (0 if prv["wrap"] else XF)
        fo = fade_out if nxt is None else 0
        if nxt is not None and not c["wrap"] and c["trim"] + dur + XF <= L:
            clip["duration"] = dur + XF
            fo = XF
        if fi:
            clip["fadeIn"] = fi
        if fo:
            clip["fadeOut"] = fo
        out.append(clip)
    return out


def point(cid, start, end_cap, trim=0, dur=None, extra_db=0.0, fade_in=0, fade_out=0, suffix=""):
    L = probe_frames(cue_src(cid)) - trim
    d = min(L if dur is None else dur, end_cap - start)
    if d <= 0:
        log.append(f"{cid}: no room at frame {start} (dropped).")
        return []
    c = {"id": cid + suffix, "src": f"sound/{cid}.mp3", "start": start, "duration": d, "volume": vol(cid, extra_db)}
    if trim:
        c["trimBefore"] = trim
    if fade_in:
        c["fadeIn"] = fade_in
    if fade_out:
        c["fadeOut"] = fade_out
    return [c]


# Levels relative to the cue sheet (sound/manifest.jsonl QC notes).
KEYRING_DB = 15.0     # QC: needs +12 to +15 dB; it plays alone over room tone, so the top of the range
STING_DB = 15.0       # QC: needs +12 to +15 dB; it lands on the first buzz pulse, so the top of the range
AMB_DB = -5.0         # file mean -44.6 dB; the sheet's -24 dB would put it ~48 dB under dialogue. -5 dB: ~28 dB under.
AMB_BUZZ_DROP = cues["amb_malkhana_night"]["automation"][0]["gain_db"] - cues["amb_malkhana_night"]["gain_db"]  # -10
BUZZ_DB = -8.0        # sheet -6; pulses measure -9 dB RMS in the file, so -8 puts them ~4 dB over dialogue speech
BUZZ_UNDER_L12 = -20.0  # sheet -12 left the pulse within ~1 dB of l12; -20 gives ~10 dB
# Music, option (b) of the sound QC note: the motif (file 0-20 s, 2.5 s bars:
# RMS peaks every 2.5 s, 96 BPM 4/4 per the prompt; not listened to) runs from
# the s02 cut to the s06 cut, ending on a bar line; then the file's quiet held
# layer (24.0-29.7 s, -45 to -48 dB) runs from the s06 cut to the hard stop on
# the first buzz, looped with crossfades because the retimed s06+s07 is longer
# than the layer.
MUSIC_DB = cues["mus_caper_bed"]["gain_db"]   # -18
BAR = F(2.5)
MOTIF_END = F(20.0)
HELD_A, HELD_B = F(24.0), F(29.7)
HELD_DB = 14.0        # the held layer is ~24 dB under the motif in the file; +14 dB keeps it quiet but audible
HELD_XF = 15


def sound_for(P, D, END):
    music, sfx = [], []
    s02, s06, stop = P["s02"]["start"], P["s06"]["start"], P["s08"]["start"]
    T = s06 - s02
    k = math.ceil(T / BAR)
    if k * BAR <= MOTIF_END:
        trim, m_start = k * BAR - T, s02
    else:  # the motif cannot cover s02-s06 on a bar line: enter late instead
        k = MOTIF_END // BAR
        trim, m_start = 0, s06 - k * BAR
    motif = {"id": "mus_caper_bed#motif", "src": "sound/mus_caper_bed.mp3", "start": m_start, "duration": s06 - m_start,
             "volume": db(MUSIC_DB), "fadeIn": 12 if trim else 4, "fadeOut": 6, "duck": True}
    if trim:
        motif["trimBefore"] = trim
    music.append(motif)
    log.append(f"{LANG}: music: motif enters on the s02 cut {trim / FPS:.2f} s into the file so that the s06 cut falls on the "
               f"file's bar line at {(trim + s06 - m_start) / FPS:.1f} s; it fades over the last 6 frames before the cut.")
    held_len = HELD_B - HELD_A
    t, n = s06, 0
    while t < stop:
        d = min(held_len, stop - t)
        last = t + d >= stop
        music.append({"id": f"mus_caper_bed#held{n}", "src": "sound/mus_caper_bed.mp3", "start": t, "duration": d,
                      "trimBefore": HELD_A, "volume": db(MUSIC_DB + HELD_DB), "fadeIn": 12 if n == 0 else HELD_XF,
                      "fadeOut": 1 if last else HELD_XF, "duck": True})
        n += 1
        t += held_len - HELD_XF
    log.append(f"{LANG}: music: held layer (file {HELD_A / FPS:.1f}-{HELD_B / FPS:.1f} s, +{HELD_DB:.0f} dB) from the s06 cut to the "
               f"s08 cut in {n} crossfaded pieces ({(stop - s06) / FPS:.2f} s); hard stop on the first buzz.")

    sfx += bed("amb_malkhana_night", 0, END, segments=[(stop, END, AMB_BUZZ_DROP)], fade_in=2, fade_out=1,
               base_db=AMB_DB)
    # s01: click (file 0-0.35 s) then the locker creak (file 1.1-2.0 s) pulled up to 0.3 s, so both sit before l01
    sfx += point("sfx_s01_torch_locker", 0, end_cap=9, dur=9, extra_db=8.0, suffix="#click")
    sfx += point("sfx_s01_torch_locker", 9, end_cap=D["l01"]["sp0"] + 6, trim=F(1.1), fade_out=6, suffix="#creak")
    sfx += point("sfx_s03_chai_clink", P["s03"]["start"], end_cap=D["l04"]["sp0"])
    sfx += point("sfx_s05_breath_torch", P["s05"]["start"], end_cap=P["s06"]["start"])
    sfx += point("sfx_s06_padlock", P["s06"]["start"], end_cap=P["s07"]["start"])
    sfx += point("sfx_s07_keyring", P["s07"]["start"], end_cap=D["l09"]["sp0"] + 8, trim=F(1.1),
                 extra_db=KEYRING_DB, fade_in=3, fade_out=6)
    sfx += point("mus_stop_sting", stop, end_cap=END, extra_db=STING_DB)
    l12 = D["l12"]
    sfx += bed("sfx_s08_phone_buzz", stop, END, segments=[(l12["sp0"] - 4, l12["sp1"] + 4, BUZZ_UNDER_L12)],
               fade_in=0, fade_out=1, base_db=BUZZ_DB)
    return music, sfx


# ---------------------------------------------------------------- picture helpers

def jitter_shots(base, cfg, buzz_start):
    on = BUZZ_ON
    rng = random.Random(cfg["seed"])
    s, amp, step = cfg["scale"], cfg["amp"], cfg["step"]

    def key(x=0.0, y=0.0):
        return {"scale": s, "x": round(x, 3), "y": round(y, 3)}

    def jolt(j):
        sx = 1 if j % 2 == 0 else -1
        return key(sx * amp * rng.uniform(0.5, 1.0), amp * rng.uniform(-0.6, 0.6))

    visual = {k: v for k, v in base.items() if k in ("image", "layers")}
    out, k, n, j = [], 0, base["duration"], 0
    while k < n:
        f = base["start"] + k
        buzzing = on[(f - buzz_start) % len(on)]
        if buzzing:
            length = 1
            while length < step and k + length < n and on[(f + length - buzz_start) % len(on)]:
                length += 1
            frm, nxt = jolt(j), jolt(j + 1)
            j += 2
            mv = {"preset": "custom", "easing": "linear", "from": frm, "to": nxt}
        else:
            length = 1
            while k + length < n and not on[(f + length - buzz_start) % len(on)]:
                length += 1
            mv = {"preset": "custom", "from": key(), "to": key()}
        sid = base["id"] if not out else f"{base['id']}-j{len(out):02d}"
        out.append({"id": sid, "start": f, "duration": length, **visual, "move": mv,
                    **({"subshot_of": base["id"]} if out else {})})
        k += length
    return out


def note_lang(n):
    """Language a log note belongs to ("hi: ..." or "l06 hi: ..."), or None for both."""
    m = re.match(r"^(?:l\d\d )?(hi|en)[: ]", n)
    return m.group(1) if m else None


frame_status = {}
for r in frames_manifest:
    frame_status[r["shot_id"]] = r

summary = {}
for lang in LANGS:
    LANG = lang
    pic, dlg, END = layout(lang)
    TOTAL = END + END_BLACK
    P = {p["shot"]["id"]: p for p in pic}
    D = {d["line_id"]: d for d in dlg}
    for d in dlg:  # no speech past its shot except the deliberate cut-offs
        limit = P[d["shot"]]["start"] + P[d["shot"]]["duration"] + (CUTOFF[d["line_id"]]["run"] if d["line_id"] in CUTOFF else 0)
        assert d["sp1"] <= limit, (lang, d["line_id"], d["sp1"], limit)
        assert d["clip"] >= 0, (lang, d["line_id"])
    for a, b in zip(dlg, dlg[1:]):  # speech never overlaps except a cut-off running under what cuts it
        ov = a["sp1"] - b["sp0"]
        assert ov <= (CUTOFF[a["line_id"]]["run"] if a["line_id"] in CUTOFF else 0), (lang, a["line_id"], b["line_id"], ov)

    # punch-in cut inside s07
    punch_at = {}
    for sid, cfg in PUNCH.items():
        at = D[cfg["line"]]["sp0"] - PUNCH_LEAD
        lo, hi_ = P[sid]["start"] + 30, P[sid]["start"] + P[sid]["duration"] - 30
        if lo <= at <= hi_:
            punch_at[sid] = at
        else:
            log.append(f"{lang} {sid}: punch-in at frame {at} would leave a part under 1 s; not cut.")

    tl_shots, cuts = [], []
    for p in pic:
        s = p["shot"]
        shot = {"id": s["id"], "start": p["start"], "duration": p["duration"]}
        fm = frame_status.get(s["id"], {})
        img = SCENE / "frames" / f"{s['id']}.png"
        if not img.exists() or fm.get("status") not in (None, "ok"):
            shot.update(type="slate", note=f"frame missing or rejected: {s['action'][:80]}")
        elif s["id"] == "s08" and (SCENE / f"frames/s08-name.{lang}.png").exists():
            shot["layers"] = [{"src": "frames/s08.png", "depth": 1}, {"src": f"frames/s08-name.{lang}.png", "depth": 1}]
        else:
            shot["image"] = f"frames/{s['id']}.png"
        mv = {"preset": s["camera_move"]}
        if s["camera_move"] != "hold":
            mv["intensity"] = s["intensity"]
            if s.get("camera_focus") and s["camera_move"] in FOCUS_PRESETS:
                mv["focus"] = s["camera_focus"]
        if s["id"] in MOVE_OVERRIDE:
            mv = json.loads(json.dumps(MOVE_OVERRIDE[s["id"]]))
        shot["move"] = mv
        cuts.append(p["start"])
        if s["id"] in punch_at:
            cfg, at = PUNCH[s["id"]], punch_at[s["id"]]
            first = dict(shot, duration=at - p["start"])
            fm_ = dict(cfg["first_move"])
            if s.get("camera_focus"):
                fm_["focus"] = s["camera_focus"]
            first["move"] = fm_
            second = {"id": cfg["id"], "start": at, "duration": p["start"] + p["duration"] - at,
                      **{k: v for k, v in shot.items() if k in ("image", "layers")},
                      "move": json.loads(json.dumps(cfg["move"])), "subshot_of": s["id"]}
            tl_shots += [first, second]
            cuts.append(at)
        elif s["id"] in JITTER and mv["preset"] == "hold":
            tl_shots += jitter_shots(shot, JITTER[s["id"]], buzz_start=P["s08"]["start"])
        else:
            tl_shots.append(shot)
    cuts.append(END)  # cut to black

    music, sfx = sound_for(P, D, END)

    dialogue = []
    for d in dlg:
        L, key = d["L"], (d["line_id"], lang)
        g = LINE_DB.get(key, 0.0)
        src = os.path.relpath(L["file"], SCENE)
        if key in SEG1_DB and L["meas"]["pause_frames"]:
            a, b = L["meas"]["pause_frames"][0]
            mid = (a + b) // 2
            dialogue.append({"id": f"{d['line_id']}#a", "src": src, "start": d["clip"], "duration": mid,
                             "volume": db(g + SEG1_DB[key])})
            dialogue.append({"id": f"{d['line_id']}#b", "src": src, "start": d["clip"] + mid, "trimBefore": mid,
                             "duration": L["clip_frames"] - mid, "volume": db(g)})
        else:
            dialogue.append({"id": d["line_id"], "src": src, "start": d["clip"], "duration": L["clip_frames"],
                             "volume": db(g)})

    timeline = {
        "id": f"{shots_doc['id']}-{lang}",
        "fps": FPS,
        "durationFrames": TOTAL,
        "background": "#000",
        "slateColor": "#1b2440",
        "shots": tl_shots,
        "audio": {
            "dialogue": dialogue,
            "music": music,
            "sfx": sfx,
            "ducking": {"enabled": True, "amountDb": cues_doc["mix"]["music_duck_under_dialogue_db"],
                        "attack": 8, "release": 15, "holdGap": 20},
        },
        "subtitlesFile": f"subs.{lang}.json",
        "debug": {"burnSubtitles": False, "showInfo": False},
        "meta": {
            "built_by": "S13 Editor, content/proof/flat2d/build_timeline.py (measured takes, D-014)",
            "lang": lang,
            "picture_seconds": round(END / FPS, 3),
            "total_seconds": round(TOTAL / FPS, 3),
            "planned_seconds": shots_doc["total_duration_s"],
            "picture_cuts": cuts,
            "shot_frames": {p["shot"]["id"]: [p["start"], p["duration"]] for p in pic},
            "end": f"hard cut to black and silence at frame {END}, {MID_BUZZ}+ frames into a buzz pulse; {END_BLACK} black frames after",
            "placeholders": {"dialogue": [], "frames_slated": [s["id"] for s in tl_shots if s.get("type") == "slate"],
                             "sound": sorted(k for k, r in sound_manifest.items() if r.get("placeholder"))},
            "lines": {d["line_id"]: {"take": os.path.relpath(d["L"]["take"], SCENE),
                                     "file": os.path.relpath(d["L"]["file"], SCENE),
                                     "file_s": d["L"]["meas"]["file_s"], "speech_s": d["L"]["meas"]["speech_s"],
                                     "pauses_s": d["L"]["meas"]["pauses_s"], "target_s": d["L"]["target"],
                                     "speech_frames": [d["sp0"], d["sp1"]], "gain_db": LINE_DB.get((d["line_id"], lang), 0.0)}
                      for d in dlg},
            "mix": {"dialogue": "1.0 (0 dB) except LINE_DB/SEG1_DB in build_timeline.py",
                    "music_motif_db": MUSIC_DB, "music_held_db": MUSIC_DB + HELD_DB,
                    "music_duck_db": cues_doc["mix"]["music_duck_under_dialogue_db"],
                    "ambience_db": AMB_DB, "ambience_from_buzz_db": AMB_DB + AMB_BUZZ_DROP,
                    "buzz_db": BUZZ_DB, "buzz_under_l12_db": BUZZ_DB + BUZZ_UNDER_L12,
                    "keyring_db": cues["sfx_s07_keyring"]["gain_db"] + KEYRING_DB,
                    "sting_db": cues["mus_stop_sting"]["gain_db"] + STING_DB,
                    "phone_filter": "not used: no line in this scene is heard through a phone (the phone only buzzes)",
                    "atempo": "not used: shots lengthen to the measured takes",
                    "master": "production/scripts/master-audio.sh, -14 LUFS integrated, -1 dBTP"},
            "notes": [n for n in log if note_lang(n) in (None, lang)],
        },
    }
    (SCENE / f"timeline.{lang}.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1) + "\n")
    placement = []
    for d in dlg:
        L = d["L"]
        segs, a = [], d["sp0"]
        for p0, p1 in L["meas"]["pause_frames"]:
            if d["clip"] + p0 < d["sp1"]:
                segs.append([a, d["clip"] + p0])
                a = d["clip"] + p1
        segs.append([a, d["sp1"]])
        placement.append({"line_id": d["line_id"], "speaker": L["speaker"], "shot": d["shot"],
                          "startMs": ms(d["clip"]), "endMs": ms(d["clip"] + L["clip_frames"]),
                          "clipFrames": [d["clip"], d["clip"] + L["clip_frames"]],
                          "speechFrames": [d["sp0"], d["sp1"]], "segmentsFrames": segs,
                          "cutoff": d["line_id"] in CUTOFF,
                          "file": os.path.relpath(L["file"], SCENE), "take": os.path.relpath(L["take"], SCENE),
                          "placeholder": False})
    (SCENE / f"dialogue-placement.{lang}.json").write_text(json.dumps(placement, ensure_ascii=False, indent=1) + "\n")
    summary[lang] = (TOTAL, pic)
    print(f"{lang}: {len(tl_shots)} shots, {len(dialogue)} dialogue clips, {len(music)} music, {len(sfx)} sfx, "
          f"{TOTAL} frames = {TOTAL / FPS:.2f} s (picture {END / FPS:.2f} s)")
    print("   ", " ".join(f"{p['shot']['id']}:{p['duration']}({F(p['shot']['duration_s'])})" for p in pic))
for n in log:
    print("NOTE", n)
