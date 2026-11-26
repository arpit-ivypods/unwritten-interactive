---
name: script-critique
description: Script critic (S3) playbook. Use when scoring an Unwritten script.hi.json / script.en.json (episode, glimpse or proof scene) against the rubric, deciding pass or fail, and writing review-notes.json with problems and fixes. Also defines the C1 cold-reader clarity gate (packets, reader form, pass conditions) that must pass before any voice (D-024).
---

# Script critique

You are the adversarial reader. You get the script, the bible and the specification, not the writer's
explanation. Look for what is wrong. A weak critic lets a weak story through, and the product has
failed if the stories are not gripping or the Hindi sounds robotic (plan section 1).

You read the bible, so you cannot judge clarity. A reader who knows the answer cannot tell whether the
question is clear: critics scored 7.7-8.3 on episodes that cold viewers scored 4-7.5 (D-024). Clarity
is scored from the cold-reader gate C1 (below), never from your own read.

Inputs:

- `content/<series>/<episode_id>/script.hi.json`, and `script.en.json` if present;
- `content/<series>/bible.json`, the series continuity ledger, and the rules in the
  `hinglish-screenwriting` skill, including its Clarity rules;
- the C1 reports for every path that contains the episode:
  `content/<series>/clarity/c1-<path>-<lang>-r<round>.json`.

You may read the script's `clarity_pass` as a list of what changed, not as an argument for it. Examples
of good notes: `content/proof/*/review-notes.json`.

## Mechanical checks (run them, do not estimate)

Run these by script and say in the verdict which you ran:

- JSON parses; every speaker, location and character id exists in the bible.
- `emotion_tags` equal the inline tags on every line.
- Spoken targets plus silences equal `target_total_seconds`; line count 25-40 for episodes.
- Characters a second per line (flag over 12); speaker changes counted at 0.25-0.3 s each.
- hi and en files have the same beat ids, line ids and speakers.
- Lead is on screen in most beats; count them.
- Search for यह / वह and other bookish forms.
- Clarity mechanics (D-024). These feed CLARITY problems, not the clarity score:
  - every line whose speaker is not in the beat's `on_screen` has `heard_as`;
  - `supers` use only `name_role`, `place` or `time`, and have the same ids in hi and en;
  - where each speaking character's name or role is first spoken, or first shown on a super, on each
    path;
  - the spoken numbers in the episode, with the load-bearing ones counted;
  - `clarity_pass` exists, with a projection and its basis for each language.

Anything you judged by ear or estimate (for example the real cut length) is labelled "estimate".

## Rubric (each 0-10)

| # | Criterion | 9-10 looks like | Fails when |
|---|---|---|---|
| 1 | Hook (first 5 s) | Shock or signature image lands by 5 s, inside a moment | Opens on set-up, recap, narration or a familiar beat (an orientation super is not set-up) |
| 2 | Stakes | Clear what the lead loses, concretely, and soon | Stakes abstract or not stated by mid-episode |
| 3 | Both choices costly | (Question episode) a reasonable viewer splits; each option has a stated cost | One option obviously right. Other episodes: score branch distinctness instead |
| 4 | Cliffhanger | Ends on a real open question that the next episode can open inside | Question answered or over-confirmed on screen; depends on a caption the viewer may miss |
| 5 | Natural Hinglish | Short lines, interruptions, English nouns and verbs in Hindi grammar, ये/वो, register per character | Bookish Hindi, plain Hindi for an urban character, translated-sounding English |
| 6 | Performability | Tags fit voice notes, dynamics vary, key lines audible, no TTS-risk tokens | Stacked tags, ellipsis after a tag, whispered cliffhanger under sound, untagged pivotal lines |
| 7 | Length | Honest projection of finished time with its basis, 130-140 s a language cut, under 150 s; per-line density 9-10 chars/s | Projection over 150 s or without a basis; padding to reach the target; beats unstageable as stills |
| 8 | Continuity | Matches bible and ledger: knowledge, props, wardrobe, time, place | Someone knows what they have not learned; prop appears without being placed |
| 9 | Clarity (from C1 only) | Every C1 reading 9 or more: premise, people, wants and the choice all read cold | Any C1 pass condition fails (fatal) |

Criterion 3 is scored as `choice` in the question episode and as `branch_distinct` in every other
episode (shared episodes: does it set up a choice that can split the audience); the unused key is null.

Criterion 9 (`clarity`) is the lowest C1 reading score for this episode in either language, after the
tie rule. Never adjust it by your own read. If C1 has not run on every path that contains the episode,
`clarity` is null, and the script is held: not passed and not failed.

Overall score is the mean of the nine, one decimal. Report each sub-score in the verdict line.

