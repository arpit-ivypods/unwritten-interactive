#!/usr/bin/env python3
"""S13 Editor: build timeline.<lang>.json and dialogue-placement.<lang>.json
for this scene from shots.json, frames/, voice/ and sound/.

    python3 -I content/proof/photoreal/build_timeline.py

All times are integer frames at 30 fps.

Voice take per line and language (voice/manifest.jsonl, voice/review.json):
  1. rows for (line_id, lang) with status ok, model eleven_v4 (D-0M2: v4 stays;
     the eleven_v3 rows are D-009 A/B takes and are never cut in);
  2. a reviewed take whose verdict is reject/fail is dropped; one marked
     'retake' is dropped when a later ok take of that line exists (review.json
     rows carry no take number: they reviewed take 1);
  3. the latest remaining take wins. A take-2 row is voice/<lang>/<id>_t2.mp3,
     which must be byte-identical to voice/<lang>/<id>.mp3 (the chosen take);
  4. review.json trim_in_s, when given for the chosen take, becomes trimBefore.
No ok take -> a silent placeholder of target_seconds (plan 7.8).

Measurement (D-014 rules 2-6): ffprobe length, ffmpeg silencedetect at -40 dB
for first and last speech and internal pauses >= 300 ms. Lines are laid out on
their speech, not on the clip edges: leads, gaps and tails below are measured
from speech. Each language gets its own shot lengths from its own takes (rule
6). Speech is never sped up; shots are lengthened or shortened instead.

Caller lines get the phone filter (sound/cues.json mix.caller_voice_fx):
band-pass 300-3400 Hz, light tanh saturation, loudness matched to the clean
take, written as WAV to voice/phonefx/<lang>/<id>.wav.
"""
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

FPS = 30
SCENE = Path(__file__).resolve().parent
sys.path.insert(0, str(SCENE))
from wordtime import glen, word_times  # noqa: E402

LANGS = ["hi", "en"]
SIL_DB = -40
PAUSE_MIN = 0.3
WHISPER = shutil.which("whisper-cli")
WHISPER_MODEL = Path.home() / ".whisper-models" / "ggml-small.bin"


def F(sec):
    return int(round(sec * FPS))


def ms(frames):
    return int(round(frames * 1000 / FPS))


def load(p, default=None):
    p = SCENE / p
    if not p.exists():
        return default
    if p.suffix == ".jsonl":
        return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    return json.loads(p.read_text())


def run(args):
    return subprocess.run(args, capture_output=True, text=True)


def probe_s(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return None


def probe_frames(path):
    d = probe_s(path)
    return None if d is None else int(math.floor(d * FPS))  # floor: never claim audio past the file end


def silences(path, db=SIL_DB, d=0.05):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", f"silencedetect=n={db}dB:d={d}",
               "-f", "null", "-"]).stderr
    out, cur = [], None
    for m in re.finditer(r"silence_(start|end): (-?[0-9.]+)", err):
        if m.group(1) == "start":
            cur = float(m.group(2))
        elif cur is not None:
            out.append((max(0.0, cur), float(m.group(2))))
            cur = None
    if cur is not None:
        out.append((cur, probe_s(path)))
    return out


def lufs(path):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"]).stderr
    m = re.findall(r"I:\s+(-?[0-9.]+) LUFS", err)
    return float(m[-1]) if m else None


def md5(p):
    return hashlib.md5(Path(p).read_bytes()).hexdigest()


class Log(list):
    def append(self, m):
        if m not in self:
            super().append(m)


log = Log()

shots_doc = load("shots.json")
shots = shots_doc["shots"]
takes = load("voice/takes.json", [])
manifest = load("voice/manifest.jsonl", None)
review = load("voice/review.json", []) or []
cues_doc = load("sound/cues.json")
cues = {c["id"]: c for c in cues_doc["cues"]}
sound_manifest = {r["cue_id"]: r for r in (load("sound/manifest.jsonl", []) or [])}
frames_manifest = load("frames/manifest.jsonl", []) or []
frame_review = load("frames/review.json", []) or []
scripts = {lg: {l["id"]: l for b in load(f"script.{lg}.json")["beats"] for l in b["lines"]} for lg in LANGS}

