#!/usr/bin/env python3
"""Episode toolchain: build timeline.<lang>.json (for production/remotion) and
dialogue-placement.<lang>.json (for build_subs.py) for one episode and language.

    python3 -I production/scripts/episode/build_timeline.py <episode_dir> <lang>

Generalised from content/proof/photoreal/build_timeline.py and
content/proof/flat2d/build_timeline.py. Everything scene-specific in those two
files is now data in <episode_dir>/edit.json (see README.md for the schema).
All times are integer frames at 30 fps.

Inputs (episode folder):
  shots.json                     shots[] {id, line_ids, duration_s, silent_lead_s?, camera_move (a Move object, or a preset
                                 name with intensity and focus|camera_focus, or 'custom' with 'move'), frame {kind,
                                 source_shot, image} | frame_source}; a line listed in consecutive shots is split over them
  script.<lang>.json             beats[].lines[] {id, speaker, text}
  voice/takes.json | voice/takes.<lang>.json   planned takes (speaker, target_seconds)
  voice/manifest.jsonl           generated takes; voice/review.json verdicts and trim_in_s
  sound/cues.json (+ sound/manifest.jsonl, sound/<cue_id>.mp3)   cue sheet: gain_db, type, loop, status; one-off cues
  content/<series>/sound/{library.json,manifest.jsonl,lib/}   series library (episodes only)
  frames/<shot>.png, frames/manifest.jsonl, frames/review.json ({"frames": [{"shot", "verdict", "attempt"}]}, D-023)
  edit.json (optional)           per-episode overrides: layout, cut-offs, line gains, voice fx, sound placements

Voice take per line (D-0M2, D-014):
  1. manifest rows for (line, lang) with status ok, a model in voice_models (default: v4 only;
     rows with take_suffix or role are A/B takes and never cut in), file present;
  2. the take number is the row's "take", else _t<n> / .t<n> in the file name, else 1;
     review.json verdicts apply to their "take" (default 1; later rows override earlier ones):
     reject/fail drops a take, 'retake' drops it when a later take exists;
  3. the latest remaining take wins (so a _t2 is preferred to take 1);
  4. review trim_in_s of the chosen take becomes trimBefore.
  No usable take -> a silent placeholder of target_seconds (plan 7.8), flagged in meta.

Measurement (D-014 rules 2-6): ffprobe length, ffmpeg silencedetect at -40 dB for first and
last speech and internal pauses >= 300 ms. Lines are laid out on their speech: leads, gaps
and tails are measured from speech, so shots follow the voice and speech is never sped up.
"""
import hashlib
import json
import math
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import (FPS, F, Episode, ExprError, Log, db, dump, evaluate, frame_verdict, load,  # noqa: E402
                    load_frame_review, lufs, md5, measure, ms, envelope, probe_frames, probe_s, pulse_pattern, run)
from wordtime import glen, word_times  # noqa: E402

WHISPER = shutil.which("whisper-cli")
WHISPER_MODEL = Path.home() / ".whisper-models" / "ggml-small.bin"
XF = 4  # frames of crossfade between pieces of one cue

PHONE_CHAIN = ("highpass=f=300:poles=2,highpass=f=300:poles=2,lowpass=f=3400:poles=2,lowpass=f=3400:poles=2,"
               "volume=6dB,asoftclip=type=tanh,volume=-6dB")
FX_CHAINS = {"phone": PHONE_CHAIN}
FOCUS_PRESETS = {"push-in", "pull-out", "drift"}

DEFAULTS = {
    "voice_models": ["v4"],
    "words": {"asr_match": "start"},
    "measure": {"silence_db": -40, "pause_min_s": 0.3, "merge_blip_ms": 0, "edge_tol_ms": 5},
    "layout": {"first_lead": 4, "lead_default": 5, "use_silent_lead": True, "lead": {}, "lead_min": {},
               "gap_default": 8, "gap": {}, "tail_default": 6, "tail": {}, "min_last_segment": 24,
               "end_black": 12, "silent_frames": {}, "silent_min_end": {}, "cutoffs": [], "cut_on_word": [],
               "read_cps": 17},
    "shots": {}, "lines": {}, "voice_fx": {}, "sound": None, "sound_windows": {}, "ducking": {},
    "slate_color": "#1d2430", "max_seconds": 150, "notes": [],
    # D-024 ruling 3: orientation supers, burned in by default (ruling 3.6); hold at least min_s (ruling 3.3).
    "supers": {"burn": True, "hold_s": 3.0, "min_s": 2.0, "snap_s": 0.5, "fade": 6, "items": {}},
}


def _shot_overlay(s, sc=None):
    """A shot's plot overlay as shots.json writes it ('overlay' str/dict/list or 'overlays' list), else the extra
    layers edit.json shots.<id>.layers puts over its frame (the overlay layer, D-023 rule 3), or None."""
    ov = s.get("overlay") or s.get("overlays")
    if not ov:
        extra = [Path(str(x.get("src", ""))).stem for x in (sc or {}).get("layers", [])[1:]]
        return ", ".join(extra) + " (edit.json layers)" if extra else None
    if isinstance(ov, dict):
        return ov.get("id") or "overlay"
    if isinstance(ov, list):
        return ", ".join(str(o.get("id", "overlay")) if isinstance(o, dict) else str(o) for o in ov)
    return str(ov)[:60]


