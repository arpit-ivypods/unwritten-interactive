---
name: hinglish-screenwriting
description: Episode writer (S2) and English adapter (S5) playbook. Use when writing or revising script.hi.json or script.en.json for an Unwritten episode, glimpse or proof scene, including emotion tags for ElevenLabs v4, finished-time pacing, the D-024 clarity rules, orientation supers and dialogue-only clarity rewrites.
---

# Hinglish screenwriting

The script text is exactly what ElevenLabs reads and exactly what the subtitle shows. Write it as
it is spoken. Source of truth for story: `content/<series>/bible.json` (beat outline, cliffhanger ladder).
The viewer has never read the bible. A fact reaches them only through a spoken line, a picture they can
read at phone size, or an orientation super. Write to the "Clarity rules" below (D-024): a script is
not voiced until cold readers pass it (gate C1 in the `script-critique` skill).
Reference format: `content/proof/*/script.hi.json` and the critic notes in `content/proof/*/review-notes.json`.

## File format

Path: `content/<series>/<episode_id>/script.hi.json` and `script.en.json`. Same ids, beats, speakers and
order in both files; only `text`, `emotion_tags`, `target_seconds`, `supers[].text` and
`clarity_pass.projected_finished_seconds` may differ.

```json
{
  "id": "s1-e01", "series_id": "s1", "episode_id": "e01", "branch": "shared",
  "title": "ग़लत Bag",
  "language": "hi",
  "language_code": "hi",
  "script_note": "Hinglish: Hindi in Devanagari, English words in Latin script",
  "lead_character_id": "tara",
  "target_total_seconds": 125,
  "characters": [{"id": "tara", "name": "तारा सेठी (Tara Sethi)", "role": "...", "look": "...", "voice_note": "..."}],
  "locations": ["taxi"],
  "time_of_day": "Night, about 2 am, monsoon rain",
  "beats": [{
    "id": "b1",
    "action": "What the picture shows, stageable as stills.",
    "on_screen": ["tara"],
    "location": "taxi",
    "silent_seconds": 0.8,
    "silent_position": "before",
    "lines": [{
      "id": "l01", "speaker": "tara",
      "text": "[laughs] चालीस लाख, इमरान! [excited] और उसे doubt तक नहीं हुआ।",
      "emotion_tags": ["[laughs]", "[excited]"],
      "target_seconds": 3.5
    }]
  }],
  "sfx_notes": ["b1: ..."],
  "music_note": "...",
  "ending_question": "The real open question, in one sentence."
}
```

- `language` is a plain code (`hi` or `en`). Never `hi-Latn-...`: that means Hindi in Latin script.
- `silent_position` is `before` or `after` the beat's lines. If a beat has several shots, say in `action`
  which line plays over which shot.
- `emotion_tags` must list exactly the inline tags in `text`, in order.
- Line ids are unique per episode (`l01`...), beat ids `b1`...; never renumber after S4 has a ledger.
- `on_screen` lists who is visible; voice-only characters are left out.
- `heard_as` (D-024) goes on every line whose speaker is not visible in its shot: `"phone"` or
  `"off_screen"`. Leave it out when the speaker is on screen. The subtitles mark these lines from it.
- `supers` (D-024) is an optional list on a beat (see "Orientation supers"). `kind` is `name_role`,
  `place` or `time`. `id`, `kind` and `with_line` are the same in both files; only `text` differs.
- `clarity_pass` (D-024) is a top-level record, written on any clarity rewrite. S10 re-voices by
  comparing script text with the takes, so this list is for the critic and continuity:

```json
"beats": [{"id": "b1", "supers": [{"id": "su1", "kind": "name_role", "with_line": "l03",
           "text": "नंदिनी जोशी · SI, इमलीपुर"}], "lines": [{"id": "l14", "speaker": "dsp",
           "heard_as": "phone", "text": "..."}]}],
"clarity_pass": {
  "ruling": "D-024",
  "reworded": ["l03"], "added": ["l35"], "cut": ["l13"], "moved": [{"line": "l04", "to_shot": "s05"}],
  "fixes": [{"lines": ["l35"], "rule": 3, "fault": "s2e01 'Arre, talkies?' answers a report nobody hears"}],
  "projected_finished_seconds": {"value": 136, "basis": "current cut 109.4 s + 230 added chars at 8.4/s"},
  "owner_items": [], "lock_conflicts": []
}
```