In the question episode, re-read the vote balance once both costs and both gains are spoken. Take
account of the readers' optional leans. If it moves past 65/35, the fix raises the cost on the
favoured side and never removes a gain (D-004 direction 2).

## Pass rule

Pass only if overall is at least 7.5 and there is no fatal problem. A high score never outweighs a fatal one.

Fatal problems (any one fails the script):

- Opens with recap narration, or nothing hooks within the first 10 seconds.
- Ends with its question answered, or with no question.
- Question episode: one choice is obviously right, or a choice costs the lead nothing.
- Branch episode retells the other branch with different lines instead of a different story.
- Last branch episode has no real ending.
- Continuity break against the ledger that the viewer would notice (knowledge leak, a dead
  character speaking, facts from branch A in branch B).
- Projected finished time over 150 s in either language cut. Fewer than 25 lines. More than 40 lines,
  unless the extra lines are clarity lines (D-024).
- C1 failed any pass condition (see "Clarity gate C1"). Write each one as
  `CLARITY (fatal): C1 <condition>, <report file>, <quote>`.
- The cliffhanger line is likely to be unintelligible (whispered under a filter or loud effect) and
  nothing else carries the question.
- Invalid JSON, or hi/en ids do not match.
- A beat that cannot be staged without content the image model will refuse, with no restaging offered.

## Clarity gate C1 (D-024)

C1 is a hard gate before any voice. No take is generated for a new or changed line until its episode
has passed three things: C1 on every path that contains it, this critique, and the Arbiter gate.

**Paths.** Series 1 has two:

- A: s1e01, s1e02, s1a01, s1a02, s1a03;
- B: s1e01, s1e02, s1b01, s1b02, s1b03.

Series 2 has two:

- A: s2e01, s2e02, s2e03, s2a01, s2a02, s2a03;
- B: s2e01, s2e02, s2e03, s2b01, s2b02, s2b03.

Each path is read once in Hindi and once in English, so a round has 8 readings.

**Packet.** `content/<series>/clarity/c1-<path>-<lang>-r<round>.packet.txt`, prepared by a session that
is neither the writer nor a reader.

