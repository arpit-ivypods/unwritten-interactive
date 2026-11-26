"""Shared helpers for the episode toolchain (production/scripts/episode/).

Everything here is generic: paths, probing, silence measurement, loudness,
JSON loading, the edit.json expression evaluator and the per-frame pulse
pattern of a sound cue. All times are integer frames at 30 fps unless a name
ends in _s.
"""
import ast
import hashlib
import json
import math
import re
import subprocess
from array import array
from pathlib import Path

FPS = 30
LANGS = ("hi", "en")


def F(sec):
    return int(round(sec * FPS))


def ms(frames):
    return int(round(frames * 1000 / FPS))


def db(x):
    return round(10 ** (x / 20), 4)


def run(args):
    return subprocess.run(args, capture_output=True, text=True)


def md5(p):
    return hashlib.md5(Path(p).read_bytes()).hexdigest()


def load(p, default=None):
    p = Path(p)
    if not p.exists():
        return default
    if p.suffix == ".jsonl":
        return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    return json.loads(p.read_text())


def dump(p, obj):
    Path(p).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n")


class Log(list):
    def append(self, m):
        if m not in self:
            super().append(m)


# ---------------------------------------------------------------- paths


class Episode:
    """Folder layout. An episode lives at content/<series>/episodes/<id>/; a
    proof scene at content/proof/<style>/ (no series library)."""

    def __init__(self, path):
        self.dir = Path(path).resolve()
        parts = self.dir.parts
        self.root = None
        if "content" in parts:
            i = len(parts) - 1 - parts[::-1].index("content")
            self.root = Path(*parts[:i])
        self.series_dir = self.dir.parent.parent if self.dir.parent.name == "episodes" else None
        self.edit = load(self.dir / "edit.json", {}) or {}

    def resolve(self, f):
        """A manifest path: absolute, 'content/...' from the repo root, else relative to the episode."""
        p = Path(f)
        if p.is_absolute():
            return p
        if str(f).startswith("content/") and self.root is not None:
            return self.root / p
        return self.dir / p

    def rel(self, p):
        import os
        return os.path.relpath(Path(p), self.dir)

    @property
    def name(self):
        return self.edit.get("render_name") or self.dir.name


# ---------------------------------------------------------------- frames/review.json

FRAME_REVIEW_SCHEMA = "frames-review/1"


def frame_verdict(v):
    """'pass', 'fail' or None (not a verdict this toolchain knows) for a frames/review.json verdict.
    D-023: 'approved' and 'approved with logged drift' pass, 'rejected' fails. The older series2 words
    ('pass', 'reject') and D-013 rule 11's 'accepted' (better take after the one retake) are read too."""
    s = str(v or "").strip().lower()
    if s.startswith(("approved", "accepted", "pass", "ok")):
        return "pass"
    if s.startswith(("reject", "fail")):
        return "fail"
    return None


def load_frame_review(path):
    """frames/review.json in the one format for both series (D-023 rule 4.9):
    {"schema": "frames-review/1", "episode", "by", "frames": [{"shot", "verdict", "attempt", ...}]}.
    Also reads a bare list and rows keyed 'shot_id' (the older series2 file). Returns (rows, shape);
    every row gets 'shot'. Rows without a shot id (notes) are skipped."""
    doc = load(path, None)
    if doc is None:
        return [], None
    if isinstance(doc, dict):
        rows, shape = doc.get("frames"), "dict"
    else:
        rows, shape = doc, "list"
    if not isinstance(rows, list):
        raise SystemExit(f"{path}: expected a dict with a 'frames' list (or a bare list of rows)")
    out = []
    for r in rows:
        if isinstance(r, dict) and (r.get("shot") or r.get("shot_id")):
            out.append(dict(r, shot=r.get("shot") or r.get("shot_id")))
    return out, shape


# ---------------------------------------------------------------- audio probes


def probe_s(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return None


def probe_frames(path):
    d = probe_s(path)
    return None if d is None else int(math.floor(d * FPS))  # floor: never claim audio past the file end


def silences(path, db_=-40, d=0.05, merge_blip_s=0.0):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", f"silencedetect=n={db_}dB:d={d}",
               "-f", "null", "-"]).stderr
    out, cur = [], None
    for m in re.finditer(r"silence_(start|end): (-?[0-9.e]+)", err):
        if m.group(1) == "start":
            cur = float(m.group(2))
        elif cur is not None:
            out.append([max(0.0, cur), float(m.group(2))])
            cur = None
    if cur is not None:
        out.append([max(0.0, cur), probe_s(path)])
    if merge_blip_s > 0:
        merged = []
        for a, b in out:
            if merged and a - merged[-1][1] < merge_blip_s:  # a blip shorter than this is not speech
                merged[-1][1] = b
            else:
                merged.append([a, b])
        out = merged
    return [tuple(x) for x in out]