if manifest is None:
    log.append("voice/manifest.jsonl does not exist: no voice takes.")

# ---------------------------------------------------------------- voice takes

plan = {(t["line_id"], t["lang"]): t for t in takes if t.get("model") == "eleven_v4"}


def is_v4(r):
    return "v4" in str(r.get("model", "")) and not r.get("take_suffix") and not r.get("role")


def resolve(f):
    p = Path(f)
    if not p.is_absolute():
        p = SCENE.parents[2] / p if str(f).startswith("content/") else SCENE / p
    return p


def pick_take(line_id, lang):
    rows = [r for r in (manifest or []) if r.get("line_id") == line_id and r.get("lang") == lang
            and is_v4(r) and str(r.get("status", "")).lower() == "ok" and r.get("file") and resolve(r["file"]).exists()]
    for r in rows:
        r.setdefault("take", 1)
    revs = [v for v in review if v.get("line_id") == line_id and v.get("lang") == lang and is_v4(v)]
    verdict = {}
    for v in revs:
        verdict[v.get("take", 1)] = v
    keep = []
    for r in rows:
        v = verdict.get(r["take"])
        vd = str(v.get("verdict", "")).lower() if v else ""
        later = any(x["take"] > r["take"] for x in rows)
        if vd in ("reject", "rejected", "fail", "bad"):
            continue
        if vd == "retake" and later:
            continue
        keep.append(r)
    if not keep:
        return None
    r = keep[-1]  # latest take wins
    p = resolve(r["file"])
    v = verdict.get(r["take"])
    chosen = SCENE / "voice" / lang / f"{line_id}.mp3"
    why = f"take {r['take']} ({p.name})"
    if r["take"] > 1:
        assert chosen.exists() and md5(chosen) == md5(p), (line_id, lang, "chosen file is not the _t2")
        why += f", identical to {chosen.name}"
    if v and str(v.get("verdict")).lower() == "retake":
        why += "; review asked for a retake but none exists, so this take stands (ear check pending)"
        log.append(f"{lang} {line_id}: review verdict 'retake' with no later take; cut in take {r['take']}: {v.get('reason', '')[:160]}")
    trim = float(v.get("trim_in_s") or 0) if v else 0.0
    if trim:
        why += f"; head trimmed to {trim:.2f} s (review trim_in_s)"
    return {"path": p, "model": r.get("model"), "take": r["take"], "why": why, "trim": trim}


def placeholder_file(line_id, lang, seconds):
    p = SCENE / "voice" / "placeholder" / lang / f"{line_id}.mp3"
    want = F(seconds)
    if not p.exists() or probe_frames(p) != want:
        p.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                        "-t", f"{want / FPS:.4f}", "-c:a", "libmp3lame", "-b:a", "64k", str(p)], check=True)
    return p


PHONE_CHAIN = ("highpass=f=300:poles=2,highpass=f=300:poles=2,lowpass=f=3400:poles=2,lowpass=f=3400:poles=2,"
               "volume=6dB,asoftclip=type=tanh,volume=-6dB")


def phone_fx(src, lang, line_id):
    """Caller voice through the phone: band-pass 300-3400 Hz (two 2-pole stages
    each side), light tanh saturation, then gain so the filtered take has the
    clean take's integrated loudness. WAV, so no second lossy generation."""
    out = SCENE / "voice" / "phonefx" / lang / f"{line_id}.wav"
    stamp = out.with_suffix(".src")
    key = f"{md5(src)} {PHONE_CHAIN}"
    if out.exists() and stamp.exists() and stamp.read_text() == key:
        return out
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".tmp.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", PHONE_CHAIN, "-ar", "48000",
                    "-c:a", "pcm_s16le", str(tmp)], check=True)
    gain = round(lufs(src) - lufs(tmp), 2)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af",
                    f"{PHONE_CHAIN},volume={gain}dB,alimiter=limit=0.89:level=false", "-ar", "48000",
                    "-c:a", "pcm_s16le", str(out)], check=True)
    tmp.unlink()
    stamp.write_text(key)
    log.append(f"phone filter on {lang} {line_id}: +{gain} dB make-up to the clean take's loudness")
    return out