## Devanagari + Latin convention

- Hindi words in Devanagari, English words in Latin, in one line: "Lock टूटा नहीं है।"
- Names in the Hindi script are in Devanagari (इमरान), English acronyms and brands in Latin (DSP, SHO).
- Use spoken forms: ये/वो, not यह/वह; नहीं/ना as people say it; contractions people use ("बोला था ना").
- Hindi sentences end with `।`; English-only lines end with `.`. Keep `?` and `!`.
- Pick one word per object and keep it across logline, dialogue and subtitles (lock or ताला, not both).
- Code-mixing: English nouns and verbs inside Hindi grammar ("open किया", "check किया", "doubt तक नहीं").
  Urban and young characters mix more; older or rural characters stay Hindi-heavy. Follow `voice_note`.

## Pacing for a two-minute episode

- **Target 130-140 s finished time per language cut, ceiling 150 s** (D-024 ruling 4), opening inside
  a moment. There is no character measure or character gate any more: the 1,050, 1,100 and 1,300 figures
  are withdrawn. The target is room to use, not a floor. Never pad.
- **Project finished time for each language** and record it, with its basis, in
  `clarity_pass.projected_finished_seconds`:
  - Base: the current cut where one exists. Otherwise, the sum of final-take durations in
    `voice/manifest.jsonl`, plus silences, plus 0.3 s a speaker change.
  - Adjust: add the time for added characters and subtract it for removed ones, at 8.4 characters a
    second for Hindi and 9.8 for English.
  - Fallback: with neither base, use 0.9 x `target_total_seconds` and label it an estimate.
- **Clarity lines are never cut to meet a count,** of characters or of lines.
  - A trim order in `writer_notes` lists only non-clarity lines. Silences go first (D-018 rule 3).
  - If the episode cannot get under 150 s without cutting a clarity line, say so in `clarity_pass`.
    The Arbiter rules.
- **25-40 lines is guidance.** More than 40 is fine when the extra lines are clarity lines.
- **Per-line targets:** budget about 9-10 characters a second of spoken Hinglish. Over 12 is too dense
  and gets flagged. Whispered or slow delivery runs slower still.
- Add 0.25-0.3 s for every speaker change and count it in `target_total_seconds`.
- Shots run 3-5 s, held emotional beats up to 8 s. A beat longer than 8 s needs two set-ups in `action`.
- Short lines, interruptions, overlaps written as cut-offs. A line over about 15 words is a speech; split it.
- The timeline is built from measured audio, not these targets; state honest targets anyway.

## Story rules

- No recap narration. No narrator unless the bible calls for one. Picture, sound, dialogue and
  orientation supers carry exposition.
- Hook in the first 5 seconds: the shock or signature image lands by 5 s, not set-up. A name, role or
  place super is not set-up. Clarity lines go after the hook and never push it past 5 s.
- End on an unanswered question; the last spoken line must not answer `ending_question`.
- Write the real open question in `ending_question`, not one a character has already said aloud.
- Stills only (no image-to-video): one visible change per shot. Motion that cannot be a still
  (ignition, wipers) is written as sound.
- Off-screen superiors and similar roles need distinct names or titles so a cold viewer cannot merge them.

## Clarity rules (D-024)

A first-time viewer must follow every episode from what it says and shows. Judge each rule on each
path the way a viewer watches it: the shared episodes, then one branch. Never judge it against the
bible. Cold readers test these rules before any voice (C1, in `script-critique`). Failing C1 is fatal.

