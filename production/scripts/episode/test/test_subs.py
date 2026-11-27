#!/usr/bin/env python3
"""Focused subtitle regressions. Run with python3 -I production/scripts/episode/test/test_subs.py."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_subs import build, validate  # noqa: E402


class Subtitles(unittest.TestCase):
    def build(self, lang, overrides, second_scene="B", legacy=False):
        def line(lid, speaker, text, mode, shot, starts):
            script = {"id": lid, "speaker": speaker, "text": text, "heard_as": mode}
            words = [{"text": w, "startFrame": a, "endFrame": b}
                     for w, a, b in zip(text.split(), starts, starts[1:])]
            placement = {"line_id": lid, "shot": shot, "words": words,
                         "segments": [{"i0": 0, "i1": len(words), "source": "asr"}]}
            return script, placement

        script, placements = zip(
            line("l01", "dsp", "Yes. I hear you.", "phone", "s01", [30, 45, 53, 62, 70]),
            line("l02", "dsp", "Wait.", "off_screen", "s01", [85, 93]),
            line("l03", "neighbour_voice", "Hello.", "off_screen", "s02", [128, 141]),
            line("l04", "dsp", "Go.", "phone", "s02", [160, 170]),
        )
        beats = [{"lines": script[:2]}, {"lines": script[2:]}]
        if not legacy:
            beats[0]["id"] = "b01"
            beats[1]["id"] = "b02"
        fixture = {
            "edit.json": {"subs": {"split_after_words": overrides}},
            f"script.{lang}.json": {"beats": beats},
            f"dialogue-placement.{lang}.json": {"lines": placements},
            f"timeline.{lang}.json": {"durationFrames": 220, "shots": [
                {"id": "s01", "start": 0, "duration": 120},
                {"id": "s02-insert", "subshot_of": "s02", "start": 120, "duration": 100},
            ]},
        }
        if not legacy:
            fixture["shots.json"] = {"shots": [{"id": "s01", "scene": "A"}, {"id": "s02", "scene": second_scene}]}
        with patch("build_subs.load", side_effect=lambda path, default=None: fixture.get(path.name, default)):
            result = build(Path("fixture"), lang)
        problems, _ = validate(*result)
        self.assertEqual(problems, [])
        return result[0]["cues"]

    def test_language_override_keeps_short_explicit_split_and_word_timing(self):
        overrides = {"l01": {"en": [1]}}
        english = [c for c in self.build("en", overrides) if c["line_id"] == "l01"]
        self.assertEqual([c["text"] for c in english], ["Yes.", "I hear you."])
        self.assertEqual([c["startFrame"] for c in english], [30, 45])
        self.assertLess(english[0]["endFrame"] - english[0]["startFrame"], 24)
        self.assertGreaterEqual(english[1]["startFrame"] - english[0]["endFrame"], 2)
        self.assertEqual([c["text"] for c in self.build("hi", overrides) if c["line_id"] == "l01"], ["Yes. I hear you."])

    def test_repeat_marked_speakers_label_only_once_per_picture_scene(self):
        cues = self.build("hi", {"l01": [1]})
        self.assertEqual([c["heard_as"] for c in cues], ["phone", "phone", "off_screen", "off_screen", "phone"])
        self.assertEqual([c.get("speaker_label") for c in cues], ["डीएसपी", None, None, "पड़ोसी", "डीएसपी"])
        same_scene = self.build("en", {}, second_scene="A")
        self.assertEqual([c.get("speaker_label") for c in same_scene], ["DSP", None, "Neighbour", None])

    def test_split_cannot_follow_the_last_word(self):
        with self.assertRaisesRegex(SystemExit, "precede the last word"):
            self.build("en", {"l01": [4]})

    def test_legacy_beats_without_ids_get_distinct_label_groups(self):
        cues = self.build("en", {}, legacy=True)
        self.assertEqual([c.get("speaker_label") for c in cues], ["DSP", None, "Neighbour", "DSP"])


if __name__ == "__main__":
    unittest.main()