- **Order:** episode by episode, in path order. Each episode's header carries only its id, with no title.
- **Shots:** in `shots.json` order, one line per shot of what the camera shows. Where frames exist,
  describe the frame as drawn.
  - People are described by look: clothes, build, what they hold.
  - Places are described by what is visible.
  - Never a name, a role or a meaning ("a brass shield with a blank plate", not "the zero-crime
    shield"), unless a spoken line or super has already given it on this path.
- **Supers:** shown as `[ON SCREEN: text]` on their shot.
- **Spoken lines:** each line sits in its shot, with:
  - its line id;
  - a neutral speaker label (P1, P2...), fixed for the whole path and introduced once with a look line;
  - its text without tags, as the subtitle shows it.
- **Unseen speakers:**
  - A `heard_as` line shows the subtitle's marker and label.
  - A line whose speaker is not in shot and is not marked shows "(unseen voice)", with no label.
- **First third:** after the line nearest one third of e01's spoken lines, insert
  `--- FIRST THIRD OF E01 ENDS HERE ---`.
- **Ballot:** after the question episode, the ballot as the app will show it: the question, both labels
  and both meanings, from the bible's `choice` block.
- **Nothing else:** no titles, loglines, bible, notes, reviews or decisions.
- **Leak check:** before handing on, the preparer greps the packet for every character name and role
  word. None may appear in a shot line or a label before the line or super that gives it.

**Readers.**

- Each reader is a fresh Opus session that has never seen this series' bible, scripts, notes, reviews,
  decisions, `docs/clarity-review.md` or `docs/clarity-cold-viewers.md`.
- One reader per packet. A reader reads only that packet, works through it in order, and fills in the
  form as they go. They do not revise an earlier answer after reading on.
- Round 2 uses new readers.
- The report is saved word for word as `content/<series>/clarity/c1-<path>-<lang>-r<round>.json`.

```json
{
  "c1": {
    "series": "series2", "path": "A", "language": "en", "round": 1, "reader": "session label",
    "first_third_premise": "One sentence, written at the first-third marker of e01.",
    "episodes": [{
      "episode": "s2e01",
      "premise": "One sentence, written at the end of the episode.",
      "who_is_who": [{"label": "P1", "who": "the SI for this area, Nandini Joshi", "known_at_line": "l03"}],
      "lead_wants": "...", "lead_could_lose": "...",
      "choice": null,
      "undecoded": [{"line": "l05", "quote": "...", "why": "..."}],
      "answers_unheard": [{"line": "l09", "quote": "...", "why": "..."}],
      "score": 6.5
    }]
  }
}
```

In the question episode, `choice` is
`{"A": {"cost": "", "gain": ""}, "B": {"cost": "", "gain": ""}, "lean": "A | B | unsure"}`. The lean is
optional and not scored. The score runs from 0 to 10: how well a first-time viewer would follow this
episode.

**Pass, per episode.** You judge each condition from the reports, against the bible:

1. Every reading in each language scores 7 or more, after the tie rule.
2. For e01: each reader's `first_third_premise` matches the series premise in substance.
3. Every reader lists every speaker of the episode correctly in `who_is_who`. Each `known_at_line` falls
   no later than the end of the beat in which that character first appears on that path. A character
   carried over from an earlier episode counts from that episode.
4. For the question episode: every reader names both costs and both gains correctly.
5. No reading has more than 2 undecoded lines, and none of them carries the plot. You decide which lines
   carry the plot.
6. No reading has a confirmed reply to an unheard line. You may dismiss an `answers_unheard` entry only
   by quoting the earlier heard line it answers.

Rules for using the reports:

- **Tie rule.** If two readings of a shared episode in one language differ by 3 points or more, one more
  fresh reader reads that path (`...-r<round>-x.json`). The middle score of the three counts.
- **Other entries.** Undecoded lines and unheard replies that do not fail a condition still go in as
  `CLARITY (must fix)` items, each quoting the report.
- **Your own notes.** Clarity problems you see yourself may go in as must-fix or medium items. They never
  raise or lower the clarity score.

## Rejection reasons (use these labels)

`HOOK`, `STAKES`, `CHOICE`, `BRANCH`, `CLIFFHANGER`, `HINGLISH`, `PERFORMABILITY`, `LENGTH`,
`CONTINUITY`, `CLARITY`, `STILLS-ONLY STAGING`, `TIMELINE AMBIGUITY`, `METADATA`, `CRAFT`.

Severity: `fatal`, `must fix`, `medium`, `minor`. Write each problem as
`LABEL (severity): what is wrong, where (line or beat id), why it matters.`

Common reasons seen in the proof scenes:

- Bookish pronouns (यह/वह) in a key line; too little code-mixing for the character.
- Per-line targets optimistic, so the real cut runs 10-15% long.
- Three whispers in a row; cliffhanger whispered under a phone buzz or filter.
- Pivotal reaction lines untagged (tags do not carry across lines).
- TTS-risk tokens: `mad—` read as "mad", ellipsis after a tag, one-syllable turns.
- Two off-screen superiors a cold viewer cannot tell apart.
- `ending_question` names a question already spoken and answered on screen.
- Prop or phone appears where nothing placed it.
- Too many motion events for stills; a beat over the 8 s shot ceiling.
- `silent_seconds` with no position; several shots in a beat with no line-to-shot mapping.
- `language` set to `hi-Latn-mixed` (means Hindi in Latin script).

## Fixes

For every must-fix or fatal problem give one concrete fix: the replacement line in Devanagari + Latin,
the new tag, the new target seconds, or the beat change.

- A fix that adds lines states the new projected finished time.
- It cuts nothing unless the projection passes 150 s, and then never a clarity line (D-024).
- In a clarity pass, never propose a new, cut or reordered beat. If only a beat change would work, say
  so as an owner item.
- Mark optional improvements "optional".

## Output

Write `content/<series>/<episode_id>/review-notes.json` (merge, do not overwrite other sections):

```json
{
  "critic": {
    "round": 1,
    "pass": false,
    "score": 7.2,
    "subscores": {"hook": 7, "stakes": 8, "choice": null, "branch_distinct": 8, "cliffhanger": 6,
                  "hinglish": 7.5, "performability": 7, "length": 7, "continuity": 8, "clarity": 6.5},
    "c1_reports": ["content/series2/clarity/c1-A-hi-r1.json", "content/series2/clarity/c1-A-en-r1.json"],
    "fatal": ["CLIFFHANGER (fatal): ..."],
    "checks_run": ["json valid", "tags match", "durations sum", "line count 31"],
    "problems": ["VERDICT: fail ...", "HINGLISH (must fix): ..."],
    "fixes": ["l08: ..."]
  }
}
```

The first `problems` entry is the verdict line: pass or fail, fatal or not, sub-scores, checks run, file path.

## Rounds

- Fail goes back to S2 with the notes. Two rounds maximum.
- Round 2 checks that every must-fix was addressed and looks for new problems the fixes caused. C1
  runs again, with fresh readers who never saw round 1's packets.
- Still failing after round 2: hand the script and both review rounds to the Arbiter, and log it as
  plan section 7.8 requires. Do not rewrite the script yourself; you never judge your own work.
