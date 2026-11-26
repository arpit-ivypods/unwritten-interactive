---
name: continuity-ledger
description: Continuity keeper (S4) playbook. Use when building or updating continuity.json for an Unwritten series or episode, and when checking a script.hi.json / script.en.json or a shots.json against the ledger, per branch.
---

# Continuity ledger

The ledger records, beat by beat and per branch, who is where, wearing and holding what, hurt how,
and knowing what. Every script and every shot list is checked against it. The product has failed if
characters change face between shots (plan section 1), so this is a gate, not a courtesy.
Worked example: `content/proof/photoreal/continuity.json`.

## Files

- Series ledger: `content/<series>/continuity.json`. State at the end of every episode, per branch.
- Episode ledger: `content/<series>/<episode_id>/continuity.json`. Beat-level detail, the proof format.

Branches: `shared` runs first; `A` and `B` each start from the shared end state and never see each
other. Glimpses inherit the state of the episode they are cut from.

## Series ledger format

```json
{
  "series_id": "s1",
  "made_by": "S4 Continuity keeper",
  "sources": ["content/s1/bible.json", "content/s1/e01/script.hi.json"],
  "characters": {
    "tara": {
      "wardrobe_lock": "Exact sentence pasted into every frame prompt where she is on screen.",
      "static": "Never changes: face, marks, jewellery, handedness.",
      "wardrobe_changes": [{"from_episode": "a04", "lock": "...", "why": "..."}]
    }
  },
  "branches": {
    "shared": [{"episode": "e01", "end_state": {
      "characters": {"tara": {"alive": true, "injuries": "none", "location": "taxi", "wardrobe": "lock", "held": ["phone"]}},
      "props": {"duffel_bag": "open, with Tara"},
      "knowledge": {"tara": ["bag is fake", "caller knows her real name"], "viewer": ["..."]},
      "relationships": {"tara-imran": "suspicion"},
      "time": "night 1, about 2:05 am",
      "open_questions": ["Who is Imran driving for?"]
    }}],
    "A": [], "B": []
  }
}
```

## Episode ledger format

As in the proof scene. Top level: `id`, `branch`, `made_by`, `sources`, `location` (description, plates
by shot, geography and screen direction), `time_of_day`, `characters`, `props`, `ledger`, `checks`,
`fixed_in_shots_json`, `creative_flags`.

```json
{
  "characters": {"tara": {"role": "lead", "wardrobe_lock": "...", "static": "...", "injuries": "none",
                 "sheet_attached_in": ["s01"], "face_visible_in": ["s01"]}},
  "props": {"keypad_phone": "State through the episode, and which hand holds it."},
  "ledger": [{
    "beat_id": "b1", "shots": ["s01"], "time_s": [0.0, 4.7],
    "on_screen_script": ["tara", "imran"], "on_screen_shots": ["tara"], "light_state": "base",
    "characters": {"tara": {"position": "...", "wardrobe": "locked", "held": "...", "injuries": "none",
                            "state": "...", "lines": ["l01"]}},
    "props": {"duffel_bag": "closed, on Tara's lap"},
    "world": {"engine": "off", "rain": "heavy"},
    "knowledge": {"tara": "...", "imran": "...", "viewer": "..."}
  }],
  "checks": [{"check": "...", "result": "pass | fail | pass after fix", "detail": "..."}],
  "fixed_in_shots_json": ["s08: ..."],
  "creative_flags": ["Script asks for X; shots do Y. Who should weigh it."]
}
```

Record a state for every prop that can change (open/closed, on/off, up/down, in which hand) in every beat,
even when it is out of frame ("not in frame (UP)").

## Checks per script

Run against the bible and the series ledger for that branch:

1. Ids: every speaker, character and location exists in the bible; hi and en have the same beats, lines, speakers.
2. Knowledge: nobody says or acts on something they have not learned on screen or in the bible.
   Facts from the other branch never appear. Track the viewer's knowledge separately from the characters'.
3. Opening state: the episode opens consistent with the previous episode's end state on the same path
   (place, time, who is present, injuries, what is held), or the gap is explained.
4. Props: nothing appears without being placed; nothing set down is later in a hand; every
   prop needed in a late beat is shown or placed earlier (the phone on the desk, the chai glass).
5. Wardrobe and injuries carry over; changes happen on screen or across a stated time cut.
6. Time: time of day, weather and elapsed time agree with lines ("आज शाम" in a 2 am scene).
7. Names and titles: one name per person, one word per object; two characters never share a title.
8. Physical states in the lines match the action (out of breath while the taxi has been parked).

## Checks per shot list

1. Every script line is covered by exactly one shot; every `line_id` in shots.json exists in both scripts.
2. Each shot's `beat_id` matches the beat that holds its lines.
3. Shot durations per beat equal line targets plus silence; totals match the script.
4. `wardrobe_lock` appears verbatim in every prompt where the character is on screen.
5. The lead's sheet is attached in most shots where she is seen; at most 5 refs per call (Codex limit);
   refs exist in the reference index and `style.json`; image labels follow refs order.
6. `light_state` per shot matches `style.json` for its beat.
7. Prop and world states (locks, lights, engine, phone screen) are consistent shot to shot.
8. Plate and reference labels do not contradict the shot: if a plate shows a knob UP and the shot needs
   it DOWN, the label must name the exception. This was the main fix in the proof scene.
9. Screen direction and handedness hold across cuts (who is frame left, which hand holds the phone,
   which side the nose stud is on).
10. `on_screen` in shots.json wins over the script; record any difference as a creative flag.

## Fix or flag

- Fix mechanical errors in shots.json yourself (labels, missing locks, wrong states) and list each in
  `fixed_in_shots_json`. Back up the original to the scratchpad first.
- Never change dialogue, beats or story. Story-level problems go to `creative_flags` with the owning
  agent named (S2 for script, S7 for shots, S3 to weigh).
- Severity in problems: `high` (viewer will notice), `low` (accept or note), `nit`, `info`.

## Output

Write the ledger file(s), and in `review-notes.json` add or replace only the `continuity` section:
`{"ok": true, "fixed": [...], "problems": [...]}`. `ok` is false if any high-severity problem remains.
After each episode passes, append its end state to the series ledger under its branch.