def place_supers(script, shots, pic, D, cuts, slates, END, SU, lang, log, ev, shot_cfg=None):
    """Orientation supers (D-024 ruling 3) from script.<lang>.json beats[].supers[].

    Start, in order: edit.json supers.items.<id>.at; else the with_line's first speech, if the line is placed
    (on the cut when the shot started at most snap_s before it, or when the next cut follows within snap_s / 2);
    else the start of on_shot (shots.json shots[].supers naming the super wins over the script's on_shot); else
    the start of the beat's first shot. If the line's shot carries a plot overlay and on_shot is a placed shot
    without one, on_shot is used (ruling 3.3: never on a shot that carries a plot overlay).
    Hold: hold_s (or items.<id>.hold_s / until), ended early at the end of the start shot's beat, at the next shot
    that carries a plot overlay, and at the picture end; an end at most 12 frames after a cut moves back to the cut.
    Never shorter than min_s: a super that cannot get min_s inside those limits keeps min_s and is flagged.
    items.<id>.position "upper" draws it in the top third instead of the lower third (for a frame whose lower
    third holds something the viewer must see).
    Returns (timeline supers, meta placed, meta unplaced, flags for meta.checks.supers)."""
    P = {p["shot"]["id"]: p for p in pic}
    order = [p["shot"]["id"] for p in pic]
    shot_cfg = shot_cfg or {}

    def _overlay(s):
        return _shot_overlay(s, shot_cfg.get(s["id"]))

    beat_of = lambda s: s.get("beat_id") or s.get("beat")
    hold_d, min_f = F(SU.get("hold_s", 3.0)), F(SU.get("min_s", 2.0))
    snap, fade = F(SU.get("snap_s", 0.5)), int(SU.get("fade", 6))
    items = SU.get("items") or {}
    on_shots = {}  # super id -> shot id, from shots.json (S7 copies each super onto its shot, ruling 3.5)
    for s in shots:
        for x in s.get("supers") or []:
            xid = x.get("id") if isinstance(x, dict) else x
            if xid:
                on_shots.setdefault(str(xid), s["id"])

    def shot_at(f):
        for p in pic:
            if p["start"] <= f < p["start"] + p["duration"]:
                return p
        return None

    def resolve(ref, beat):
        """(shot id or None, note) for an on_shot value: an id, an id followed by prose, or 'shot N' of the beat."""
        if not ref:
            return None, None
        r = str(ref).strip()
        if r in P:
            return r, None
        m = re.match(r"(s\d+[a-z]?)\b", r)
        if m and m.group(1) in P:
            return m.group(1), f"on_shot {r!r} read as {m.group(1)}"
        m = re.match(r"shot\s+(\d+)\b", r, re.I)
        if m:
            bs = [x["id"] for x in shots if beat_of(x) == beat]
            n = int(m.group(1))
            if 1 <= n <= len(bs):
                return bs[n - 1], f"on_shot {r!r} read as shot {n} of {beat}, {bs[n - 1]}"
        return None, f"on_shot {r!r} is not a placed shot"

    # The script's supers, then any super a shot lists (as an object) that no beat of this script has.
    todo = [(b, su) for b in script.get("beats", []) for su in b.get("supers") or []]
    known = {str(su.get("id")) for _, su in todo}
    for s in shots:
        for x in s.get("supers") or []:
            if isinstance(x, dict) and x.get("id") and str(x["id"]) not in known:
                known.add(str(x["id"]))
                todo.append(({"id": x.get("beat_id") or beat_of(s)}, dict(x, on_shot=s["id"])))
                log.append(f"{lang} super {x['id']}: only in shots.json ({s['id']}), not in script.{lang}.json; placed from there.")

    out, placed, unplaced, flags = [], [], [], []
    for b, su in todo:
        sid = str(su.get("id") or f"{b.get('id')}-super{len(placed) + len(unplaced) + 1}")
        o = items.get(sid) or {}
        base = {"id": sid, "kind": su.get("kind"), "beat": b.get("id")}
        if o.get("drop"):
            unplaced.append(dict(base, why=f"dropped in edit.json supers.items: {o.get('drop')}"))
            continue
        text = per_lang(o.get("text"), lang) or su.get(f"text_{lang}") or su.get("text")
        if not text or not str(text).strip():
            unplaced.append(dict(base, why=f"no text_{lang} or text"))
            continue
        text = str(text).strip()
        wl = su.get("with_line")
        ref = on_shots.get(sid) or su.get("on_shot")
        notes = []
        if on_shots.get(sid) and su.get("on_shot") and on_shots[sid] != su.get("on_shot"):
            notes.append(f"shots.json puts it on {on_shots[sid]}, the script on {su.get('on_shot')!r}; shots.json used")
        os_, rnote = resolve(ref, b.get("id"))
        if rnote:
            notes.append(rnote)
        start = None
        if "at" in o:
            start, how = ev(o["at"]), f"edit.json at {o['at']!r}"
        elif wl and wl in D:
            f = D[wl]["speech_start"]
            p = shot_at(f) or P[D[wl]["shot"]]
            psid = p["shot"]["id"]
            if os_ and os_ != psid and _overlay(p["shot"]) and not _overlay(P[os_]["shot"]):
                start = P[os_]["start"]
                how = f"start of on_shot {os_}: {wl} plays over {psid}, which carries plot overlay {_overlay(p['shot'])}"
            else:
                nxt = min([c for c in cuts if c > f] or [END])
                if f - p["start"] <= snap:
                    start, how = p["start"], f"with {wl}: on the cut into {psid}, {f - p['start']} frames before its speech"
                elif nxt - f <= snap // 2 and nxt < END:
                    start, how = nxt, f"with {wl}: on the cut {nxt - f} frames after its speech starts"
                else:
                    start, how = f, f"with {wl}: on its first speech, in {psid}"
                if os_ and os_ != psid:
                    notes.append(f"{wl} plays over {psid}, not on_shot {os_}; the line's placement is used")
        elif os_ and os_ in P:
            start = P[os_]["start"]
            how = f"start of on_shot {os_}" + (f" ({wl} is in no shot)" if wl else "")
        else:
            bs = [p for p in pic if beat_of(p["shot"]) == b.get("id")]
            if bs:
                start = bs[0]["start"]
                how = (f"start of beat {b.get('id')} ({bs[0]['shot']['id']})"
                       + (f"; {wl} is in no shot" if wl else "") + ("; on_shot not placed" if ref else ""))
        if start is None or start >= END:
            why = "no placed line, on_shot or beat shot to put it on" if start is None else f"starts at {start}, after the picture end"
            unplaced.append(dict(base, why=why + ("; " + "; ".join(notes) if notes else "")))
            log.append(f"{lang} super {sid}: not placed, {why}.")
            continue
        p0 = shot_at(start) or pic[-1]
        s0 = p0["shot"]["id"]
        want = ev(o["until"]) - start if "until" in o else F(float(o.get("hold_s", hold_d / FPS)))
        end = start + want
        limits = [(END, "the picture end")]
        beat0 = beat_of(p0["shot"])
        if beat0:
            bend = max(p["start"] + p["duration"] for p in pic if beat_of(p["shot"]) == beat0)
            limits.append((bend, f"the end of beat {beat0}"))
        for sid_ in order[order.index(s0) + 1:]:
            if P[sid_]["start"] >= end:
                break
            if _overlay(P[sid_]["shot"]):
                limits.append((P[sid_]["start"], f"{sid_}, which carries plot overlay {_overlay(P[sid_]['shot'])}"))
                break
        lim, lim_why = min(limits)
        ended = None
        if end > lim:
            end, ended = lim, lim_why
        inside = [c for c in cuts if start < c <= end]
        c = max(inside) if inside else None
        if c is not None and 0 < end - c <= 12 and c - start >= min_f:
            end, ended = c, ended or f"the cut at {c} ({end - c} frames earlier)"
        if end - start < min_f:
            end2 = min(start + min_f, END)
            flags.append(f"{sid}: only {(end - start) / FPS:.2f} s before {ended or 'its end'}; held "
                         f"{(end2 - start) / FPS:.2f} s, so it runs past it (D-024 ruling 3.3 asks for 2 s)")
            end, ended = end2, f"min_s, running past {ended or 'its end'}"
        if _overlay(p0["shot"]):
            flags.append(f"{sid}: starts on {s0}, which carries overlay {_overlay(p0['shot'])} (D-024 ruling 3.3)")
        crossed = [x for x in order if start < P[x]["start"] < end]
        for x in crossed:
            if _overlay(P[x]["shot"]) and f" {x}, which" not in f" {ended or ''}":
                flags.append(f"{sid}: runs into {x}, which carries overlay {_overlay(P[x]['shot'])}")
        for x in [s0] + crossed:
            if x in slates:
                flags.append(f"{sid}: drawn over slate {x}")
        rec = dict(base, shot=s0, start=start, duration=end - start, seconds=round((end - start) / FPS, 2),
                   how=how, text=text, **({"ended_by": ended} if ended else {}),
                   **({"notes": notes} if notes else {}), **({"over_shots": crossed} if crossed else {}))
        placed.append(rec)
        log.append(f"{lang} super {sid}: {s0} frames {start}-{end} ({rec['seconds']} s), {how}"
                   + (f"; ended at {ended}" if ended else "") + ("; " + "; ".join(notes) if notes else "") + ".")
        if SU.get("burn", True):
            out.append({"id": sid, "kind": su.get("kind"), "start": start, "duration": end - start,
                        "text": text, "fadeIn": fade, "fadeOut": fade,
                        **({"position": "upper"} if o.get("position") == "upper" else {})})
    out.sort(key=lambda x: x["start"])
    for a, b in zip(out, out[1:]):
        if b["start"] < a["start"] + a["duration"] and a.get("position") == b.get("position"):
            flags.append(f"{a['id']} and {b['id']} overlap by {a['start'] + a['duration'] - b['start']} frames; drawn stacked")
    return out, placed, unplaced, flags


def merged(defaults, over):
    out = json.loads(json.dumps(defaults))
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = dict(out[k], **v)
        else:
            out[k] = v
    return out


