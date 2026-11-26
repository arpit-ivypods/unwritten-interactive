#!/usr/bin/env python3
"""Episode toolchain: check the rendered cuts of one episode and print a JSON summary.

    python3 -I production/scripts/episode/verify.py <episode_dir> [--remaster]

Per language, for render/<name>.<lang>.mp4 and render/<name>.<lang>.review.mp4:
  - video is H.264 1080x1920 30 fps and has exactly timeline durationFrames frames;
  - loudness: integrated within +/-0.5 LU of -14 LUFS and true peak <= -1 dBTP (D-0M4),
    measured with the ffmpeg loudnorm pass (two decimals, as master-audio.sh). With --remaster a file outside tolerance is
    run once more through production/scripts/master-audio.sh and measured again;
  - length <= max_seconds (edit.json, default 150 s; D-018/D-019/D-020).
Across files: Hindi and English cuts differ (md5), clean and review cuts differ.
Subtitles: subs.<lang>.json validation ok (build_subs.py), the review timeline burns
exactly those cues, and every cue ends inside the video.
Exit 0 when every check passes.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import FPS, Episode, load, loudness, md5, run  # noqa: E402

TARGET_I, TOL_I, MAX_TP = -14.0, 0.5, -1.0
MASTER = HERE.parent / "master-audio.sh"


def video_info(p):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
               "stream=codec_name,width,height,r_frame_rate,nb_read_packets", "-of", "json", str(p)]).stdout
    s = (json.loads(out or "{}").get("streams") or [{}])[0]
    dur = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).stdout.strip()
    return {"codec": s.get("codec_name"), "size": f"{s.get('width')}x{s.get('height')}", "fps": s.get("r_frame_rate"),
            "frames": int(s.get("nb_read_packets") or 0), "seconds": float(dur or 0)}


def check_file(p, want_frames, remaster):
    r = {"file": str(p), "exists": p.exists()}
    if not p.exists():
        r["ok"] = False
        r["problems"] = ["missing"]
        return r
    probs = []
    v = video_info(p)
    r.update(video=v)
    if v["codec"] != "h264" or v["size"] != "1080x1920" or v["fps"] != "30/1":
        probs.append(f"video is {v['codec']} {v['size']} {v['fps']}, not h264 1080x1920 30/1")
    if v["frames"] != want_frames:
        probs.append(f"{v['frames']} video frames, timeline says {want_frames}")
    i, tp = loudness(p)
    r.update(lufs=i, true_peak_dbtp=tp)

    def loud_ok(i, tp):
        return i is not None and tp is not None and abs(i - TARGET_I) <= TOL_I and tp <= MAX_TP

    if not loud_ok(i, tp) and remaster and MASTER.exists() and i not in (None, float("-inf")):
        tmp = p.with_suffix(".pre-remaster.mp4")
        shutil.copyfile(p, tmp)
        res = subprocess.run([str(MASTER), str(tmp), str(p)], capture_output=True, text=True)
        tmp.unlink()
        i2, tp2 = loudness(p)
        r["remastered"] = {"before": [i, tp], "after": [i2, tp2], "exit": res.returncode}
        i, tp = i2, tp2
        r.update(lufs=i, true_peak_dbtp=tp)
    if not loud_ok(i, tp):
        probs.append(f"loudness {i} LUFS / {tp} dBTP outside {TARGET_I}+/-{TOL_I} LUFS, <= {MAX_TP} dBTP")
    r["md5"] = md5(p)
    r["problems"] = probs
    r["ok"] = not probs
    return r


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: verify.py <episode_dir> [--remaster]")
    E = Episode(sys.argv[1])
    remaster = "--remaster" in sys.argv
    ED = E.dir
    max_s = float(E.edit.get("max_seconds", 150))
    summary = {"episode": str(ED), "name": E.name, "langs": {}, "cross": {}}
    md5s = {}
    all_ok = True
    for lang in ("hi", "en"):
        tl = load(ED / f"timeline.{lang}.json")
        rv = load(ED / f"timeline.{lang}.review.json")
        subs = load(ED / f"subs.{lang}.json")
        L = {"problems": []}
        if not tl:
            L["problems"].append("no timeline")
            summary["langs"][lang] = L
            all_ok = False
            continue
        want = tl["durationFrames"]
        meta = tl.get("meta", {})
        L["timeline_frames"] = want
        L["seconds"] = round(want / FPS, 3)
        L["length_ok"] = want / FPS <= max_s
        if not L["length_ok"]:
            L["problems"].append(f"{want / FPS:.1f} s is over the {max_s} s ceiling")
        lp = (meta.get("checks") or {}).get("layout_problems") or []
        if lp:
            L["problems"] += [f"layout: {x}" for x in lp]
        L["placeholders"] = meta.get("placeholders", {})
        L["sound_unplaced"] = meta.get("sound_unplaced", [])
        # reported, not failed: a screener should know about these before watching
        for k in ("sound_missing", "frames_unchecked_takes", "frames_unreviewed"):
            if meta.get(k):
                L[k] = meta[k]
        if (meta.get("checks") or {}).get("second_framing_scale"):
            L["second_framing_scale"] = meta["checks"]["second_framing_scale"]
        sm = meta.get("supers") or {}
        if sm.get("placed") or sm.get("unplaced"):  # D-024 ruling 3: reported, not failed
            L["supers"] = {"burned": len(tl.get("supers") or []), "placed": len(sm.get("placed") or []),
                           "unplaced": [f"{x['id']}: {x['why']}" for x in sm.get("unplaced") or []],
                           "flags": (meta.get("checks") or {}).get("supers") or []}
        clean = check_file(ED / "render" / f"{E.name}.{lang}.mp4", want, remaster)
        review = check_file(ED / "render" / f"{E.name}.{lang}.review.mp4", want, remaster)
        L["clean"], L["review"] = clean, review
        for k, r in (("clean", clean), ("review", review)):
            L["problems"] += [f"{k}: {x}" for x in r.get("problems", [])]
            if r.get("md5"):
                md5s[(lang, k)] = r["md5"]
        # subtitles
        if not subs:
            L["problems"].append("no subs file")
        else:
            val = subs.get("validation", {})
            L["subs"] = {"cues": len(subs["cues"]), "validation_ok": val.get("ok"), "warnings": val.get("warnings", []),
                         "max_cps": val.get("max_cps"), "min_gap_frames": val.get("min_gap_frames")}
            if not val.get("ok"):
                L["problems"] += [f"subs: {x}" for x in val.get("problems", ["validation missing"])]
            burned = [(c["startMs"], c["endMs"], c["text"]) for c in (rv or {}).get("subtitles", [])]
            if burned != [(c["startMs"], c["endMs"], c["text"]) for c in subs["cues"]]:
                L["problems"].append("review timeline does not burn exactly the subs cues")
            if any(c["endMs"] > want * 1000 / FPS + 250 for c in subs["cues"]):
                L["problems"].append("a cue ends after the video")
            if tl.get("debug", {}).get("burnSubtitles"):
                L["problems"].append("clean timeline burns subtitles")
        L["ok"] = not L["problems"]
        all_ok &= L["ok"]
        summary["langs"][lang] = L
    cross = summary["cross"]
    if ("hi", "clean") in md5s and ("en", "clean") in md5s:
        cross["hi_en_clean_differ"] = md5s[("hi", "clean")] != md5s[("en", "clean")]
    if ("hi", "review") in md5s and ("en", "review") in md5s:
        cross["hi_en_review_differ"] = md5s[("hi", "review")] != md5s[("en", "review")]
    for lang in ("hi", "en"):
        if (lang, "clean") in md5s and (lang, "review") in md5s:
            cross[f"{lang}_clean_review_differ"] = md5s[(lang, "clean")] != md5s[(lang, "review")]
    cross_ok = bool(cross) and all(cross.values()) and len(cross) == 4
    all_ok &= cross_ok
    summary["cross_ok"] = cross_ok
    summary["ok"] = all_ok
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