def measure(path, trim_s=0.0, sil_db=-40, pause_min_s=0.3, merge_blip_s=0.0, edge_tol_s=0.005):
    """D-014 rule 2: first and last speech and internal pauses, in seconds from the trimmed start."""
    dur = probe_s(path)
    T = dur - trim_s
    sil = [(max(a, trim_s) - trim_s, b - trim_s) for a, b in silences(path, sil_db, 0.05, merge_blip_s)
           if b > trim_s + 0.005]
    a_s, b_s = 0.0, T
    if sil and sil[0][0] <= 0.005:
        a_s = sil[0][1]
    if sil and sil[-1][1] >= T - edge_tol_s:
        b_s = sil[-1][0]
    pauses = [(a, b) for a, b in sil if a > a_s + 0.005 and b < b_s - 0.005 and b - a >= pause_min_s - 1e-6]
    return dict(T_s=T, a_s=a_s, b_s=b_s, pauses_s=pauses)


def lufs(path):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"]).stderr
    m = re.findall(r"I:\s+(-?[0-9.]+) LUFS", err)
    return float(m[-1]) if m else None


def loudness(path):
    """Integrated LUFS and true peak dBTP of a file's first audio stream, two decimals
    (ffmpeg loudnorm measurement pass, as production/scripts/master-audio.sh reads them)."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-map", "0:a:0", "-af",
               "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"]).stderr
    g = lambda k: (re.findall(rf'"{k}" : "([^"]+)"', err) or [None])[-1]
    f = lambda v: None if v is None else (float("-inf") if "inf" in v else float(v))
    return f(g("input_i")), f(g("input_tp"))


def envelope(path, win=1 / FPS):
    """RMS level in dBFS per window (one frame by default), mono 48 kHz."""
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


def pulse_pattern(path, below_peak_db=10.5):
    """Per-frame on/off of a pulsed cue (a phone buzz): on at or above peak - 10.5 dB RMS (30 % of peak amplitude)."""
    env = envelope(path)
    peak = max(env)
    return [e >= peak - below_peak_db for e in env]


# ---------------------------------------------------------------- expressions

_UNIT = re.compile(r"(?<![A-Za-z_0-9.])(\d+(?:\.\d+)?)\s*(s|f)\b")


class ExprError(Exception):
    pass


def evaluate(expr, names, cue_len=None):
    """Evaluate an edit.json time expression to integer frames.

    Grammar: numbers (frames), '<n>s' (seconds, each literal rounded to a frame),
    '<n>f' (frames), + - * and parentheses, min(...), max(...), len(<cue_id>)
    (probed frames of a cue file, inside its usable window), and names
    '<shot>.start|end|dur', '<line>.clip_start|clip_end|speech_start|speech_end|split<k>_start|split<k>_end',
    'start' (0), 'end' (picture end), 'total' (end + black).
    """
    if isinstance(expr, (int, float)):
        return int(round(expr))
    src = _UNIT.sub(lambda m: str(F(float(m.group(1)))) if m.group(2) == "s" else m.group(1), str(expr))
    try:
        tree = ast.parse(src, mode="eval")
    except SyntaxError as e:
        raise ExprError(f"bad expression {expr!r}: {e}")

    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.Add, ast.Sub, ast.Mult, ast.FloorDiv)):
            a, b = ev(n.left), ev(n.right)
            return {ast.Add: a + b, ast.Sub: a - b, ast.Mult: a * b}.get(type(n.op), a // b if b else 0)
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            return -ev(n.operand)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name):
            fn = n.func.id
            if fn in ("min", "max"):
                vals = [ev(a) for a in n.args]
                return min(vals) if fn == "min" else max(vals)
            if fn == "len" and len(n.args) == 1 and isinstance(n.args[0], ast.Name) and cue_len:
                return cue_len(n.args[0].id)
            raise ExprError(f"{expr!r}: unknown function {fn}")
        if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name):
            key = f"{n.value.id}.{n.attr}"
            if key not in names:
                raise ExprError(f"{expr!r}: '{key}' is not known here")
            return names[key]
        if isinstance(n, ast.Name):
            if n.id not in names:
                raise ExprError(f"{expr!r}: '{n.id}' is not known here")
            return names[n.id]
        raise ExprError(f"{expr!r}: unsupported syntax {type(n).__name__}")

    return int(round(ev(tree)))