1. **Name or role at first appearance.**
   - Every speaking character, and every silent one the plot turns on, is named or given a role, in a
     line or a super, by the end of the beat in which they first appear on that path.
   - Name the lead in e01.
   - A person talked about but not seen gets one identifying clause at first mention ("Bhaiyaji, who
     runs the ration godown").
   - Bridge an alias once, in a line ("Tonight she's 'Sneha', but she's still my Kiran.").
   - No two people or places share a name or label. If two stations are both "Imlipur thana", one of
     them becomes "the talkies thana".
2. **Jargon is glossed once on each path, in context.** Put the gloss in the same line or the next, from
   a character who has a reason to say it.
   - English glosses police and legal words a non-Hindi viewer does not know: thana, SI, SHO, DSP, FIR,
     malkhana, charge handover, case property. Hindi need not.
   - Both languages gloss in-world code words (bureau, party, setting, shutter), or replace them with
     plain words.
   - After one gloss, use the word freely.
3. **No reply to a line the viewer did not hear.**
   - If a line answers a report, a question or an event, the viewer hears or sees that first.
   - No line leans on an action that no frame shows. "Put it down" needs the reach in shot, or the words
     "Then I'll drink it myself".
4. **Each line follows from the one before.**
   - Keep the "because" and "so" clauses that the old length measure squeezed out.
   - Every "it", "this", "them" or "that man" refers to something the viewer heard, or can see in that
     shot.
   - When the scene changes place, the first line or a super says where we are.
5. **At most three load-bearing numbers an episode.**
   - A number is load-bearing if a later line, the choice or an ending needs the viewer to remember it
     (the ten o'clock deadline, thirty complaints, eleven days). A repeat counts once.
   - Serial-type numbers (frame, note and register numbers) are said as words ("the cycle's frame
     number") or cut.
   - Any other number is incidental: keep those few, and say each once.
6. **A planted thread pays off in both branches or is cut.**
   - A want, question or object that a shared episode asks the viewer to track (a transfer application,
     a token, a vow) is answered by a line in each branch. Otherwise the plant goes.
   - A thread planted in a branch pays off in that branch.
7. **Phone and off-screen voices are marked.**
   - Set `heard_as` on every line whose speaker is not visible in its shot.
   - The first such line of each speaker in a scene says who it is: the listener names them ("जी, DSP
     साहब"), or they name themselves.
8. **Every plot clue that is a picture is also spoken once.**
   - Say what the picture shows, not what it means, and never whose it is before the story reveals it
     ("The bride has a burn on her wrist, like a half moon.").
   - This covers the swaps and tells the plot rests on, such as the fresh milk, the cap and what is in
     the almirah.
9. **The choice states what each answer costs and gains.**
   - In the question episode, before the question line, the viewer hears both costs and both gains.
   - The bible's ballot meanings carry the same words.
   - If stating a gain tilts the vote past 65/35, raise the cost on the favoured side. Never remove the
     gain.
10. **Keep the lines viewers liked.** D-024 lists them.
    - Change their set-up first.
    - Reword one only if the line itself is the confusion, and keep its meaning.

- **No "as you know".** A name or a gloss rides on a reason to say it: an introduction, a newcomer, an
  order, an argument, a phone pick-up.
- **Fixes never break a lock.** That means a story lock, a production lock (for example, the Series 1
  sedative is never named or measured), D-004 direction 5's forms of address, or a glimpse's
  `must_not_reveal` list. If a fault can be fixed only by breaking a lock, record it in
  `clarity_pass.lock_conflicts` and leave the lock alone.

## Orientation supers (D-024)

On-screen text may carry exactly three things:

- a character's name and role at first appearance on a path;
- a place;
- a time.

Nothing else the plot needs may depend on reading. Token numbers, boards, receipts and file dates stay
as D-004 direction 6 set them. Endings stay spoken.

- **True and public only.** A super says only what is true and what the story is not hiding at that
  point.
  - No super for an alias (Sneha), a false role (Nirala's "Inspector"), or anything a twist reveals.
  - Introduce those characters in dialogue.
- **Form:**
  - at most two short lines of about four words each;
  - its own text in each language, with names in Devanagari in the Hindi file;
  - held at least 2 s;
  - inside the 9:16 safe area and clear of the subtitle zone;
  - never on a shot that carries a plot overlay.
- **How often:**
  - a name once per character per path;
  - a place at its first appearance on a path;
  - a time only for a deadline or a jump in time.
- **Where it goes:** write each super in the beat's `supers` list, with the line it appears with. S7
  copies it onto that shot in `shots.json`. By default the edit burns it in; the app draws it only if
  P3 builds that.

## Clarity rewrite of an existing script (D-024)

- **What stays:** every beat, shot and frame, the story, both endings, and the choice question and its
  labels.
- **You may:**
  - reword any line, with its tags and targets;
  - add a line inside an existing beat, using the next unused id and never renumbering;
  - cut a line;
  - move a line to another existing shot of the same beat, so that its speaker is on screen;
  - edit `action` only to say which line plays over which shot, or to drop a stage note that the new
    line replaces.
- **You may not:** add, cut, split or reorder a beat, or change what a shot shows. No shot is added.
  If added lines make one shot run past about 8 s, spread the lines over the beat's other shots, or
  flag the shot for S7 to hold on its camera move.
- **A fix that truly needs a beat change.** Ship the best line-level fix and list the beat change in
  `clarity_pass.owner_items`, with the C1 quote and why no line or super can carry it. Do not make the
  change: the owner decides.
- **Protected and balance lines** from earlier gates keep their function. Reword one only if the line
  itself is the fault, and log it in `clarity_pass`.
- **New lines** go in both files, with the same id. A gloss that only one language needs goes inside
  the existing line.
- **Defaults:** the drafted lines in `docs/clarity-review.md` section 6 are defaults. Use them or write
  better ones.

## Emotion tags (ElevenLabs v4)

Square-bracket tags inside the line. Each line is generated separately (connector, section 7.7), so a
tag never carries over to the next line: tag every line whose read matters.

| Group | Tags |
|---|---|
| Used in proof scenes | `[whispers]` `[sighs]` `[laughs]` `[chuckles]` `[excited]` `[nervous]` `[angry]` `[sharply]` `[quietly]` `[calm]` |
| Verify in casting first | `[deadpan]` `[cold]` `[flatly]` `[earnest]` `[hesitant]` `[confused]` |

Obedience depends on the voice. A tag not yet confirmed for that voice in casting goes in the
"verify" group; S10 swaps it if ignored.

Placement:

- Put the tag at the start of the line or directly before the clause it colours.
- One tag on short lines; never stack two tags on a line of one or two words.
- No ellipsis straight after a tag (`[whispers] ...और`): it produces breaths and artefacts.
- Vary dynamics. Do not whisper three lines in a row; keep the true whisper for the one line that needs it.
- The cliffhanger line must stay intelligible: no whisper under a phone filter or a loud sound effect.
  Say in `sfx_notes` that the bed ducks under it.
- Tags must fit `voice_note` (no `[urgent]` for a man who "never raises his voice").
- Write cut-offs so they are not read as another word: `mada—`, not `mad—`.
- Very short turns (one or two syllables) are unstable; merge them or flag them for extra takes.

## English adaptation (S5)

- Performable Indian English for the same cast, not a translation. Same beats, same line ids, same intent.
- Keep Indian terms people use in English: lakh, crore, sir/madam, yaar where the character would.
- Match length within about 15% of the Hindi line; note any line that runs short or long of its shot.
  Exception (D-024): a gloss that English needs and Hindi does not (thana, SI, SHO, DSP, FIR, malkhana)
  may run longer. Put it inside the same line, so the ids stay paired.
- Mirror every clarity fix, and write `supers[].text` and `clarity_pass.projected_finished_seconds`
  for English.
- Same tags where they still fit; adjust where the English read needs a different cue.
- Set `language` to `en` and describe the accent in each `voice_note` (no British or American).

## Before handing on

- JSON parses; hi and en have the same beat and line ids; tags match `emotion_tags`.
- Spoken total plus silences equals `target_total_seconds`; line count 25-40 (proof scenes excepted;
  more is fine when the extra lines are clarity lines).
- No यह/वह, no bookish Hindi, no recap, ending question open, cliffhanger line audible.
- Clarity checks (D-024), for each path that contains the episode:
  - every speaking character is named or given a role by the end of their first beat;
  - every line whose speaker is not in the beat's `on_screen` has `heard_as`;
  - each term is glossed once;
  - no more than three load-bearing numbers, and no serial numbers spoken as digits;
  - every thread from a shared episode is paid off in both branches;
  - every picture clue is spoken once;
  - in the question episode, both costs and both gains are spoken before the question line.
- `clarity_pass` is written. The projection is under 150 s in both languages. Any `owner_items` and
  `lock_conflicts` are listed.
