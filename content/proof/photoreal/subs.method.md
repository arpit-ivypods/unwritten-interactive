# Subtitle method (S12, proof/photoreal)

Generator and validator: `build_subs.py` (run `python3 build_subs.py`; exits non-zero on any failure).

Inputs: `script.{hi,en}.json` (text), `dialogue-placement.{hi,en}.json` (clip start/end). `voice/review.json` is empty and all clips are placeholders, so the timing source is clip length only. No transcript or forced alignment was used. When real takes replace the placeholders, re-run after the placement files are updated.

Steps
1. Text = script line text with `[audio tags]` removed and whitespace collapsed. Hindi stays in Devanagari, English words stay in Latin, exactly as scripted.
2. Length is counted in graphemes (combining marks and virama conjuncts do not add to the count).
3. A line of <=32 graphemes is one cue. Longer lines are split at sentence or ellipsis breaks (e.g. "!", "...", "."), each piece wrapped into at most 2 lines of <=32, with the two lines balanced.
4. Word timing: the clip span is divided across all words of the line, weighted by word grapheme length. Cue start/end come from their first/last word, so cues of one line are contiguous and cover the clip.
5. Overlap: l06 (ends 15567) overlaps l07 (starts 15467) in the placement, which is intentional audio crosstalk. The subtitle for l06 is trimmed to end at 15467, and its words are spread over 13567-15467. All other cues are separate in time.
6. Checks (all pass): no overlaps, <=2 lines of <=32, min cue 800 ms (shortest is 1000 ms), reading speed <=17 chars/s, no tags, word text equals cue text, and per-line cue text joined equals the script text minus tags.

Limits: word timings are estimates, not aligned to audio. The Hindi l06 and English l06 cut-off dash is kept in the text. Cues sit back to back inside a line (end of one equals start of the next); a renderer that wants a gap should trim in rendering, not here.