def asr_words(src, lang, line_id, trim):
    """Local whisper.cpp word stamps (seconds, relative to the trimmed start), cached by file hash."""
    if not WHISPER or not WHISPER_MODEL.exists():
        log.append("whisper-cli or ggml-small.bin missing: no transcription timings (rule 4 everywhere).")
        return None
    cache = SCENE / "voice" / "asr" / lang / f"{line_id}.{md5(src)[:10]}.json"
    if not cache.exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        wav = cache.with_suffix(".wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(wav)], check=True)
        run([WHISPER, "-m", str(WHISPER_MODEL), "-l", lang, "-ml", "1", "-sow", "-oj", "-of",
             str(cache.with_suffix("")), "-f", str(wav), "-np"])
        wav.unlink()
    if not cache.exists():
        return None
    d = json.loads(cache.read_text())
    return [(s["text"].strip(), s["offsets"]["from"] / 1000 - trim, s["offsets"]["to"] / 1000 - trim)
            for s in d.get("transcription", [])]


def measure(src, trim):
    dur = probe_s(src)
    T = dur - trim
    sil = [(max(a, trim) - trim, b - trim) for a, b in silences(src) if b > trim + 0.005]
    a_s, b_s = 0.0, T
    if sil and sil[0][0] <= 0.005:
        a_s = sil[0][1]
    if sil and sil[-1][1] >= T - 0.005:
        b_s = sil[-1][0]
    pauses = [(a, b) for a, b in sil if a > a_s + 0.005 and b < b_s - 0.005 and b - a >= PAUSE_MIN - 1e-6]
    return dict(T_s=T, a_s=a_s, b_s=b_s, pauses_s=pauses)


lines = {}
for lang in LANGS:
    for (line_id, l), t in sorted(plan.items()):
        if l != lang:
            continue
        raw = scripts[lang][line_id]["text"]
        pick = pick_take(line_id, lang)
        if pick:
            src = pick["path"]
            m = measure(src, pick["trim"])
            asr = asr_words(src, lang, line_id, pick["trim"])
            play = phone_fx(src, lang, line_id) if t["speaker"] == "caller" else src
            T = int(math.floor(m["T_s"] * FPS))
            if play != src:
                T = min(T, int(math.floor((probe_s(play) - pick["trim"]) * FPS)))
            a, b = int(math.floor(m["a_s"] * FPS)), min(T, int(math.ceil(m["b_s"] * FPS)))
            wt = word_times(raw, m["a_s"] * FPS, m["b_s"] * FPS, [(p * FPS, q * FPS) for p, q in m["pauses_s"]],
                            [(x, p * FPS, q * FPS) for x, p, q in asr] if asr else None)
            lines[(line_id, lang)] = dict(file=play, source=src, T=T, a=a, b=b, trim=F(pick["trim"]), wt=wt,
                                          meas=m, speaker=t["speaker"], placeholder=False, model=pick["model"],
                                          why=pick["why"], target=t["target_seconds"])
        else:
            src = placeholder_file(line_id, lang, t["target_seconds"])
            n = F(t["target_seconds"])
            lines[(line_id, lang)] = dict(file=src, source=src, T=n, a=0, b=n, trim=0,
                                          wt=word_times(raw, 0, n), meas=None, speaker=t["speaker"],
                                          placeholder=True, model=None, target=t["target_seconds"],
                                          why=f"no ok take; silent placeholder of target {t['target_seconds']} s")

# ---------------------------------------------------------------- picture, per language

# All spacing is measured from speech (first/last non-silent sample), not from clip edges.
FIRST_LEAD = 4          # frames before the very first speech
GAP_DEFAULT = 8         # frames from one line's last speech to the next line's first, same shot
GAP = {}
TAIL_DEFAULT = 4        # frames from the last speech to the cut
TAIL = {"s03": 6, "s06": 6, "s09": 12}  # s03: key click falls after l04; s06: beeps start under it; s09: hold on her face
LEAD_MIN = {"s04": 4, "s08": 18}  # s04: room for the key click; s08: CLUNK exposed 0.6 s before l09
CUTOFF_OVERLAP = 3      # l06's last speech runs this many frames past the s04/s05 cut, under l07
END_BLACK = 12          # black and silence after the last shot (hard cut)
CUTOFF = ("s04", "l06", "s05", "l07")  # cut lands on the first speech of l07; l07 talks over l06
CUT_ON_WORD = {"l08": ("s05", "s06", {"hi": "driver", "en": "driver"})}
MIN_CUE_F = 24          # 800 ms: the last line of a shot gets at least this much picture after its last segment starts
BEEPS_LAST_ONSET = F(1.33)  # sfx_s06_call_end: third beep starts 1.33 s into the 1.6 s file (silencedetect)
DEAD_EXPOSE = F(0.6)    # dead-line tone heard alone before the CLUNK
MOVE_OVERRIDE = {"s07": {"preset": "push-in", "intensity": 0.1, "easing": "linear", "focus": {"x": 0.40, "y": 0.19}}}


def gap(a, b):
    return GAP.get(f"{a}>{b}", GAP_DEFAULT)


def word_onset(line_id, lang):
    """Frames from clip start to the onset of the cut word (wordtime.py: ASR where the
    segment's word count matches, else grapheme spread inside the measured segment)."""
    L = lines[(line_id, lang)]
    word = CUT_ON_WORD[line_id][2][lang]
    ws = L["wt"]["words"]
    i = next(k for k, w in enumerate(ws) if w["text"].lower().strip(".,!?…") == word)
    seg = next(s for s in L["wt"]["segments"] if s["i0"] <= i < s["i1"])
    return int(round(ws[i]["start"])), seg["source"]


def last_segment_len(L):
    ws, seg = L["wt"]["words"], L["wt"]["segments"][-1]
    return L["b"] - int(math.floor(ws[seg["i0"]]["start"]))


def layout(lang):
    D = {}
    pic = []
    cursor = 0
    carried = None

    def put(lid, speech_start):
        L = lines[(lid, lang)]
        cs = speech_start - L["a"]
        D[lid] = dict(clip_start=cs, speech_start=speech_start, speech_end=cs + L["b"], shot=None)
        return D[lid]

    for idx, s in enumerate(shots):
        sid, start, ids = s["id"], cursor, s["line_ids"]
        lead = max(F(s.get("silent_lead_s", 0)), LEAD_MIN.get(sid, 0))
        if idx == 0:
            lead = max(lead, FIRST_LEAD, *(lines[(l, lang)]["a"] for l in ids[:1]))
        if sid == CUTOFF[2]:
            lead = 0
        t, prev = None, None
        todo = [l for l in ids if l != carried]
        if carried and carried in ids:
            t, prev = D[carried]["speech_end"], carried
        for lid in todo:
            put(lid, start + lead if t is None else t + gap(prev, lid))["shot"] = sid
            t, prev = D[lid]["speech_end"], lid
        cow = [l for l, (p, _, _) in CUT_ON_WORD.items() if p == sid]
        if cow:
            lid = cow[0]
            d = put(lid, start + lead if t is None else t + gap(prev, lid))
            d["shot"] = CUT_ON_WORD[lid][1]
            onset, src = word_onset(lid, lang)
            end = d["clip_start"] + onset
            log.append(f"{lang}: s05/s06 cut on '{CUT_ON_WORD[lid][2][lang]}' at {onset} frames into {lid} ({src})")
            carried = lid
        elif sid == CUTOFF[0]:
            # cut CUTOFF_OVERLAP frames before l06's last speech, but no earlier than its
            # clamped last cue needs to stay at or under 17 graphemes a second (build_subs.py)
            L06 = lines[(CUTOFF[1], lang)]
            seg = L06["wt"]["segments"][-1]
            seg_start = D[CUTOFF[1]]["clip_start"] + int(math.floor(L06["wt"]["words"][seg["i0"]]["start"]))
            seg_text = " ".join(w["text"] for w in L06["wt"]["words"][seg["i0"]:seg["i1"]])
            read = seg_start + math.ceil(glen(seg_text) * FPS / 17)
            end = min(D[CUTOFF[1]]["speech_end"], max(D[CUTOFF[1]]["speech_end"] - CUTOFF_OVERLAP, read))
            if end != D[CUTOFF[1]]["speech_end"] - CUTOFF_OVERLAP:
                log.append(f"{lang}: s04/s05 cut moved to {D[CUTOFF[1]]['speech_end'] - end} frames before l06's last speech so its cue reads at <= 17 cps")
        elif not ids:
            # silent shot after the call: beeps from the end of l08, then the dead line alone
            planned = F(s["duration_s"])
            beeps = D["l08"]["speech_end"]
            end = max(start + planned, beeps + BEEPS_LAST_ONSET + DEAD_EXPOSE)
        else:
            tail = max(TAIL.get(sid, TAIL_DEFAULT), MIN_CUE_F - last_segment_len(lines[(prev, lang)]))
            end = t + tail
        pic.append(dict(shot=s, start=start, duration=end - start))
        cursor = end
    return pic, D


# ---------------------------------------------------------------- sound


def cue_src(cid):
    return SCENE / "sound" / f"{cid}.mp3"


def vol(cid, extra_db=0.0):
    return round(10 ** ((cues[cid]["gain_db"] + extra_db) / 20), 4)


def file_frames(cid):
    return probe_frames(cue_src(cid))


XF = 4
RING_DUCK_DB = -18.0
CLUNK_FADE = 6
DRONE_TRIM = F(2.0)   # mus_drone_bed fades in over its first ~4 s (sound QC); start 2.0 s in so it is heard from the ring


def build_sound(pic, D, END):
    P = {p["shot"]["id"]: p for p in pic}
    sstart = lambda i: P[i]["start"]
    send = lambda i: P[i]["start"] + P[i]["duration"]

    def bed(cid, start, end, segments=(), trim=0, fade_in=0, fade_out=1, loop=False):
        L = file_frames(cid)
        cuts = sorted({start, end, *[max(start, min(end, x)) for a, b, _ in segments for x in (a, b)]})
        pieces = []
        for a, b in zip(cuts, cuts[1:]):
            if b <= a:
                continue
            db = 0.0
            for s0, s1, extra in segments:
                if s0 <= a and b <= s1:
                    db = extra
            pieces.append([a, b, db])
        merged = []
        for pc in pieces:
            if merged and merged[-1][2] == pc[2]:
                merged[-1][1] = pc[1]
            else:
                merged.append(pc)
        tidy = []
        for pc in merged:
            if tidy and pc[1] - pc[0] < 12:
                tidy[-1][1] = pc[1]
            else:
                tidy.append(pc)
        clips = []
        for a, b, db in tidy:
            off = trim + (a - start)
            a2 = a
            while a2 < b:
                o = off + (a2 - a)
                if loop:
                    o %= L
                room = L - o
                if room <= 0:
                    log.append(f"{cid}: file ends before {a2} (bed shortened).")
                    break
                seg_end = min(b, a2 + room)
                clips.append(dict(a=a2, b=seg_end, trim=o, db=db, wrap=(seg_end < b)))
                a2 = seg_end
        result = []
        for k, c in enumerate(clips):
            nxt = clips[k + 1] if k + 1 < len(clips) else None
            prv = clips[k - 1] if k else None
            dur = c["b"] - c["a"]
            clip = {"id": f"{cid}#{k}" if len(clips) > 1 else cid, "src": f"sound/{cid}.mp3",
                    "start": c["a"], "duration": dur, "volume": vol(cid, c["db"])}
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
            result.append(clip)
        return result

    def point(cid, start, max_end=None, fade_out=0, trim=0):
        L = file_frames(cid)
        start0 = start
        if start < 0:
            trim, start = trim - start, 0
        dur = L - trim
        if max_end is not None:
            dur = min(dur, max_end - start)
        dur = min(dur, END - start)
        if dur <= 0:
            log.append(f"{cid}: no room at {start0} (dropped).")
            return []
        clip = {"id": cid, "src": f"sound/{cid}.mp3", "start": start, "duration": dur, "volume": vol(cid)}
        if trim:
            clip["trimBefore"] = trim
        if fade_out:
            clip["fadeOut"] = fade_out
        return [clip]

    l08 = D["l08"]
    L08 = lines[(l08["lid"], l08["lang"])]
    # the question = l08 after its ellipsis pause; rain and drone pulled down from just before it
    sp = [p for p in L08["wt"]["pauses"] if p["kind"] == "split"]
    q_start = l08["clip_start"] + int(round(sp[0]["p1"])) if sp else l08["clip_start"] + (L08["a"] + L08["b"]) // 2
    q0, q1 = q_start - F(0.3), l08["speech_end"] + F(0.2)
    l10 = D["l10"]
    beeps = l08["speech_end"]

    music, sfx = [], []
    music += bed("mus_drone_bed", sstart("s03"), send("s06"),
                 segments=[(q0, q1, cues["mus_drone_bed"]["duck"]["extra_duck_db"])],
                 trim=DRONE_TRIM, fade_in=6, fade_out=1)
    # s09 now runs longer than the 3.5 s sting and idle: right-align both on the hard cut so neither
    # stops audibly before the cut to black (never earlier than the cue sheet's offsets)
    music += point("mus_end_sting", max(sstart("s09") + F(0.2), END - file_frames("mus_end_sting")), max_end=END, fade_out=1)

    sfx += bed("amb_rain_roof", 0, END, segments=[(q0, q1, -12.0)], fade_in=2, fade_out=1, loop=True)
    sfx += point("sfx_s01_breath_leather", sstart("s01"))
    sfx += point("sfx_s01_zip_pull", sstart("s02") - F(3.2))
    sfx += point("sfx_s02_paper_rustle", sstart("s02") + F(0.7), max_end=D["l03"]["speech_start"] + F(0.1), fade_out=4)
    click = send("s03") - 2
    sfx += bed("sfx_s03_phone_ring", sstart("s03"), min(click, sstart("s03") + file_frames("sfx_s03_phone_ring")),
               segments=[(D["l04"]["speech_start"] - 3, click, RING_DUCK_DB)], fade_in=0, fade_out=1)
    sfx += point("sfx_s04_key_click", click)
    sfx += bed("amb_s04_line_hiss", sstart("s04"), beeps, fade_in=2, fade_out=3, loop=True)
    # sfx_s06_call_end is 1.6 s (sound QC, not 1.2 s): it starts on the last speech of l08, uncut
    sfx += point("sfx_s06_call_end", beeps)
    sfx += point("amb_s07_dead_line", beeps + BEEPS_LAST_ONSET, max_end=sstart("s08"), fade_out=1)
    sfx += point("sfx_s08_lock_clunk", sstart("s08"), max_end=D["l09"]["speech_start"], fade_out=CLUNK_FADE)
    sfx += point("sfx_s09_headlight_click", sstart("s09"))
    ign = point("sfx_s09_ignition_idle", sstart("s09") + F(0.5), max_end=END, fade_out=1)
    if ign:
        c = ign[0]
        split = l10["speech_start"]
        if c["start"] < split < c["start"] + c["duration"]:
            a = dict(c, id=c["id"] + "#0", duration=split - c["start"] + XF, fadeOut=XF)
            b = dict(c, id=c["id"] + "#1", start=split, duration=c["start"] + c["duration"] - split,
                     trimBefore=c.get("trimBefore", 0) + split - c["start"], fadeIn=XF,
                     volume=vol("sfx_s09_ignition_idle", -6.0), fadeOut=1)
            ign = [a, b]
        # the file ends before the hard cut: repeat the steady idle tail, crossfaded, up to the cut
        last = ign[-1]
        L_ign = file_frames("sfx_s09_ignition_idle")
        fill = END - (last["start"] + last["duration"])
        if 0 < fill < L_ign // 2:
            last["fadeOut"] = XF
            ign.append(dict(last, id="sfx_s09_ignition_idle#fill", start=END - fill - XF, duration=fill + XF,
                            trimBefore=L_ign - fill - XF - 2, fadeIn=XF, fadeOut=1))
    sfx += ign
    return music, sfx, dict(q0=q0, q1=q1, beeps=beeps)


# ---------------------------------------------------------------- write

placeholder_sound = sorted(k for k, r in sound_manifest.items() if r.get("placeholder"))
frame_status = {r["shot_id"]: r for r in frames_manifest}
rejected_frames = {r.get("shot_id") for r in frame_review
                   if r.get("ok") is False or str(r.get("verdict", "")).lower() in ("reject", "rejected", "fail")}

for lang in LANGS:
    pic, D = layout(lang)
    for lid, d in D.items():
        d["lid"], d["lang"] = lid, lang
    END = pic[-1]["start"] + pic[-1]["duration"]
    TOTAL = END + END_BLACK
    P = {p["shot"]["id"]: p for p in pic}
    cuts = [p["start"] for p in pic[1:]] + [END]
    # checks: speech inside its shot (cut-off line may run CUTOFF_OVERLAP past), clips inside the picture
    for lid, d in D.items():
        sh = P[d["shot"]]
        limit = sh["start"] + sh["duration"] + (CUTOFF_OVERLAP if lid == CUTOFF[1] else 0)
        assert d["speech_end"] <= limit, (lang, lid, d["speech_end"], limit)
        assert d["clip_start"] >= 0, (lang, lid)
    music, sfx, marks = build_sound(pic, D, END)

    tl_shots, slates = [], []
    for p in pic:
        s = p["shot"]
        img = SCENE / "frames" / f"{s['id']}.png"
        fm = frame_status.get(s["id"], {})
        bad = (not img.exists()) or fm.get("status") not in (None, "ok") or s["id"] in rejected_frames
        shot = {"id": s["id"], "start": p["start"], "duration": p["duration"]}
        if bad:
            shot.update(type="slate", note=f"frame missing or rejected: {s['action'][:80]}")
            slates.append(s["id"])
        else:
            shot["image"] = f"frames/{s['id']}.png"
        mv = {"preset": s["camera_move"]}
        if s["camera_move"] != "hold":
            mv["intensity"] = s["intensity"]
        if s.get("focus"):
            mv["focus"] = s["focus"]
        if s["id"] in MOVE_OVERRIDE:
            mv = dict(MOVE_OVERRIDE[s["id"]])
        shot["move"] = mv
        tl_shots.append(shot)

    dialogue, placement = [], []
    order = sorted(D, key=lambda k: D[k]["clip_start"])
    for lid in order:
        d, L = D[lid], lines[(lid, lang)]
        dur = min(L["T"], TOTAL - d["clip_start"])
        clip = {"id": lid, "src": os.path.relpath(L["file"], SCENE), "start": d["clip_start"], "duration": dur,
                "volume": 1.0}
        if L["trim"]:
            clip["trimBefore"] = L["trim"]
        if L["placeholder"]:
            clip["placeholder"] = True
        dialogue.append(clip)
        cs = d["clip_start"]
        wt = L["wt"]
        placement.append({
            "line_id": lid, "speaker": L["speaker"], "shot": d["shot"],
            "startMs": ms(cs), "endMs": ms(cs + dur),
            "speechStartFrame": d["speech_start"], "speechEndFrame": d["speech_end"],
            "speechStartMs": ms(d["speech_start"]), "speechEndMs": ms(d["speech_end"]),
            "pauses": [{"startFrame": round(cs + p["p0"], 2), "endFrame": round(cs + p["p1"], 2), "kind": p["kind"],
                        "beforeWord": p["k"]} for p in wt["pauses"]],
            "words": [{"text": w["text"], "startFrame": round(cs + w["start"], 2), "endFrame": round(cs + w["end"], 2)}
                      for w in wt["words"]],
            "segments": wt["segments"],
            "file": os.path.relpath(L["file"], SCENE), "sourceTake": os.path.relpath(L["source"], SCENE),
            "trimInFrames": L["trim"], "measured": L["meas"], "placeholder": L["placeholder"],
        })

    timeline = {
        "id": f"{shots_doc['id']}-{lang}",
        "fps": FPS,
        "durationFrames": TOTAL,
        "background": "#000",
        "slateColor": "#1d2430",
        "shots": tl_shots,
        "audio": {
            "dialogue": dialogue,
            "music": music,
            "sfx": sfx,
            "ducking": {"enabled": True, "amountDb": cues["mus_drone_bed"]["duck"]["under_dialogue_db"],
                        "attack": 8, "release": 15, "holdGap": 20},
        },
        "debug": {"burnSubtitles": False, "showInfo": False},
        "meta": {
            "built_by": "S13 Editor, content/proof/photoreal/build_timeline.py",
            "lang": lang,
            "picture_seconds": round(END / FPS, 3),
            "total_seconds": round(TOTAL / FPS, 3),
            "planned_seconds": shots_doc["total_duration_s"],
            "cuts": cuts,
            "end": f"hard cut to black and silence at frame {END}, {END_BLACK} black frames after",
            "placeholders": {"dialogue": [l for l in D if lines[(l, lang)]["placeholder"]],
                             "frames_slated": slates, "sound": placeholder_sound},
            "takes": {l: lines[(l, lang)]["why"] for l in order},
            "shot_vs_plan": {p["shot"]["id"]: f"{p['duration'] / FPS:.2f} s (plan {p['shot']['duration_s']} s)" for p in pic},
            "notes": [n for n in log if n.startswith(f"{lang}") or not re.match(r"^(hi|en)\b", n)] + [
                "D-014 rule 6: shot lengths follow this language's measured takes; speech is not sped up (no atempo).",
                "Layout is on speech (silencedetect -40 dB): lead before first speech, 8 frames speech-to-speech inside a shot, "
                "4 frames after the last speech (s03 6, s06 6, s09 12), at least 800 ms of picture for a shot's last segment.",
                "Caller lines (l05, l07, l08): voice/phonefx/<lang>/<id>.wav, band-pass 300-3400 Hz + light tanh saturation, loudness-matched.",
                "l06 is cut 3 frames before its last speech; l07's first speech is on the s04/s05 cut.",
                f"sfx_s06_call_end (1.6 s) starts on l08's last speech (frame {marks['beeps']}); line hiss ends there; "
                "dead line enters on the third beep; s07 holds until the dead line has played 0.6 s alone.",
                f"mus_drone_bed starts {DRONE_TRIM / FPS:.1f} s into the file (its head is a ~4 s fade-in) with a 6-frame fade, "
                "from the first ring to the cut into s07; the 11 s 'pulse' was not found in a loudness scan, so it is not aligned.",
                f"Rain -12 dB and drone extra duck from frame {marks['q0']} to {marks['q1']} (l08's question after its ellipsis pause).",
                "End sting right-aligned on the hard cut (s09 is longer than the 3.5 s file); ignition stays 0.5 s into s09 and its steady idle tail is repeated, crossfaded, to the cut.",
                "s07 move: very slow linear 2.4% push towards Imran's eyes in the mirror (screening r1).",
            ],
        },
    }
    (SCENE / f"timeline.{lang}.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1) + "\n")
    (SCENE / f"dialogue-placement.{lang}.json").write_text(json.dumps(
        {"lang": lang, "fps": FPS, "cuts": cuts, "end": END, "lines": placement}, ensure_ascii=False, indent=1) + "\n")
    print(f"{lang}: {len(tl_shots)} shots ({len(slates)} slate), {len(dialogue)} lines "
          f"({sum(1 for l in D if lines[(l, lang)]['placeholder'])} placeholder), {len(music)} music, {len(sfx)} sfx, "
          f"{TOTAL} frames = {TOTAL / FPS:.2f} s; shots " + " ".join(f"{p['shot']['id']}={p['duration']}" for p in pic))
for n in log:
    print("NOTE", n)
