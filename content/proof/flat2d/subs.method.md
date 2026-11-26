# Subtitle method (flat2d proof scene, S13, measured takes, D-014)

Generator and validator: `build_subs.py` (run after `build_timeline.py`; exits non-zero on any failed check).

Inputs: `dialogue-placement.{hi,en}.json` (speech start/end and segments in frames, measured on the chosen takes `voice/<lang>/<line_id>.mp3` with ffprobe and ffmpeg silencedetect at -40 dB / 50 ms), `timeline.{hi,en}.json` (`meta.picture_cuts`), `script.{hi,en}.json` (text). Each language uses its own timeline (shot lengths follow that language's takes).

Text: the script line with [audio tags] removed and whitespace collapsed. Wording unchanged ("ma—" kept). Up to 32 graphemes per line, at most 2 lines, balanced, preferring a break after punctuation. Devanagari counted in clusters.

Timing:
- A cue starts at the first speech of its segment and ends at the last (rule 2). Times are whole frames, written as floored ms so a cue ending on a cut is not drawn on the cut frame.
- A line with an internal pause of 300 ms or more is split there; the text is split at the punctuation whose grapheme position best matches the pause's position in the speech (rule 3). Splits made: hi l03, l04, l07, l08, l09, l10; en l03, l04, l07, l08, l10. en l09's pause measured 0.29 s, so it is one cue.
- Words: spread by grapheme count inside the segment (rule 4), unless local whisper.cpp (ggml-small, word timestamps, cached in `edit/whisper/`) gives exactly the script's word count for that segment, every transcribed word being assigned to its nearest segment; then its word starts are used (rule 5). Each cue records `wordTiming`. No cue time depends on transcription.
- Cut-offs: l06 (cut by l07) and l11 (cut by the first buzz) run 2 frames past their cuts in the audio; their cues are clamped to the cut, then to 2 frames before the next cue.
- Holds: a cue above 17 characters a second or under 800 ms is held past its last speech, up to 2 frames before the next cue and never past the next picture cut (the s07 punch-in counts as a cut; the s08 vibration sub-shots do not).
- Cues are at least 2 frames apart.

Checks (run, all pass, both languages): no overlaps; gaps at least 2 frames; no cue spans a picture cut; every cue starts on its first speech frame; at most 2 lines of 32 graphemes; no tags; word texts equal cue text and span the cue; per-line joined cue text equals the script text. Results are stored in each file's `checks` block.

Not verified: that the -40 dB threshold catches soft onsets (a cue may start a frame or two after a breathy onset); whisper word timings on Hindi (ggml-small is weak there; they are used only where counts match).