def per_lang(v, lang, default=None):
    """A value that may be given once or per language: 3 or {"hi": 3, "en": 5}."""
    if isinstance(v, dict) and set(v) & {"hi", "en"}:
        return v.get(lang, default)
    return default if v is None else v


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_timeline.py <episode_dir> <lang>")
    E = Episode(sys.argv[1])
    lang = sys.argv[2]
    ED = E.dir
    cfg = merged(DEFAULTS, E.edit)
    LY = cfg["layout"]
    log = Log()

    shots_doc = load(ED / "shots.json")
    if not shots_doc:
        raise SystemExit(f"{ED}/shots.json is missing: no storyboard, nothing to lay out")
    shots = shots_doc["shots"]
    script = load(ED / f"script.{lang}.json")
    if not script:
        raise SystemExit(f"{ED}/script.{lang}.json is missing")
    script_lines = {l["id"]: l for b in script["beats"] for l in b["lines"]}
    takes = load(ED / "voice" / "takes.json", None)
    if takes is None:
        takes = load(ED / "voice" / f"takes.{lang}.json", []) or []
    plan = {t["line_id"]: t for t in takes if t.get("lang", lang) == lang}
    manifest = load(ED / "voice" / "manifest.jsonl", None)
    if manifest is None:
        log.append("voice/manifest.jsonl does not exist: no voice takes.")
        manifest = []
    review = load(ED / "voice" / "review.json", []) or []
    frames_manifest = load(ED / "frames" / "manifest.jsonl", []) or []
    frame_review, frame_review_shape = load_frame_review(ED / "frames" / "review.json")

    # ------------------------------------------------------------ voice takes
    models = cfg["voice_models"]

    def model_ok(r):
        return any(m in str(r.get("model", "")) for m in models) and not r.get("take_suffix") and not r.get("role")

    def take_no(r):
        if r.get("take"):
            return int(r["take"])
        m = re.search(r"[._]t(\d+)\.[A-Za-z0-9]+$", str(r.get("file", "")))
        return int(m.group(1)) if m else 1

    def pick_take(line_id):
        rows = [r for r in manifest if r.get("line_id") == line_id and r.get("lang") == lang and model_ok(r)
                and str(r.get("status", "")).lower() == "ok" and r.get("file") and E.resolve(r["file"]).exists()]
        rows = sorted(rows, key=take_no)  # stable: a later row wins a tie
        verdict = {}
        for v in review:
            if v.get("line_id") == line_id and v.get("lang") == lang and model_ok(v):
                verdict[int(v.get("take") or v.get("take_no") or 1)] = v
        keep = []
        for r in rows:
            v = verdict.get(take_no(r))
            vd = str(v.get("verdict", "")).lower() if v else ""
            if vd in ("reject", "rejected", "fail", "bad"):
                continue
            if vd == "retake" and any(take_no(x) > take_no(r) for x in rows):
                continue
            keep.append(r)
        if not keep:
            return None
        r = keep[-1]
        p = E.resolve(r["file"])
        n = take_no(r)
        v = verdict.get(n)
        why = f"take {n} ({p.name})"
        chosen = ED / "voice" / lang / f"{line_id}.mp3"
        if n > 1 and chosen.exists():
            if md5(chosen) == md5(p):
                why += f", identical to {chosen.name}"
            else:
                log.append(f"{lang} {line_id}: voice/{lang}/{chosen.name} differs from the latest take {p.name}; the latest take is cut in.")
        if v and str(v.get("verdict")).lower() == "retake":
            why += "; review asked for a retake but none exists, so this take stands"
            log.append(f"{lang} {line_id}: review verdict 'retake' with no later take; cut in take {n}: {str(v.get('reason', ''))[:160]}")
        trim = float(v.get("trim_in_s") or 0) if v else 0.0
        if trim:
            why += f"; head trimmed to {trim:.2f} s (review trim_in_s)"
        return {"path": p, "model": r.get("model"), "take": n, "why": why, "trim": trim}

    def placeholder_file(line_id, seconds):
        p = ED / "voice" / "placeholder" / lang / f"{line_id}.mp3"
        want = F(seconds)
        if not p.exists() or probe_frames(p) != want:
            p.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                            "-t", f"{want / FPS:.4f}", "-c:a", "libmp3lame", "-b:a", "64k", str(p)], check=True)
        return p

    def voice_fx(src, line_id, name):
        spec = cfg["voice_fx"].get(name, {}) if isinstance(cfg["voice_fx"].get(name), dict) else {}
        chain = spec.get("chain") or FX_CHAINS.get(name)
        if not chain:
            log.append(f"{lang} {line_id}: voice fx '{name}' has no chain; line played dry.")
            return src
        out = ED / "voice" / "fx" / name / lang / f"{line_id}.wav"
        stamp = out.with_suffix(".src")
        match = spec.get("match_loudness", True)
        key = f"{md5(src)} {chain} {match}"
        if out.exists() and stamp.exists() and stamp.read_text() == key:
            return out
        out.parent.mkdir(parents=True, exist_ok=True)
        gain = 0.0
        if match:
            tmp = out.with_suffix(".tmp.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", chain, "-ar", "48000",
                            "-c:a", "pcm_s16le", str(tmp)], check=True)
            gain = round(lufs(src) - lufs(tmp), 2)
            tmp.unlink()
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af",
                        f"{chain},volume={gain}dB,alimiter=limit=0.89:level=false", "-ar", "48000",
                        "-c:a", "pcm_s16le", str(out)], check=True)
        stamp.write_text(key)
        log.append(f"{lang} {line_id}: voice fx '{name}', {gain:+} dB make-up to the clean take's loudness")
        return out

    def asr_words(src, line_id, trim):
        """Local whisper.cpp word stamps (seconds from the trimmed start), cached by file hash."""
        if not WHISPER or not WHISPER_MODEL.exists():
            log.append("whisper-cli or ggml-small.bin missing: no transcription timings (D-014 rule 4 everywhere).")
            return None
        cache = ED / "voice" / "asr" / lang / f"{line_id}.{md5(src)[:10]}.json"
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

    def cut_stub(line_id, src, trim_f, b, trunc):
        """Truncate a cut-off line `trunc` frames after its last syllable onset (RMS rises through -30 dB)."""
        env = envelope(src)[trim_f:]
        onset = None
        for i in range(min(b, len(env) - 1), 1, -1):
            if env[i] >= -30 and env[i - 1] < -33:
                onset = i
                break
        if onset is None:
            log.append(f"{lang} {line_id}: no last-syllable onset found; not truncated.")
            return src, b
        cut = min(b, onset + trunc)
        out = ED / "edit" / "voice" / lang / f"{line_id}.cut.wav"
        out.parent.mkdir(parents=True, exist_ok=True)
        t = cut / FPS
        seek = ["-ss", f"{trim_f / FPS:.4f}"] if trim_f else []
        subprocess.run(["ffmpeg", "-v", "error", "-y", *seek, "-i", str(src), "-t", f"{t:.4f}",
                        "-af", f"afade=t=out:st={t - 0.02:.4f}:d=0.02", "-ar", "44100", "-ac", "1", str(out)], check=True)
        log.append(f"{lang} {line_id}: cut-off stub, last-syllable onset {onset / FPS:.2f} s; truncated at {t:.2f} s "
                   f"(onset + {trunc} frames, 20 ms fade) into {E.rel(out)}; the take's speech ran to {b / FPS:.2f} s.")
        return out, cut

    CUT = {c["line"]: c for c in LY["cutoffs"]}
    COW = {}  # line -> its cut_on_word entries, in edit.json order (a line split over three shots has two)
    for c in LY["cut_on_word"]:
        COW.setdefault(c["line"], []).append(c)
    line_cfg = cfg["lines"]
    fx_by_speaker = {}
    for name, spec in cfg["voice_fx"].items():
        for spk in (spec.get("speakers", []) if isinstance(spec, dict) else []):
            fx_by_speaker[spk] = name
    MS = cfg["measure"]

    # A line listed in two (or more) shots is one take split over consecutive shots: it is placed once,
    # in the first shot, and each later shot starts on a cut-on-word inside it (D-023 rule 3).
    used, line_shots = [], {}
    for k, s in enumerate(shots):
        for l in s["line_ids"]:
            if l not in line_shots:
                used.append(l)
            line_shots.setdefault(l, []).append(k)
    missing = [l for l in used if l not in script_lines]
    if missing:
        raise SystemExit(f"shots.json names lines not in script.{lang}.json: {missing}")
    split_lines = {}
    for l, ks in line_shots.items():
        if len(ks) < 2:
            continue
        ids_ = [shots[k]["id"] for k in ks]
        if ks != list(range(ks[0], ks[0] + len(ks))):
            raise SystemExit(f"{l} is listed in shots {ids_}, which are not consecutive; a split line must run "
                             "from one shot straight into the next")
        for a, b in zip(ks, ks[1:]):
            if shots[a]["line_ids"][-1] != l or shots[b]["line_ids"][0] != l:
                raise SystemExit(f"{l} is listed in {shots[a]['id']} and {shots[b]['id']}: a split line must be the last "
                                 f"line of the earlier shot and the first line of the later one")
        split_lines[l] = ids_
        log.append(f"{lang} {l}: listed in shots {', '.join(ids_)}; placed once, picture cut on a word inside it.")
    for lid in script_lines:
        if lid not in used:
            log.append(f"{lang} {lid}: in the script but in no shot; not cut in.")

    lines = {}
    for lid in used:
        sl = script_lines[lid]
        t = plan.get(lid, {})
        speaker = t.get("speaker") or sl.get("speaker")
        target = t.get("target_seconds") or sl.get("target_seconds") or 2.0
        raw = sl["text"]
        lc = line_cfg.get(lid, {})
        pick = pick_take(lid)
        if pick:
            src = pick["path"]
            m = measure(src, pick["trim"], MS["silence_db"], MS["pause_min_s"], MS["merge_blip_ms"] / 1000,
                        MS["edge_tol_ms"] / 1000)
            asr = asr_words(src, lid, pick["trim"])
            fx = per_lang(lc.get("fx"), lang) or fx_by_speaker.get(speaker)
            play = voice_fx(src, lid, fx) if fx else src
            T = int(math.floor(m["T_s"] * FPS))
            if play != src:
                T = min(T, int(math.floor((probe_s(play) - pick["trim"]) * FPS)))
            a, b = int(math.floor(m["a_s"] * FPS)), min(T, int(math.ceil(m["b_s"] * FPS)))
            clip_frames = T
            trim_f = F(pick["trim"])
            c = CUT.get(lid)
            if c and c.get("trunc"):
                stub, b = cut_stub(lid, play, trim_f, b, int(c["trunc"]))
                if stub != play:
                    play, trim_f = stub, 0  # the stub starts at the trimmed head
                clip_frames = b
            elif c and c.get("clip") == "speech":
                clip_frames = min(T, b + 1)  # hard stop: no tail after the cut-off syllable
            E_s = min(m["b_s"] * FPS, b)
            wt = word_times(raw, m["a_s"] * FPS, E_s, [(p * FPS, q * FPS) for p, q in m["pauses_s"] if q * FPS < E_s],
                            [(x, p * FPS, q * FPS) for x, p, q in asr] if asr else None,
                            asr_match=cfg["words"]["asr_match"])
            lines[lid] = dict(file=play, source=src, T=T, clip_frames=clip_frames, a=a, b=b, trim=trim_f, wt=wt,
                              meas=m, speaker=speaker, placeholder=False, model=pick["model"], why=pick["why"],
                              target=target, fx=fx,
                              pause_frames=[[int(math.ceil(p * FPS)), int(math.floor(q * FPS))] for p, q in m["pauses_s"]])
        else:
            src = placeholder_file(lid, target)
            n = F(target)
            lines[lid] = dict(file=src, source=src, T=n, clip_frames=n, a=0, b=n, trim=0, wt=word_times(raw, 0, n),
                              meas=None, speaker=speaker, placeholder=True, model=None, target=target, fx=None,
                              pause_frames=[], why=f"no usable take; silent placeholder of target {target} s")
            log.append(f"{lang} {lid}: no usable take; silent placeholder of {target} s (plan 7.8).")

    # ------------------------------------------------------------ sound library
    cues_doc = load(ED / "sound" / "cues.json", {}) or {}
    cue_meta = {}
    lib_rows, lib_meta, lib_mix = {}, {}, {}
    if E.series_dir:
        lib = load(E.series_dir / "sound" / "library.json", {}) or {}
        lib_mix = lib.get("mix", {}) or {}
        for k, v in lib.items():
            if isinstance(v, list):
                for c in v:
                    if isinstance(c, dict) and c.get("cue_id"):
                        lib_meta[c["cue_id"]] = c
        for r in load(E.series_dir / "sound" / "manifest.jsonl", []) or []:
            lib_rows[r["cue_id"]] = r
    # Cue sheet: every list of cue entries counts (cues, music, and the episode sheets' library_cues,
    # library_cues_used, new_cues, one_off_cues). An entry's gain_db, type, loop, file and status are used.
    for k, v in cues_doc.items():
        if isinstance(v, list) and k not in ("placement_by_beat",):
            for c in v:
                if isinstance(c, dict) and (c.get("cue_id") or (k in ("cues", "music") and c.get("id"))):
                    cue_meta[c.get("cue_id") or c.get("id")] = dict(cue_meta.get(c.get("cue_id") or c.get("id"), {}), **c)
    # Episode one-off cues: <episode>/sound/<cue_id>.mp3 with rows in <episode>/sound/manifest.jsonl.
    # Per cue, the latest row with status ok and a file on disk; else the cue's last row (placeholder or failed).
    ep_rows = {}
    for r in load(ED / "sound" / "manifest.jsonl", []) or []:
        cid_ = r.get("cue_id") or r.get("id")
        if not cid_:
            continue
        okrow = str(r.get("status", "ok")).lower() == "ok"
        if okrow or str(ep_rows.get(cid_, {}).get("status", "")).lower() != "ok":
            ep_rows[cid_] = r
    sound_missing = {}  # cue -> why it is not in the mix (D-023: tagged in meta.placeholders.sound)
    mix = cues_doc.get("mix", {}) or {}
    start_gains = dict(lib_mix.get("starting_gains_db", {}) or {}, **(mix.get("starting_gains_db", {}) or {}))

    cue_cache = {}
    windows_used = {}
    WIN_RE = re.compile(r"\b[Uu]se (?:final |loop )?~?(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?) s\b")

    def cue(cid):
        if cid in cue_cache:
            return cue_cache[cid]
        meta = dict(lib_meta.get(cid, {}), **cue_meta.get(cid, {}))
        row = ep_rows.get(cid) or lib_rows.get(cid) or {}
        er = ep_rows.get(cid)
        er_status = str(er.get("status", "ok")).lower() if er else None
        cand = []
        if er and er_status in ("ok", "placeholder") and er.get("file"):
            cand += [E.resolve(er["file"])] + ([E.series_dir / er["file"]] if E.series_dir else [])
        if er is None or er_status in ("ok", "placeholder"):
            # a cue whose only episode rows failed is not taken from a fallback path
            if meta.get("file") and cid not in lib_meta:
                cand.append(E.resolve(meta["file"]))
            cand += [ED / "sound" / f"{cid}.mp3", ED / "sound" / f"{cid}.wav"]
            if E.series_dir:
                r = lib_rows.get(cid)
                if r and r.get("file"):
                    cand.append(E.series_dir / r["file"])
                cand.append(E.series_dir / "sound" / "lib" / f"{cid}.mp3")
        path = next((p for p in cand if p.exists() and p.is_file()), None)
        if path is None:
            cue_cache[cid] = None
            st = str(meta.get("status", "")).lower()
            why = (f"marked '{meta['status']}' on the cue sheet" if st.startswith("drop")
                   else f"its sound/manifest.jsonl row has status {er.get('status')!r}" if er and er_status != "ok"
                   else "no file in sound/ or the series library")
            sound_missing[cid] = why
            log.append(f"sound {cid}: {why}; dropped (plan 7.8).")
            return None
        if er_status == "placeholder" or (er and er.get("placeholder")):
            row = dict(row, placeholder=True)
        L = probe_frames(path)
        typ = meta.get("type") or row.get("type") or ""
        gain = meta.get("gain_db")
        if gain is None:
            gain = meta.get("default_gain_db")
        if gain is None:
            key = {"music_sting": "music"}.get(typ, typ)
            gain = start_gains.get(key, 0.0)
            log.append(f"sound {cid}: no gain_db on the cue sheet; {gain} dB from the starting gains for '{typ}'.")
        lo, hi = 0, L
        win, why = None, None
        if cid in cfg["sound_windows"]:
            win, why = cfg["sound_windows"][cid], "edit.json"
        else:
            for src_ in (meta, row):
                for k in ("usable_s", "usable_window_s"):
                    if src_.get(k):
                        win, why = src_[k], k
            if win is None:
                mm = WIN_RE.search(str(row.get("qc_note") or row.get("qc") or ""))
                if mm:
                    win, why = [float(mm.group(1)), float(mm.group(2))], "qc note: " + mm.group(0)
        if win:
            lo, hi = max(0, F(float(win[0]))), min(L, F(float(win[1])))
            if hi - lo < 2:
                lo, hi = 0, L
                log.append(f"sound {cid}: usable window {win} is empty in a {L}-frame file; ignored.")
            else:
                windows_used[cid] = {"window_s": [round(lo / FPS, 3), round(hi / FPS, 3)], "from": why}
        info = dict(id=cid, path=path, src=E.rel(path), L=L, lo=lo, hi=hi, gain=float(gain), type=typ,
                    loop=bool(meta.get("loop", row.get("loop", False))), placeholder=bool(row.get("placeholder")) or str(row.get("status", "")).lower() == "placeholder",
                    meta=meta)
        cue_cache[cid] = info
        return info

    def cue_len(cid):
        c = cue(cid)
        if c is None:
            raise ExprError(f"len({cid}): cue has no file")
        return c["hi"] - c["lo"]

    pulse_cache = {}

    def pulse_on(cid, rel):
        if cid not in pulse_cache:
            c = cue(cid)
            pulse_cache[cid] = pulse_pattern(c["path"]) if c else [False]
        p = pulse_cache[cid]
        return p[rel % len(p)]

    # ------------------------------------------------------------ picture layout
    D, pic = {}, []
    names = {"start": 0}

    def name_line(lid):
        d, L = D[lid], lines[lid]
        cs = d["clip_start"]
        names.update({f"{lid}.clip_start": cs, f"{lid}.clip_end": cs + L["clip_frames"],
                      f"{lid}.speech_start": d["speech_start"], f"{lid}.speech_end": d["speech_end"]})
        sp = [p for p in L["wt"]["pauses"] if p["kind"] == "split"]
        for k, p in enumerate(sp, 1):
            names[f"{lid}.split{k}_start"] = cs + int(round(p["p0"]))
            names[f"{lid}.split{k}_end"] = cs + int(round(p["p1"]))

    def put(lid, speech_start, shot):
        L = lines[lid]
        cs = speech_start - L["a"]
        D[lid] = dict(clip_start=cs, speech_start=speech_start, speech_end=cs + L["b"], shot=shot)
        name_line(lid)
        return D[lid]

    def ev(expr):
        return evaluate(expr, names, cue_len)

    def gap(a, b):
        return int(LY["gap"].get(f"{a}>{b}", LY["gap_default"]))

    def norm_word(x):
        return str(x).lower().strip(".,!?…।\"'“”‘’()-—")

    def word_onset(lid, c, nth_split=0):
        """Onset (frames from the clip start) of the word the picture cuts on. The word is chosen by, in order:
        'position' (1-based word number in the line, tags stripped), else the 'occurrence'-th (1-based, default 1)
        match of 'word'. Each may be per language. With no entry (a split line with no cut_on_word), the cut is
        on the first word after the line's (nth_split + 1)-th split pause."""
        L = lines[lid]
        ws = L["wt"]["words"]
        texts = [norm_word(w["text"]) for w in ws]
        if c is None:
            sp = [p for p in L["wt"]["pauses"] if p["kind"] == "split"]
            if nth_split >= len(sp):
                raise SystemExit(f"{lang} {lid}: split over shots but has no cut_on_word entry and no split pause "
                                 f"number {nth_split + 1} to cut on; add a cut_on_word entry in edit.json layout")
            i = sp[nth_split]["k"]
            how = f"no cut_on_word entry: first word after split pause {nth_split + 1}"
        else:
            word = per_lang(c.get("word"), lang)
            pos = per_lang(c.get("position"), lang)
            occ = per_lang(c.get("occurrence"), lang)
            if pos is not None:
                i = int(pos) - 1
                if not 0 <= i < len(ws):
                    raise SystemExit(f"{lang} {lid}: cut position {pos} is outside the line's {len(ws)} words")
                if word is not None and texts[i] != norm_word(word):
                    raise SystemExit(f"{lang} {lid}: word {pos} is {ws[i]['text']!r}, not the cut word {word!r}")
                how = f"word {pos}"
            else:
                if word is None:
                    raise SystemExit(f"{lang} {lid}: cut_on_word entry has no word or position for '{lang}'")
                hits = [k for k, t in enumerate(texts) if t == norm_word(word)]
                n = int(occ or 1)
                if len(hits) < n:
                    raise SystemExit(f"{lang} {lid}: cut word {word!r} occurs {len(hits)} time(s) in the line, "
                                     f"occurrence {n} asked for")
                i = hits[n - 1]
                how = f"occurrence {n} of {len(hits)}"
                if len(hits) > 1 and occ is None:
                    log.append(f"{lang} {lid}: cut word {word!r} occurs {len(hits)} times (words "
                               f"{', '.join(str(k + 1) for k in hits)}); cut on the first. Give 'occurrence' or "
                               f"'position' in cut_on_word if another is meant.")
        seg = next(s for s in L["wt"]["segments"] if s["i0"] <= i < s["i1"])
        return int(round(ws[i]["start"])), seg["source"], f"'{ws[i]['text']}' (word {i + 1}; {how})"

    def cow_entry(lid, next_sid, nth):
        """The cut_on_word entry for the cut into next_sid inside lid: one naming that shot, else the nth for the line."""
        es = COW.get(lid, [])
        named = [e for e in es if e.get("shot") == next_sid]
        if named:
            return named[0]
        unnamed = [e for e in es if not e.get("shot")]
        return unnamed[nth] if nth < len(unnamed) else None

    def last_segment_len(L):
        ws, seg = L["wt"]["words"], L["wt"]["segments"][-1]
        return L["b"] - int(math.floor(ws[seg["i0"]]["start"]))

    READ_CPS = float(LY["read_cps"] or 0)

    def read_end(lid):
        """Frame by which the line's last segment has been on screen long enough to read at READ_CPS
        (build_subs.py holds a cue past its speech up to 2 frames before the next cue or the cut)."""
        if not READ_CPS:
            return -10 ** 9
        L, d = lines[lid], D[lid]
        ws, seg = L["wt"]["words"], L["wt"]["segments"][-1]
        st = d["clip_start"] + int(math.floor(ws[seg["i0"]]["start"] + 1e-6))
        return st + math.ceil(glen(" ".join(w["text"] for w in ws[seg["i0"]:seg["i1"]])) * FPS / READ_CPS)

    def after(prev, lid, t):
        """Speech start of lid after prev: the gap, or more if prev's last cue needs reading room."""
        g = t + gap(prev, lid)
        r = read_end(prev) + 2
        if r > g:
            log.append(f"{lang}: {lid} starts {r - g} frames later than the {gap(prev, lid)}-frame gap so {prev}'s last cue reads at <= {READ_CPS:g} graphemes/s")
        return max(g, r)

    def pulse_wait_off(spec, f):
        cid, z = spec["cue"], ev(spec.get("from", 0))
        while pulse_on(cid, f - z):
            f += 1
        return f

    cursor, carried, prev_cut = 0, None, False
    split_no = {}  # split line -> cuts made inside it so far
    cow_used = set()
    for idx, s in enumerate(shots):
        sid, start, ids = s["id"], cursor, s["line_ids"]
        names.update({f"{sid}.start": start})
        lv = LY["lead"].get(sid)
        if isinstance(lv, dict):
            f = pulse_wait_off(lv["after_pulse"], start) if "after_pulse" in lv else start
            lead = f + int(lv.get("plus", 0)) - start
        elif lv is not None:
            lead = int(lv)
        elif prev_cut is not False:
            lead = int(prev_cut)
        else:
            lead = max(F(s.get("silent_lead_s") or 0) if LY["use_silent_lead"] else 0, int(LY["lead_default"]),
                       int(LY["lead_min"].get(sid, 0)))
        if idx == 0 and ids:
            lead = max(lead, int(LY["first_lead"]), lines[ids[0]]["a"])
        prev_cut = False
        t, prev = None, None
        if carried and carried in ids:
            t, prev = D[carried]["speech_end"], carried
        for lid in [l for l in ids if l != carried]:
            put(lid, start + lead if t is None else after(prev, lid, t), sid)
            t, prev = D[lid]["speech_end"], lid
        carried = None
        nxt = shots[idx + 1] if idx + 1 < len(shots) else None
        nxt_first = nxt["line_ids"][0] if nxt and nxt["line_ids"] else None
        cow_lid = None
        if nxt_first and nxt_first == prev and nxt_first in split_lines:
            cow_lid = prev  # listed in this shot and the next: already placed here, the cut lands inside it
            d = D[cow_lid]
        elif nxt_first and nxt_first in COW and nxt_first not in D and nxt_first not in split_lines:
            cow_lid = nxt_first  # listed only in the next shot: laid out at the end of this one (series2 storyboards)
            d = put(cow_lid, start + lead if t is None else after(prev, cow_lid, t), nxt["id"])
        if cow_lid:
            nth = split_no.get(cow_lid, 0)
            entry = cow_entry(cow_lid, nxt["id"], nth)
            onset, srcw, word = word_onset(cow_lid, entry, nth)
            split_no[cow_lid] = nth + 1
            if entry is not None:
                cow_used.add(id(entry))
            end = d["clip_start"] + onset
            if end <= max(start, d["speech_start"]):
                raise SystemExit(f"{lang} {sid}/{nxt['id']}: the cut on {word} in {cow_lid} falls at frame {end}, "
                                 f"not after the shot's start ({start}) and the line's first speech ({d['speech_start']})")
            d["shot"] = nxt["id"]
            log.append(f"{lang}: {sid}/{nxt['id']} cut on {word} at {onset} frames into {cow_lid} ({srcw})")
            carried = cow_lid
        elif prev and prev in CUT:
            c = CUT[prev]
            se = D[prev]["speech_end"]
            run_ = int(c.get("run", 3))
            end = se - run_
            if c.get("read_cps"):
                L = lines[prev]
                seg = L["wt"]["segments"][-1]
                seg_start = D[prev]["clip_start"] + int(math.floor(L["wt"]["words"][seg["i0"]]["start"]))
                seg_text = " ".join(w["text"] for w in L["wt"]["words"][seg["i0"]:seg["i1"]])
                read = seg_start + math.ceil(glen(seg_text) * FPS / float(c["read_cps"]))
                end = min(se, max(se - run_, read))
                if end != se - run_:
                    log.append(f"{lang}: {sid} cut moved to {se - end} frames before {prev}'s last speech so its cue reads at <= {c['read_cps']} cps")
            prev_cut = int(c.get("next_lead", 0))
        elif not ids:
            end = start + int(LY["silent_frames"].get(sid, F(s["duration_s"])))
            if sid in LY["silent_min_end"]:
                end = max(end, ev(LY["silent_min_end"][sid]))
        else:
            tv = LY["tail"].get(sid, LY["tail_default"])
            if isinstance(tv, dict):
                end = t + int(tv.get("frames", LY["tail_default"]))
                ip = tv.get("in_pulse")
                if ip:
                    z, k = ev(ip.get("from", 0)), int(ip.get("frames", 9))
                    while not all(pulse_on(ip["cue"], end - j - z) for j in range(0, k + 1)):
                        end += 1
            else:
                tail = max(int(tv), int(LY["min_last_segment"]) - last_segment_len(lines[prev]))
                end = t + tail
                r = read_end(prev)
                if r > end:
                    log.append(f"{lang}: {sid} held {r - end} frames past its tail so {prev}'s last cue reads at <= {READ_CPS:g} graphemes/s")
                    end = r
        if end <= start:
            raise SystemExit(f"{lang} {sid}: computed end {end} is not after its start {start}")
        pic.append(dict(shot=s, start=start, duration=end - start))
        names.update({f"{sid}.end": end, f"{sid}.dur": end - start})
        cursor = end

    for es in COW.values():
        for e in es:
            if id(e) not in cow_used:
                log.append(f"{lang} {e['line']}: cut_on_word entry {json.dumps(e, ensure_ascii=False)} was not used "
                           "(the line does not start a shot or run across a cut).")
    END = cursor
    TOTAL = END + int(LY["end_black"])
    names.update({"end": END, "total": TOTAL})
    P = {p["shot"]["id"]: p for p in pic}

    problems = []
    for lid, d in D.items():
        sh = P[d["shot"]]
        limit = sh["start"] + sh["duration"] + (int(CUT[lid].get("run", 3)) if lid in CUT else 0)
        if d["speech_end"] > limit:
            problems.append(f"{lid}: speech ends at {d['speech_end']}, past its shot {d['shot']} (limit {limit})")
        if d["clip_start"] < 0:
            problems.append(f"{lid}: clip starts at {d['clip_start']} < 0")
    order = sorted(D, key=lambda k: D[k]["speech_start"])
    for a, b in zip(order, order[1:]):
        ov = D[a]["speech_end"] - D[b]["speech_start"]
        if ov > (int(CUT[a].get("run", 3)) if a in CUT else 0):
            problems.append(f"{a}/{b}: speech overlaps by {ov} frames")

    # ------------------------------------------------------------ sound
    def vol(c, extra=0.0, base=None):
        return db((c["gain"] if base is None else float(base)) + extra)

    def bed(c, start, end, segments=(), trim=None, fade_in=0, fade_out=1, loop=None, base=None, extra=0.0,
            id_=None, duck=None, min_piece=12):
        lo, hi = c["lo"], c["hi"]
        loop = c["loop"] if loop is None else loop
        trim = lo if trim is None else trim
        cid = id_ or c["id"]
        cuts = sorted({start, end, *[max(start, min(end, x)) for a, b, _ in segments for x in (a, b)]})
        pieces = []
        for a, b in zip(cuts, cuts[1:]):
            if b <= a:
                continue
            g = 0.0
            for s0, s1, x in segments:
                if s0 <= a and b <= s1:
                    g = x
            pieces.append([a, b, g])
        mrg = []
        for pc in pieces:
            if mrg and mrg[-1][2] == pc[2]:
                mrg[-1][1] = pc[1]
            else:
                mrg.append(pc)
        tidy = []
        for pc in mrg:
            if tidy and pc[1] - pc[0] < min_piece:
                tidy[-1][1] = pc[1]
            else:
                tidy.append(pc)
        clips = []
        for a, b, g in tidy:
            off = trim + (a - start)
            a2 = a
            while a2 < b:
                o = off + (a2 - a)
                if loop:
                    o = lo + (o - lo) % (hi - lo)
                room = hi - o
                if room <= 0:
                    log.append(f"{cid}: file ends before frame {a2} (bed shortened).")
                    break
                seg_end = min(b, a2 + room)
                clips.append(dict(a=a2, b=seg_end, trim=o, g=g, wrap=(seg_end < b)))
                a2 = seg_end
        out = []
        for k, cl in enumerate(clips):
            nx = clips[k + 1] if k + 1 < len(clips) else None
            pv = clips[k - 1] if k else None
            dur = cl["b"] - cl["a"]
            clip = {"id": f"{cid}#{k}" if len(clips) > 1 else cid, "src": c["src"], "start": cl["a"],
                    "duration": dur, "volume": vol(c, extra + cl["g"], base)}
            if cl["trim"]:
                clip["trimBefore"] = cl["trim"]
            fi = fade_in if pv is None else (0 if pv["wrap"] else XF)
            fo = fade_out if nx is None else 0
            if nx is not None and not cl["wrap"] and cl["trim"] + dur + XF <= hi:
                clip["duration"] = dur + XF
                fo = XF
            if fi:
                clip["fadeIn"] = fi
            if fo:
                clip["fadeOut"] = fo
            if duck is not None:
                clip["duck"] = duck
            out.append(clip)
        return out

    def xloop(c, start, end, xf, fade_in=12, fade_out=1, base=None, extra=0.0, id_=None, duck=None):
        """Loop the usable window with an xf-frame crossfade at every join (for files that are not seamless loops)."""
        lo, hi = c["lo"], c["hi"]
        n_len = hi - lo
        if n_len <= xf:
            log.append(f"{c['id']}: window too short to loop with a {xf}-frame crossfade; dropped.")
            return []
        out, t, n = [], start, 0
        pre = id_ or c["id"]
        while t < end:
            d = min(n_len, end - t)
            last = t + d >= end
            clip = {"id": f"{pre}{n}", "src": c["src"], "start": t, "duration": d, "trimBefore": lo,
                    "volume": vol(c, extra, base), "fadeIn": fade_in if n == 0 else xf, "fadeOut": fade_out if last else xf}
            if not clip["trimBefore"]:
                del clip["trimBefore"]
            if duck is not None:
                clip["duck"] = duck
            out.append(clip)
            n += 1
            t += n_len - xf
        return out

    def point(c, at, until=None, trim=None, len_=None, base=None, extra=0.0, fade_in=0, fade_out=0, id_=None,
              duck=None, grid=None, fade_in_untrimmed=None):
        lo, hi = c["lo"], c["hi"]
        trim = lo if trim is None else trim
        start = at
        cid = id_ or c["id"]
        if grid:
            T = until - at
            g, mx = ev(grid["grid"]), ev(grid.get("max", hi - trim))
            k = math.ceil(T / g)
            if k * g <= mx:
                trim, start = trim + k * g - T, at
            else:
                k = mx // g
                start = until - k * g
            len_ = until - start
            if trim == lo and fade_in_untrimmed is not None:
                fade_in = fade_in_untrimmed
            log.append(f"{lang}: {cid} enters {(trim - lo) / FPS:.2f} s into the file so its end at frame {until} "
                       f"falls on the file's {g}-frame grid ({(trim + until - start) / FPS:.2f} s).")
        if start < 0:
            trim, start = trim - start, 0
        dur = hi - trim
        if len_ is not None:
            dur = min(dur, len_)
        if until is not None:
            dur = min(dur, until - start)
        dur = min(dur, END - start)
        if dur <= 0:
            log.append(f"{cid}: no room at frame {at} (dropped).")
            return []
        clip = {"id": cid, "src": c["src"], "start": start, "duration": dur, "volume": vol(c, extra, base)}
        if trim:
            clip["trimBefore"] = trim
        if fade_in:
            clip["fadeIn"] = fade_in
        if fade_out:
            clip["fadeOut"] = fade_out
        if duck is not None:
            clip["duck"] = duck
        return [clip]

    def split_point(clips, c, splits, extra, base):
        """Split one point clip at frames with extra gain after each split, XF crossfades."""
        if not clips:
            return clips
        c0 = clips[0]
        cuts = sorted(x for x, _ in splits if c0["start"] < x < c0["start"] + c0["duration"])
        if not cuts:
            return clips
        gains = dict(splits)
        bounds = [c0["start"]] + cuts + [c0["start"] + c0["duration"]]
        out, g = [], 0.0
        for k, (a, b) in enumerate(zip(bounds, bounds[1:])):
            if k:
                g = gains[a]
            last = k == len(bounds) - 2
            p = dict(c0, id=f"{c0['id']}#{k}", start=a, duration=b - a + (0 if last else XF), volume=vol(c, extra + g, base))
            if k:
                p["trimBefore"] = c0.get("trimBefore", 0) + a - c0["start"]
                p["fadeIn"] = XF
                if "fadeOut" in c0:
                    p["fadeOut"] = c0["fadeOut"]
            if not last:
                p["fadeOut"] = XF
            out.append(p)
        return out

    def fill_tail(clips, c, until, id_):
        last = clips[-1]
        fill = until - (last["start"] + last["duration"])
        L = c["hi"]
        if 0 < fill < (L - c["lo"]) // 2:
            last["fadeOut"] = XF
            clips.append(dict(last, id=f"{id_}#fill", start=until - fill - XF, duration=fill + XF,
                              trimBefore=L - fill - XF - 2, fadeIn=XF, fadeOut=1))
        return clips

    filters_used = {}

    def filter_chain(fs):
        """edit.json sound[].filter: an ffmpeg audio filter chain, or {lowpass_hz, highpass_hz, poles, volume_db}."""
        if isinstance(fs, str) and fs.strip():
            return fs.strip()
        if not isinstance(fs, dict):
            raise ExprError(f"filter {fs!r} is neither a chain nor an object")
        poles, parts = int(fs.get("poles", 2)), []
        if fs.get("highpass_hz"):
            parts.append(f"highpass=f={float(fs['highpass_hz']):g}:poles={poles}")
        if fs.get("lowpass_hz"):
            parts.append(f"lowpass=f={float(fs['lowpass_hz']):g}:poles={poles}")
        if fs.get("volume_db") is not None:
            parts.append(f"volume={float(fs['volume_db']):g}dB")
        if not parts:
            raise ExprError("filter has none of lowpass_hz, highpass_hz, volume_db")
        return ",".join(parts)

    def filtered(c, fs):
        """The cue run through a filter chain once, cached as edit/sound/<cue>.<hash>.wav (Remotion plays files
        as they are, so a low-passed bed is a pre-filtered file). Same length, so windows and loops still hold."""
        chain = filter_chain(fs)
        key = f"{md5(c['path'])} {chain}"
        out = ED / "edit" / "sound" / f"{c['id']}.{hashlib.md5(key.encode()).hexdigest()[:8]}.wav"
        stamp = out.with_suffix(".src")
        if not (out.exists() and stamp.exists() and stamp.read_text() == key):
            out.parent.mkdir(parents=True, exist_ok=True)
            r = run(["ffmpeg", "-v", "error", "-y", "-i", str(c["path"]), "-af", chain, "-c:a", "pcm_s16le", str(out)])
            if r.returncode != 0 or not out.exists():
                raise ExprError(f"filter {chain!r} failed: {r.stderr.strip()[:200]}")
            stamp.write_text(key)
        L = probe_frames(out)
        filters_used.setdefault(c["id"], {})[chain] = E.rel(out)
        return dict(c, path=out, src=E.rel(out), L=L, lo=min(c["lo"], L), hi=min(c["hi"], L))

    music, sfx, unplaced = [], [], []
    spec = cfg["sound"]
    if spec is None:
        spec = []
        for cid, meta in cue_meta.items():
            for p in meta.get("place", []) if isinstance(meta.get("place"), list) else []:
                spec.append(dict(p, cue=cid))
            for u in meta.get("uses", []) or []:
                if isinstance(u, dict) and isinstance(u.get("place"), dict):
                    spec.append(dict(u["place"], cue=cid))
    placed_ids = set()
    for item in spec:
        cid = item["cue"]
        c = cue(cid)
        if c is None:
            continue
        try:
            kind = item.get("kind", "point")
            base = item.get("gain_db")
            extra = float(per_lang(item.get("db"), lang, 0.0) or 0.0)
            id_ = (cid + item["id"]) if str(item.get("id", "")).startswith("#") else item.get("id")
            segs = [(ev(sg["from"]), ev(sg["to"]) if "to" in sg else END, float(per_lang(sg["db"], lang, 0.0)))
                    for sg in item.get("segments", [])]
            if "window_s" in item:
                c = dict(c, lo=F(item["window_s"][0]), hi=min(c["L"], F(item["window_s"][1])))
            if item.get("filter"):
                c = filtered(c, item["filter"])
            at = ev(item.get("at", item.get("from", 0)))
            if kind == "bed":
                to = ev(item.get("to", item.get("until", "end")))
                if item.get("loop_xf"):
                    clips = xloop(c, at, to, int(item["loop_xf"]), int(item.get("fade_in", 12)), int(item.get("fade_out", 1)),
                                  base, extra, id_ or f"{cid}#", item.get("duck"))
                else:
                    clips = bed(c, at, to, segs, ev(item["trim"]) if "trim" in item else None, int(item.get("fade_in", 0)),
                                int(item.get("fade_out", 1)), item.get("loop"), base, extra, id_, item.get("duck"))
            else:
                until = ev(item["until"]) if "until" in item else None
                clips = point(c, at, until, ev(item["trim"]) if "trim" in item else None,
                              ev(item["len"]) if "len" in item else None, base, extra, int(item.get("fade_in", 0)),
                              int(item.get("fade_out", 0)), id_, item.get("duck"), item.get("end_on_grid"),
                              item.get("fade_in_untrimmed"))
                if segs:
                    clips = split_point(clips, c, [(a, g) for a, _, g in segs], extra, base)
                if item.get("fill_tail") and clips:
                    clips = fill_tail(clips, c, until if until is not None else END, id_ or cid)
        except ExprError as e:
            log.append(f"sound {cid}: {e}; not placed.")
            continue
        bus = item.get("bus") or ("music" if str(c["type"]).startswith("mus") or cid.startswith("mus_") else "sfx")
        (music if bus == "music" else sfx).extend(clips)
        placed_ids.add(cid)
    for cid in cue_meta:
        if cid not in placed_ids:
            unplaced.append(cid)
            if str(cue_meta[cid].get("status", "")).lower().startswith("drop"):
                sound_missing.setdefault(cid, f"marked '{cue_meta[cid]['status']}' on the cue sheet")
    if unplaced:
        log.append(f"sound: {len(unplaced)} cue(s) on the sheet have no placement in edit.json and are not in the mix: "
                   + ", ".join(unplaced))

    duck_db = None
    for c in cue_meta.values():
        if isinstance(c.get("duck"), dict) and c["duck"].get("under_dialogue_db") is not None:
            duck_db = c["duck"]["under_dialogue_db"]
            break
    for k in ("music_duck_under_dialogue_db",):
        if mix.get(k) is not None:
            duck_db = mix[k]
    if duck_db is None:
        duck_db = start_gains.get("music_duck_under_dialogue", -8)
    ducking = dict({"enabled": True, "amountDb": duck_db, "attack": 8, "release": 15, "holdGap": 20}, **cfg["ducking"])

    # ------------------------------------------------------------ shots
    # Frame manifest: the latest row with status ok for a shot (else its last row, so a failed shot shows as failed).
    frame_status, frame_attempt = {}, {}
    for r in frames_manifest:
        sid_ = r.get("shot_id") or r.get("shot")
        if not sid_:
            continue
        if str(r.get("status", "ok")).lower() == "ok":
            frame_status[sid_] = r
            frame_attempt[sid_] = max(frame_attempt.get(sid_, 0), int(r.get("attempt") or 1))
        elif str(frame_status.get(sid_, {}).get("status", "")).lower() != "ok":
            frame_status[sid_] = r
    # frames/review.json (D-023): per shot, the row for the highest attempt wins; a later row wins a tie.
    # A row whose file_md5 is not the png on disk, or whose attempt is older than the manifest's latest ok
    # attempt, judged an earlier take. It still applies (a rejected shot stays a slate until a row approves
    # its retake), and the shot is listed in meta.frames_unchecked_takes.
    review_rows = {}
    for r in frame_review:
        a = int(r.get("attempt") or 0)
        if r["shot"] not in review_rows or a >= int(review_rows[r["shot"]].get("attempt") or 0):
            review_rows[r["shot"]] = r
    md5_cache = {}

    unchecked = {}

    def verdict_of(sid_, img_):
        """('pass' | 'fail' | 'unknown' | None for no row, why)."""
        r = review_rows.get(sid_)
        if r is None:
            return None, "not in frames/review.json"
        a = int(r.get("attempt") or 0)
        v = "fail" if r.get("ok") is False else frame_verdict(r.get("verdict"))
        why = f"verdict {r.get('verdict')!r}" + (f", attempt {a}" if a else "")
        stale = None
        if a and frame_attempt.get(sid_, 0) > a:
            stale = f"attempt {frame_attempt[sid_]} is on disk and has no review row yet"
        elif r.get("file_md5") and img_ is not None and img_.exists():
            if img_ not in md5_cache:
                md5_cache[img_] = md5(img_)
            if md5_cache[img_] != r["file_md5"]:
                stale = f"the png on disk ({md5_cache[img_][:8]}) is not the judged file ({r['file_md5'][:8]})"
        if stale:
            unchecked[sid_] = f"{why} judged an earlier take; {stale}"
            why += f" (an earlier take: {stale})"
        if v is None:
            return "unknown", f"verdict {r.get('verdict')!r} is neither approved nor rejected"
        return v, why

    SHOT = {x["id"]: x for x in shots}
    derive_map = shots_doc.get("second_framings") if isinstance(shots_doc.get("second_framings"), dict) else {}

    def frame_spec(s_):
        """(kind, source shot, image) from shots.json. Second framings: frame.kind 'second_framing' with
        frame.source_shot (series1), or frame_source / top-level second_framings (series2). Reused assets:
        frame.kind 'reused_asset' with frame.image (an approved photograph or sheet, never regenerated)."""
        fr = s_.get("frame") if isinstance(s_.get("frame"), dict) else {}
        dm = derive_map.get(s_["id"]) if isinstance(derive_map.get(s_["id"]), dict) else {}
        kind = fr.get("kind")
        src = fr.get("source_shot") or fr.get("source") or s_.get("frame_source") or dm.get("source")
        image = fr.get("image") or dm.get("image")
        if kind == "reused_asset":
            return "reused_asset", None, image
        if kind == "second_framing" or src:
            return "second_framing", src, image
        return "generated", None, None

    def asset_path(f):
        """An image path from shots.json. An absolute path inside some content/ tree is re-rooted onto this
        checkout's content/ when the file is there (so a scratch copy reads its own files)."""
        pth = Path(f)
        if pth.is_absolute() and E.root is not None and "content" in pth.parts:
            i = len(pth.parts) - 1 - pth.parts[::-1].index("content")
            q = E.root / Path(*pth.parts[i:])
            if q.exists():
                return q
        return E.resolve(f)

    frames_info, unreviewed, scale_problems = {}, [], []  # unreviewed: shown frames with no review row

    def picture(sid_, chain=()):
        """(image Path or None, why it is a slate or None, info dict) for a shot."""
        s_ = SHOT[sid_]
        kind, src, image = frame_spec(s_)
        info = {"kind": kind}
        if kind == "second_framing" and src:
            info["source"] = src
            if src in chain or src == sid_:
                return None, f"second framing loop through {src}", info
            if src not in SHOT:
                if not image:
                    return None, f"source shot {src} is not in shots.json", info
                kind = "reused_asset"
            else:
                own = ED / "frames" / f"{sid_}.png"
                if own.exists():
                    log.append(f"{lang} {sid_}: frames/{sid_}.png exists, but {sid_} is a second framing of {src}; "
                               f"the source frame is used and frames/{sid_}.png is ignored.")
                pimg, pbad, pinfo = picture(src, chain + (sid_,))
                info["verdict"] = f"from {src}: " + pinfo.get("verdict", "")
                if pbad:
                    return None, f"source {src}: {pbad}", info
                v, why = verdict_of(sid_, None)
                if v in ("fail", "unknown"):
                    return None, f"own row {why}", info
                return pimg, None, info
        if kind == "reused_asset":
            if not image:
                return None, "reused asset with no frame.image", info
            pth = asset_path(image)
            info["image"] = E.rel(pth)
            if not pth.exists():
                return None, f"reused asset {image} not found", info
            v, why = verdict_of(sid_, None)
            info["verdict"] = why if v else "reused approved asset (no frames/review.json row)"
            if v in ("fail", "unknown"):
                return None, why, info
            return pth, None, info
        img_ = ED / "frames" / f"{sid_}.png"
        fm = frame_status.get(sid_, {})
        if not img_.exists():
            return None, "frame missing", info
        if fm.get("status") not in (None, "ok"):
            return None, f"frame manifest status {fm.get('status')!r}", info
        v, why = verdict_of(sid_, img_)
        info["verdict"] = why
        if v == "fail":
            return None, f"rejected ({why})", info
        if v == "unknown":
            return None, why, info
        if v is None and sid_ not in unreviewed:
            unreviewed.append(sid_)
        return img_, None, info

    def shot_move(s_):
        """The camera move as shots.json writes it: camera_move as a Move object (series1), or a preset name with
        intensity and focus|camera_focus, or 'custom' with the from/to in 'move' (series2)."""
        cm = s_.get("camera_move")
        focus = s_.get("focus") or s_.get("camera_focus")
        if isinstance(cm, dict):
            mv = json.loads(json.dumps(cm))
        elif isinstance(s_.get("move"), dict) and cm in (None, "custom", s_["move"].get("preset")):
            mv = json.loads(json.dumps(s_["move"]))
        else:
            mv = {"preset": cm or "hold"}
        pre = mv.get("preset", "hold")
        if pre == "custom" and not (isinstance(mv.get("from"), dict) and isinstance(mv.get("to"), dict)):
            log.append(f"{lang} {s_['id']}: camera_move 'custom' with no from/to; held still.")
            return {"preset": "hold"}
        if pre not in ("hold", "custom"):
            mv.setdefault("intensity", s_.get("intensity", 0.5))
            if focus and pre in FOCUS_PRESETS:
                mv.setdefault("focus", focus)
        return mv

    shot_cfg = cfg["shots"]

    def jitter_shots(base, jc, z):
        on = lambda f: pulse_on(jc["cue"], f - z)
        rng = random.Random(jc.get("seed", 0))
        sc, amp, step = jc.get("scale", 1.012), jc.get("amp", 0.55), int(jc.get("step", 2))

        def key(x=0.0, y=0.0):
            return {"scale": sc, "x": round(x, 3), "y": round(y, 3)}

        def jolt(j):
            sx = 1 if j % 2 == 0 else -1
            return key(sx * amp * rng.uniform(0.5, 1.0), amp * rng.uniform(-0.6, 0.6))

        visual = {k: v for k, v in base.items() if k in ("image", "layers", "type", "note")}
        out, k, n, j = [], 0, base["duration"], 0
        while k < n:
            f = base["start"] + k
            if on(f):
                length = 1
                while length < step and k + length < n and on(f + length):
                    length += 1
                frm, nx = jolt(j), jolt(j + 1)
                j += 2
                mv = {"preset": "custom", "easing": "linear", "from": frm, "to": nx}
            else:
                length = 1
                while k + length < n and not on(f + length):
                    length += 1
                mv = {"preset": "custom", "from": key(), "to": key()}
            sid_ = base["id"] if not out else f"{base['id']}-j{len(out):02d}"
            out.append({"id": sid_, "start": f, "duration": length, **visual, "move": mv,
                        **({"subshot_of": base["id"]} if out else {})})
            k += length
        return out

    tl_shots, slates, cuts = [], [], []
    for p in pic:
        s = p["shot"]
        sid = s["id"]
        sc = shot_cfg.get(sid, {})
        img, why_bad, finfo = picture(sid)
        shot = {"id": sid, "start": p["start"], "duration": p["duration"]}
        if why_bad:
            shot.update(type="slate", note=f"frame missing or rejected: {str(s.get('action', ''))[:80]}")
            slates.append(sid)
            finfo["slate"] = why_bad
            log.append(f"{lang} {sid}: slate, {why_bad}.")
        else:
            layers = [dict(x, src=x["src"].replace("{lang}", lang)) for x in sc.get("layers", [])]
            if layers and all((ED / x["src"]).exists() for x in layers):
                shot["layers"] = layers
            else:
                shot["image"] = E.rel(img)
            finfo["image"] = shot.get("image") or [x["src"] for x in layers]
        mv = shot_move(s)
        if "move" in sc:
            mv = json.loads(json.dumps(sc["move"]))
            if mv != shot_move(s):
                log.append(f"{lang} {sid}: camera move from edit.json shots.{sid}.move, not shots.json.")
        shot["move"] = mv
        if finfo["kind"] != "generated":
            limit = float((derive_map.get(sid) or {}).get("max_scale", 1.3)) if isinstance(derive_map.get(sid), dict) else 1.3
            top = max([float(mv[k].get("scale", 1)) for k in ("from", "to") if isinstance(mv.get(k), dict)] or [0])
            finfo["max_scale"] = top or None
            if top > limit + 1e-9:
                scale_problems.append(f"{sid}: {finfo['kind']} at scale {top:g}, over {limit:g} (D-010)")
        frames_info[sid] = finfo
        if p["start"] > 0:
            cuts.append(p["start"])
        punch = sc.get("punch")
        at = None
        if punch:
            at = D[punch["line"]]["speech_start"] - int(punch.get("lead", 4))
            mn = int(punch.get("min_part", 30))
            if not (p["start"] + mn <= at <= p["start"] + p["duration"] - mn):
                log.append(f"{lang} {sid}: punch-in at frame {at} would leave a part under {mn} frames; not cut.")
                at = None
        if at is not None:
            first = dict(shot, duration=at - p["start"])
            fmv = dict(punch.get("first_move", mv))
            focus = s.get("focus") or s.get("camera_focus")
            if focus and fmv.get("preset") in FOCUS_PRESETS and "focus" not in fmv:
                fmv["focus"] = focus
            first["move"] = fmv
            second = {"id": punch.get("id", f"{sid}-punch"), "start": at, "duration": p["start"] + p["duration"] - at,
                      **{k: v for k, v in shot.items() if k in ("image", "layers", "type", "note")},
                      "move": json.loads(json.dumps(punch["move"])), "subshot_of": sid}
            tl_shots += [first, second]
            cuts.append(at)
        elif sc.get("jitter") and mv.get("preset") == "hold":
            jc = sc["jitter"]
            tl_shots += jitter_shots(shot, jc, ev(jc["from"]) if "from" in jc else p["start"])
        else:
            tl_shots.append(shot)
    cuts.append(END)

    # ------------------------------------------------------------ supers (D-024 ruling 3)
    supers_tl, supers_placed, supers_unplaced, super_flags = place_supers(
        script, shots, pic, D, cuts, slates, END, cfg["supers"], lang, log, ev, shot_cfg)

    # ------------------------------------------------------------ dialogue
    dialogue, placement = [], []
    for lid in sorted(D, key=lambda k: D[k]["clip_start"]):
        d, L = D[lid], lines[lid]
        lc = line_cfg.get(lid, {})
        g = float(per_lang(lc.get("gain_db"), lang, 0.0) or 0.0)
        sg = per_lang(lc.get("segment_gain_db"), lang)
        dur = min(L["clip_frames"], TOTAL - d["clip_start"])
        src = E.rel(L["file"])
        if sg is not None and L["pause_frames"]:
            gains = sg if isinstance(sg, list) else [sg]
            pf = L["pause_frames"]
            mids = [(a + b) // 2 for a, b in pf[:len(gains)]]
            bounds = [0] + mids + [dur]
            for k, (a, b) in enumerate(zip(bounds, bounds[1:])):
                clip = {"id": f"{lid}#{'abcdefgh'[k]}", "src": src, "start": d["clip_start"] + a, "duration": b - a,
                        "volume": db(g + (gains[k] if k < len(gains) else 0.0))}
                if a or L["trim"]:
                    clip["trimBefore"] = L["trim"] + a
                dialogue.append(clip)
        else:
            clip = {"id": lid, "src": src, "start": d["clip_start"], "duration": dur, "volume": db(g)}
            if L["trim"]:
                clip["trimBefore"] = L["trim"]
            if L["placeholder"]:
                clip["placeholder"] = True
            dialogue.append(clip)
        cs, wt = d["clip_start"], L["wt"]
        placement.append({
            "line_id": lid, "speaker": L["speaker"], "shot": d["shot"],
            "startMs": ms(cs), "endMs": ms(cs + dur),
            "speechStartFrame": d["speech_start"], "speechEndFrame": d["speech_end"],
            "speechStartMs": ms(d["speech_start"]), "speechEndMs": ms(d["speech_end"]),
            "pauses": [{"startFrame": round(cs + p["p0"], 2), "endFrame": round(cs + p["p1"], 2), "kind": p["kind"],
                        "beforeWord": p["k"]} for p in wt["pauses"]],
            "words": [{"text": w["text"], "startFrame": round(cs + w["start"], 2), "endFrame": round(cs + w["end"], 2)}
                      for w in wt["words"]],
            "segments": wt["segments"], "cutoff": lid in CUT,
            "file": E.rel(L["file"]), "sourceTake": E.rel(L["source"]),
            "trimInFrames": L["trim"], "measured": L["meas"], "placeholder": L["placeholder"],
        })

    length_ok = TOTAL / FPS <= float(cfg["max_seconds"])
    if not length_ok:
        log.append(f"{lang}: cut runs {TOTAL / FPS:.1f} s, over the {cfg['max_seconds']} s ceiling (D-018/D-019/D-020).")
    sound_placeholders = sorted(k for k, c in cue_cache.items() if c and c["placeholder"])
    if unreviewed and frame_review:
        log.append(f"{lang}: frames with no frames/review.json row, shown as they are: {', '.join(unreviewed)}")
    for k, v in unchecked.items():
        log.append(f"{lang} {k}: {v}; the verdict stands until a row for the new take is added.")
    for sp_ in scale_problems:
        log.append(f"{lang}: {sp_}")
    timeline = {
        "id": f"{shots_doc.get('id', E.dir.name)}-{lang}",
        "fps": FPS,
        "durationFrames": TOTAL,
        "background": "#000",
        "slateColor": cfg["slate_color"],
        "shots": tl_shots,
        "audio": {"dialogue": dialogue, "music": music, "sfx": sfx, "ducking": ducking},
        "subtitlesFile": f"subs.{lang}.json",
        "debug": {"burnSubtitles": False, "showInfo": False},
        **({"supers": supers_tl} if supers_tl else {}),
        "meta": {
            "built_by": "production/scripts/episode/build_timeline.py",
            "lang": lang,
            "picture_seconds": round(END / FPS, 3),
            "total_seconds": round(TOTAL / FPS, 3),
            "planned_seconds": shots_doc.get("total_duration_s"),
            "cuts": cuts,
            "end": f"hard cut to black and silence at frame {END}, {LY['end_black']} black frames after",
            "placeholders": {"dialogue": [l for l in D if lines[l]["placeholder"]], "frames_slated": slates,
                             "sound": sound_placeholders + sorted(k for k in sound_missing if k not in sound_placeholders)},
            "sound_missing": sound_missing,
            "frames": frames_info,
            "frames_unreviewed": unreviewed,
            "frames_unchecked_takes": unchecked,
            "frame_review_format": frame_review_shape,
            "split_lines": split_lines,
            "sound_filters": filters_used,
            "takes": {l: lines[l]["why"] for l in order},
            "shot_vs_plan": {p["shot"]["id"]: f"{p['duration'] / FPS:.2f} s (plan {p['shot'].get('duration_s')} s)" for p in pic},
            "shot_frames": {p["shot"]["id"]: [p["start"], p["duration"]] for p in pic},
            "sound_windows": windows_used,
            "sound_unplaced": unplaced,
            "supers": {"burn": bool(cfg["supers"].get("burn", True)), "placed": supers_placed,
                       "unplaced": supers_unplaced},
            "checks": {"layout_problems": problems, "length_ok": length_ok, "max_seconds": cfg["max_seconds"],
                       "second_framing_scale": scale_problems, "supers": super_flags},
            "notes": list(log) + list(cfg.get("notes") or []),
        },
    }
    dump(ED / f"timeline.{lang}.json", timeline)
    dump(ED / f"dialogue-placement.{lang}.json", {"lang": lang, "fps": FPS, "cuts": cuts, "end": END, "lines": placement})
    print(f"{lang}: {len(tl_shots)} shots ({len(slates)} slate), {len(dialogue)} dialogue clips "
          f"({sum(1 for l in D if lines[l]['placeholder'])} placeholder), {len(music)} music, {len(sfx)} sfx, "
          f"{TOTAL} frames = {TOTAL / FPS:.2f} s; shots " + " ".join(f"{p['shot']['id']}={p['duration']}" for p in pic))
    if supers_placed or supers_unplaced:
        print(f"{lang}: supers placed " + (" ".join(f"{x['id']}@{x['shot']}={x['start']}+{x['duration']}"
                                                 for x in supers_placed) or "none")
              + (f"; unplaced {', '.join(x['id'] for x in supers_unplaced)}" if supers_unplaced else "")
              + ("" if cfg["supers"].get("burn", True) else " (burn false: not in the picture)"))
    for n in log:
        print("NOTE", n)
    if problems:
        for pr in problems:
            print("PROBLEM", pr)
        sys.exit(1)


if __name__ == "__main__":
    main()
