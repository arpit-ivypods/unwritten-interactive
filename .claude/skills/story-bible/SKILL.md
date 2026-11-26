---
name: story-bible
description: Showrunner (S1) playbook for Unwritten series. Use when proposing loglines or writing content/<series>/bible.json, the branch map, the cliffhanger ladder, the choice, the glimpse plan or the two endings.
---

# Story bible

The bible is the source every later agent works from: S2 writes from the beat outline, S4 seeds the
continuity ledger from it, S6 draws characters and locations from it, S14 cuts glimpses from its plan.
If a fact matters downstream, it goes in the bible.

## Before writing

1. Read `docs/unwritten-poc-plan.md` sections 2, 3 and 9 (section 9 overrides).
2. Fixed scope (section 9):
   - Series 1: photoreal, crime or con story, 2 shared episodes then 3 per branch (5 on any path, 8 to produce).
   - Series 2: flat 2D, small-town cop caper, 3 shared then 3 per branch (6 on any path, 9 to produce).
   - One choice point per series, at the end of the last shared episode. Two glimpses per series.
   - Each episode about two minutes (110-140 spoken seconds, 25-40 lines).
3. Loglines: propose three per series, each a different premise, not three takes of one. The critic
   and the Arbiter pick; record the reasoning in `docs/decisions.md`, not in the bible.

## bible.json template

```json
{
  "series_id": "s1",
  "title": {"hi": "...", "en": "..."},
  "look": "photoreal | flat2d",
  "logline": {"hi": "...", "en": "..."},
  "premise": "3-6 sentences: world, lead, inciting event, what is at stake by the choice point.",
  "tone": "Genre, register, how dark, how funny, reference feel. One paragraph.",
  "characters": [{
    "id": "tara", "name": {"hi": "तारा सेठी", "en": "Tara Sethi"}, "age": 31, "role": "lead",
    "bio": "Past, job, relationships; only what the story uses.",
    "want": "What they are actively chasing.",
    "secret": "What they hide, from whom, and the episode it surfaces (or never).",
    "look": "Face, build, skin, hair, marks, one fixed outfit per period: concrete enough for a reference sheet.",
    "voice_note": "Age, region, register, pace, how they change under pressure. Same actor in both languages.",
    "branches": ["shared", "A", "B"]
  }],
  "locations": [{
    "id": "taxi", "description": "Layout, light sources, fixed set dressing, time of day used.",
    "episodes": ["e01", "a03"]
  }],
  "episodes": [
    {"id": "e01", "branch": "shared", "path_position": 1, "title": {"hi": "...", "en": "..."}},
    {"id": "a03", "branch": "A", "path_position": 3, "title": {"hi": "...", "en": "..."}},
    {"id": "b03", "branch": "B", "path_position": 3, "title": {"hi": "...", "en": "..."}}
  ],
  "branch_map": {
    "shared": ["e01", "e02"],
    "choice_after": "e02",
    "A": ["a03", "a04", "a05"],
    "B": ["b03", "b04", "b05"]
  },
  "beat_outlines": {
    "e01": [{"id": "b1", "what_happens": "...", "who": ["tara"], "location": "taxi", "reveal": "new fact or null"}]
  },
  "cliffhanger_ladder": [
    {"episode": "e01", "type": "reveal", "question": "The question the last frame leaves open.", "stakes_level": 1}
  ],
  "choice": {
    "question": {"hi": "In the character's own words", "en": "..."},
    "A": {"label": {"hi": "...", "en": "..."}, "gain": "...", "cost": "What the lead loses for certain."},
    "B": {"label": {"hi": "...", "en": "..."}, "gain": "...", "cost": "..."},
    "why_hard": "Why a reasonable viewer splits close to 50/50."
  },
  "glimpses": {
    "A": {"source_episode": "a03", "seconds": 25, "shows": "...", "ends_on": "A new question", "must_not_reveal": "..."},
    "B": {"source_episode": "b03", "seconds": 25, "shows": "...", "ends_on": "...", "must_not_reveal": "..."}
  },
  "endings": {
    "A": {"episode": "a05", "summary": "...", "final_image": "...", "lead_state": "Who they are now"},
    "B": {"episode": "b05", "summary": "...", "final_image": "...", "lead_state": "..."}
  },
  "content_notes": ["Fictional police force and insignia; no national flag; no real people; no minors in peril."]
}
```

Episode ids: shared episodes `e01..`, branch episodes `a03..`/`b03..` numbered by path position.
Every character, location and episode id used anywhere else must be defined here.

## Branch-map rules

- Shared episodes are seen by everyone; the last one ends on the cliffhanger that is the question.
- Each branch is a different story, not the same events with a different line. Test: write each
  branch's three-episode summary without naming the choice; if they read alike, redo one.
- Each branch reaches a real ending in its last episode: the central question answered, the lead changed.
  No "to be continued", no ending that only makes sense after watching the other branch.
- Both branches stay inside the shared setup: no character's past rewritten, no new rules of the
  world that contradict the shared episodes.
- A branch may drop a shared character but must account for them in one line or image.
- Day-2 viewers see only the winning branch, so each branch must stand alone after the shared episodes.
- A tie goes to A. Do not make A the "obvious" default; balance the choice instead.

## The choice

- It must cost the lead something real either way. If one option is obviously right, rewrite it.
- State both costs concretely (a person, money, freedom, a relationship, self-respect), not "risk".
- The question is phrased as the character would say it, in both languages, under 12 words.
- The gain of one option should be roughly the cost of the other, so the viewer trades, not picks.

## Cliffhanger ladder

One rung per episode on each path. Each ending raises the stakes over the last and is a different type.

| Type | The last beat... |
|---|---|
| reveal | shows a fact that changes what the viewer thought was true |
| threat | puts someone or something the lead cares about in immediate danger |
| reversal | turns an ally into a suspect, a win into a loss, or the reverse |
| arrival | brings in a person or thing that should not be there |
| decision | forces the lead to choose now (the question episode uses this) |

Rules: never two of the same type in a row on one path; stakes_level rises by path position;
every cliffhanger is an unanswered question the next episode opens inside (no recap); the final episode
of each branch ends on resolution, not a cliffhanger, though a last unsettling image is allowed.

## Glimpse plan

- 20-30 seconds each, cut from the first branch episode's material (S14 cuts; you choose the moments).
- Shows what the choice leads to, ends on its own new cliffhanger, never reveals the outcome or ending.
- Late viewers watch both to see what they missed, so each must make sense without the other.
- Name for each glimpse what it must not reveal; S14 and S15 check against that field.

## Done means

- Valid JSON at `content/<series>/bible.json`; every id referenced is defined.
- Path lengths and episode counts match section 9. Ladder has one rung per episode per path.
- Both choice costs stated; both endings real and different; glimpse `must_not_reveal` filled.
- Character `look` concrete enough to draw a sheet from; `voice_note` usable for casting both languages.
