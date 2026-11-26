# Decisions log — Unwritten POC build

Every decision the owner would otherwise have made, plus harness findings. Newest at the bottom. Format: question · options · evidence · decision · what would change it.

## D-000 Harness check (26 Nov 2026, 00:45 IST)

- **Agent definition files.** `.claude/agents/<name>.md` files written during this session are **not** picked up by the desktop app's Agent tool: calling `harness-test-fable` returned "Agent type not found". The registry is read at session start only.
- **Decision:** use the brief's documented fallback. Every agent call passes `model` and `effort` explicitly (Agent tool and Workflow `agent()` opts). The `.claude/agents/*.md` files are still written as the single written source of truth for each role (model, effort, tools, skills), and every workflow call copies model and effort from them. A new session would pick the files up directly.
- `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`: **not set** in this session's environment (checked with `env`).
- Tier results (each agent asked to report its own model ID from its system prompt):

| Tier pinned | Agent tool (`model` + `effort` per call) | Workflow `agent()` (`model` + `effort` opts) |
|---|---|---|
| fable | Fable 5.2, `claude-fable-5-2` | Fable 5.2, `claude-fable-5-2` |
| opus | Opus 5.5, `claude-opus-5-5` | Opus 5.5, `claude-opus-5-5` |
| sonnet | Sonnet 5.5, `claude-sonnet-5-5` | Sonnet 5.5, `claude-sonnet-5-5` |

- Fable is available, so no Opus-xhigh substitution is needed.
- Caveat: the model ID is self-reported from the system prompt, which is how the harness tells an agent its model; I have no independent telemetry beyond that.
- Role roster with model/effort/tools/skills: `.claude/agents/*.md` (27 roles). Workflows copy `model` and `effort` from those files on every call.

## D-001 Runner methods from Phase 0 probes (26 Nov, 00:55 IST)

- **Codex frames.** Prompt first, `-i <refs>` last (variadic flag). 41 s per frame. Output in `~/.codex/generated_images/<session>/`; Codex cannot copy it (read-only sandbox), so the runner copies it by session id. Upscale with ffmpeg lanczos `scale=-2:2560,crop=1440:2560`. One-sample consistency with an attached reference: strong match (face, hair, jewellery, saree). Codex prints no allowance figure, only tokens used (~28k per frame). Playbook: `.claude/skills/frame-generation/SKILL.md`.
- **ElevenLabs from subagents works.** `creative_generate_speech` then `creative_get_generations` -> `full_res_url`, downloaded with curl (MP3 44.1 kHz mono). 35 credits per ~28-char line on both v4 and v3. `account_get_usage` does not show these spends, so credits are tracked from per-call `credit_costs`. Playbook: `.claude/skills/voice-direction/SKILL.md`.

## D-002 Agent registry (26 Nov, 01:05 IST)

- About 20 minutes after they were written, the desktop app hot-loaded the `.claude/agents/*.md` files and they became callable agent types. From here on, workflows call each role by `agentType` **and** still pass `model` and `effort` explicitly (belt and braces), copied from the file.
- Voice runner, voice director and sound designer were given `ToolSearch` plus the specific ElevenLabs connector tools they need; their original tool lists would have blocked the connector.

## D-002b Start Phase 1 while Phase 0 production runs (orchestrator, 26 Nov ~01:30 IST)

- **Question:** the plan sequences Phase 0 before Phase 1. Wait for Gate 0, or start the story work now?
- **Options:** (a) wait about an hour for Gate 0; (b) start loglines and bibles now, and hold scripts until Gate 0 has fixed any script conventions.
- **Evidence:** the overnight window is the binding constraint. Codex alone needs about 500 frames × ~41 s ≈ 6 hours in a single lane (D-001). Gate 0 decides production method (frames, voice model, timing, render). It does not decide story.
- **Decision:** (b). Phase 1 runs now. Phase 2 scripts start only after Gate 0, so any change to script format (tag vocabulary, line length) is applied before writing.
- **Would change it:** a Gate 0 finding that changes story constraints (for example, a cap on characters per shot for consistency). That finding is then applied to the bibles before scripts.

## D-003 Gate 1a: Series 1 logline (A0 Arbiter, 26 Nov ~01:45 IST)

- **Question:** which of the three Series 1 loglines in `content/series1/loglines.json` goes forward to the bible?
- **Options:**
  - s1-l1 सातवाँ साल: an imposter husband and a wife who cannot say how she knows.
  - s1-l2 नौवीं पहली रात: a runaway bride whose ninth groom is the trap.
  - s1-l3 Camera बंद मत करना: a fake video-call policeman who gets a real confession.
  - Also considered: s1-l3 with the critic's choice fix (the critic's recommendation). Moving one logline's ballot onto another story was rejected, because each ballot only works inside its own plot.
- **Evidence:**
  - **Critic (S3):** s1-l3 8.4, s1-l2 8.1, s1-l1 7.8. It calls the top two "within my margin of judgement" and recommends s1-l3 only with a choice fix. Its choice sub-scores are 6.5 for s1-l3 and 7.5 for each of the others. It says to take s1-l2 if the choice is judged as pitched or if a second police-uniform series is unwanted.
  - **Showrunner (S1), who wrote all three:** leans l1, l2, l3. It says s1-l2 has the strongest first five seconds and the lowest production risk, and that s1-l3's choice is the likeliest to split unevenly. So the author and the critic agree on s1-l3's weak point.
  - **Plan:** section 3 says a script goes back if one option is obviously right, and asks for English nouns and verbs inside Hindi lines. Section 1 lists "characters change face between shots" as a failure. Section 9 fixes stills only and Codex only.
  - **The critic marked s1-l2 down for risks the logline file already designs out.** It cites heavy bridal jewellery, henna and a hanging that may be refused. The file specifies a plain red saree, no heavy jewellery, block henna, the chooda as the one fixed marker, and a death that is spoken of and never shown. The critic's list of files read does not include `content/series1/loglines.json`.
  - **D-001:** one Codex frame made with a reference sheet matched face, hair, jewellery and saree. That is one sample.
  - **Series 2 shortlist (`content/series2/loglines.json`):** all three candidates have khaki leads, and s2-duplicate-thana is about a fake inspector in a perfect uniform. s1-l3 would give a two-series demo two police-uniform leads, and would clash directly with one Series 2 candidate. Series 2 had no decision entry when this was written.
  - **Web search, results pages only, pages not opened:** digital-arrest dramas already exist, including a vertical micro-drama on a rival app, a government micro-drama series on Instagram and police awareness shorts. None found uses the real-confession turn. Runaway-bride stories on screen are a 2011 TV serial and Dolly Ki Doli (2015); none found uses the groom as the trap. Coverage of Indian micro-dramas names romance and family drama as lead genres, with revenge and hidden identity also popular.
  - **Proof review notes:** a key line that is quiet and phone-filtered was flagged as likely to be unintelligible. In s1-l3 the e01 confession, the daughter's question and the boss's order all arrive over a call or an earbud. In s1-l2 only Mausi's speaker line does.
  - **My judgement, not a measurement:** s1-l3's choice is not forced. Kabir can say nothing now and tell the daughter later, so a careful viewer sees a third way, and the critic's fix (threatening Zoya) does not close it. s1-l2's choice is forced: one of two phrases has to be said on a live call, and silence is itself an alarm.
- **Decision:** **s1-l2 नौवीं पहली रात**, with the changes below. Reasons, in order of weight:
  1. The choice is the product's central mechanic, and s1-l2's is stronger than s1-l3's both as pitched and as fixable.
  2. It works beside any Series 2 pick and gives the demo its widest range.
  3. Its cast and set are the smallest (five principals, six places, no uniforms or insignia, no call-interface overlays).
  4. The critic's 0.3-point preference for s1-l3 rested mainly on a wardrobe risk the logline already answers.
  - s1-l1 has the most even choice but is third. It has six or seven faces, with group frames at both the hook and the question. It has the least code-mixing. Its plot needs a legal mechanism explained in two minutes and a reason nobody runs a DNA or fingerprint test. It shares a small-town setting and a daroga with Series 2.
- **Direction to the showrunner:**
  1. **Keep as pitched:** title, the five principals, the six locations, the e01 hook and cliffhanger, the question, both option phrases (A = all clear, B = alarm), both branches, both endings and both glimpses.
  2. **Wrist check (must fix).** Aditya has to look for the scar on screen and fail for a reason the viewer can see. "He does not think to look" will not pass.
     - One line in e01 says why he has never seen the sixth bride's face: he was not at the wedding and the gang took every photograph but one. It must fit a pharmacist, so do not use the critic's "ship" line.
     - Within the first 30 seconds of e02 he asks for her hands. Recommended: the scar sits under the middle of the bangle stack, and before he starts taking bangles off Kiran gives him a decoy, that the girl with the burnt wrist no longer does weddings and sits with Mausi. The lie makes Kiran his only way in. An equivalent beat is fine if the critic passes it.
     - In every branch A episode the wrist stays covered and under threat, and each near miss has a shown reason.
     - The bible fixes which wrist, where on it, and the scar's size and shape. The photograph shows that same hand.
     - Do not put a custom about how tightly a chooda fits into dialogue. A search confirmed only that it is traditionally worn for about 40 days.
  3. **Code in audio (must fix).** The viewer hears both phrases and what they mean before the 2 am call, out of Aditya's hearing. For example, on an earlier check-in Mausi says in Kiran's ear: 'फट जाए तो बता देना, लड़के गली में हैं।' The pinned message may stay as a second cue, added as an overlay. On the ballot each option shows the spoken phrase and its plain meaning.
  4. **Choice balance (must fix).** All four belong in e01 and e02. Do not add a hostage or a weapon to force it.
     - A's danger is in Aditya's own words: before the call he says, calmly, what he will do to the owner of that hand. His promise that she walks is made to "Sneha".
     - Mausi's care is shown in one concrete act, not reported.
     - B is an option a decent viewer can pick: as far as Kiran knows the boys frighten and rob, and nobody has died at their hands. She learns what "handling him" means only in branch B. The cost stays that she knowingly breaks a second brother.
     - There is no third way: no answer, or any other answer, brings Billu up the stairs.
  5. **Register.** Aditya speaks as an educated small-city pharmacist, with the English words natural to him (dose, sedative, SIM, speaker, photo, bureau, police). Kiran speaks small-city Hinglish. Mausi and Billu are Hindi-heavy with the trade's English (party, booking, advance, biodata). Mausi's line on the speaker is warm and fully voiced, never a whisper.
  6. **Production locks for the bible.**
     - Kiran's look is as in the logline file: plain red saree, no heavy jewellery, block henna, chooda on both forearms as the fixed marker, then the same chooda with a grey salwar-kurta.
     - Aditya has his glasses and the key on a red thread in every shot.
     - The two leads are clothed and apart in the bedroom: no intimacy staging. Mohit's death is never pictured.
     - "The boys" are Billu plus at most two faces; otherwise boots, headlights and shadows.
     - All readable text is an overlay.
     - The room is broken up with inserts (glass, padlock, key, photograph, phone, brass jewellery, window) and at least one cut to Billu in the lane per shared episode. No set-up is held past 8 seconds (plan 7.3).
  7. **English version.** The two code phrases must still sound like a mother's check-in ("Did he drink his milk?" and "The milk has split").
- **Not verified:** no script exists, so every vote-split figure is a guess. Gate 0 frames were not finished and I did not look at any image. The web checks read search summaries, not the pages. I did not check any legal point, because s1-l2 does not depend on one.
- **Would change it:**
  - Before scripts start: if the showrunner cannot close the wrist-check hole in a way the critic accepts, take s1-l3 instead. That needs a fix that makes Kabir's lie final (for example, the two crore also buys the recording), and Series 2 must not be s2-duplicate-thana.
  - If Gate 0 shows the chooda or the lead's face drifting between frames even with a reference sheet and tight framing: first simplify the look (drop the henna, keep the chooda), and reopen this decision only if the chooda itself cannot be held.
  - If someone finds an existing film or series built on a groom who makes himself the mark to hunt the bride.
  - After scripts start the logline is not reopened. A choice that fails the critic twice is fixed inside this story.
- **Sources for the web checks:** [Open: Scam Se Bacho](https://openthemagazine.com/india/scam-se-bacho-meta-and-indian-government-take-on-digital-arrest-scams-with-instagram-microdrama) · [Indian Television: Story TV's Scam 2024](https://indiantelevision.com/iworld/vidya-malavade-makes-microdrama-debut-with-story-tvs-scam-2024/) · [Deccan Herald: UP Police short film](https://www.deccanherald.com/india/uttar-pradesh/real-life-digital-arrest-switcheroo-inspires-nana-patekar-led-short-awareness-film-by-uttar-pradesh-police-3849326) · [Wikipedia: Looteri Dulhan](https://en.wikipedia.org/wiki/Looteri_Dulhan) · [Airtel blog: Dolly Ki Doli](https://www.airtel.in/blog/entertainment/dolly-ki-doli-bollywoods-bold-breezy-take-on-a-runaway-bride/) · [Meta-Ormax micro-drama report](https://about.fb.com/news/2026/03/social-feeds-are-powering-indias-micro-drama-boom-meta-ormax-report/) · [Wikipedia: Chura (bangles)](https://en.wikipedia.org/wiki/Chura_(bangles))

## D-004 Gate 1a: Series 2 logline (A0 Arbiter, 26 Nov ~01:55 IST)

- **Question:** which of the three Series 2 loglines in `content/series2/loglines.json` goes forward to the bible?
- **Options:**
  - s2-laddoo लड्डू: an evidence locker opened with a key, a laddoo left in place of the cash, and the lead framed. Grown from the flat 2D proof scene.
  - s2-duplicate-thana Duplicate थाना: a fake police station in a shut cinema that runs better than the real one.
  - s2-pichkari पिचकारी: a retiring ASI's loaded revolver replaced by a toy on his last day.
  - Also considered: a hybrid. Rejected for the reason in D-003: each ballot only works inside its own plot. The one thing that carries across is the proof scene's approved uniform and palette.
- **Evidence:**
  - **Critic (S3):** duplicate-thana 7.7, laddoo 7.5, pichkari 7.2, each the mean of six criteria. I re-added the sub-scores and the means are right. It calls the top two "within noise" and recommends duplicate-thana narrowly. The sub-scores that separate them are branches (8.5 against 6.5), freshness (8 against 6.5) and production fit (6.5 against 9). On choice they are level (6 against 6.5): both lean to B.
  - **Showrunner (S1), who wrote all three:** leans pichkari, duplicate-thana, laddoo. It calls duplicate-thana "the funniest and most original" with the most set-up.
  - **Plan:** section 1 lists "the stories are not gripping" first among the failure tests. Section 3 requires a choice that costs the lead either way, and branches that are different stories with real endings. Sections 2 and 4 make "watch the other ending" and "keep or move your ballot" part of the demo, so the branch a viewer did not pick has to be worth watching, and neither ending may make the other pointless.
  - **My read of the three full entries (judgement, not measurement):**
    - duplicate-thana: the lead drives both climaxes (thirty FIRs door to door in A; the seizure memo read aloud and her own statement in court in B). Neither ending hands back what the choice cost: A costs Nirala his freedom and the town its grain, B costs her the uniform. Its must-fixes are local: one scene in e03, a few lines of motive in e01 and e02, and prop and naming changes.
    - laddoo: the lead is passive in both climaxes (PP's statement settles A; the aunties settle B while she sits in the lockup). The night's timeline (the forged 11:40 entry, the women's theft, the SHO's midnight visit, his 2 a.m. call) does not yet fit together. Both fixes mean re-plotting the shared episodes and both branches.
    - pichkari: the e03 reveal (Dadda put the toy in his own holster) undoes the e01 hook, where he opens the flap himself. The engine is his, not the lead's. Ending A refunds every cost, so after seeing both endings nobody would keep B. "She is clean" in B is untrue, because she has hidden the loss since morning.
  - **Production:**
    - Reuse is worth less than it looks. The critic puts it at 15 to 20 of about 250 generations; at 41 s a frame (D-001) that is 10 to 14 minutes. The new laddoo hook also reorders the proof shots. laddoo would also carry over the two proof voices; I did not read the voice review, so I gave that no weight.
    - duplicate-thana needs about four more sheets and plates than laddoo (13 against 9, by the cast and location lists) and more overlay text. Overlays are added in assembly, so they do not depend on the image model, and the proof already used one for the caller name.
    - pichkari is the only candidate that needs weapon frames (a revolver in hand, rifles being loaded). Plan section 3 names model refusals as a real limit, the proof did not test weapons, and the build runs unattended.
  - **Approved uniform** (checked in `content/proof/flat2d/style.json` and `continuity.json`): khaki, teal epaulettes with off-white bars (two for a sub-inspector, none for a constable), a white lantern sleeve patch, no caps. The force has no stars, so "two stars" in the hook and "one star too many" cannot be drawn as written.
  - **Proof review notes (flat 2D):** two off-screen superiors both called "साहब" were confused, and an ending that had to be read off an overlay was changed to a spoken line. duplicate-thana has three senior men and an e01 ending built on dates in a file, so both lessons apply to it.
  - **Research (search summaries, not the pages):** a real fake police station ran for about eight months in Banka, Bihar, in 2022, reportedly about 500 metres from the real one. It was an extortion racket. The logline turns that round: the fake thana is honest and better run. Two searches for a film or series built on a fake police station found none. That is not an exhaustive check.
  - **D-003:** Series 1 is s1-l2, which has no uniforms, so the fake-cop clash the critic warned about (with s1-l3) does not arise. Both picks do involve an impostor (a bride under a false name, a fake inspector). I weighed that lightly: the looks, tones and leads are far apart, and here the lead is the real officer.
- **Decision:** **s2-duplicate-thana Duplicate थाना**, with the changes below. Reasons, in order of weight:
  1. Its branches are the strongest of the three, and they are what the day-one mechanic shows off: two different stories, the lead active in both, and endings that leave a real question of keep or move.
  2. Its weak point, a choice that leans to B, has fixes that are local and that I judge likely to work. laddoo's choice leans almost as far (the critic's 60 to 65 per cent against about 70), and its other must-fixes are structural.
  3. It has the freshest premise and the clearest one-line pitch for a team demo.
  4. laddoo's production advantage is real but small in frame time. Feasibility is a limit to stay inside, not a thing to maximise.
  - pichkari is third, against the showrunner's lean: its plot does not hold at e03, one ending dominates the other, and it alone carries the weapon-frame risk.
  - Side ruling the critic asked for: growing the proof scene into a series would have been allowed. Plan section 3 bars the three concept-note stories, and the proof was written inside this build. This did not decide the gate.
- **Direction to the showrunner:**
  1. **Keep as pitched,** except where changed below: title, logline, town, the five on-screen principals and the DSP, the e01 hook dialogue, the three shared episodes and their cliffhanger types, the question and both labels (A = हथकड़ी, B = एक रात और), both branches, both endings and final images, and both glimpse seeds.
  2. **Choice balance (must fix).** All of it sits in e03 and on the ballot.
     - The city transfer stops being the DSP's reward for the arrest. The e01 order is only "arrest him by ten tomorrow", and ten is the DSP's press conference. If her wish to leave Imlipur is kept, it is her own pending application, shown in e01. It is not mentioned in the e03 choice scene, on the question card or ballot, or in glimpse A. In a06, "she tears up the transfer" is cut, or becomes her withdrawing her own application.
     - A's gain is then one thing: Nirala is alive and in her lockup tonight, by the book. The bible states A's cost to her, not only to the town: she locks up the one policeman Imlipur trusted and watches the truck leave knowing she let it.
     - B's danger is real on screen. In e03 Pushpa tells Nandini that Tripathi's call to Bhaiyaji connected and that she heard the word "talkies". Nobody knows what Bhaiyaji said back. The viewer votes believing he may know, without being sure.
     - Bhaiyaji's midnight invitation has an ordinary reason that holds whether or not he knows (for example, he wants the "outpost" to sign the truck's movement slip). The invitation must not itself prove a trap.
     - Nirala is frightened when he shows the wooden revolver and holds out his wrists. It is an admission that he cannot defend himself, played straight, with no comic tag on the line.
     - If the critic still reads the bible as worse than about 65 to 35, raise what B risks on screen. Do not add rewards to A.
  3. **Why the fake thana lasted two years (must fix).** It goes in e01 and e02, in dialogue, with no narrator. Every complaint Tripathi turned away walked across the railway line. That is what gave him fourteen months without an FIR and his zero-crime shield. Exposing Nirala would expose the shield, so Tripathi told neither the department nor Bhaiyaji, and Bhaiyaji went on paying what he took for a new outpost. Nandini's report up the line ends that arrangement, which is why Tripathi dials Bhaiyaji at the end of e02. Pushpa is the natural voice for this, in two or three lines.
  4. **Endings are spoken (must fix).** In e01 Nandini reads one refusal date aloud and says whose thana refused it. The overlay may support the line but not carry it. The same holds for every episode ending and both glimpses.
  5. **Names.** There are three senior men, so nobody says a bare "साहब" or "बड़े साहब". Tripathi is "SHO साहब" or "Tripathi जी". The DSP is "DSP साहब". Nirala is "Nirala जी" to the town and "Inspector साहब" only in Bhaiyaji's mouth, and that is set up in e02 before e03 relies on it.
  6. **Production locks for the bible.**
     - Uniform: the approved proof force as described above. No stars anywhere. Nandini wears two bars.
     - Nirala's too-perfect uniform reads in silhouette, not by counting. He is the only person in the series in a peaked cap, the uniform is a size too big, and his "one thing too many" is a single large home-made item (default: a self-awarded medal on the chest).
     - Hook image: a khaki sleeve with the lantern patch holding the token. In b04 and glimpse B she unpins the medal, not a star.
     - The wooden revolver is holstered, on a table, or in his hand in profile. It is never pointed at a face or at the camera.
     - Text: token numbers, thana boards, receipts, file dates and the help-desk board are overlays added in assembly. Boards and papers are painted blank. The bible lists every overlay. Nothing the plot needs may depend on reading one.
     - Places: seven plates at most. They are real_thana (the a06 press conference is staged here, as a table of microphones with no audience), talkies_lobby (also B's final image), projection_room, crossing_stall, godown, one lane doorway used for every complainant door in a04 and a05, and magistrate_room (B only). The prison van is a close insert, not a plate.
     - Rename cold_storage to godown: ration grain sits in a godown, and b05 is already titled गोदाम.
     - Faces: six sheets (nandini, nirala, tripathi, bhaiyaji, pushpa, dsp). Complainants are at most three faces across a04 and a05, one shot each, never recurring. The magistrate and the defence lawyer in b06 are voices with hands or backs. There is no crowd anywhere.
  7. **For the critic at the bible.** Branch A's climax is paperwork. The cuffed door-to-door walk in a05 has to be funny and warm, or A becomes the branch nobody wants to see. Test that hardest.
- **Not verified:** no script exists, so every vote-split figure is a guess, mine included. I did not look at any image, and this file had no Gate 0 entry when I wrote this. The web checks read search summaries, not the pages. I checked no legal point (what impersonation or abetting it would cost either of them); the story asserts those. I read the flat 2D proof script and review notes in full, and only the problem headings of the photoreal review notes.
- **Would change it:**
  - Before scripts start: if the bible cannot land the set-up inside e01 and e02 without a narrator, in a form the critic passes (why the fake thana exists, why Tripathi tolerates it, why Bhaiyaji trusts it), take s2-laddoo instead. That needs the critic's fixes: Meenu engineers PP's turn in A and plans the sting from the lockup in B; one written timeline for the night; A's cost tied to that day's wedding; the lockup moved out of the malkhana plate; the forged signature spoken.
  - If Gate 0 shows that overlay text cannot be held on a still under a camera move, or that new character sheets drift where the proof's did not, laddoo's reuse and tight night palette count for more and this is reopened.
  - If D-003's fallback fires (s1-l2 fails its wrist-check fix) and s1-l3 is wanted, the two gates are looked at together, because s1-l3 and this pick cannot both run.
  - If someone finds an existing film or series built on a fake thana that is better than the real one.
  - After scripts start the logline is not reopened. A choice that fails the critic twice is fixed inside this story.
- **Sources:** [Inquirer/AFP: Indian gang ran fake police station for eight months](https://newsinfo.inquirer.net/1649642/indian-gang-ran-fake-police-station-for-eight-months) · [ThePrint: Bihar police bust fake police station in Banka](https://theprint.in/india/bihar-police-bust-fake-police-station-in-banka-seven-arrested-so-far/1095381/) · [Free Press Journal: Bihar gang runs fake police station out of hotel](https://www.freepressjournal.in/india/bihar-gang-runs-fake-police-station-out-of-hotel-for-eight-months-busted) · [LiveLaw: Fake cops, real crimes](https://www.livelaw.in/amp/articles/fake-police-stations-digital-arrest-and-financial-scam-280993)

## D-005 Gate 1b: Series 1 bible (A0 Arbiter, 26 Nov ~02:50 IST)

- **Question:** can scripts be written from `content/series1/bible.json` as it stands, or does it go back to the showrunner first?
- **Options:**
  - (a) Approve as written and hand the critic's list to the eight episode writers as notes.
  - (b) Approve the story, and return the bible file once for a fixed list of changes before any script starts.
  - (c) Reopen the logline. D-003 allows this only if the wrist check fails.
- **Evidence:**
  - **Critic (S3), round 1:** pass, 7.8, no fatal problem, 8 must-fix items it calls local, 9 medium, 5 minor. It accepts the wrist check on three conditions (its M3, M7 and m1). The review reached me as text in the orchestrator's brief. The critic has no write tool, so `content/series1/review-notes.json` does not exist.
  - **My read:** the whole bible (1,378 lines), checked against the critic's list item by item. Each point I rely on is in the text:
    - s1e02 b13 says "Both answers begin with that word" (मौसी). A's locked line is "हाँ मौसी, पी लिया।", so that is untrue. The last word of the shared episode is also the first word of B's ballot label.
    - s1e02 b2 bares "three fingers' width" of skin. `story_locks.scar` puts the scar's centre at three fingers' width and says a 3 cm push still covers it. Both cannot hold.
    - s1e01 b1 pushes both stacks up to the elbows, b3 sends her to the door, and b11 reveals the scar on the left arm with the stack "still pushed up". Nothing tells the frame artist to keep that arm out of sight for ten beats.
    - Branch B has no beat between 2:01 and 4:10 that says why he leaves the wrist alone. `near_misses_branch_A` has no B counterpart.
    - Mausi reaches for the left wrist in both finales (s1a03 b2, s1b03 b4), and "आपने ही सिखाया है" is in both (s1a03 b5, s1b03 b6).
    - s1a01 b1 has Aditya think the milk question was "small talk". He is the man who said "पूरी पुड़िया डाल दो".
    - `writer_notes` says to trim s1e02 b5 first. `choice.balance_levers` puts two of the five levers in b5.
    - The bureau's cot is in the back room (`locations.bureau.geography`), and three front-room beats put Chhoti on it (s1a01 b10, s1a03 b7, s1b03 b9).
  - **Plan:** section 2 makes "watch the other ending" and "keep or move" part of day 1, so the two finales are seen back to back. Section 3 asks for each branch to be a different story. Section 9 fixes stills only and five episodes a path; section 1 says "about two minutes" each.
  - **D-003:** the wrist check is a condition on the logline. Direction 4 makes "his promise is made to 'Sneha'" a balance lever.
  - **D-004 direction 4 and the flat 2D proof notes:** an ending or clock carried only by an overlay was sent back.
  - **Timing:** D-002b holds scripts until Gate 0. This file has no Gate 0 entry, and `docs/morning-report.md` (last updated about 01:30) lists Gate 0 as running. One revision of the bible should therefore cost little script time. I could not check Gate 0's state beyond those two files.
  - **Voice evidence:** `content/proof/photoreal/voice/review.json` is an empty list, so nothing measured says one-word lines fail.
  - **App manifest:** `app/public/media/series1/series.json` carries ballot meanings that differ from the bible ("सब ठीक है: car ले आओ।", "यह trap है: लड़के भेजो।"), and the second uses यह.
- **Decision:** **(b). The story is approved. The bible file goes back once.**
  - Approved and closed: title, cast, the six locations, the hook, the shape of both shared episodes, the question, both locked phrases, both branches, both endings and both glimpses. There is no re-plot.
  - **Wrist check: D-003's condition is met and the logline is not reopened.** He asks for her hands in his first line and takes the correct hand. He is stopped by something the viewer sees (she lifts the drugged glass) and turned by a lie the viewer can see through. The critic accepts it and, on my reading, so do I, with changes 2, 3 and 4.
  - Not (a): changes 1, 5 and 9 each cross two to four episodes. Eight writers applying them from a note, while the file S4 and S6 read says the opposite, is how the scripts would drift.
  - Not (c): nothing below touches the premise.
- **Required changes, part 1 (the critic re-reads these beats).** Wording in quotes is the default. An equivalent is fine if it does the same job.
  1. **End of s1e02 (critic M1).** The episode ends on Mausi's "हाँ बेटा? पी लिया?" and Kiran's in-breath. She says no word. s1a01 b1 opens on the whole line "हाँ मौसी, पी लिया।" and s1b01 b1 on the whole line "मौसी... दूध फट गया।". Delete "Both answers begin with that word". Update s1e02 b13, the ladder's s1e02 `last_beat`, both branch openers and `register.performance_flags`.
  2. **Wrist check staging, s1e02 b2 (M7).** The bible's own `staging_alternative` becomes the staging: he slides the bangles off over her hand one at a time, and three lie on the sheet when she lifts the glass. Delete "three fingers' width" and the viewer-only insert, because a still cannot show a scar that is covered. Say where the three bangles go next (default: she slides them back on while she tells the Rekha lie). Update `wrist_check.how_it_is_met`, `wrist_check.status`, `scar.under_the_chooda` and the matching `not_verified` line.
  3. **Why he stops, s1e02 b4 (m1, changed).** He says it to her face, not half to himself. The beat must give (i) the reason he stops looking at her wrist and (ii) the priority, "पहले मौसी। रेखा बाद में।". The critic's line alone is not enough, because after change 2 he has seen none of the skin that matters. Default for (i) is the bible's own reason, said to her: if she were that girl she would not be telling him where the girl sits. An action is as good as a line (example only: she holds the wrist out and offers to take the rest off herself, and he waves it away).
  4. **Branch B wrist, s1b01 between b5 and b6 (M3).** Show why he does not check the wrist in two and a half hours. Default: Kiran sits with her back against the door, left arm under the pallu: "हाथ लगाया तो चिल्लाऊँगी। फिर ये दरवाज़ा नहीं बचेगा।" Add `story_locks.near_misses_branch_B`. This also marks the time jump. She must be clear of the door before the hasp tears (b8 and glimpse B).
  5. **The two finales (M2).**
     - s1a03: Mausi does not reach for the wrist and does not offer to sell the hand. Her first move is to cover for Kiran. Default: Aditya asks her for Rekha by name and she backs the lie: "रेखा? वो तो दो साल पहले भाग गई, दामाद जी।" Kiran refuses the cover and takes the chooda off herself, so the confession is chosen and not forced. This also fits Mausi's stated want (to keep Kiran) better than selling her does.
     - The step from the s1a02 threat ("बता दूँ इसे, बेटा?") to the cover must read as Mausi's choice. Her s1a03 b4 line ("take her, go out the back") is rewritten to fit.
     - s1b03 b6 gets its own line (default: "हिसाब अब मैं रखूँगी, मौसी।"). "आपने ही सिखाया है" stays in s1a03 only.
     - "The boy turned out weak" stays in s1b01 only. In A the fact comes out through Kiran's question and Mausi's silence.
     - Update s1a03 b1, b2 and b4 with their `reveal` fields, `endings.A.summary`, `mausi.secret`, `story_locks.rekha` and `knowledge.branch_A_only`.
  6. **Scar hidden in s1e01 (M6).** New production lock: "s1e01 b1 to b10: the left forearm is never in frame uncovered. It is under the fall of the pallu or against her body, and she uses only her right hand at the tray, the door and the phone."
  7. **What Aditya and Mausi know (M8).**
     - Aditya knows the milk question is the gang's check. What he does not know is that an alarm phrase exists, or that any other answer counts as one. Correct s1a01 b1 ("small talk"), the s1e02 b8 `reveal`, `knowledge.end_of_s1e02.aditya` and `story_locks.code.who_knows`.
     - s1a01 b7: on the car call Kiran tells Mausi why she gave the all-clear with the groom awake. Default: "लड़के ऊपर आते तो सौदा टूट जाता, मौसी। इसलिए बोला पी लिया।"
  8. **Why no police in branch B, s1b01 b6 (M4).** "Mausi would turn back at the corner" does not stop him calling them for 4:30. Add what he would have to show them: "Police को दिखाओगे क्या? ताला तुमने लगाया है, नाम तुम्हारा नकली है, और मौसी बस अपनी बेटी लेने आई हैं।" Cut the notebook business to one insert.
  9. **Length (M5).** The plan says only "about two minutes", so this ceiling is my call: each outline should be writable at about 120 seconds and no more than about 135.
     - `writer_notes`: remove "trim b5 first". s1e02 b5 is protected.
     - Defaults. s1e02: merge b8 into b4 and b11 into b10, keeping everything b8 carries (a dead phone brings Billu up, the SIM goes back, the speaker, her lie that there is no code). s1a01: cut b4 and make b2 one short silent shot. s1a03: fold b9 into b8. s1e01: compress b6 to b8 into two beats, with b8 down to the one or two lines D-003 asked for.
     - Other trims are fine if no balance lever, lock or near miss is lost.
- **Required changes, part 2 (small; checked for presence only).**
  10. **Ballot meanings (m2, changed).** `choice.A.meaning` and `choice.B.meaning` take the same two-part form (what the answer tells the gang, then who is handed to whom) at about the same length, with no word of praise or blame. Drop "सब ठीक है" and "ख़तरा है" as openers. The critic's wording for A, "आदित्य को बचा लेती है", is not used: "saves" leans to A harder than the present text does.
  11. **"किरण" in the shared episodes (critic minor, raised).** Mausi says the name in s1e01 b5. The viewer then knows 'Sneha' is false before Aditya promises 'Sneha' she can walk, which is a D-003 balance lever. Aditya still first hears the name from Billu. Update `story_locks.names`.
  12. **Photograph (critic minor, raised).** `story_locks.photograph` states that the bride's hand in the print has no henna at all. Tonight her fingertips are dipped. If the print's were too, he would have a second match in front of him from the first frame.
  13. **s1a02 b6 (m3).** Aditya says the half-hour aloud in a full phrase, and the overlay only supports it. One clause says how police are thirty minutes from a town he first saw that morning (default: his contact passes it to the nearest post).
  14. **s1b02 b9 (m4).** Add a last image that shows beyond doubt he is alive (default: one eye opens a slit behind the glasses). "Unopened" cannot be read off two paper folds in a still.
  15. **s1a02 b5 (m6).** Mausi says she gave her the name Kiran (default: "किरण नाम मैंने रखा था तेरा। याद है?"), so "तुलसी" pays off in s1a03 b10. Update `story_locks.names`.
  16. **Chooda (m8a).** Describe it as it reads: a red cuff about 10 cm long with a pale band at each end. No line, lock or continuity check depends on a count.
  17. **The boys (m8b).** They are in 11 beats across five episodes. Use one shared reference sheet, or lock them to hands, backs and silhouettes. Write the choice into `production_locks`.
  18. **Bureau geography (m8c).** Move the cot to the front room, and say what is in the back room for s1a02 b4.
  19. **s1a02 b6 (mine).** Say where Mausi is while Aditya opens the cashbox that sits on her own desk (default: behind the marigold curtain with Chhoti, with Kiran standing in the gap).
  20. **s1b01 b7 (critic minor).** One clause: Mausi comes in a hired car, present only as headlights and sound, and it does not wait.
  21. **`writer_notes` gains two lines.** Single-word turns get a carrier or extra takes, decided line by line by the writer and the voice director (m5). English verbs belong in the Hindi lines where they are natural, as plan section 3 asks (critic minor).
  22. **`content/series1/branch-map.md`** is regenerated from the revised bible.
- **Rejected, or not a bible matter:**
  - **m5 as a rule.** None of the eight words is a locked line, anchor lines are the writer's to improve, and nothing measured supports it. The three names at the chowki are the ending and are not padded by rule. It survives only as the writer note in change 21.
  - **m7 (Billu briefs the boys).** Optional. A boss repeating the drill before a job is natural enough, and D-003 direction 3 asks only that both phrases and what each does are heard out of Aditya's hearing. If the writer changes it, all three outcomes are still spoken.
  - **m8d (plate list).** It belongs in S6's `style.json` and is judged at Gate 3. Note for S6: the six locations will need about nine plates.
  - **m9 (he leaves the key on the step).** It breaks the lock that the key is in every shot of him to the last frame (D-003 direction 6, `key_thread`). In B he ends unable to act, and the key for a lock that no longer exists already shows it.
  - **Critic minor on the s1b02 b3 `reveal` label.** No effect on screen. Fix in passing or leave.
  - **From M2: "Mausi knew he died" in both branches.** Not a repeat to remove. It is a fact fixed before the choice, so it may surface in both. Only the wording is separated (change 5).
- **Next steps:**
  - S1 applies changes 1 to 22 in `bible.json` and `branch-map.md`.
  - The first agent with a shell runs `bible.json` through a JSON parser.
  - S3 re-reads the beats changed by 1 to 9 and confirms 10 to 22 are present. **This is the last bible round.** Local findings on the second read go to the writers as notes and the bible is approved. Only a fatal finding comes back here.
  - The product track then syncs the ballot text in `app/public/media/series1/series.json` from the bible.
  - An agent that can write saves the critic's round 1 review to `content/series1/review-notes.json`.
- **Not verified:**
  - No one has parsed `bible.json`: the showrunner, the critic and I all lack a shell. My pattern searches found no backslash, no comma before a closing bracket and no stray text after a value's closing quote. That is not a parse.
  - Lengths are estimates from beat counts. The vote split is unknown, and the ballot lean in change 10 is a guess, the critic's and mine.
  - Of the critic's counts I reran two: the beat total (85) and the यह/वह search (the only hits are यहाँ, यही and the register rule that names the two words).
  - I viewed no frame. Sliding or removing a chooda as staged is untested on a frame.
  - `branch-map.md`: I read the diagram, the glimpses, the branch test and the first 400 characters of each episode paragraph.
  - Proof scenes: I read the first 120 lines of the photoreal script and its review notes with eight long lines not shown by the tool. I did not reread the flat 2D proof.
  - The defaults in changes 3 to 5 are untested until the critic reads them in place.
- **Would change it:**
  - If on the second read the critic no longer accepts the wrist check (changes 2 to 4), D-003's fallback applies, and D-004 says the two series are then looked at together.
  - If Gate 0 closes and writers would sit idle before the revision lands: s1a02 and s1b02 are touched only by part 2, so those two scripts may start from the present bible plus this entry. The other six wait.
  - If measured script timings come in under the ceiling with a merged beat restored, the showrunner may restore it.
  - After scripts start, the bible changes only through an entry in this log.

## D-006 Gate 1b: Series 2 bible (A0 Arbiter, 26 Nov ~03:05 IST)

- **Question:** can scripts be written from `content/series2/bible.json` as it stands, or does it go back to the showrunner first?
- **Options:**
  - (a) Approve as written and hand the critic's list to the nine episode writers as notes.
  - (b) Approve the story, and return the bible file once for a fixed list of changes before any script starts.
  - (c) Reopen the logline. Before scripts start, D-004 allows this only if the set-up cannot land in e01 and e02 without a narrator.
- **Evidence:**
  - **Critic (S3), round 1:** fail, 7.3 against a 7.5 line, no fatal problem. Ten must-fix items it calls local (P1 to P10), ten medium, four minor. Highest sub-score: branch_distinct 9. Lowest: length 6, choice 6.5, continuity 6.5. It says D-004's no-narrator condition is met, "but only just". The review reached me as text in the orchestrator's brief. The critic has no write tool, so `content/series2/review-notes.json` does not exist.
  - **My read:** the whole bible (560 lines) and `branch-map.md`, checked against the critic's list item by item. Each point I rely on is in the text:
    - The antagonist is बृजेश 'भैयाजी' सिंह. The name is read aloud as the accused in s2a03 b4, in the memo in s2b02 b6 and in the court order in s2b03 b8. It is also in `loglines.json` line 131.
    - s2e03 b7 says the truck "निकल जाएगा" and gives no reason a real SI cannot stop it. The reason (her own SHO's signature on the slip) is first shown in s2a01 b6, after the vote.
    - s2e03 b6: the DSP names no consequence for her. She calls the tip "निराला की", though she heard Bhaiyaji herself on speaker in b2. In s2b01 b1 she argues she is inside the order ("Order दस बजे का है"), and s2b03 b2 and b8 then charge her with breaking it.
    - `glimpses.A.shows` is s2a01 b4, b7, b9 and b11, ending on the episode's own last line. It shows A's loss as done. Glimpse B shows none of B's.
    - s2b01 b8: a wired man says "Madam..." with the man he is recording in the room.
    - s2b02 b12: Tripathi, who arrived in b9, asks whose phone was in the pocket. Nobody has told him there was one.
    - The two branches give different facts for the same night. A: slip signed by Tripathi, loaded truck at the crossing at 12:10 (s2a01 b6, b7). B: slip unstamped, 640 of 800 sacks loaded, memo at 12:50, Tripathi at 1:00 (s2b02 b6, b7, b9), with the line dead since about 12:10 and the godown in sight of the stall.
    - "नौ साल" in s2e03 b8 and s2b01 b4. The thana and the holster are two years old; nine is the count of failed attempts.
    - s2a02 has three faces (b3, b6, b9) and Nirala wins all three.
    - Mine, not the critic's: s2b03 b6 quotes "Slip पर मोहर चाहिए, हमेशा की तरह" as part of the recording. Bhaiyaji said it on Nirala's phone at 10:30 (s2e03 b2). The recording starts in s2b01 b5.
    - Mine: a hand count of the s2b03 key lines gives about 1,125 characters, level with the four episodes the critic put at about 1,130. The critic did not list s2b03.
  - **Web checks today (search summaries, not the pages):**
    - Brijesh Singh is reported as a jailed don who won the Varanasi legislative council seat in 2016 ([Lokmat Times](https://www.lokmattimes.com/politics/battle-for-up-mafia-don-brijesh-singh-to-contest-mlc-poll/amp), [ThePrint](https://theprint.in/politics/with-wifes-mlc-win-on-modi-turf-up-bahubali-shows-hes-still-powerful-under-anti-mafia-yogi/916330)). The critic's P1 stands.
    - The critic's replacement, बलदेव सिंह, is the name of a sitting Uttar Pradesh minister of state ([Baldev Singh Aulakh](https://en.wikipedia.org/wiki/Baldev_Singh_Aulakh)).
    - Balram Thakur: two searches found no politician, strongman or other public figure of that name.
    - Imlipur: a village of that name is listed in Sagri tehsil, Azamgarh district, with about 1,175 people ([census listing](https://www.onefivenine.com/india/census/village/Azamgarh/Sagri/Imlipur)). `content_notes` says the name is invented.
    - Roopam Talkies and Dayashankar Tripathi: one search each, nothing found.
  - **Length:** the critic projects from 9.5 characters a second. I found no measured speech rate in the repository; the proof voice files hold targets only. At 9.5, the s2e02 key lines alone (about 1,200 characters) run about 140 s. At 11 they run about 125 s. Connective lines come on top, so s2e02 is over either way and the other flagged episodes are over or borderline.
  - **Plan:** section 2 says each glimpse ends on its own new cliffhanger, and makes watching both branches back to back part of day 1. Section 3 says the choice must cost the lead either way. Section 1 says about two minutes an episode.
  - **D-004:** locked the question wording and both glimpse seeds, set the 65 to 35 test for the choice, and named s2a02 as the episode to test hardest because the lead should drive both climaxes.
  - **D-005:** the same gate for Series 1. It set the length ceiling, the last-round rule and the ruling on one-word turns that I reuse here.
  - **App manifest:** `app/public/media/series2/series.json` carries the question with "इसे".
- **Decision:** **(b). The story is approved. The bible file goes back once.**
  - Approved and closed: title, town, the six principals, the seven plates, the hook, the three shared episodes and their cliffhanger types, both labels, both branches, both endings and final images, and the running threads. There is no re-plot.
  - D-004's no-narrator condition is met and the logline is not reopened.
  - Not (a): changes 1 to 6 each alter a fact that two or more episodes, a glimpse or the app manifest depend on. Nine writers applying them from a note, while the file S4, S6 and S14 read says the opposite, is how the scripts would drift.
  - Not (c): nothing below touches the premise.
  - I accept all ten of the critic's must-fixes, two of them in a different form (changes 1 and 8), and most of its medium items as small changes. What I reject is listed after the changes.
- **Required changes, part 1 (the critic re-reads these beats).** Wording in quotes is the default. An equivalent is fine if it does the same job.
  1. **Antagonist's name (P1).** बृजेश 'भैयाजी' सिंह becomes **बलराम 'भैयाजी' ठाकुर** (Balram 'Bhaiyaji' Thakur) in the character entry, s2a03 b4, s2b02 b6 and s2b03 b8, and in `content/series2/loglines.json` line 131 so no Studio artefact shows the old name.
  2. **A's cost is closed in speech before the vote (P2).**
     - s2e03 b7 line 1 says two things: Tripathi will stamp the slip if Nirala does not, and she cannot stop a truck that carries her own SHO's stamp. Default: "अभी arrest करूँ, तो ये मेरे lockup में हैं। ज़िंदा। पर मोहर SHO साहब लगा देंगे, और मोहर लगा truck मैं रोक नहीं सकती।"
     - Pay for it by cutting the carbon-copy sentence and the eleven copies from s2e03 b3.
     - s2a01 b6 gains two spoken lines: "रोकिए। काग़ज़ दिखाइए।" and, after she reads the signature, "काग़ज़ पूरे हैं।"
     - Optional, if the length budget allows: Nirala in s2e03 b5, "ना गया, तो वो यहाँ आएँगे, madam।" It says why doing neither is not a third option.
  3. **B's cost to her is spoken before the vote and not taken back (P3).**
     - s2e03 b6: she reports the tip truthfully and the DSP names the price. Default: dsp "Information किसकी है?" nandini "भैयाजी की अपनी आवाज़, DSP साहब। निराला के phone पर।" dsp "नक़ली थाने के phone पर सुनी बात पर raid नहीं होती, SI Joshi। उसे अभी lockup में डालिए। जो अफ़सर उसकी मदद करेगा, उसी FIR में उसका नाम होगा।" This is `balance_dials.dial_3`; mark it used.
     - Pay for it by trimming s2e03 b2 line 2. Default: "त्रिपाठी जी दस हज़ार लेते हैं। आप दो में ख़ुश। अकेले आइएगा।"
     - s2b01 b1: she no longer argues that she is inside the order. Default: "Order मैंने सुना है, पुष्पा जी। नाम मेरा ही लिखा जाएगा।"
     - s2b02 b10 answers the DSP's new refusal. Default: "अब बात नक़ली थाने के phone की नहीं है। Seizure memo मेरे हाथ का है..."
     - Update `choice.B.cost`, `choice.balance_rules` and the `reveal` fields of s2e03 b6 and b7.
  4. **Glimpse A is recut (P4; this amends D-004 direction 1).** It now comes from the first half of s2a01: (1) b1, the cuffs closing, "बस... cap रहने दीजिए।"; (2) b4, the lockup door closing on a man in full uniform; (3) b5, "बारह। भैयाजी इंतज़ार कर रहे होंगे।"; (4) b6, she steps into the truck's headlights with her hand up, "रोकिए। काग़ज़ दिखाइए।" It ends on that line. Add to `must_not_reveal`: whether the truck passes, who signed the slip, "मैंने जाने दिया", "FIR लिखिए" and the shut door. Remove the Glimpse A tags from s2a01 b7, b9 and b11.
  5. **Glimpse B's last line, s2b01 b8 (P5).** Nirala stays in cover: full voice, to Bhaiyaji, a second after the shutter sound dies. Default: "Shutter क्यों गिरा दिया गया, भैयाजी?" Glimpse B ends on it.
  6. **One night, one set of facts (P7, P17, P6).** Fixed before the choice, and unknown to Nandini and the viewer until after it: Tripathi signed and stamped the slip that evening, and the truck is fully loaded by midnight.
     - s2a01 b6 and b7 stay as written.
     - s2a01 b8: the inference comes from the slip, not from a phone that did not ring. Default: nirala "मोहर पहले से SHO साहब की थी, madam? तो मेरी मोहर की ज़रूरत ही नहीं थी।" nandini "मतलब बुलावा मोहर के लिए नहीं था। आपके लिए था।"
     - s2b01 b9: Nirala reads the same fact aloud, and that is what sets off the laugh in b10. It replaces "silence, a beat too long". Default: "Slip पर तो SHO साहब के sign पहले से हैं, भैयाजी..."
     - s2b02: the memo time is about 12:20, item three is the slip with Tripathi's signature, the truck is fully loaded, and Tripathi arrives at about 12:30. Nirala's split count may stay only if it adds up to a loaded truck.
     - s2b02 b11 and b12: Tripathi learns of the phone on screen. Default: bhaiyaji "इनकी जेब से madam का phone निकला है, त्रिपाठी जी। कुछ कीजिए।" tripathi "तो इसे अंदर madam ने भेजा। Court में मैं यही बोलूँगा: madam को सब पता था।"
     - Update `timeline.B`, the `movement_slip` prop, the godown description ("half loaded"), `bhaiyaji.secret` and the `tripathi_call` thread.
  7. **s2a02: the lead wins one door herself (P9).** b10 (the feet image) becomes a door that will not open for Nirala either. It is a hand and a voice, so there is no fourth face. Default: voice "जो ख़ुद हथकड़ी में है, वो हमें क्या बचाएगा, निराला जी?" nandini "हथकड़ी मेरी है। और कल रात आपका अनाज मेरे सामने से गया। FIR लिखवाइए, ताकि दोबारा ना जाए।" "साढ़े नौ। सत्ताईस।" moves to the head of b11. Add the voice to `voices_only`. No beat is added.
  8. **Length (P10, P11).** The ceiling is the one D-005 set: each outline writable at about 120 seconds and no more than about 135.
     - Working measure until a speech rate is measured: key lines at or under about 950 characters an episode, so a finished script stays near 1,050. s2e03 may run to about 1,050 in key lines, because nearly every line in it is one.
     - Over this by the critic's estimate or my count: s2e02 (about 1,200), s2e03, s2a03, s2b02 and s2b03 (about 1,130 each) and s2e01 (about 990).
     - s2e02 defaults: (a) b2 becomes an exchange without the Bhaiyaji clause: nandini "आपको पता था।" pushpa "भेजती मैं ही थी, madam। SHO साहब जिसे लौटाते, उसे line के पार।" nandini "और SHO साहब?" pushpa "दो साल से जानते हैं। बोलते, तो shield जाता। इसलिए ना department को बताया, ना भैयाजी को।" b6 to b8 then show the payment before anyone describes it, and "आपने रिश्वत ली।" lands. Update `setup_without_narrator.why_bhaiyaji_trusts_it`. (b) Drop the section-number correction in b5. (c) Merge b8 and b9 in the lobby and keep b10 there. (d) Trim b6 line 2: "हमारी चौकी, हमारे Inspector साहब। त्रिपाठी जी से सस्ते भी, मीठे भी।"
     - The other episodes: the showrunner chooses the cuts. Protected: every change in this entry, s2e03 b4 to b10, every spoken ending, and the say-it-aloud plant in s2e02 b4.
     - There is no cap on beat count.
- **Required changes, part 2 (small; checked for presence only).**
  9. **"नौ साल" becomes "दो साल" (P8)** in s2e03 b8 and s2b01 b4.
  10. **s2e01 b12 ends on a forward question (P12).** It is the question `cliffhanger_ladder` already lists for this episode. Default: "तीस की तीस... मेरे ही थाने से लौटाई हुई हैं।" as a statement, her hand stops on the cuff pouch, then "तो कल दस बजे से पहले... arrest किसे करूँ?" The refusal date and the SHO's name are still read aloud first, as D-004 direction 4 requires.
  11. **s2b03 b6 says why the truth decides the case (P13), and quotes only what is on the recording.** That means lines from s2b01 b7 onwards, not the 10:30 invitation. Default: "इसलिए वो recording मेरी है। बहुरूपिये की जेब का phone सबूत नहीं होता। SI का भेजा हुआ phone होता है। 'नक़ली Inspector, आप ही का इंतज़ार था': भैयाजी की आवाज़।"
  12. **s2a01 b9: branch A's clock gets a mechanism (P14).** Default middle line: "कल दस बजे इस थाने में microphone होंगे, madam। उनके सामने रखा register कोई दबा नहीं सकता। उसके बाद... SHO साहब की almirah।"
  13. **Where the recording lives (P15).** On Pushpa's phone, at the listening end, so cutting the call cannot touch it. Pushpa says so in s2b01 b5 or b7: "Recording चालू है, madam।" Correct the `nandini_phone` and `pushpa_phone` props, the s2b01 b5 action and the s2b02 b8 `reveal`. The keypad phone on the evidence table in s2b03 then follows.
  14. **s2b01 b10 (from P16).** After the laugh, one unfiltered line from the lead states the reversal. Default: nandini "इन्हें पता था।"
  15. **s2a03 b10 and b11: the van leaves the same morning (P18),** straight after the press conference. His line becomes "जुर्म क़बूल करूँगा, madam। वर्दी नक़ली थी।" That explains why he is still in the uniform and cap, and removes a time jump and a sentence nobody checked. The bench fills with last night's complainants. Update `timeline.A`, `endings.A` and the ladder.
  16. **s2b03 b11: the last exchange carries the bill (P19).** Default: nirala "ये help desk है, थाना नहीं, madam। मेरी तारीख़ अगले महीने है। आपकी?" nandini "उसी दिन। बुलाइए।" nirala "अगला! Token एक।" Both final images stay.
  17. **s2a03: the press is heard once (P20).** One off-screen reporter after FIR number one. Default: "DSP साहब, chief guest ही आरोपी हैं?" Add the voice to `voices_only`. Hands holding recorders at the edge of frame are S7's call. There is still no audience in frame.
  18. **One number (from P23).** "चौदह महीने" becomes "दो साल" throughout (s2e01 b6, s2a01 b4 and b10, the premise, the bios, the props). The shield, the fake thana and the twenty-four envelopes then share one figure, and "लगातार दूसरे साल" is true.
  19. **Question wording (P24; this amends D-004 direction 1).** "इन्हें हथकड़ी लगाऊँ, या आज रात Inspector बनने दूँ?" She says "ये... हैं" of him two beats earlier and "निराला जी" and "आप" everywhere else. Change s2e03 b10, `choice.question.hi` and the branch map. The English is unchanged. In s2a01 b1 the arrest line becomes "आप under arrest हैं।"
  20. **Metadata sweep (P22).**
      - Nirala gets a period 1b in `look`: from s2b01 b2 to the end of s2b02 he has no medal, folded-back cuffs, a tucked belt tail and squared shoulder seams. S6 decides whether that needs a drawing.
      - Bhaiyaji's "never over his eyes" names its two exceptions (s2a03 b4, s2b03 b2).
      - `key_props`: add the thana desk phone (s2e01 b8, s2e02 b12); `thick_file` adds s2a02; `sealed_envelopes` drops s2a03 unless a beat brings them across the line.
      - s2e02 b6: her red helmet goes into the booth with her.
  21. **`content_notes`.** Replace "Imlipur and Roopam Talkies are invented" with what is known: the town in the story is not a real place; a village called Imlipur exists in Azamgarh district; the other names were checked by one search each.
  22. **Writer notes** (a new `writer_notes` key if none exists):
      - One-word turns and lines that open on an ellipsis get a carrier word or extra takes, decided line by line by the writer and the voice director.
      - s2e03 b4 may take one clause on why Pushpa comes so late, if there is room (P21).
      - s2b01 b9 may play over two or three insert stills from inside the godown, with no faces, if S7 finds fifty seconds of two listeners too static.
      - A phone-filtered line never sits directly on a loud effect.
  23. **`content/series2/branch-map.md`** is regenerated from the revised bible, and `not_verified` is brought up to date.
- **Rejected, or not a bible matter:**
  - **A cap of ten beats an episode (the critic's F10).** Beats do not cost time; dialogue does. s2a02's short image beats are what D-004 direction 7 relies on. The budget in change 8 is on characters.
  - **बलदेव सिंह as the new name.** See the web checks.
  - **One-word turns and leading ellipses as a rule (P24).** Nothing measured supports it, and D-005 ruled the same way. It survives as the first writer note in change 22.
  - **P21 as a bible change.** It adds a line to the tightest episode to answer a question few viewers will ask.
  - **P23, a line about labourers sent home.** "आप अकेली हैं" already has weight: s2e03 b8 says Bhaiyaji is armed. Optional for the writer.
  - **P16, interior stills as a requirement.** Staging belongs to S4 and S7. The audio risk is covered by change 14.
  - **Renaming the town.** A village of about 170 houses sharing the name is not what the no-real-people rule is for, and this is an internal demo. The note is corrected instead (change 21).
  - **`dial_1` and `dial_2`.** The critic reads the split at D-004's threshold, not past it, and changes 2 to 5 already move it. `dial_2` adds a lecture.
  - **P19 beyond changes 15 and 16.** Neither ending is re-plotted. A keeps a working thana and the town's trust; B loses the thana its officer.
- **Next steps:**
  - S1 applies changes 1 to 23 in `bible.json`, `branch-map.md` and the one name in `loglines.json`.
  - The first agent with a shell runs `bible.json` through a JSON parser and counts key-line characters for each episode against change 8.
  - S3 re-reads the beats changed by 1 to 8 and confirms 9 to 23 are present. **This is the last bible round.** Local findings on the second read go to the writers as notes and the bible is approved. Only a fatal finding comes back here.
  - The product track then syncs the question text in `app/public/media/series2/series.json` from the bible.
  - An agent that can write saves the critic's round 1 review to `content/series2/review-notes.json`. I did not: the orchestrator holds the exact text, and I would be retyping it.
- **Not verified:**
  - No one has parsed `bible.json`. My pattern searches found no backslash, no comma before a closing bracket and no quote mark away from a delimiter. That is not a parse.
  - Lengths: the critic's figures are by eye. Mine is a hand count of s2b03 only. The speech rate is unmeasured, so the 950-character measure is provisional.
  - The vote split is a judgement (the critic's 35 to 65), and the effect of changes 2 to 5 on it is unknown.
  - The name checks are one or two searches each, read as summaries. They are not a legal clearance.
  - The defaults in changes 2 to 7 are untested until the critic reads them in place.
  - I viewed no frame. Of the proof scenes I read the flat 2D review notes (first 120 lines, with six long lines not shown by the tool) and nothing from the photoreal one for this gate.
  - Gate 0: this file has no Gate 0 entry and `docs/morning-report.md` lists it as running. I checked nothing beyond those two files.
- **Would change it:**
  - If on the second read the critic still puts the choice past 65 to 35 after changes 2 to 5: raise what B risks on screen inside s2e03, as D-004 says. The logline is not reopened.
  - If the first measured voice takes run at 11 characters a second or faster, the showrunner may restore lines cut for change 8.
  - If a public figure called Balram Thakur turns up before voice is recorded, the name changes again.
  - If the series is ever shown outside the team, every principal's name, the town and the cinema need a proper clearance first.
  - All nine episodes are touched by part 1, so no script starts from the present bible.
  - After scripts start, the bible changes only through an entry in this log.

## D-008 Gate 0: verdict and quality bar per style (A0 Arbiter, 26 Nov ~03:35 IST)

Numbering: the Gate 0 brief asked for entries from D-003, but D-003 to D-006 were already used by Gates 1a and 1b. D-007 was taken by the Series 1 bible round 2 entry, which was written at the same moment and sits below these in the file. Gate 0 is D-008 to D-015.

- **Question:** do the two proof scenes meet the quality bar, and is the production method proven for the full run?
- **Options:**
  - (a) Pass, and start full production on the method as run.
  - (b) Fail, and send both scenes round the same workflow again.
  - (c) Split the gate: rule on the picture half now, and hold the audio half for a short second proof (Gate 0b) run from a session that can reach ElevenLabs.
- **Evidence:**
  - **Finished cuts.** Screening failed both scenes twice, 3/10 each time. All six renders are digital silence (-70 LUFS, which is the meter's floor; every sample is 0). None of the 50 planned voice takes (23 photoreal, 27 flat 2D) and none of the 23 sound cues (14 and 9) was generated. Both `cast.json` files are still `uncast_placeholder` and neither scene has a `voice/manifest.jsonl`.
  - **Cause.** Every workflow session that needed the ElevenLabs connector (casting, voice, sound, voice review, screening) started without `ToolSearch` and without the `creative_*` tools. The agent files do list them (`.claude/agents/voice-runner.md`, `voice-director.md`, `sound-designer.md`, `screening-reviewer.md`, and D-002), so the tools are dropped when the workflow starts a session. My own session shows the same thing: the connector's instructions are in my context, and my tools are Read, Write, Edit, Grep, Glob, WebSearch and WebFetch. This is a harness fault. It is not evidence about voice quality in either direction.
  - **Untested as a result:** Hindi performance on v4 against v3, code-mixed pronunciation, subtitle timing against real speech, and the mix (ducking, loudness, the phone filter). These are four of the things Gate 0 existed to settle.
  - **Photoreal picture.**
    - Frame check: 8 of 9 frames passed first time; s01 was remade once for a wrong eyeline and passed. Lead consistency 8/10. No hand faults, no text, lock knobs correct in the seven frames that show them, faces clear of the subtitle band.
    - Screening: Tara reads about ten years older in s01, s05 and s09 than in s03 and s06. The duffel bag is missing from her lap in s06 and s09. The phone is keypad-outward at the ear in s05, keypad to camera in s06 and screen to camera in s09. The taped seat tear changes sides.
    - My own look (the Tara sheet, s05, s06, s09): she is clearly the same woman in all three and the grade, rain and neon hold. I agree with each screening point I could check: s05 looks older and heavier than s06, there is no bag in s06 or s09, the keypad faces out in s05, the screen faces camera in s09, and the tear is picture-left of her in s06 and picture-right in s09.
  - **Flat 2D picture.**
    - Frame check: 6 of 9 passed first time; s01, s02 and s09 were remade and passed. Lead consistency 8/10. Her markers hold (mole, loose strand, bun, two-bar epaulettes, lantern patch, watch). It also logged a drifting drawing idiom, Bablu too tall beside Meenu in s05 and s07, the torch in his other hand in s07, and soft-edged beams where the style block asks for hard edges.
    - Screening: the laddoo placed on the middle shelf in s03 is missing from the open locker in s05 and s07. The fist holding the key in s09 wears the watch, so the key has changed hands since s07.
    - My own look (the Meenu sheet, s05, s07, s09): the same character by her markers, and it reads as one show. The idiom drift is real: s05 is a broad cartoon, s09 is sleeker with gradient rim light. The shelves are bare in s05 and s07, and the watch is on the key fist in s09.
  - **Prop sheets were made and then not used.** The `refs` lists in both `frames/manifest.jsonl` files show that no photoreal story frame attached `duffel_bag`, `keypad_phone` or `bag_contents`, and no flat 2D story frame attached `brass_key`, `brass_padlock`, `laddoo_plate`, `phone_incoming_call`, `chai_glass` or `yellow_torch`. The props that drifted are these props.
  - **Left and right.** The wrong side or hand turned up five times: the s01 eyeline (photoreal, first attempt), the hair parting in s01's prompt text ("parted on her right" against a sheet parted on her left), the key hand (flat s09), the torch hand (flat s07) and the seat tear (photoreal s06 and s09).
  - **Assembly.** Rendering works: H.264, 1080x1920, 30 fps, a Hindi and an English cut and a Hindi review cut per scene. Devanagari shapes correctly. Subtitle text matches both scripts with no mismatches or overlaps. On the flat 2D review cut the burned cues sit within one frame of their cue times, and the caller-name overlay stays in register through the s08 shake in both languages.
  - **Reopen conditions set earlier.** D-003 named the lead's face or the chooda drifting despite a sheet. D-004 named overlay text failing under a camera move, or new sheets drifting. Neither happened: both leads held at 8/10, the small fixed markers that were on a sheet held (nose stud, chain, mole, watch), and the one overlay tested held.
- **Decision:** **(c). Gate 0 is not passed as a whole.**
  - **Picture, both styles:** the look and the lead's identity meet the bar. Prop and state continuity does not. The frame method is approved for the full run with the changes in D-013. D-003 and D-004 are not reopened.
  - **Finished scene, both styles:** not judged. A silent cut cannot meet or fail a bar for performance, sync or mix.
  - **Not (a):** half the method has never run.
  - **Not (b):** two rounds through the same sessions gave the same result, and a third would too.
  - **Gate 0b.** Run from a session that reaches the connector (D-009), on the two existing proof scenes: cast both; generate the 50 takes in the two `voice/takes.json` files, including the six v3 comparison takes, and the 23 sound cues; transcribe and measure every take; rebuild timelines and subtitles from measured lengths; master to -14 LUFS; render; one screening per scene. Estimated cost is about 8,000 credits (D-011). Its results are logged here as a new entry and settle D-009 and D-011.
  - **May start now:** scripts (D-002b's hold ends, because Gate 0 changed no script convention and the length budgets in D-005 and D-006 stand as provisional), Phase 3 sheets and plates under D-013, storyboards, and frames under D-010 once the five-frame test in D-013 has run.
  - **Waits for Gate 0b:** bulk voice and sound for episodes. If Gate 0b cannot run tonight, episodes are assembled with silent lines and subtitles, tagged as placeholders (plan 7.8), and voice is added later by rerunning that one step.
  - **Orchestrator, now:** `docs/morning-report.md` was last updated at about 01:30 and still says "Placeholders: none yet" and "Codex frames made: 0". Plan 7.8 step 6 requires the 44 silent voice clips, the 23 silent sound cues, their cause and both failed screenings to be logged there, with the connector question under "Needs your decision". I did not edit that file; my brief covers this log only.
- **Not verified:**
  - I did not play or probe any render and extracted no frames, because my session has no shell. Loudness, durations, checksums and timings are the editors' and screeners' measurements.
  - I viewed eight images: two sheets and six story frames, shown at 1125x2000. Everything else about the frames comes from the frame-check and screening reports.
  - I did not read the proof scripts, `shots.json`, `style.json` or `continuity.json` for this gate.
  - Whether the orchestrating session can reach the connector now. D-001 says a subagent could at 00:55.
- **Would change it:**
  - If the Gate 0b cuts screen below 7/10 on sync, levels or grip with real audio, the fixes go into D-009 and D-014 before any bulk voice.
  - If the connector cannot be reached from any session tonight, production continues picture-first with silent placeholders and the route stays paused (D-009).
  - If the five-frame test in D-013 does not bring back the bag, phone, laddoo and key, the fallback in D-013 applies.

## D-009 Gate 0: voice and sound route, and v4 against v3 (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** how do voice, sound and transcription get made when workflow sessions cannot reach ElevenLabs, and is the series voiced on `eleven_v4` or `eleven_v3`?
- **Options:**
  - Route: (a) keep sending the work to workflow sessions; (b) run it from the orchestrating session, or from Agent-tool subagents of the kind that made the D-001 probes; (c) an API key in `.env` and a script, which is plan 7.7's fallback.
  - Model: v4 throughout; v3 throughout; a choice per character.
- **Evidence:**
  - Route: see D-008. D-001 records that a subagent generated and downloaded speech through the connector at 00:55, and `production/proof/probe/v4_probe.mp3` and `v3_probe.mp3` exist. Plan 7.8 says a fault that hits many items pauses the route for all lanes, and that entering keys needs the owner.
  - Model: Gate 0 produced no take on either model. The only data is D-001: the same ~28-character line cost 35 credits on each. Nobody recorded how either probe sounds. Plan 7.1 makes v4 the default and says "pick by ear".
  - No agent in this build can listen. What an agent can measure on a take is a transcript, its length, its loudness and its silences.
- **Decision:**
  - **Route: (b).** Voice, sound and transcription steps do not go to workflow sessions again until one such session has shown it can call the connector. The first action of any voice or sound session is one call to `creative_list_voices`. If that fails the session stops and reports. It writes no per-line placeholders and nothing is sent for review.
  - **(c) goes under "Needs your decision" in the morning report now,** so a key can be supplied if (b) fails. No agent enters a key.
  - **Model: `eleven_v4` is the working default, and it is unproven.** It is the plan's default and costs the same.
  - **The test.** Gate 0b runs the six comparison pairs already written into the takes files (photoreal Hindi l01, l08, l10; flat 2D Hindi l07, l08, l12). v3 replaces v4 only if it wins at least four of the six on measurable checks:
    1. The transcript matches the script's words, counting the English words inside Hindi lines.
    2. No tag is spoken aloud.
    3. The length is within 20 per cent of the line's target.
    4. A whispered or quiet tag gives a measurably lower level than the same voice's plain lines, and transcription still gets the words.
  - A tie stays with v4. One character may go to v3 alone if that voice obeys tags only there.
  - **Ear check.** These checks cannot tell a moving performance from a flat one. The six pairs go into the morning report with file paths for the owner to hear, and the owner's pick overrides the agents'.
- **Not verified:** everything about how either model sounds in Hindi or Indian English. Whether `creative_transcribe_audio` copes with Hindi lines that contain English words: no session has run it.
- **Would change it:**
  - If transcription fails on mixed lines, checks 1 and 2 cannot run. The pick then rests on length and level, and the owner's ear decides.
  - If v4 speaks tags aloud or ignores them for a cast voice, try simpler tags, then v3 for that character, then the backup voice (plan 7.8).
  - If no session can reach the connector, the route stays paused until the owner answers the key question.

## D-010 Gate 0: time per frame and Codex lanes (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** how long does a frame take, how many Codex calls run at once, and how long will the full run take?
- **Options:** one lane; two (the only level with evidence); three or more, stepped up under a rule.
- **Evidence (the four manifests, 56 logged Codex generations, no quota or rate-limit message in any row):**
  - **Story frames.** Photoreal: 9 frames, 56.7 to 117.6 s, mean 76.3 s. The lane summary says 75.2; the manifest adds up to 76.3. Flat 2D: 9 frames, 77.9 to 181.1 s, mean 104.4 s. All 18 together: 90 s. Four retakes ran 76.9, 118.6, 119.3 and 121.4 s.
  - **Sheets and plates.** 26 generations, 35 to 95 s, mean 55 s.
  - **References cost time.** Calls with one reference ran 57 to 88 s. Calls with three ran 105 to 120 s, and one took 181 s.
  - **D-001's 41 s was one sample.** It is superseded, and so is the six-hour estimate in D-002b.
  - **The two lanes mostly did not overlap.** Photoreal frames ran 01:45 to 01:57 and flat 2D frames 02:10 to 02:25. The lanes overlapped three times, each for a retake or two: about 01:41 to 01:43, 01:53 to 01:55 and 02:04 to 02:05. In the first two, no call was slower than its neighbours. In the third, the photoreal s01 retake took 77 s against 64 s first time and Bablu's sheet took 90 s against about 60 s, but both prompts had changed and the sheet had gained a reference, so it settles nothing. The time of that third overlap is inferred from the session ids, because the sheet row's timestamp is a dummy.
  - **Two calls at once did happen, by accident.** `content/proof/flat2d/frames/manifest.jsonl` holds two interleaved runs of the same batch, started 7 seconds apart. Both wrote to the same `<shot>.codex.log`. For about 14.5 minutes two Codex calls ran side by side: 17 generations, mean 101 s each, no errors. The same lane alone afterwards took 119 to 121 s a call, so two at once showed no slowdown.
  - **What the duplicate cost.** Eight generations were wasted. Six rows are marked `refused` although their own error text is a success message ("Created one vertical 9:16 image..."), so there were no real refusals. On the eight shots both runs made, the first run's rows carry the second run's session id, because the second run overwrote the log header. I checked that against the session ids, which embed a millisecond clock: on s01, s02 and s03 their spacing matches the second run's start times to within 0.1 s. Which run's image ended up in each `.png` is not recorded.
  - **Three or more at once is untested.** The plan allowance is opaque (plan 7.2). The flat 2D logs show 14,000 to 34,000 tokens a generation.
- **Decision:**
  - **Planning time: 120 s per story frame and 55 s per sheet.** The measured mean is 90 s, but D-013 adds references to every call.
  - **Lanes: a ceiling of 3 Codex calls at once across all episodes and both series,** held by one shared counter, not one lane per episode. Start at 2. Step to 3 after 20 clean generations in a row. Stay at 3 only if more frames finish per 10 minutes than at 2. There is no fourth lane on this run.
  - **Step down:** a quota or allowance message stops every lane (already in the frame skill). A timeout or rate-limit message drops one lane for 10 minutes.
  - **One runner per scene folder.** The runner takes a lock file in `frames/` and a second runner exits. Each attempt writes its own log (`<shot>.a<attempt>.codex.log`). The session id is read from that process's own output and the image is copied only from that session's folder.
  - **Status rules.** `refused` needs both no image in the runner's own session folder and refusal wording in Codex's final message. Anything else without an image is `failed`. Every manifest row carries real start and end times; two flat 2D sheet rows carry a dummy `00:00:00Z`.
  - **Frame budget: 28 generated frames per two-minute episode.** The proof scenes used 9 frames for about 33 seconds, which is about 33 for two minutes. Extra shots come from a second framing of an approved frame, at a camera scale of 1.3 or less, because screening found the 1.55x punch-in soft.
  - **Projection.** 17 x 28 = 476 episode frames, plus 12 new frames for glimpses, is 488. With 40 per cent retakes that is 683 generations. About 45 sheets and plates with 30 per cent retakes is 59. Total about 740 generations and about 23.7 lane-hours: roughly 7.9 hours on three lanes or 11.8 hours on two.
- **Not verified:** three calls at once. The size of the Codex allowance, or whether about 740 generations fit inside it. The time for calls with four or five references. The 40 per cent retake rate is a guess between two measures: 4 of 18 frames were rejected at the first frame check, and screening asked for five more.
- **Would change it:**
  - If three lanes finish no more frames than two, stay at two and expect about 12 hours.
  - If the allowance runs out, plan 7.8's frame ladder applies and the question goes under "Needs your decision".
  - If frames with four or five references average over 150 s, cut the budget to 24 frames an episode before cutting references.

## D-011 Gate 0: credits per finished minute and the 730,916 budget (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** what does a finished minute cost in voice, music and effects, and does the balance cover the full run with retakes?
- **Options:** decide from measurement (not possible, nothing was generated); estimate now and set a ceiling that the first real measurements are checked against.
- **Evidence:**
  - **Measured in Gate 0: nothing.** No credits were spent. The 70 credits used so far went on the D-001 probes.
  - **Speech rate, measured twice only.** 35 credits for a ~28-character line on v4 and on v3 (D-001), and 84 credits for a 5.4-second tagged line (plan 7.7). That is about 1.25 credits a character.
  - **Characters per minute, counted by hand** from `content/proof/photoreal/voice/takes.json`: the ten Hindi takes hold about 510 characters for a 33-second scene, of which about 225 are tags. That is about 920 characters per finished minute, or about 1,150 credits per take. The spoken part alone (about 510 a minute) agrees with D-006's budget of about 1,050 characters for a two-minute script. Whether tag text is billed is not known.
  - **Effects and ambience asked for:** 59 seconds of generated sound for the 33-second photoreal scene and 36 seconds for the flat 2D one, from the two `sound/manifest.jsonl` files. That is about 86 seconds per episode minute.
  - **Rates for music and effects are not established.** Search summaries today, not the pages: ElevenLabs' help page on effects gave 40 credits a second in the web app and 11 a second through the API with a set length, and now points to the live pricing page; third-party pages say about 200 credits a generation; third-party pages put music at about 900 credits a minute, and ElevenLabs' own article gives no figure ([effects help page](https://elevenlabs.io/docs/help-center/product/content-production/sound-effects/how-much-does-it-cost-to-generate-sound-effects), [API pricing](https://elevenlabs.io/pricing/api), [music help page](https://help.elevenlabs.io/hc/en-us/articles/37821528996497-How-much-does-Eleven-Music-cost)). I used the highest figure for each.
  - **Size of the run.** 17 episodes of about two minutes in two languages, plus four glimpses, is about 75 finished minutes. Music and effects are made once per episode and shared by both language cuts.
- **Decision: an estimate, to be replaced by Gate 0b's figures.**

| Item | Basis | Credits per finished minute |
|---|---|---|
| Voice | 920 characters x 1.25 x 2 takes on average | 2,300 |
| Music | 900 a minute x 1.5 takes, shared by two cuts | 675 |
| Effects and ambience | 86 s x 40 a second x 1.3 takes, shared by two cuts | 2,240 |
| Casting and tests | about 6,000 over the run | 80 |
| **Total** | | **about 5,300** |

  - **Projected total: about 400,000 credits,** 55 per cent of 730,916. The worst case I can build (three takes a line, music twice, effects 1.5 times at the top rate) is about 530,000. The low case (tags not billed, the API effects rate, reused music) is about 150,000.
  - **So the balance covers the full run with retakes on every case I can build, with at least 200,000 to spare.** That rests on two probe measurements and on unconfirmed rates. Until Gate 0b it is a forecast, not a finding.
  - **Ceiling: 8,800 credits per finished minute.** That is the balance less a 10 per cent reserve, over 75 minutes. If the actual figure after Gate 0b, or after the first finished episode of either series, is above it, bulk generation stops and the question comes back to this log.
  - **Ledger.** Every generation's `credit_costs` goes into its manifest, and the orchestrator keeps the running total in the morning report. The account usage tool does not show connector spend (D-001).
  - **Takes.** One take for every line. Retakes only for lines the review flags. At most three takes a line, or four for lines of one to three words. After that the fallback text in the takes file, then the best take is accepted and logged.
  - **Reuse.** One ambience per location per series. One effects library per series, so a recurring sound (a phone ring, a lock, a door) is made once. One small theme set per series (bed, tension, sting, ending) in place of a new bed for every episode. The estimate above assumes none of this reuse, so it is on the high side.
  - **Gate 0b itself:** about 3,200 credits of voice and about 4,900 of sound at these rates, so about 8,000.
- **Not verified:** the live balance (no session of mine can call the account tool; 730,916 is the plan's figure from earlier today). Every music and effects rate. Whether tags are billed. The take counts. My character count is by hand and may be a few per cent out.
- **Would change it:**
  - Gate 0b's measured rates replace this table.
  - If effects are billed per generation and not per second, the effects line falls sharply and the reuse rule matters less.
  - If the first episode comes in above 8,800 a minute: cut to two takes a line, then enforce reuse, then drop to ambience only (plan 7.8), in that order.

## D-012 Gate 0: render time (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** how long does rendering take, and does it need its own lanes?
- **Options:** render in one lane, in order; render episodes in parallel.
- **Evidence:** four clean renders. Photoreal: 14.8 s (Hindi) and 13.6 s (English) for a 34.3-second file. Flat 2D: 13.8 s and 13.3 s for 33.0 seconds. That is 24 to 26 seconds of rendering per finished minute, mean about 25. The Hindi review cuts with burned-in subtitles took 14.2 s and 16.5 s, which is 25 to 30 seconds a minute. Mastering never ran, because the audio was silent and `master-audio.sh` skipped normalisation.
- **Decision:**
  - **Plan on 25 seconds of render per finished minute.** About 75 finished minutes is about 31 minutes for the clean cuts and about 35 more for review cuts in both languages. Allow about 1.7 hours in total with re-renders after fixes.
  - **One render lane, in order.** Rendering is not the bottleneck; frames are (D-010).
  - **A review cut is rendered in both languages for every episode.** The flat 2D scene had no English review cut, so its English subtitle layout was never seen over picture.
  - **Before any review cut,** the editor sets `whiteSpace: 'pre-line'` on the subtitle text in `production/remotion/src/Episode.tsx` and removes the no-break-space workaround in `make_review.py`, so authored line breaks survive in every burn-in.
- **Not verified:** render time for a two-minute composition (the proofs are 33 seconds, and I assume it scales with length). Mastering time. Two renders at once. I did not time anything myself.
- **Would change it:** if a two-minute episode takes more than about 90 seconds to render, or mastering adds more than a minute an episode, add a second render lane.

## D-013 Gate 0: character and continuity method (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** what changes in how frames are specified, generated and checked, so that people and things stay the same between shots?
- **Options:**
  - (a) Keep the method (sheet and plate on every call) and accept prop drift.
  - (b) Keep it and add what the evidence points to: prop references, a state line, a scene anchor, and a continuity check at the frame gate.
  - (c) Restage everything tight so props are rarely in shot.
- **Evidence:** D-008. In short:
  - Faces held at 8/10 in both styles with a sheet attached on every call.
  - What failed was the state of things: a bag, a phone, a laddoo, a key, a torch and a seat tear. The prop sheets existed and were never attached to a story frame.
  - Left and right went wrong five times.
  - The frame check passed frames that screening later failed on continuity (photoreal s05, s06, s09; flat 2D s07), so those faults were found one step too late.
  - The frame checkers had no way to zoom or crop.
- **Decision: (b), with (c) as the fallback for any prop that still will not hold.**
  1. **References on every call, up to Codex's limit of five:** each character's sheet, the location plate, the sheet of every prop visible in the shot, and the scene anchor (rule 2). If more than five are needed, the plate is dropped first when the anchor already shows the same setting.
  2. **Scene anchor.** The first approved frame of a scene that shows the lead is attached to every later frame of that scene. The storyboard names the anchor shot. Anchors are generated and checked before the rest of the scene. The first frame of a new scene attaches one series-wide style frame instead, chosen at Gate 3. This is also the answer to the flat 2D drawing-idiom drift.
  3. **State line.** Every shot prompt carries a short STATE block copied from the continuity file for that beat: what each hand holds, what is on the lap or table, which props are in view, and lock or door states. Sides are written in picture terms ("the arm on the picture-left side"), never only as "her left". The storyboard locks handedness only where the story needs it. For Series 1 that includes the scarred wrist (D-003, D-005).
  4. **The character lock is written from the approved sheet,** after the sheet gate, and states age, face shape and hair side as the sheet shows them. A prompt may not contradict its sheet.
  5. **Pair sheet.** Two characters who share frames get one line-up sheet showing both at their true relative height. It answers the height drift and uses one reference slot where two sheets would use two.
  6. **Plates carry no one-off marks** (a taped tear, a stain) unless the story needs the mark. A mark the story needs gets a prop sheet and a state line.
  7. **Small hand props.** The storyboard states the orientation ("back of the phone to camera") and prefers framings that hide what cannot be controlled. Inserts carry the detail.
  8. **Sheets** keep every view inside the centre 80 per cent of the frame. A sheet that fails only on its crop is re-cropped from the raw file and not regenerated (the Bablu sheet).
  9. **Flat 2D style block.** Soft-edged light cones are accepted as the look, and the block is reworded to say so. The model drew them in five of the nine frames, and both frame checks logged it as drift without rejecting a frame for it.
  10. **The frame check covers state.** For each shot it works through a checklist taken from the continuity file, and it compares a face crop with the sheet's close-up. The frame checker gets a shell so it can make crops with ffmpeg.
  11. **One retake per frame.** After that the better take is accepted and the drift is logged (plan 7.8).
  12. **Test before bulk.** Regenerate photoreal s05, s06 and s09 and flat 2D s07 and s09 under rules 1 to 4. That is five generations and about ten minutes. Pass means the bag, the phone, the laddoo and the key hand are right in at least four of the five. Log the result here.
- **Not verified:** that any of rules 1 to 5 works. They follow from what failed and none has been run. Whether an anchor frame carries its own flaws into later frames, as a flawed sheet does (plan 7.2). The time for calls with four or five references.
- **Would change it:**
  - If the five-frame test fails, apply (c) for the props that failed: frame them out, carry them in inserts, and tell the writers to cut business that depends on them.
  - If anchors spread a fault (an older face, a wrong prop), the anchor is replaced with the sheet's close-up crop.
  - If faces drift once new sheets are made for the real series, D-003's and D-004's conditions apply as written.

## D-014 Gate 0: subtitle timing method (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** where do cue times and per-word highlight times come from?
- **Options:**
  - (a) Clip length per line, with transcription word timings for the highlight (plan 7.7).
  - (b) Clip length and detected silences for everything, with words spread by length; transcription used as a check on the words, and as a timing source only where it lines up.
  - (c) Even spacing.
- **Evidence:**
  - The subtitle build works on placeholder lengths: text exact against both scripts, no overlaps, at most two lines of 32 graphemes, Hindi at 13.0 characters a second at most and English at 16.9, burned cues within one frame of cue times. Devanagari and mixed-script lines shape correctly.
  - Nothing has been timed against speech, because there is no speech. Transcription has not run once in this build, so its word timings on lines that mix Devanagari and Latin are as unknown as they were in the plan.
  - Screening found two timing faults that do not depend on audio: an English cue that outlasted a picture cut by three frames, and a line break that was lost in burn-in.
  - Proof lines contain deliberate pauses on ellipses (for example photoreal l08), where spreading words evenly across the whole clip would be visibly wrong.
- **Decision: (b).**
  1. One generation per spoken line (unchanged).
  2. Each clip is measured, not estimated: its length with ffprobe and its leading, trailing and internal silences with ffmpeg's silence detection. A cue starts at the first speech and ends at the last.
  3. A line with an internal pause of 300 ms or more is split into segments at the pause, and its text at the matching punctuation.
  4. Inside a segment, word times are spread by grapheme count, as `build_subs.py` does now.
  5. Transcription checks that the take says the script's words. Its word timings replace rule 4 only for a segment where its word count matches the script's. No cue depends on transcription.
  6. Each language's timeline is rebuilt from its own measured clip lengths, and shot lengths follow the voice.
  7. Kept from the proof: cut-off lines are clamped to the cut; English cues above 17 characters a second are held longer; Devanagari is counted in clusters. Added: no cue outlasts a picture cut, and cues are at least two frames apart.
- **Not verified:** rules 2, 3 and 5 on real takes. Whether silence detection finds the pause inside a whispered line.
- **Would change it:**
  - If Gate 0b shows transcription word timings are right on at least five of the six mixed lines it checks, they become the default for the highlight and rule 4 becomes the fallback.
  - If silence detection misplaces pauses, drop rule 3 and keep whole-line cues.
  - If the highlight looks wrong against speech either way, ship cue-level subtitles without a per-word highlight.

## D-015 Gate 0: process changes for Phase 4 (A0 Arbiter, 26 Nov ~03:35 IST)

- **Question:** what changes in how the episode workflow runs, given how Gate 0 went?
- **Options:** run Phase 4 as planned (17 lanes, review loops as in Gate 0); change the points below.
- **Evidence:**
  - A missing tool became 44 silent voice clips, 23 silent sound cues, four screening sessions and two fix rounds before anyone stopped the route. Plan 7.8 says to pause a route when the same fault hits many items.
  - Screening's frame findings from round 1 were never sent to the frame runner. No frame file changed between rounds, and round 2 re-screened the same pictures.
  - Two runners worked the same folder at once (D-010).
  - The morning report was not updated for two hours (D-008).
  - Several review sessions lacked a tool their role needs: a shell for the voice review, a crop tool for the frame checks.
- **Decision:**
  1. **Tool check first.** Each workflow session's first step is to compare its tool list with what its role needs. If something is missing it stops and reports in one line. It does not produce placeholders.
  2. **One trial call per route before lanes start:** `creative_list_voices` for voice and sound, one Codex frame, a one-second render. A failed trial pauses that route for every lane and writes one morning-report entry.
  3. **Screening needs something to screen.** It runs only if the episode's voice and sound manifests hold no placeholder rows, the render measures above -30 LUFS, and the Hindi and English files differ. Otherwise the cut is marked picture-only and not scored.
  4. **Fixes are routed by owner and checked before a second look.** The orchestrator sends each finding to its owner's step. A second look happens only if the files it concerns have changed.
  5. **Fewer rounds.** Frames: one check and one retake check, then accept and log. Episodes: one full screening, then one pass that looks only at what was changed. There is no second full screening.
  6. **Waves, not 17 lanes at once.** Wave 1 is the first episode of each series, which is also Gate 4. The other 15 follow in waves of five. With three Codex slots, more episodes in flight would only queue.
  7. **Order inside an episode.** Storyboard, then scene anchors, then the anchor check, then the remaining frames (D-013). Voice runs one episode and one language at a time from a session that passed its trial call. Each series' ambience and effects library is made before its first episode.
  8. **One runner per folder, own logs, real timestamps** (D-010).
  9. **The morning report is updated at every gate, every paused route and every placeholder,** by the orchestrator, as plan 7.8 requires.
  10. **Reviews keep stating what they did not check.** The Gate 0 reports did, and that is how the missing-tool fault could be traced.
- **Not verified:** that the workflow can grant `ToolSearch` and connector tools to its sessions at all. If it cannot, rules 1 and 2 will stop those steps cleanly, and they still have to run elsewhere (D-009).
- **Would change it:**
  - If wave 1 shows the frame check and the screening disagreeing again, add a second frame check for scenes with three or more props.
  - If waves of five leave Codex slots idle, raise the wave size.
  - If wave 1 passes screening first time in both series, the changed-items pass in rule 5 may be dropped for later waves.

## D-007 Gate 1b, round 2: Series 1 bible approved (A0 Arbiter, 26 Nov ~03:40 IST)

- **Question:** revision 2 of `content/series1/bible.json` has had its second critic read. Approve it for scripts, or send it back again?
- **Options:**
  - (a) Approve. The second-read findings go forward as directions in this entry.
  - (b) Send the bible back for a third round.
  - (c) Reopen the logline. D-003 and D-005 allow this only if the critic no longer accepts the wrist check.
- **Evidence:**
  - **Critic (S3), round 2:** pass, 7.9, no fatal problem. Hook 9, stakes 8.5, choice 8, branch distinctness 8.5, cliffhanger 8.5, Hinglish 7.5, performability 7.5, length 6.5, continuity 7.5. It finds all 22 D-005 changes present and accepts the wrist check, with two medium notes on it (its 7 and 8). It lists 6 must-fix items, 7 medium and 10 minor, and says none needs to come back here. The review reached me as text in the orchestrator's brief. The critic has no write tool, so neither round is on disk as `content/series1/review-notes.json`.
  - **D-005:** round 2 is the last bible round. Local findings go to the writers, and only a fatal finding comes back.
  - **My read:** revision 2 (1,424 lines), each critic item checked against the text. What I rely on:
    - s1b01 b5 is Billu and Mausi on the phone on the landing. No beat tells Kiran or Aditya that Mausi is coming, yet b5a has Kiran count on "the door Mausi told them to leave" and b6 has both of them waiting for her. "Two and a half hours" is in no line.
    - s1b01 b10: "To Kiran, softly: she never told her" is said with Aditya seated in the same room.
    - s1a03 b5 ("मैंने तुझे चौदह की उमर से...") and s1b03 b4 (she took Kiran out of the kitchen at fourteen) make the same appeal. `kept_apart_in_the_two_finales` has three entries and not this one.
    - s1b02 b2: Billu answers "मौसी ने कहा है।" and gives no figure. s1b03 b2 then has Kiran recite "what he was told".
    - s1e01 b11 shows the stack sliding along her arm. In s1e02 b2 he takes it apart bangle by bangle, and nothing says why he does not push it. That staging was my direction (D-005 change 2).
    - s1b01 b6: the long police line with "आई हैं" is my own D-005 default.
    - `writer_notes` says the last line of s1b03 is "identical" to the first of s1e01. The anchors are "पूरी पुड़िया डाल दो। आधी में मुझे नींद नहीं आती।" and "पूरी पुड़िया, छोटी। आधी में नींद नहीं आती।"
    - s1a02 b9 has Mausi say "ढूँढ रहे हो" to a man she addresses with खोलिए, रख दीजिए and देख लीजिए everywhere else.
    - `length_budget` calls 120 and 135 "spoken seconds". D-005 change 9 took them from the plan's "about two minutes", which is the length of an episode. D-005 did not say "running time", so the misreading is partly mine.
    - Mine, not the critic's: its default for Billu's figure is "चौदह". Fourteen is already Kiran's age when Mausi took her and the months of Aditya's hunt, and both are spoken in branch B.
    - `app/public/media/series1/series.json` lines 29 and 39 still hold the old meaning text, one with यह.
    - Counts I reran: 81 beat ids; the only यह/वह hit is the register rule; the boys are in 11 `who` lists.
  - **Plan:** section 2 puts both finales in front of a day-1 viewer back to back. Section 3 says image models refuse some content. Section 1 says "about two minutes" and lists "characters change face between shots" as a failure.
  - **Gate 0 so far:** `content/proof/photoreal/screening.json` (round 2) reports no voice in any render, and face-age drift in three of nine shots with one character on screen. So there is still no measured speech rate, and nothing yet shows three sheet faces holding in one frame.
  - **Web check today (one search, read as a summary):** no marriage bureau called exactly "Shubh Lagan Marriage Bureau" turned up. Other wedding businesses use "Shubh Lagan" ([a caterer and planner in Raipur](https://www.weddingwire.in/wedding-planners/shubh-lagan-caterers-&-wedding-planner-raipur--e311673), [a photo studio in Munger](https://www.weddingwire.in/wedding-photographers/shubh-lagan-studio--e496896)).
- **Decision:** **(a). Revision 2 is approved. Series 1 scripts are written from it, read together with this entry.**
  - **Wrist check:** accepted on the second read, by the critic and by me. D-003's fallback is not triggered and the logline is closed. Directions 3 and 4 make the check firmer; they are not conditions on it.
  - Not (b): every finding sits inside one episode, or two in the same branch, and has a fix of a line or two. A third round would cost script time for nothing a writer cannot do.
  - Not (c): nothing touches the premise.
  - When scripts start is still governed by D-002b and Gate 0.
- **Directions to the writers (binding).** Wording in quotes is the default; an equivalent that does the same job is fine. Where this entry and revision 2 differ, this entry governs.
  1. **Length measure, all eight episodes (critic 1).** 120 and 135 are finished running time, silent shots included. Read `target_spoken_seconds` and `ceiling_spoken_seconds` that way. Working measure until a speech rate is measured, the same as D-006 change 8: dialogue at or under about 1,050 characters an episode, emotion tags not counted. s1e02 may use the ceiling; the others aim at the target.
  2. **s1e02 is cut to the measure (critic 1).** The critic puts it at about 138 s spoken and about 165 s in all.
     - Defaults, the critic's: b9's drill in two lines ('पी लिया बोले, तो तीन बजे गाड़ी। दूध फट गया बोले, तो लड़के ऊपर।' then 'कुछ और बोले, या चुप रहे, तब भी ऊपर।'); b4 without the echoed 'रेखा।' and without the spoken speaker instruction, his check cut to 'कोई code?'; b6 without "not police"; b10 without "only tonight, I have kept everything safe".
     - Must survive any cut: all three outcomes in b9; in b4 the 2 o'clock call, "a dead phone brings Billu up" and his question about a code; "eleven days, then one dose" in b6, which s1a02 b3 and s1b03 b5 pay off; the mathri in his hand and the locked question in b10; b5, b7 and b13 whole.
  3. **s1e02 b2: the slow removal is his choice (critic 8).** The viewer saw the stack slide in s1e01 b11. Default: 'एक-एक करके। मुझे जल्दी नहीं है।'
  4. **s1e02 b4: he puts the wrist off, he does not drop it (critic 7, raised from medium).** Default, after the priority line: 'और झूठ निकला, तो तुम्हारी कलाई कहीं नहीं जा रही।', with an insert that shows the time (overlay, about 1:52). The writer may then keep or drop 'तुम वो होतीं तो उसका पता मुझे नहीं देतीं।'. That line cannot be his only reason, because a decoy is what the scarred girl would offer. Why raised: the wrist check is the one condition D-003 put on the logline, and this line also sets up s1a02 b3 and s1b01 b5a.
  5. **s1b01 b5: Kiran and Aditya hear that Mausi is coming, and how long it will take (critic 2).** Default, Billu through the door at the end of b5: 'किरण! मौसी ख़ुद आ रही हैं। ढाई घंटे लगेंगे। हम यहीं बैठे हैं।' Mausi's order becomes "wait for me, do not touch him". "The lane will wake" goes, because the hasp is torn out at 4:30 anyway. The 4:10 overlay then rests on a spoken figure. I did not take the critic's 'दरवाज़े से दूर रहना': in the next beat she sits against that door.
  6. **s1b01 b6 (critic 15).** Three short turns, with 'आ रही हैं'. Default: 'Police को दिखाओगे क्या?' 'ताला तुमने लगाया है। नाम तुम्हारा नकली है।' 'और मौसी बस अपनी बेटी लेने आ रही हैं।'
  7. **s1b01 b10 (critic 3).** Mausi does not tell Kiran, in front of Aditya, that she kept the death from her. It marks Kiran as the one who was owed the news, two episodes before he is meant to know. Default: 'मोहित का भाई। हाँ, ख़बर आई थी। लड़का कमज़ोर निकला।' Kiran: 'आपको पता था?' No "तुझे बताया नहीं".
  8. **s1b02 b2 and s1b03 b2 (critic 10).** Billu says his figure aloud, so the gap is heard. Default: Kiran 'बाईस तोला आया था। तुझे कितना बताया?' Billu '...बारह।' Not 'चौदह'. Then 'मौसी ने कहा है।' s1b03 b2 covers two weddings and tonight, not eight; one line may say the rest went the same way.
  9. **s1b02 b4 (critic 9).** Mausi sees a reason for him to drink. Default: an insert of the boys' hands tightening on his shoulders, Kiran aloud 'पी लो। नहीं तो ये पिला देंगे।', then the whisper nobody hears. The withholding in `writer_notes` stands.
  10. **s1a03 b5 (critic 12).** Mausi says only 'तूने...?' before 'हाँ मौसी। आपने ही सिखाया है।' The "since you were fourteen" appeal belongs to s1b03 b4 alone and is a fourth entry in `kept_apart_in_the_two_finales`.
  11. **s1a03 b4 (critic 13).** No line, subtitle or cue calls the half fold a lethal dose. s1e01's first line says half does not bring sleep, and s1b01 needs two full folds. It is his promise made visible. Mausi's line stays.
  12. **s1b03 b10 (critic 16).** An echo of the series' first line, not a copy: 'पूरी पुड़िया डाल दे, छोटी। आधी में नींद नहीं आती।' 'हाथ मत काँपने दे।' may stay in front of it. This replaces "keep the wording identical" in `writer_notes`.
  13. **s1a02 b9 (critic 15).** 'दामाद जी... ये हाथ ढूँढ रहे हैं?'
- **Advisory (the writer's call; S3 judges the result at Gate 2):**
  - s1b03 b7 (critic 11): Aditya 'तुम जा सकती थीं।' Kiran 'कहाँ?' It says why she stays, and echoes s1e02 b7 and s1b02 b7. Pay for it from b2.
  - s1a03 b3 (critic 15): the line must still mean "do not lie for me". 'झूठ मत बोलिए, मौसी।' on its own reads as an accusation. Try 'मेरे लिए झूठ मत बोलिए, मौसी।'
  - s1a01 b7 (critic 18): half a line, so that Billu has not driven two hours before telling Mausi. Default, as he hands Kiran the phone: 'मौसी तुझसे ख़ुद सुनना चाहती हैं।'
  - s1a02 (critic 18): the morning passes without a marker. A change of light is enough.
- **Directions to the production roles (not story changes; judged at Gate 3 and at the visual check):**
  14. **Chhoti reads as an adult woman (critic 6e; binding).** Her sheet prompt opens "adult woman, 19". "Round-cheeked", "gap-toothed" and the ribbon are dropped and a dupatta is added; those words in `characters.chhoti.look` and `look_detail` are superseded. Her voice is a young woman's, not a child's. Two reasons: a small figure with a child's markers being dressed as a bride invites a refusal, and a frame that reads as a child bride is a failure the bible itself rules out ("nothing about her is played as a child"). Gate 3 checks the sheet and the voice sample for this.
  15. **Hands (critic 6a, 6b; expected at Gate 3).** S6 makes a hand-and-forearm sheet for Kiran: left palm up; left back up with the full cuff; left with the cuff pushed up and the scar; right hand. The scar is drawn once and reused. The photograph is made once, and every shot in which its content can be read uses that one image.
  16. **Faces per frame (critic 6c, 6d; S7's default).** No more than two sheet faces in a frame until a proof or Gate 3 frame shows three holding. s1a01 b10, s1a03 b7, s1b01 b9 and s1b03 b3 are shot as singles and two-shots: `who` lists who is in the beat, not who is in one frame. s1a02 b3 is one face per frame, and the mirror wall stays out of wides.
  17. **The boys (critic 14, 19).** Their hands stay on Aditya's shoulders from s1b01 b9 until they lay him down in s1b02 b5. S4 and S7 treat them as present in s1b01 b10 and b11 and s1b02 b1, where `who` omits them. In s1b01 b9 the phone Billu pockets is Aditya's.
  18. **Bedroom light for path B (critic 21; S6).** Four states: lamp and streetlight; the landing bulb spilling in once the hasp is torn; pre-dawn blue; dawn grey.
  19. **The breath that ends s1e02 (critic 20; S10 and S11).** A recorded breath or a sound effect, not a voiced line.
- **Rejected, or not required:**
  - **A cap of 34 lines for s1e02.** Lines do not cost time; characters do. D-006 ruled the same way on a beat cap. The measure is direction 1.
  - **Critic 22, a clause on the glass bangles at wedding six.** Optional. It adds a line to answer a question few viewers will ask, and `story_locks.chooda.dialogue_ban` still applies to whatever is written.
  - **Critic 23, renaming the bureau.** The phrase is common, the search found no bureau of that exact name, and the name is an overlay and is in no locked line. Kept for an internal demo. `content_notes` should say what is known in place of "no real bureau".
  - **Critic 17 and the "11 beats" count as reasons to hold anything.** They are fixed in the errata below.
- **Next steps:**
  - S2 writes from revision 2 plus this entry. Every Series 1 brief from here on (S2, S3, S4, S5, S6, S7, S10, S14) names this entry beside the bible.
  - Errata, in parallel. Scripts do not wait for it and there is no critic round. S1 folds directions 1 to 17 into `bible.json` as revision 3, changing only what they name: the beats cited, the `length_budget` labels, `writer_notes`, `kept_apart_in_the_two_finales`, the three `who` lists and the "11 beats" count, Chhoti's look, and the bureau line in `content_notes`. It also adds b5 to the s1e02 paragraph of `branch-map.md` (critic 17). If no agent runs this step, this entry governs.
  - The first agent with a shell parses `bible.json`, which is still not done, and reports each script's dialogue character count against direction 1.
  - The product track syncs the four meaning strings in `app/public/media/series1/series.json` from `choice.A.meaning` and `choice.B.meaning`. D-005 asked for this and it is still not done.
  - An agent that can write saves both critic reviews to `content/series1/review-notes.json`. I did not: the orchestrator holds the exact texts, and retyping them here risks changing them. Every default line a writer needs from round 2 is quoted above.
- **Not verified:**
  - **JSON:** not parsed. My pattern searches on revision 2 found no comma before a closing bracket (on one line or across two), no tab or backslash, and no line ending without a comma or an opening bracket ahead of a line that starts with a quote. That is not a parse.
  - **Length:** no script exists and no speech rate has been measured. 138 s and 165 s are the critic's estimates, and 1,050 characters is a provisional measure.
  - **Vote split:** the critic's guess is 55 to 65 per cent for A. Nothing is measured.
  - **How I read the file:** through a search tool that returns it in pieces of 400 to 600 characters. Four long lines (23, 69, 141 and 316) I read only in part.
  - **`branch-map.md`:** I read from the s1b02 paragraph to the end. Critic 17 I checked only by searching the file for b5's key phrases, which found none.
  - **Frames:** none viewed. Whether three faces hold in a frame, whether the scar and cuff hold from frame to frame, and whether Chhoti's sheet reads as an adult are all untested.
  - **Hindi defaults:** the lines in directions 5, 6 and 8 and the last two advisory lines are mine or reworded by me. The critic has not read them and no voice has spoken them.
  - **Bureau name:** one search, read as a summary. It is not a clearance.
  - **Gate 0:** I read the first 70 lines of the photoreal screening file and the opening of the photoreal review notes. Nothing from the flat 2D proof for this gate.
- **Would change it:**
  - If the first measured takes run faster or slower than 10 characters a second, the 1,050-character measure moves in proportion.
  - If S3 fails the s1e02 script twice on length with every protected item in place, the next cut is decided here, not by dropping a balance lever in the script.
  - If no sheet for Chhoti reads as an adult at Gate 3, her look is redesigned (older, taller) before any frame is made. The story does not change.
  - If frames show the cuff or the scar drifting even with the hand sheet, D-003's remedy applies: simplify the look first (drop the henna, keep the chooda).
  - If the series is ever shown outside the team, the bureau's name and every principal's name need a proper clearance first.
  - The logline and the story are closed. From here the bible changes only through an entry in this log.

## D-016 Gate 1b, round 2: Series 2 bible approved (A0 Arbiter, 26 Nov ~04:00 IST)

- **Question:** revision 2 of `content/series2/bible.json` has had its second critic read. Approve it for scripts, or send it back again?
- **Options:**
  - (a) Approve. The second-read findings go forward as directions in this entry.
  - (b) Send the bible back for a third round.
  - (c) Reopen the logline. D-004 allows this only if the set-up cannot land in s2e01 and s2e02 without a narrator.
- **Evidence:**
  - **Critic (S3), round 2:** pass, 7.5 against the 7.5 line, no fatal problem. Six must-fix items, all local (P1 to P6), five medium (P7 to P11), seven minor (P12 to P18) and one optional (P19). Sub-scores: branch_distinct 9, hook 8.5, cliffhanger 8, hinglish 8, choice 7.5, stakes 7, performability 7, continuity 7, length 6.5. It reads the vote at about 40 A to 60 B, inside D-004's 65 to 35 limit. It found D-006 changes 1 to 7 and 9 to 23 present, and could not confirm change 8 (length) without a counter. It ran no parser, no tool count, no timing and no name check. The review reached me as text in the orchestrator's brief; `content/series2/review-notes.json` still does not exist.
  - **D-006:** round 2 is the last bible round. Local findings go to the writers, and only a fatal finding comes back.
  - **My read:** revision 2 (603 lines, read in full), each critic item checked against the text. What I rely on:
    - राशन is in no Hindi line of the file. अनाज is first spoken in s2a02 b10 and सरकारी in s2b01 b9. Before the vote the viewer hears only "आठ सौ बोरी" (s2e03 b2, b3) and "तीस complaint" (s2e01 b11). The godown plate is used in s2b01 and s2b02 only, so no picture says it either.
    - s2b03 b1 asks whether she knew the man was not police. She reported him to the DSP in s2e01 b8 and was ordered to lock him up in s2e03 b6, so nobody could believe "ना". The lawyer's own second line (b2) and the s2b02 cliffhanger are about who sent him.
    - The same signed slip stops her in A and not in B. A: "मोहर लगा truck मैं रोक नहीं सकती" (s2e03 b7) and "काग़ज़ पूरे हैं" (s2a01 b6). B: the slip is item three of a seizure and the truck key is taken (s2b02 b7, b8). s2b02 b10 gives the DSP the memo and the witness and does not mention the recording. The gap comes from my D-006 change 6.
    - s2b01 b10: "इन्हें पता था।" The question uses इन्हें for Nirala (s2e03 b10), and Nirala says उनके of Bhaiyaji (s2e03 b8). The line was my D-006 default.
    - s2a01 b9: Nirala supplies the ten o'clock microphones. The press conference is spoken once, in s2e01 b8, in the real thana. s2e02 b10 tells him only "कल दस बजे से पहले". The line was my D-006 change 12.
    - The `talkies_lobby` plate lists no clock. s2e03 b10 shows one, and in s2e02 b4 she times ten minutes with "no watch" in her look.
    - s2a03 b10 and b11 are tagged `real_thana`, an interior plate, and are seen from the yard.
    - `who` lists five principals in s2a02 b12, s2a03 b1 and s2b02 b9.
    - `red_helmet` cites s2b02 b1 in its description and omits s2b02 from its episodes.
    - Mine, not the critic's: naming the ration (direction 1) makes A's loss heavier. That moves the vote towards B, by how much nobody can say.
    - Mine: s2a01 b8 infers that the slip was stamped before midnight. In s2e03 b7 she said Tripathi would stamp it if Nirala did not come, so the stamp alone does not show that. The time does: the truck is at the crossing at ten past twelve (b7).
  - **Searches I ran on the files:** 101 beat ids. No यह or वह. No old antagonist name in `content/series2` or `app/public/media/series2`. No "चौदह", "नौ साल" or "इसे हथकड़ी" in the bible.
  - **App manifest:** `app/public/media/series2/series.json` has the question with "इसे" (line 15), a `questionContext` that differs from `choice.question_context` (lines 19 and 20), and "चौदह महीने" and "fourteen months" for Tripathi (lines 78 and 79). Its cast list has five entries and no DSP.
  - **Plan:** section 2 puts both branches in front of a day-1 viewer back to back, and gives each glimpse 20 to 30 seconds and its own cliffhanger. Section 3: no narrator, and the choice costs the lead either way. Section 9: stills only.
  - **Skills:** the 25 to 40 line rule and the 8-second shot ceiling are rules for scripts (`hinglish-screenwriting`, `script-critique`). They are not rules for a bible's key lines.
  - **Gate 0 (D-008, D-013):** there is still no measured speech rate. Codex takes five references a call, and each character, each visible prop, the plate and the scene anchor want one.
  - **D-007:** the Series 1 rulings on what 120 and 135 seconds mean, on faces per frame and on errata. I reuse them.
  - **Web checks today (one search each, read as summaries):**
    - Anil Rathore: no police officer of that name turned up. An IAS officer called Anil Kumar Rathore is listed in Madhya Pradesh ([The Secretariat](https://thesecretariat.in/bureautrack/anil-kumar-rathore-01mp119m03)). The critic's recollection is right: Anil Rathod was a Shiv Sena legislator from Ahmednagar and a minister of state, and died in 2020 ([Wikipedia](https://en.wikipedia.org/wiki/Anil_Rathod)).
    - Sudhir Nirala: nobody of that name turned up.
    - Nandini Joshi, searched with "sub-inspector": no police officer of that name turned up.
    - Pushpa Kumari, searched with "head constable": no head constable. A Pushpa Kumari Kohli is an assistant sub-inspector in Sindh, Pakistan ([Wikipedia](https://en.wikipedia.org/wiki/Pushpa_Kumari_Kohli)).
- **Decision:** **(a). Revision 2 is approved. Series 2 scripts are written from it, read together with this entry.**
  - The critic found nothing fatal and nor did I.
  - D-004's no-narrator condition stays met (D-006). The logline and the story are closed.
  - Not (b): every finding is a line or two inside one episode, a staging note or a metadata fix. D-006 ruled out a third round for findings of that size.
  - Not (c): nothing touches the premise.
  - I accept all six must-fixes, P6 in a different form (directions 7 to 9). What I reject is listed after the directions.
- **Directions to the writers (binding).** Wording in quotes is the default; an equivalent that does the same job is fine. Where this entry and revision 2 differ, this entry governs.
  1. **What the sacks are, before the vote (P1).** s2e03 b3, nandini: "आठ सौ बोरी। कस्बे का राशन। रंगे हाथ।" s2e01 b11, nandini: "तीस complaint। राशन, उगाही... सब में एक ही नाम: भैयाजी।" The first is the one the vote depends on.
  2. **s2b03: the court asks who sent him (P2).**
     - b1, defence_lawyer: "SI Joshi। हाँ या ना। इस आदमी को godown में आपने भेजा था?"
     - b2 line 1: "'ना' कहिए, तो एक बहुरूपिया ख़ुद godown में घुसा: gang उसका, मेरे मुवक्किल शिकार।" Line 2 stays.
     - b3, nirala: "हुज़ूर, madam ने नहीं भेजा! मैं अकेला गया था—"
     - b5, nandini: "निराला जी। बयान मेरा है।" then "भेजा मैंने था। Phone मेरा था। फ़ैसला भी मेरा।"
     - s2b02 b12 and s2b03 b6 stay as written.
  3. **s2b02 b10: what B has that A did not (P3).** nandini: "DSP साहब, SI Joshi। अब बात नक़ली थाने के phone की नहीं है। भैयाजी की आवाज़ record है, और आठ सौ बोरी मेरे memo में। Force भेजिए।" The echo of s2e03 b6 stays and the DSP still takes nothing back. She says it in front of Bhaiyaji and Tripathi, and b11 and b12 follow from that.
  4. **s2b01 b10 (P4).** nandini: "भैयाजी को पता था।" The ladder and `glimpses.B.must_not_reveal` are read with this line.
  5. **s2a01 b9: the microphones are her fact (P5).** Same words, new speakers.
     - nirala: "माल गया, madam। Complaint नहीं गईं। पर मेरी files नक़ली थाने का काग़ज़ हैं। असली register में चढ़ाइए।"
     - nandini: "सुबह दस बजे इस थाने में microphone होंगे। उनके सामने रखा register कोई दबा नहीं सकता।"
     - nirala: "उसके बाद... SHO साहब की almirah। FIR लिखिए, madam।"
     - The idea of registering is still his, as `balance_rules` says. The clock is hers. The almirah clause may go to either of them.
  6. **s2b03 b9: branch B pays off the thirty complaints (P10).** pushpa: "तीस FIR मैं लिख दूँगी, madam।" in place of "थाना मैं देख लूँगी।" The bible already puts this fact in the last picture and its overlay, and an overlay may not carry a fact (D-004 direction 4). If B wins the vote it is the official ending.
  7. **Length measure, all nine episodes (P6).** As D-007 direction 1. 120 and 135 are finished running time, with holds and silent beats. Dialogue is at or under about 1,050 characters an episode. Characters are code points, with spaces and punctuation and without tags or speaker labels. s2e03 may use the ceiling; the others aim at the target.
  8. **Line count (P6).** A script has 25 to 40 lines. S2 gets there by splitting the long key lines at their sentence breaks, with a reaction between, and not by adding matter. The critic lists eight of 100 characters or more: s2e01 b8, s2e03 b2, b6 and b7, s2a01 b9, s2a03 b5, s2b02 b10 and s2b03 b6.
  9. **The tight episodes (P6).**
     - s2e02: the dictation in b4 and in b8 is one short spoken fragment each. The rest is the picture of him writing. The fragments count in the measure.
     - s2e03: if the counted script is over, the first cut is "त्रिपाठी जी दस हज़ार लेते हैं। आप दो में ख़ुश।" from b2. "अकेले आइएगा।" stays. This cut is allowed only because s2e02 b6 keeps "त्रिपाठी जी से सस्ते भी, मीठे भी।", which says the same thing an episode earlier.
     - s2b01 has room by every estimate. It is spent in b9, where the sting has to be heard working: Nirala says aloud what he sees.
  10. **s2e02 b1 (P7).** It opens on her hand still on the pouch, where s2e01 left it. The cuffs come out on "नक़ली थाने का charge handover?" No line changes.
  11. **s2a01 b1 (P18).** Nirala's reply is two lines, "जी, madam।" and "बस... cap रहने दीजिए।", so that Glimpse A starts on a whole line.
  12. **"Force" is feminine in every script (P16).** "हमारी force में cap होती ही नहीं।" (s2e01 b4) and "मेरी force में ये नहीं होता।" (s2b01 b3). This rests on the critic's ear and mine. S3 may overrule it at Gate 2.
  13. **Two small fixes (P13).** s2b01 b7 loses "a shutter rattling up": the godown mouth is open in b6 and the shutter first moves in b8. In s2b02 b4 the order is the blows, Bhaiyaji's smile, then her voice.
- **Advisory (the writer's call; S3 judges the result at Gate 2):**
  - s2b02 b7 (P19): bhaiyaji "Madam, आप अकेली हैं। और त्रिपाठी जी आ ही रहे हैं।" It says why an armed man stands still while his key is taken. It costs about 28 characters, so only if the count allows.
  - s2a01 b8 (mine; the critic has not read it): rest the inference on the time. Default: nandini "गया। बारह दस पर। SHO साहब के sign पर।" His "मोहर पहले से SHO साहब की थी" then follows from the ten minutes.
  - s2b03 b9 (P12): nothing says whether the suspension order was signed before or after her statement. "The room emptying" is a cut in time. One clause, if the writer wants it.
  - s2b03, the medal (P15): the showrunner's open point stands as written. The critic's action (in b8 the magistrate's hand slides the medal clear of the sealed exhibits) is allowed if the medal is still in b10's frame, untouched.
- **Directions to the production roles (not story changes; judged at Gate 3 and at the visual check):**
  14. **Faces per frame (P8b; S4 and S7).** As D-007 direction 16: no more than two sheet faces in a frame until a Gate 3 frame shows three holding. Never more than three, because of the five-reference limit (D-013 rule 1). `who` lists who is in the beat, not who is in one frame. Every beat whose `who` has more than two is shot as singles and two-shots; s2a02 b12, s2a03 b1 and s2b02 b9 list five. Silhouettes, backs and hands are not sheet faces, so the three figures on the track in s2a01 b3 stay.
  15. **No eighth plate (P8a; S4 and S6).** s2a03 b10 and b11 are the van-grille insert and one shot on the existing `real_thana` plate, from inside looking out: the full bench in the foreground, her saluting in the doorway. What the final image contains does not change.
  16. **Long lines get more than one still (P8c; S4).** s2e03 b2 and b6 and s2b03 b6 run well past the 8-second ceiling as outlined. Defaults: s2e03 b6 as her face with the phone, then Nirala's hands and Pushpa's stopped needles, then her face on "उसी FIR में"; her listening face added to s2e03 b2; s2b03 b6 across its three listed images.
  17. **A clock in the talkies (P9; S6).** The `talkies_lobby` plate gets a wall clock with hands and no numerals. In s2e02 b4 she reads the ten minutes off it, and s2e03 b10 uses it.
  18. **Glimpse B (P18; S14).** Its last line is a phone voice over a shut shutter, and the glimpse never shows the phone. S14 either adds the s2b01 b5 frame of the phone going into his pocket, or plays the line as his voice through the shutter. The glimpse stays inside 30 seconds and inside its `must_not_reveal` list.
  19. **Continuity and metadata (P13, P14; S5, and S1's errata).**
      - `red_helmet` adds s2b02. She has no helmet from s2a01 b8 to the end of s2a03, or in s2b02 after b1.
      - Bhaiyaji's marigold garland (s2a02 b12, s2a03) becomes a prop.
      - `ov_shield` adds s2a01.
      - s2b01 b8 is two shots on two plates: the godown from outside with Nirala small in the doorway, then the stall with Nandini and Pushpa listening. Bhaiyaji is not seen.
- **Rejected, or not required:**
  - **A return to the showrunner for length.** Nobody has counted anything with a tool in three sessions on this bible. A count needs a shell and a script to count, and both arrive with S2. The critic's hand figures (s2e03 about 1,080; s2e02 about 990 plus about 100 not listed) are within their own error of the measure.
  - **Fewer than 25 key lines an episode as a fault.** The floor is for scripts. See direction 8.
  - **Cutting "त्रिपाठी जी से सस्ते भी, मीठे भी।" from s2e02 b6 (the critic's P6 fix).** It is the first spoken sign that Bhaiyaji pays Tripathi, and keeping it is what lets s2e03 shed its repeat (direction 9).
  - **P12 and P15 as required changes.** Few viewers will ask either question. Both are in the advisory list.
  - **Renaming the DSP (from P17).** The name is common. The politician with the near-identical name was in another state and another trade and died in 2020. The character is honest, his full name is in no spoken line, and he is not in the app's cast list. Kept for an internal demo; `content_notes` should say what was found.
  - **The critic's own rejections stand:** Pushpa's late arrival in s2e03 (D-006 ruled), the DSP's thin refusal, B's trials left pending, s2a02 as flat, and Pushpa telling Tripathi about the files in s2e02 b11.
  - **`dial_1` and `dial_2`.** Still unused. The critic reads the vote inside the limit.
- **Next steps:**
  - S2 writes from revision 2 plus this entry. Every Series 2 brief from here on (S2, S3, S4, S5, S6, S7, S10, S14) names this entry beside the bible. When scripts start is governed by D-008.
  - Errata, in parallel. Scripts do not wait for it and there is no critic round. S1 folds this entry's directions into `bible.json` as revision 3, changing only what they name, brings `branch-map.md` into line, and adds the four name checks and the Anil Rathod finding to `content_notes`. If no agent runs this step, this entry governs.
  - The first agent with a shell parses `bible.json`, which is still not done, and reports each script's dialogue count against direction 7, saying how it counted.
  - The product track syncs three things in `app/public/media/series2/series.json` from the bible: the question (line 15), `questionContext` (lines 19 and 20) and Tripathi's cast line (lines 78 and 79, which become "दो साल" and "two years"). D-006 asked for the first and it is still not done.
  - An agent that can write saves both critic reviews to `content/series2/review-notes.json`. I did not: round 1 is not in my brief, and retyping round 2 here risks changing it. Every default line a writer needs from round 2 is quoted above.
- **Not verified:**
  - **JSON:** not parsed. No session at this gate has had a shell. The pattern searches by the critic and in D-006 are all there is.
  - **Length:** nothing counted by a tool, and I hand counted no episode this round. The speech rate is unmeasured (D-008), so 1,050 characters is provisional. The counting method in direction 7 is my inference from one figure in the flat 2D proof review (46 characters for a 15-syllable line). The skill does not define it.
  - **Vote split:** the critic's judgement. The effect of direction 1 on it is unknown.
  - **Hindi defaults:** directions 1 to 6, 11 and 12 use the critic's wording, which I read and did not change. The advisory line for s2a01 b8 is mine. No voice has spoken any of them. The gender of "force" is by ear.
  - **Legal points** (when a recording counts as evidence, who may write an FIR, suspension, bail): asserted by the story. No law was checked.
  - **Name checks:** one search each, read as summaries. They are not a clearance.
  - **Frames:** none viewed. Whether three faces hold in a flat 2D frame, and whether the final image reads from inside the thana, are untested.
  - **How I read:** the bible in full. Plan sections 1 to 4, 7.8 and 9. D-004, D-006, D-007, D-008, D-013 and D-015 through a search tool. Two long lines of D-006 (change 4 and the cut list in change 8) were not shown, and I took their content from the bible's own record of them. `branch-map.md` and the app manifest by search and in part. Of the proof scenes, the flat 2D script's line list and the length notes in its review.
- **Would change it:**
  - If the first measured takes run faster or slower than 10 characters a second, the 1,050-character measure moves in proportion (as D-007).
  - If S3 fails the s2e02 or s2e03 script twice on length with every protected item in place, the next cut is decided here, not by dropping a balance line.
  - If at Gate 2 the critic reads the s2e03 script past 65 to 35 towards B: raise what B risks on screen, with `dial_1` as the first lever. No reward is added to A.
  - If a Gate 3 frame shows three flat 2D sheet faces holding, direction 14's default rises to three.
  - If the final image does not read from inside the thana at storyboard, the fallback is a tight single of her salute against the door frame, still on the `real_thana` plate. An eighth plate needs an entry here.
  - If the series is ever shown outside the team, every principal's name, the town and the cinema need a proper clearance first (D-006).
  - The logline and the story are closed. From here the Series 2 bible changes only through an entry in this log.

## D-0M1 Model change: no more Fable (orchestrator, on the owner's instruction, 26 Nov ~05:00 IST)

- **Question:** the owner said Fable usage is running out and to stop using it. What replaces the Fable roles?
- **Decision:** every role assigned Fable in plan section 5 now runs on **Opus at the same effort** (Fable xhigh to Opus xhigh, Fable high to Opus high). This is the brief's own fallback for "Fable unavailable". Opus and Sonnet roles are unchanged. All 16 `.claude/agents/*.md` files with `model: fable` now say `model: opus`, and every call still pins model and effort explicitly.
- **What was stopped and resumed:** Phase 2 scripts, Phase 3 visual bibles, the app fix round and the five-frame retest were stopped and resumed from cache with the model swapped; calls already finished on Opus or Sonnet were reused, calls that were on Fable run again on Opus. The two proof voice reviews and the two series castings were stopped and relaunched on Opus, told to continue from any files already written.
- **Effect:** decisions D-000 to D-016 were made on Fable; later Arbiter entries are made on Opus xhigh. "Promotion on failure" now tops out at Opus xhigh.

## D-0M2 Gate 0b: v4 against v3 settled, and length overruns (orchestrator applying D-009 and D-014, 26 Nov ~05:30 IST)

- **Question:** does the series switch to `eleven_v3`, and should takes that run over `target_seconds` be retaken?
- **Evidence:** `content/proof/photoreal/voice/ab.json`: v3 wins l01 and l10 on length only, l08 ties. `content/proof/flat2d/voice/ab.json`: v4 wins l08 and l12, l07 ties. Both reviewers (S10, on Opus) used local whisper.cpp transcripts, because the connector's transcription text cannot be read back. Nearly every v4 take ran over target, and the flat 2D length retakes came back still over target, with three of nine longer than before.
- **Decision:**
  - **v4 stays for both series.** v3 won 2 of the 6 pairs, short of the 4 D-009 requires, and no character obeys tags only on v3. The six pairs stay listed in `ab.json` for the owner's ear, which overrides this.
  - **Length is fixed in the edit, not by retakes.** D-014 rule 6 applies: shots follow the measured voice. A take is retaken only for wrong words, a spoken tag, a lost or wrong whisper, or a line the director's note marks as having to fit a hard cut. This caps retake spend.
  - **Transcription for all review steps is local whisper.cpp.** It is a check on words, not a timing source.
- **Not verified:** how any take sounds. Whisper.cpp's small model is weak on Hindi.
- **Would change it:** if the owner prefers v3 by ear, or if the first finished episode runs much longer than about 2 minutes because of voice pace, in which case writers trim lines before more voice is spent.

## D-017 Gate 0: five-frame continuity test (A0 Arbiter, on Opus, 26 Nov ~09:20 IST)

Numbering: the brief asked for D-016. D-016 is the Series 2 bible entry, and D-0M1 cites it by that number, so this entry is D-017.

- **Question:** did the five-frame test in D-013 rule 12 pass? Pass means the bag, the phone, the laddoo and the key hand are right in at least four of the five frames. What changes in the frame method for Phase 3 and 4?
- **Options:**
  - (a) Pass, and run D-013 as written.
  - (b) Pass, and amend D-013 where this test showed a gap.
  - (c) Fail, and apply D-013's fallback: frame the failed props out and carry them in inserts.
- **Evidence:**
  - **Checker results.** Photoreal s05, s06 and s09 (attempt 3) pass every listed item. Flat 2D s09 (attempt 4) passes every item, though its height pass is only just. Flat 2D s07 (attempt 4) passes the laddoo, key, torch, idiom and face items and fails on Bablu's height: the top of his head is at Meenu's eye line, where `style.json` `two_shot_rule` says her chin.
  - **What I saw myself.** I looked at all five current frames, the prev1 of each, the prev2 of photoreal s05, s06 and s09 and flat 2D s07, and the flat 2D s02 anchor.
    - Photoreal s05: the phone is a thin black edge at her ear on the picture-left, and no bag shows. s06: the tan duffel is open on her lap, and the phone is edge-on at her ear. s09: the bag is open on her lap with newspaper in the gap, and only the phone's plain back faces the lens. There is no seat tear in any of the three.
    - Flat 2D s07: the laddoo sits alone on the middle shelf, and the key lies on the open palm of the arm on the picture-left, with no watch. s09: the key's bow and ring show above a bare fist rising from the lower left, with no watch.
    - Every prev1 shows the fault screening named: keypad to camera, no bag, a screen to camera, a taped tear, bare shelves, the watch on the key fist.
    - I agree with every call the checker made. I also see the height fault.
  - **Count: 5 of 5 on the four named props. The bar was 4 of 5.** Counting earlier samples made under D-013, the named props were right in 9 of 9 generations. Photoreal attempts 2 and 3 used the same prompt for each shot (the same `prompt_sha`), and both came out right. Flat 2D s07 was right at attempt 3 (revision 3) and attempt 4 (revision 4). Flat 2D s09 had one D-013 attempt.
  - **Height is the one fault that stuck.** Bablu stands too tall in all four s07 takes. Three prompt rewrites made no visible change: absolute percentages, alignments to her body, and a lower camera. No pair sheet exists (`shots.json` says so for s07 and s09), so D-013 rule 5 was never tried. Height holds where the two are not side by side at the same depth: s09 puts him a step back, and the s02 anchor is over his shoulder.
  - **Anchors spread no fault.** Tara's age held at about 30 in all six photoreal samples, against s05 prev1, which looked older. The photoreal prompts listed what not to copy from the anchor (its green phone light and its raised lock knob). Neither carried over: there is no green light in any frame, and the knob is down in s09. The plate's taped tear was suppressed by a written exception in all six samples.
  - **Five reference slots are not enough for a busy two-shot.** s07 needed seven references. The key and torch sheets were dropped: the torch because it is drawn on Bablu's sheet, the key because a written description had drawn it correctly in the previous take. Both came out right.
  - **Flat 2D s09 drift.** The phone glow on the faces is a soft gradient, which the flat 2D style block forbids. prev1 had the same glow, and screening did not fail it.
  - **Time (manifests, 4 or 5 references).** Photoreal: 69.6 to 125.7 s, mean 86.8 s over five rows. Flat 2D: 146.2 to 163.0 s, mean 155.5 s over three. All eight: 112.6 s. I excluded one row: photoreal s05 attempt 2 has a start time of `2026-11-25T22:33Z` and a duration of 17,501 s, which breaks D-010's rule of real timestamps.
- **Decision: (b). The test passes.** D-013's fallback (c) is not triggered. The method goes into Phase 3 and 4 with these amendments:
  1. **Proof frames.** The current five are accepted as the proof takes. The s07 height fault is accepted and logged under D-013 rule 11, because the frame has had its retake. No more generations go to the proof scenes for this test.
  2. **Rule 5 becomes a gate.** Every pair that shares a storyboard frame and differs visibly in height gets a line-up sheet in Phase 3. The sheet gate checks the height relation the bible states. In a two-shot the line-up sheet replaces both single sheets and frees one slot. Prompt wording alone does not set relative height: in s07 three rewrites moved nothing.
  3. **Rule 1 drop order after the plate:**
     - first, a prop that is already drawn on an attached character sheet;
     - then, a prop that held in the previous take, described in words copied from the style file.
     - Never drop the sheet of the prop the beat turns on.
  4. **Rule 2 addition.** A prompt that attaches the anchor lists what the anchor shows that is different now (a light, a lock, a held prop) under "do not copy from the anchor".
  5. **Rule 9 is widened.** In flat 2D, soft glow from a light source the shot names (a phone screen, a torch) is accepted, as soft-edged cones are. It is not a reason for a retake. The style block is reworded to say so.
  6. **D-010 is unchanged.** The pooled mean of 112.6 s is under its 150 s trigger and under the 120 s planning figure. The 40 per cent retake allowance stands, because nine samples are too few to replace it.
- **Not verified:**
  - I had no shell, so I made no crops or measurements. I viewed the frames whole at 1125x2000. Wrist and keypad detail and every pixel position are the checker's measurements from full-resolution crops.
  - I did not open the reference sheets. Face and identity matches are the checker's judgement and mine by eye; no face-matching tool was used.
  - I read the photoreal s05 and s09 prompts in full. I read the flat 2D STATE and notes only through `shots.json` excerpts.
  - The test frames were rewritten by hand for exactly the props that had failed. Storyboard frames with more props per scene have not run under D-013.
  - Whether Codex holds height from a line-up sheet is untested.
  - I did not examine `frames/s09.a4.codex.log.orphan.*`.
- **Would change it:**
  - If the first two-shot anchor of a mismatched pair in wave 1 still shows the wrong height with the line-up sheet attached, that pair's two-shots are restaged: never side by side at the same depth; depth separation as in flat 2D s09, or over the shoulder as in s02.
  - If wave 1's frame check finds a prop in the wrong state in more than one frame in five, D-013's fallback (c) applies to that prop.
  - If flat 2D frames average over 150 s across wave 1, Series 2 drops to 24 frames an episode (D-010). Series 1 keeps 28.
  - If an anchor spreads a fault in wave 1, D-013's replacement with the sheet close-up applies.

## D-0M3 Gate 0b: measured pace, for Gate 2 to rule on (orchestrator, 26 Nov ~10:00 IST)

- **Fact, not a ruling:** with real v4 takes and shots following the voice (D-014 rule 6), the flat 2D proof scene runs **39.3 s (Hindi) and 39.0 s (English) against 30.3 s planned, about 30 per cent long**. The photoreal scene's takes ran 20 to 60 per cent over their targets line by line; its cut is being re-rendered now.
- **Consequence if nothing changes:** a script written to the 120 s finished-time measure (D-005 change 9, D-006 change 8, D-007 direction 1, about 1,050 dialogue characters) would finish at about 150 to 160 s.
- **For the Gate 2 Arbiter:** decide whether the episode scripts are trimmed to about 800 dialogue characters (or a per-episode equivalent) before voice, or whether about 2.5 minutes an episode is accepted. Plan: "about two minutes". Cost of trimming: one writer pass per episode before voice. Cost of not trimming: more voice credits and about 40 more render minutes, both inside budget (D-011, D-012).
- **Flat 2D proof result:** screening round 3 passes at 7/10, no blocking issue (`content/proof/flat2d/screening.json`). Mastered to -14.0 LUFS, -1.07 dBTP; Hindi and English cuts differ; subtitles land within 34 ms of speech.

## D-0M4 Gate 0b closed: both proof scenes pass with real audio (orchestrator, 26 Nov ~10:30 IST)

- **Evidence:** screening round 3: photoreal 8/10, flat 2D 7/10, no blocking issue (`content/proof/*/screening.json`). Both mastered at -14.0 to -14.3 LUFS, true peak about -1.1 dBTP; Hindi and English cuts differ; every dialogue clip sits where the timeline puts it; subtitles start within 0.2 s of speech on 27 of 29 cues (photoreal) and within 34 ms (flat 2D). Measured length: photoreal 37.1 s hi / 35.9 s en against 31.7 s planned (+15%); flat 2D 39.3 / 39.0 s against 30.3 s (+30%). Gate 0b spend: about 5,700 credits for both scenes including retakes, under D-011's 8,000 estimate.
- **Decision:** the full production method is approved: D-009 (route b, v4), D-010 (lanes), D-012 (render), D-013 with D-017 (continuity), D-014 (subtitles), D-015 (process), D-0M2 (length in the edit). Bulk voice and sound may start once Gate 2 passes. Loudness tolerance is ±0.5 LU around -14 LUFS, because the true-peak ceiling stops loudnorm reaching exactly -14.
- **Process fix:** shared files in `production/remotion` and `production/scripts` were changed by two editors at once. From Phase 4 on, only the orchestrator-run toolsmith step edits them; episode editors change only their own episode folder.
- **Not verified:** nobody has listened to either scene.

## D-018 Gate 2: series1 scripts (A0 Arbiter, on Opus, 26 Nov ~10:20 IST)

- **Question:** are the eight Series 1 scripts, in Hindi and English, ready for storyboards and voice? D-0M3 also asks this gate a second question: trim every script to about 800 dialogue characters before voice, or accept longer episodes?
- **Options:**
  - (a) Pass all eight as written.
  - (b) Pass seven and hold s1a02 for the critic read it never had. No trim before voice: length is settled in the edit, under a stated ceiling and trigger.
  - (c) As (b), and also trim all eight to about 800 characters before voice (D-0M3's first option).
- **Evidence:**
  - **Critic (S3).** Seven episodes pass at 7.8 to 8.1, and each `review-notes.json` has a `writer_response` that applies the must-fix items. I checked s1e02 (length, the b1 seam) and s1b01 (four staging items, plus the English l24 fix) item by item. For the other five I checked only that a writer response exists. s1a02's "0, fail" is not a verdict. The critic stopped at its tool check (no Bash, no Write) and reviewed nothing, and its file says so. The seven other critics had the same tools and worked by hand count and Grep.
  - **English (S5 check).** Scores are 7.9 to 8.5. The two must-fix items are applied in `script.en.json`: the caller-name overlay reads 'Mausi' in s1a01 b1 and b7, and s1b01 l24 is now "This one won't get scared, beta."
  - **Continuity (S4).** It reported ok false on P01 (high) and four lows, but the report is out of date. P01 to P06 are now in both script files of each episode they touch:
    - P01: s1a01 b1 set-up 2 ends on "a marigold petal on the sheet beside it". The silent two-shot now has "the steel dabba still in Aditya's hand".
    - P02: s1e02 b1 has "both cuffs at rest just above the wrist bone; she slid the right one down on her way from the door".
    - P03: s1a02 l08 is 'तुमने कहा था हिसाब रेखा लिखती है। यहाँ मौसी लिखती हैं।'.
    - P04: s1b02 b4 and its writer note now say the fold is tapped still folded shut, nothing falls, and it goes back half full.
    - P05 and P06: s1a02 b9 shot 1 has the cross to the desk, and `time_of_day` starts at 5:45.
    - `continuity.json` still lists all six as open.
  - **My read.** I read the dialogue of all eight Hindi scripts, the action at both seams and in both finales, and English lines at the seams and the kept-apart lines.
    - **The seams.** s1e02 ends on l30 'हाँ बेटा? पी लिया?' and a recorded breath. At that point the phone is lit on the sheet, Kiran's left arm is under the pallu, and the dabba is in Aditya's hand across the room. s1a01 b1 opens on 'हाँ मौसी, पी लिया।' and s1b01 b1 on 'मौसी... दूध फट गया।', both with the same phone and dabba states. In English, the drill (s1e02 l24), the ballot question and both openers all use the same words: "He drank it" and "the milk has split".
    - **Finale A, s1a03.**
      - Mausi covers for Kiran: 'रेखा? वो तो साल भर पहले भाग गई, दामाद जी।'. Kiran refuses the cover ('मेरे लिए झूठ मत बोलिए, मौसी।'), slides the bangles off herself and confesses.
      - Mausi says only 'तूने...?' before 'हाँ मौसी। आपने ही सिखाया है।'.
      - At the chowki the names go स्नेहा, then किरण, then तुलसी, which pays off s1a02 l17.
      - No wrist grab, and no line calls the half fold lethal. The key ring Kiran holds was put back in her hand in s1a02 b6 shot 7.
    - **Finale B, s1b03.**
      - Kiran's own line, 'हिसाब अब मैं रखूँगी, मौसी।', is there, and 'चौदह की थी तू' appears in this finale only.
      - The gold figures are spoken: 16 and 8, then 9 and 4, after s1b02's 22 and 12.
      - The advisory 'तुम जा सकती थीं।' / 'कहाँ?' was taken.
      - The last line is 'पूरी पुड़िया डाल दे, छोटी। आधी में नींद नहीं आती।', after 'हाथ मत काँपने दे।'.
    - **s1a02 against D-005 and D-007.** Every item aimed at it is present:
      - the half hour said in full, with how the police know (l23, l24);
      - 'किरण नाम मैंने रखा था तेरा।' (l17);
      - Mausi behind the curtain while the cashbox is open (b6);
      - 'दामाद जी... ये हाथ ढूँढ रहे हैं?' (b9);
      - the change of light at b5.
    - **Searches.**
      - No spoken यह or वह in any of the 16 files.
      - In each of the eight pairs, Hindi and English have the same number of spoken lines and of beat and line ids.
      - Both lines with two tags list both in `emotion_tags`. One line has no tag (s1e01 l08, Billu).
      - Every key in the proof script is present. The extra keys (`series_id`, `episode_id`, `locations`, `script_note` and so on) are metadata only.
  - **Length.** These are the writers' hand counts, tags excluded:

    | Episode | Characters |
    |---|---|
    | s1e01 | ~940 |
    | s1e02 | ~1,045 |
    | s1a01 | ~885 |
    | s1a02 | ~890 |
    | s1a03 | ~760 |
    | s1b01 | ~915 |
    | s1b02 | ~838 |
    | s1b03 | ~946 |

    - All eight are under D-007's ~1,050, and none is padded. `target_total_seconds` runs from 117.9 to 132.1.
    - The measured pace: the photoreal proof's Hindi v4 takes speak about 8.4 characters a second (283 in 33.5 s, as the critics read the manifest). That finished scene ran 15 per cent over plan; flat 2D ran 30 per cent over (D-0M4).
    - At 8.4 a second, plus each script's silences and speaker gaps, the eight project to about 123 to 145 s, with a mean of about 133 s. s1e02 is the longest at about 144 s. Several writers had already set their targets at 8 to 9.5 a second after Gate 0b.
  - **D-0M3 costs.** Trimming costs one writer pass per episode, then the critic, English and continuity again. Not trimming costs more voice and render time, which stays inside budget (D-011, D-012).
- **Decision: (b).**
  - **Seven pass Gate 2 in both languages** and go to storyboard and voice now: s1e01, s1e02, s1a01, s1a03, s1b01, s1b02 and s1b03.
  - **s1a02 is held.** It has had no adversarial read, and that read is the plan's script gate (sections 5 and 7.6). Its storyboard, frames and voice wait for the S3 round below. My own check above found no fault, but it does not replace S3's read.
  - **Length (D-0M3): no trim before voice.**
    1. The character measure stays as D-007 direction 1 set it: about 1,050, tags excluded, no padding.
    2. The ceiling on finished time for Series 1 moves from 135 s to 150 s, for each language cut. "About two minutes" stays the aim.
    3. Length is settled in the edit (D-0M2). Silences are shortened first, then lines are cut in the script's own trim order. Seven scripts have one in `writer_notes`. s1b02, the shortest, has none. No trim may drop a line that the script or D-007 marks as protected.
    4. Trigger: if the first two finished Series 1 episodes both run over 150 s with their silences already shortened, the trim orders are applied in the script, Hindi and English, to every episode not yet voiced. That is D-0M2's "writers trim before more voice is spent", now with a number.
  - **Not (a):** s1a02 has not been reviewed.
  - **Not (c):**
    - The projected mean of about 2:13 is within about 10 per cent of "about two minutes".
    - An 800 cap would cut about 12 per cent from scripts that are already under their measure. It would also cost eight writer passes plus the critic, English and continuity rounds again.
    - The cuts would fall on the lines the critic and D-007 built the balance levers from.
- **Must fix: s1a02 only.**
  1. S3 reviews s1a02 now, on Opus (D-0M1).
     - It needs no shell: it works by hand count and Grep, as the other seven did.
     - If it cannot write files, it returns the review in its result, and S2 saves it word for word into `review-notes.json`, as for the other seven.
     - It also confirms that P03, P05 and P06 are applied correctly.
  2. If S3 passes it at or above the threshold:
     - S2 applies the must-fix items.
     - S5 mirrors them in `script.en.json`.
     - s1a02 goes to storyboard and voice without coming back here.
  3. A fail goes through the usual two rounds. It comes back here if it fails twice, or if a must-fix touches another episode, a lock or a balance lever.
- **Next steps (not holds on the seven):**
  - **Parse and count.** Before an episode's storyboard or voice, the first step with a shell parses its two script files. It also machine-counts the dialogue characters, tags excluded.
    - A parse error is fixed mechanically by S2 and does not come back here.
    - If the count is over 1,100, that script's trim order is applied before voice. For s1e02 that means l04 'रखो। ' first, then 'अच्छा सुन... ' in l29. b5, b7, b13, l07, l09, l24, l25 and the mathri stay.
  - **Continuity.** S4 marks P01 to P06 as fixed in `continuity.json` and the review notes, so the shot-list pass does not raise them again.
  - **Storyboards (S7).** The production lock "no set-up past 8 s" applies to measured clip lengths, not to targets. Where a voiced line runs long, its set-up is split with an insert. Several critics found set-ups close to 8 s on targets alone.
  - **Voice.** The short turns the writers flagged get extra takes, not padding (D-005 change 21). Examples: s1e02 l20 'और मैं?', s1b01 l23 'आपको पता था?', s1b03 l16 and l17 'तुम।' / 'हाँ। मैं।', and s1a03's three names.
  - **Product track.** `app/public/media/series1/series.json` lines 29 and 39 still carry the old meaning strings, and one of them uses यह. This is the third time it has been flagged (D-005, D-007). Sync both from `choice.A.meaning` and `choice.B.meaning` before the ballot screen is screened. It does not hold back the scripts.
- **Not verified:**
  - **Parse and counts.** No file was parsed and nothing was machine-counted, because this session has no shell. The character counts are the writers' and critics' hand counts; I did not recount.
  - **Projections.** They take one proof scene's pace (10 lines, a different cast) and apply it to this cast.
  - **What I read.** I read the files through Grep, in pieces. I read long action lines only where quoted above, so not every action line of every beat. I did not read the one-line review notes of s1e01 and s1b03 in full. For English beyond the lines quoted, I rely on the S5 check.
  - **Takes and frames.** I heard no take and viewed no frame.
- **Would change it:**
  - If S3 fails s1a02 twice, the next step is decided here.
  - The 150 s trigger in the length ruling.
  - If the owner watches the first finished episode and wants two minutes strictly, the trim orders are applied to every script not yet voiced. D-0M3's 800 measure then becomes the target.

## D-019 Gate 2: series2 scripts (A0 Arbiter, on Opus, 26 Nov ~10:30 IST)

Numbering: D-018 is the Series 1 Gate 2 entry, written minutes before this one, so this entry is D-019.

- **Question:** are the nine Series 2 scripts, in Hindi and English, ready for storyboards and voice? And D-0M3's question for Series 2: trim to about 800 dialogue characters before voice, or accept longer episodes?
- **Options:**
  - (a) Pass all nine as written.
  - (b) Pass the six that had a critic read and hold s2e02, s2a01 and s2b01 for theirs. No trim before voice: length is settled in the edit, as D-018 ruled for Series 1.
  - (c) As (b), and also trim all nine to about 800 characters before voice.
- **Evidence:**
  - **Critic (S3).**
    - Six reads pass: s2e01 7.7, s2e03 8.1, s2a02 7.9, s2a03 7.9, s2b02 7.9, s2b03 8.2. Each must-fix item is applied. What the writers declined is medium or minor: s2b02 medium 4, two optional items in s2a03, s2a02's [deadpan], and s2e03's ticket-booth note.
    - The three scores of 0 are not verdicts. The s2e02, s2a01 and s2b01 critic sessions stopped at their tool check (no Bash, no Write) and say in their own notes that they did not read the script. Those three have had no critic read.
  - **English (S5).** Scores are 7.8 to 8.3. All three must-fix items are in `script.en.json`:
    - s2e03 l26 is "If you tell me to, I will go. If you tell me to...".
    - s2b03 l12 now quotes s2b01 l24 word for word ("It's you I was waiting for."). I checked both files by Grep.
  - **Continuity (S4).** Its report is older than the files. Every item it gave to a writer is now in the scripts:
    - s2e02 b1, in both languages: token seven is on her right wrist in shot 1, goes into her left trouser pocket on l03, and is in the STATE note. This was the one high item.
    - No spoken Hindi line spells the surname 'Joshi' in Latin. s2a03 l02, l05 and l22 and s2b02 l23 and l26 read जोशी.
    - s2a01: the helmet is on the lobby bench in b1 and b2, set on the SHO's desk in b4, picked up in b5, and set down out of frame in b8. The look line and the actions agree.
    - The s2a02 tokens, the s2b01 notebook and the s2b02 memo pad are each placed in a look line before they appear.
    - Three items are still open. They are ruled below: the s2e02 neighbour's voice, Tripathi's bars in s2b03, and the key sets.
  - **My read.** I read the dialogue of all nine Hindi scripts, all of s2e02 including its action, and the action at both seams and in both finales, in part.
    - **The seams.**
      - s2e03 ends on one held frame: his wrists over the desk, her right hand holding the open cuffs, the wooden revolver between them, and l27 'इन्हें हथकड़ी लगाऊँ, या आज रात Inspector बनने दूँ?'.
      - s2a01 b1 opens on the cuffs closing on those wrists. Then come the arrest, and 'जी, madam।' and 'बस... cap रहने दीजिए।' as two lines (D-016 direction 11).
      - s2b01 b1 opens "on the held frame of s2e03 b10 with one change": her hand pushes his wrists down. Then come 'एक रात और। मेरी ज़िम्मेदारी पर।' and Pushpa's 'Madam, DSP साहब का order—', cut off. Then 'नाम मेरा ही लिखा जाएगा।', which answers the DSP's 'उसी FIR में उसका नाम होगा।' (s2e03 l17).
    - **Finale A, s2a03.**
      - FIR number one names the chief guest in the middle of the DSP's 'zero crime' speech.
      - 'दूसरी चाबी, SHO साहब।' pays off s2a01.
      - 'आठ सौ बोरी नहीं लौटेगी' and 'वो मेरे सामने से गई थी।' keep A's loss on screen.
      - She withdraws her transfer because thirty FIRs are pending. Then 'वर्दी नक़ली थी।' and 'काम असली था। Cap सीधी रखिए।'. The last line is 'Madam, bench भर गई है।'.
    - **Finale B, s2b03.**
      - D-016 direction 2 is in l01 to l07.
      - She quotes only recorded words: l12 matches s2b01 l24 without its 'आइए...'.
      - Direction 6 is l20, 'तीस FIR मैं लिख दूँगी, madam।'.
      - She is charged on her own statement (l17) and suspended (l18). The last scene pays off 'जो लिखो, बोलकर लिखो' (s2e02 l13) and the token (s2e01).
    - **The three unread scripts.**
      - I found no fault in s2e02, s2a01 or s2b01.
      - D-016 directions 4, 5, 9, 10, 11, 12 and 17 are in them.
      - `emotion_tags` matches the inline tags on every line: all 27 checked one by one in s2b01, by reading in the other two.
      - The s2a01 glimpse is marked to end on l08, 'रोकिए। काग़ज़ दिखाइए।'.
    - **Searches across all 18 files.**
      - No spoken यह or वह. No bare 'साहब'. Only Bhaiyaji says 'Inspector साहब'.
      - Each Hindi and English pair has the same number of line ids and speakers. Every script has 25 to 34 lines, inside 25 to 40.
      - Multiline searches found no comma before a closing bracket and no missing comma at a line break.
      - Every proof-script key is in every file. Twelve files add top-level metadata keys (`series_id`, `episode_id`, `branch`, `path_position`, `language_code`, `lead_character_id`, `locations`, `script_note`). Some also add beat-level `location` and `silent_position`. No file in `production/` mentions any of them.
  - **Length.** These are the writers' hand counts for Hindi, tags excluded:

    | Episode | Characters | target_total_seconds, hi / en |
    |---|---|---|
    | s2e01 | ~946 | 134.9 / 121.4 |
    | s2e02 | ~1,039 to 1,050 | 133.8 / 124.4 |
    | s2e03 | ~1,025 | 132.8 / 124.0 |
    | s2a01 | ~962 | 127.0 / 122.1 |
    | s2a02 | ~943 | 128.0 / 119.5 |
    | s2a03 | ~988 | 131.1 / 122.4 |
    | s2b01 | ~854 | 124.5 / 120.1 |
    | s2b02 | ~976 | 134.7 / 130.8 |
    | s2b03 | ~1,008 | 131.5 / 114.3 |

    - All nine are at or under D-016's ~1,050, and none is padded.
    - The writers set their targets slow after Gate 0b, at about 8.6 to 8.8 characters a second (s2e02 and s2e03 say so).
    - At the photoreal proof's measured 8.4 a second (D-018), the nine project to about 130 to 140 s. This is my estimate.
    - The Series 2 cast's own casting takes (`content/series2/casting/manifest.jsonl`, one take each) run faster. Ten of them have words that match a script line or pair of lines:
      - Nine came in at or under the script's target, by 1 to 43 per cent. The biggest gap is Nirala's 'Arrest आपका हक़ है, madam।...' (s2e02 l01 and l02): 4.88 s against 8.5 s.
      - One ran 6 per cent over: Bhaiyaji's laugh line (s2b01 l24), 5.52 s against 5.2 s.
      - The casting tags differ from the scripts' tags, and the manifest does not record the model.
  - **Vote balance.** The s2e03 critic reads the vote at 45 A to 55 B, inside D-004's 65/35. D-016's `dial_1` trigger is not met.
- **Decision: (b).**
  - **Six pass Gate 2 in both languages** and go to storyboard and voice now: s2e01, s2e03, s2a02, s2a03, s2b02 and s2b03.
  - **s2e02, s2a01 and s2b01 are held** for the S3 read they never had.
    - As in D-018: that read is the plan's script gate (section 5), and my own check does not replace it.
    - Their storyboards, frames and voice wait for it. So do both glimpses, which are cut from s2a01 and s2b01.
  - **Length (D-0M3): no trim before voice. D-018's length ruling applies to Series 2 unchanged.**
    1. The measure stays at about 1,050 characters, tags excluded, no padding. I do not move it under D-016's proportion clause: nothing measured shows this cast speaking slower than the targets assume.
    2. The ceiling on finished time is 150 s for each language cut. "About two minutes" stays the aim.
    3. Silences are shortened first, then lines are cut in the script's own trim order. s2e01, s2e02, s2a01, s2a02, s2b01, s2b02 and s2b03 have one in `writer_notes`. s2e03 and s2a03 name holds only, so their first line cut is decided here (D-016). No trim drops a protected line or a balance line.
    4. Trigger: if the first two finished Series 2 episodes both run over 150 s with their silences already shortened, the trim orders are applied, in Hindi and English, to every episode not yet voiced.
  - **Rulings on the three open continuity items (no script change):**
    - **The neighbour's call.** s2e02 l10 'निराला जी!' stays with `neighbour_voice`, as a call from the bench, off frame.
      - The bible contradicts itself here. Its b3 outline asks for "a voice" to call him, and its minor-character list says the neighbours do not speak. The call is how the viewer learns that the town calls him निराला जी, so the outline wins.
      - S10 voices it with an existing minor voice (default: door3_man's) and designs no new one.
      - S1's errata adds it to `voices_only` and corrects the s2e02 "silent" note.
    - **Tripathi's bars.** He keeps his three bars in s2b03. No order suspends him on screen, while hers is handed to her. S6 and S7 draw the bible look.
    - **Key sets.** No file is rewritten. The proof keys are the required set and the extras are metadata, as in D-018.
  - **Not (a):** three scripts have had no critic read.
  - **Not (c):**
    - The projection is about 2:10 to 2:20 against a 2:30 ceiling, and this cast's casting takes point shorter.
    - An 800 cap would cut 6 to 24 per cent from all nine scripts, which are already under their measure. Much of it would fall on protected lines in s2e02 and s2e03.
    - It would cost nine writer passes plus the critic, English and continuity rounds again, on a model allowance that is already short (D-0M1).
- **Must fix: s2e02, s2a01 and s2b01 only.**
  1. S3 reviews each of the three on Opus (D-0M1).
     - The brief says that no shell is needed and that it must not stop at the tool check. It works by hand count and Grep, as the six did.
     - If it cannot write files, it returns the review in its result, and S2 saves it word for word into that episode's `review-notes.json`.
     - For s2a01 and s2b01 it also checks each glimpse against its `must_not_reveal` list. Glimpse A ends on l08.
     - For s2e02 the neighbour-voice ruling above stands, and S3 does not reopen it.
  2. If S3 passes an episode at or above the threshold:
     - S2 applies the must-fix items.
     - S5 mirrors them in `script.en.json`.
     - The episode goes to storyboard and voice without coming back here.
  3. A fail goes through the usual two rounds. It comes back here if it fails twice, or if a must-fix touches another episode, the s2e03 seams, a glimpse limit, a lock or a balance line.
- **Next steps (not holds on the six):**
  - **Parse and count, as in D-018.** Before an episode's storyboard or voice, the first step with a shell parses its two script files and machine-counts the dialogue characters, tags excluded.
    - A parse error is fixed mechanically by S2 and does not come back here.
    - If the count is over 1,100, that script's trim order is applied before voice.
  - **Continuity.** S4 marks the items above as fixed in `continuity.json` and the review notes, and sets s2e02's continuity to ok true.
  - **Storyboards (S7).** "No set-up past 8 s" applies to measured clip lengths, not to targets. Where a voiced line runs long, its set-up is split with an insert.
  - **Voice (S10).**
    - The short turns the writers flagged get extra takes, not padding. Examples: s2e03 l01 'भैयाजी।', s2a01 l02 'जी, madam।', and s2e02 l10, l11, l14 and l24.
    - 'Force' stays feminine (D-016 direction 12). No critic overruled it.
- **Not verified:**
  - **Parse and counts.** No file was parsed and nothing was machine-counted, because this session has no shell. The character counts are the writers'; I did not recount. The structure checks are pattern searches, not a parse.
  - **Projections.** 8.4 a second comes from one proof scene with a different cast. My casting comparison is ten lines, one take each, counted by hand, with different tags and an unrecorded model.
  - **What I read.**
    - I read the files through Grep, in pieces.
    - I read long action lines only in part: most of the action in s2a03 and s2b03, the s2b01 action after b3, and the s2a01 b6, b10 and b11 action past their first sentences.
    - Of the six critic reviews, I read the writer responses and statuses, not every item in full.
    - In English I read only the lines named above. The rest rests on S5's check.
  - **Takes and frames.** I heard no take and viewed no frame.
- **Would change it:**
  - If S3 fails any of the three twice, the next step is decided here.
  - The 150 s trigger in the length ruling.
  - If the owner watches the first finished episode and wants two minutes strictly, the trim orders are applied to every script not yet voiced. D-0M3's 800 measure then becomes the target.

## D-020 The voice gate and the English scripts (A0 Arbiter, on Opus, 26 Nov ~10:45 IST)

- **Question:** does the 1,100-character gate in D-018 and D-019 ("If the count is over 1,100, that script's trim order is applied before voice") apply to `script.en.json`? The S10 voice directors stopped English voice on it. Does English need its own measure, or only the 150 s ceiling? And what happens now to the stopped episodes?
- **Options:**
  - (a) The gate applies to English as written. Every English script over 1,100 is trimmed before voice.
  - (b) English gets its own measure, scaled from the Hindi one by measured pace. Episodes under it are voiced in both languages now.
  - (c) No character gate for English. Only the 150 s ceiling per cut, and the trigger.
- **Evidence:**
  - **Where the figure came from.** The measure (D-005 change 9, D-006 change 8, D-007 direction 1, D-016 direction 7) was set from Hindi counts before any speech was measured. It exists to predict finished time. D-007 and D-016 already say it moves in proportion to a measured rate. D-018 and D-019 added 1,100 as the stop-before-voice point and named no language. They were written before any English count existed.
  - **S10 counts (machine; tags removed, whitespace collapsed; as given in my brief):**
    - Hindi: every cleared episode is under 1,100 (s1e02 1,044, s2e03 1,025, s2b03 1,001).
    - English over 1,100: s1e02 1,286, s1b01 1,102, s1b03 1,211, s2e03 1,168, s2a02 (figure in the S10 report, not in my brief or any file), s2a03 1,199, s2b02 1,150, s2b03 1,199. That is eight episodes. The brief says seven.
    - English under: s1e01 1,077, s1a01, s1a03, s1b02, s2e01.
    - English against Hindi, on the three pairs with both figures: 1.23 (s1e02), 1.14 (s2e03), 1.20 (s2b03).
  - **s2a02, my hand count:** about 1,180 over its 29 English lines.
  - **Measured pace (my counts of both proof scripts, and my sums of the voice manifests).** I counted code points with tags removed. My photoreal Hindi figure is 283, the same as D-018's, so the method agrees.

    | Proof scene | Characters, hi / en | First-take speech, s, hi / en | Characters a second, hi / en | Finished cut, s, hi / en (D-0M4) |
    |---|---|---|---|---|
    | Photoreal | 283 / 312 | 33.5 / 31.9 | 8.4 / 9.8 | 37.1 / 35.9 |
    | Flat 2D | 299 / 371 | 33.6 / 33.0 | 8.9 / 11.2 | 39.3 / 39.0 |

    - For the same lines, English carries 10 and 24 per cent more characters than Hindi. It runs no longer, either in speech or in the finished cut.
    - English speaks 1.16 (photoreal) and 1.26 (flat 2D) times as many characters a second as Hindi. Pooled: 1.21.
    - So a Hindi 1,100 is worth about 1,275 English characters at the slower ratio, about 1,335 pooled and about 1,390 at the faster ratio.
    - The series scripts' English-to-Hindi ratios (1.14 to 1.23) sit inside the range of the proofs (1.10 to 1.24), and in both proofs English did not run longer.
  - **The closest case (my projection).** s1e02 English at the slower English pace is about 132 s of speech, against about 124 s for its Hindi. D-018 projected the Hindi cut at about 144 s, so the English cut could finish near 150 s. At the faster pace it is about 115 s of speech.
  - **Plan:** S5 writes English with "same beats and timing intent" (section 5), and English is a full adaptation by the same cast (section 2). D-018 and D-019 checked that each pair has the same line ids. Section 7.8: no stuck item holds up the rest.
- **Decision: (b). D-018 and D-019 are amended as follows.**
  1. **1,100 is a Hindi figure.** It does not apply to `script.en.json`. Measured pace says it would stop English scripts that run no longer than their Hindi.
  2. **The English measure is about 1,250 characters, and the English gate is 1,300.** Both use the same count: code points, spaces and punctuation included, no tags or speaker labels.
     - 1,300 is 1,100 scaled by measured pace. It lies between the slower-scene figure (about 1,275) and the pooled one (about 1,335).
     - It is rounded, because two scenes do not support anything finer.
  3. **What each gate triggers:**
     - **Hindi over 1,100:** unchanged. The trim order is applied to both files and both are recounted.
     - **English over 1,300 with its Hindi under 1,100:** S5 tightens the wording of the longest English lines. Line ids, speakers and meaning stay, and so does every protected or balance line. No line is cut and the Hindi file is not touched. The English is then recounted.
     - A line leaves the story only through the Hindi gate or the 150 s trigger, and then in both languages.
  4. **The time ceiling governs English unchanged.** It is 150 s per language cut and is settled in the edit, silences first and then the script's trim order (D-018 rule 3).
     - For the trigger, an episode counts as over if either of its cuts runs over 150 s with silences already shortened.
  5. **The stopped episodes get no trim pass. S10 writes takes for both languages now:**
     - s1e02, s1b01, s1b03, s2a03, s2b02 and s2b03.
     - s2e03 in English only, since its Hindi takes exist.
     - s2a02 too, if its machine figure in the S10 report is at or under 1,300. My hand count is about 1,180.
     - The highest English count is s1e02 at 1,286, under the gate.
  6. **s1e02 is the one to watch.** It is 14 under the gate and about 12 over the slower-scene figure. It is voiced as written. If it is among the first two finished Series 1 episodes, its English cut is this ruling's first test.
  - **Not (a):**
    - It would trim eight English scripts that the only measurements say run no longer than their Hindi.
    - Cutting English lines alone would break the line-for-line pairing. Keeping the pairing would mean cutting Hindi that already clears its own gate.
    - It costs one S5 pass per episode plus re-checks, for no measured gain.
  - **Not (c):** S10 already counts, so an English check before voice costs nothing. It catches what the Hindi count cannot: an English adaptation grown wordy against its own Hindi. Without the check, that is found only after the English voice is paid for.
- **Next steps:**
  - **S10, both series:** resume the episodes in decision 5 now. The parse-and-count step stays. Each report gives both counts: Hindi against 1,100 and English against 1,300.
  - **S5:** when it mirrors must-fix items into the held episodes (s1a02, s2e02, s2a01, s2b01), it keeps English near about 1,250 and at or under 1,300.
  - **S13:** logs each finished cut's length per language and states whether silences were already shortened. The trigger and the items below are read from that log.
- **Not verified:**
  - **S10 counts.** Taken from my brief. I reran none by machine, because this session has no shell. The s2a02 figure is my hand count, and I have not seen the S10 report's figure.
  - **Proof figures.**
    - Character counts are by hand.
    - For photoreal I used manifest rows 1 to 20, the first take of each line. For flat 2D I used the first v4 take of each line (rows 1 to 24). These are not necessarily the takes in the cut.
    - The finished-cut lengths are D-0M4's.
    - I counted ड़ as two code points. If the files hold the precomposed letter, the Hindi counts fall by one per instance, which moves no ratio by more than a fraction of a per cent.
  - **Pace ratios.** They come from two scenes of 10 and 12 lines, voiced by casts other than the series casts. Whether the series casts speak English faster than Hindi by the same margin is untested.
  - **Takes and cuts.** I heard no take and watched no cut.
- **Would change it:**
  - Either of these drops the English gate to 1,275 for every episode not yet voiced, and S5 tightens any English script over it:
    - a finished English cut runs more than about 5 per cent longer than its Hindi cut, with the same silences;
    - s1e02's English cut runs over 150 s with silences shortened while its Hindi cut does not.
  - Once the first finished episodes give a measured English-to-Hindi pace ratio for the series casts, the English gate becomes 1,100 times that ratio, rounded down to the nearest 25.
  - If the owner wants two minutes strictly (D-018, D-019), 800 becomes the Hindi target and the English target scales by the same ratio, to about 950.

## D-021 Gate 3: visual bibles (A0 Arbiter, on Opus, 26 Nov, after D-020; this session has no clock)

- **Question:** do the visual bibles for Series 1 (47 assets) and Series 2 (52 assets) pass Gate 3 now that each has had one check and one fix round? Which series-wide style frame does each series attach to the first frame of a new scene (D-013 rule 2)?
- **Options:**
  - (a) Pass both with the remaining drift logged, and name a plate with no people in it as each series' style frame.
  - (b) Pass both, but hold all frame work until the visual checker has re-checked the 27 regenerated assets at full resolution.
  - (c) Order second retakes now for the one reject-list fault still showing (Mausi's right-profile stud), plus the five Mausi pair sheets that depend on her sheet.
- **Evidence:**
  - **What I looked at.** I viewed each file whole at 1125x2000. I made no crops.
    - Series 1: all 9 character sheets, all 12 pair sheets and all 13 plates.
    - Series 2: all 9 character sheets, all 15 pair sheets and all 7 plates, plus the raw of pair_nandini_dsp.
    - I opened no prop sheet in either series.
  - **Series 1: the fixes hold.**
    - Kiran's henna: kiran_p1, kiran_p2 and all seven Kiran pairs show her palms to camera with the disc on the palm. No back of a hand that I can see carries a disc.
    - kiran_p3: the right cuff is on and the left forearm bare. The scar is a pale crescent in the lower third of the forearm, still higher than kiran_hands view 3 (already logged).
    - mausi: one stud, picture-right, in the front close-up. A stud still shows in her right profile (logged).
    - pair_mausi_chhoti: Chhoti's left wrist is bare. The only orange I can see is on the fingertips of her left hand (picture-right), which her lock allows. I see none on the hand holding the phone.
    - lane_night: the house has an iron door with a latch and no shutter, and no hanging lamp shows in the window. The door reads as two leaves, where stairwell_down shows one (logged).
    - Sides hold in every front view: Kiran's ring and pallu or dupatta, Aditya's watch, and Mausi's keys and pallu are all picture-right; Billu's toothpick and key and Chhoti's braid, phone and bangles are all picture-left.
    - Chhoti reads as an adult woman on both of her sheets and in all three of her pairs. By eye, every pair face matches its single sheet.
    - The 13 plates match the geography in `style.json`. I saw no person, no readable text and no ceiling fan in the bedroom. The car is right-hand drive.
  - **Series 2: the fixes hold.**
    - bhaiyaji and all five Bhaiyaji pairs: a plain kurta with no patch. Keys picture-left, watch picture-right, sunglasses pushed up.
    - dsp and all five DSP pairs: one broad band and rimless glasses. The cane is gripped at the belt on picture-right and runs up towards the armpit (logged). It never sticks out sideways.
    - talkies_lobby: five small blank tokens hang on one loop, and the stair starts from the floor.
    - lane_doorway: night blue, except a warm spill that is larger than asked (logged).
    - Wardrobe sides and ranks hold in every front view: two bars for Nandini, three for Nirala and Tripathi, one for Pushpa, one band for the DSP.
  - **Heights.** By eye, every pair looks right. Eye readings are not measurements, though. On pair_nandini_dsp my first reading of the png was about 4 per cent off, and the raw then showed her crown at his eye line, which agrees with S6's measured 0.939. So pair heights rest on the checker's and S6's measurements, not mine. The closest to the 3 per cent limit is pair_aditya_chhoti, at about 0.87 against 0.847 (logged).
  - **New from my look, in neither report.** All four are preview-only and unverified.
    - Mausi: a gold-coloured mark on a finger of her picture-left hand that may be a ring. It shows on her sheet's front view and in pair_kiran_mausi_p1, pair_kiran_mausi_p2 and pair_mausi_chhoti. Her lock says no rings.
    - nirala and nirala_p1b: the side view (nose to picture-right, so his right side faces camera) shows no holster on his hip. The front views are correct.
    - godown: the truck cab in the plate reads nearer orange than dull ochre.
    - lane_night: a small mark on the car's boot lid may be a badge.
  - **Retake checks.** In both fix rounds, the only check on the new images was by the S6 session that made them. The visual checker has not looked at any of the 27 regenerated assets. D-015 rule 5 asks for one check and one retake check.
  - **Style frame.**
    - Any frame with a person in it can carry that face, a wardrobe period or a prop state into scenes where it does not belong. D-017 lists anchor spread as untested. A plate carries none of these.
    - Series 1: the bedroom is the main set of s1e01, s1e02 and branch B. `bedroom_bed` shows both light sources of the series look: the amber lamp, and cool streetlight through the grille.
    - Series 2: `real_thana` is named in more script lines than any other plate, across s2e01, s2e02 and s2a01 to s2a03. It shows the full drawing idiom: outline weights, flat cel shading, a flat light shaft and the dusty palette.
- **Decision: (a). Option (b)'s full-resolution check still runs, but alongside storyboards rather than in front of them.**
  1. **Series 1 passes.** All 47 pngs in `content/series1/refs/` are the reference set for Phase 4.
  2. **Series 2 passes.** All 52 pngs in `content/series2/refs/` are the reference set for Phase 4.
  3. **Style frames for all of Phase 4.** These are not stand-ins until an episode anchor exists: a plate cannot carry a face or a state into another scene, and an anchor can.
     - Series 1: `content/series1/refs/bedroom_bed.png`.
     - Series 2: `content/series2/refs/real_thana.png`.
     - Each is attached last, in the anchor's slot, only on the first frame of a new scene.
     - The prompt labels it: "Image N is the series style frame. Match only its rendering. Do not copy its room, furniture, props or light; the light comes from the LIGHT line." What "rendering" means:
       - Series 1: grade, grain, lens, skin and surface texture.
       - Series 2: outline weights, flat cel shading, palette, flat light shapes.
     - When the scene's own plate is the same file, attach it once.
  4. **Logged drift is accepted.** Each asset has used its one retake (D-013 rule 11). How each drift is handled:
     - **Mausi's right profile:** no close right profile of her. If a shot needs one, the prompt says no stud is visible on that side.
     - **Kiran's scar:** kiran_hands view 3 sets where it sits.
     - **pair_aditya_chhoti:** the shot prompt keeps her crown at his collar.
     - **lane_night:** frames of the street door follow stairwell_down.
     - **lane_doorway:** night shots restate the small pool of light.
     - **Lobby tokens:** inserts use token.png.
     - **Plate details:** the one-handed clock in real_thana and the extra lamp in projection_room stand as drawn.
  5. **No second retake now.** The only reject-list fault left is Mausi's profile stud. It shows in one view that the storyboards can avoid. A second take would also force the five Mausi pairs to be regenerated: six generations for one avoidable view.
  6. **Retake check.**
     - **Who and when:** the visual checker, with a shell. It runs in parallel with storyboards, and it must finish before the first anchor that attaches any sheet it names.
     - **Series 1, full-resolution crops of:**
       - Mausi's nostrils and her picture-left hand, on mausi and her five pairs;
       - the backs of Kiran's hands on the seven Kiran pairs;
       - Chhoti's hands and wrists on pair_mausi_chhoti;
       - the scar against the cuff band on kiran_p3;
       - the car's boot lid on lane_night.
     - **Series 2:**
       - Bhaiyaji's kurta front, on bhaiyaji and his five pairs;
       - scripted height measurements on the nine regenerated pairs;
       - the tokens on talkies_lobby and the walls of lane_doorway, for text;
       - the truck colour on godown and Nirala's side holster, as notes only.
     - **What a finding triggers:**
       - A confirmed fault that changes how a person reads (face, age, a side error, a mark the story turns on) gets the second take the sheet gate allows. The sheets that depend on it are regenerated with it.
       - Anything else is written into the lock under D-013 rule 4, or logged. That includes a ring on Mausi: frames keep it consistently, and no image is remade for it.
  7. **Lock rewrite (D-013 rule 4) before any story frame.** S6 rewrites every character_lock and wardrobe_lock in both `style.json` files from the approved sheets, and records there:
     - Kiran's henna as drawn: the disc on her palms, the backs of her hands plain.
     - The DSP's cane and Bhaiyaji's key finger, as drawn.
     - The size of Nirala's medal, and his holster stated for side-on shots.
     - Mausi's profile rule.
     - The two style frames, replacing "none exists yet" in Series 1's usage notes.
  8. **Faces per frame stay at two** (D-007 direction 16, D-016 direction 14). Gate 3 made line-up sheets, not frames with three faces, so the condition for raising the limit has not been met.
  - **Not (b):** holding frames would also hold storyboards, which need no images. The check is just as useful if it finishes before the first anchor.
  - **Not (c):** see decision 5.
- **Not verified:**
  - **My look.** I had no shell, so I made no crops and no measurements. Nostrils, the backs of hands, wrist bangles, keypads, text-free surfaces and hex colours are the checker's and S6's findings, not mine.
  - **Prop sheets.** I opened none of the 13 in Series 1 or the 21 in Series 2. That includes `photograph`, whose gate items rest on the checker's full-resolution look.
  - **Style frames:**
    - whether a plate attached as a style frame pulls its room or props into other settings (the label is the only guard);
    - whether a night plate (Series 1) darkens day scenes, or a day plate (Series 2) brightens night scenes.
  - **Heights in story frames.** Whether Codex holds height from the line-up sheets there is still untested (D-017).
- **Would change it:**
  - **Style frame copied into other scenes.** If wave 1's first-of-scene frames copy the style frame's room or props in more than one frame in five, the style frame is dropped from those frames and its slot goes to a prop sheet. The bedroom's garlands or grille, and the thana's fan, shield or almirah, are what to watch for.
  - **Wrong light inherited.** If first-of-scene frames inherit the style frame's light, a second style frame is used for the other light: `bureau_front.png` for Series 1 day scenes, `crossing_stall.png` for Series 2 night scenes. This entry is then amended.
  - **Retake check finds a fault.** If it confirms a fault that changes how a person reads, that sheet and its dependants are regenerated once more before their first anchor, and the result is logged here.
  - **The owner disagrees.** If the owner looks at the sheets and disagrees with any face, the owner's view governs.

## D-022 Whispered takes where a voiced read is wanted, Kiran's backup, and s2b03 l12 (A0 Arbiter, on Opus, 26 Nov ~11:25 IST)

- **Question:** what one retake rule applies, in both series, when a line whose note wants a voiced read comes out whispered or breathy? Do quiet tags come out of the retake rungs not yet used? Does Kiran move to Rudrika (`2kb0BzqPNMYVxWCj9dqt`) now? What happens when the last allowed take still whispers? Is s2b03 l12's "भैयाजी की आवाज़ में:" / "In Bhaiyaji's voice:" a stage direction inside the line text?
- **Options:**
  - Retake text: (a) each reviewer picks the rung, as now ([low voice], [calm] or the bare line); (b) [low voice], then [calm], then the bare line (most Series 1 ladders); (c) no quiet-family tag in any retake: [calm] first, then the bare line, with the level set in the mix.
  - Kiran: (a) switch to Rudrika now; (b) switch only if quiet-free retakes still whisper on her and not on the others.
  - s2b03 l12: (a) move the frame out of the line text and accept the take; (b) keep it as dialogue and retake it for missing words.
- **Evidence** (S10 reviews: local whisper.cpp plus voiced-frame ratio; nobody has listened):
  - **The fault follows the tag, across voices and both series.** [quietly] or [low voice] came out whispered on six voices: Kiran (Yashvi G), Aditya (Amit Wadhwa), Billu (Bunty), Mausi (Savitri), Nandini (Apsara) and the Series 2 DSP. Examples:
    - kiran_t3: 0.23;
    - s1a01 Billu: hi l16 0.38, en l16 0.23;
    - s1a01 Aditya: hi l04 and l20;
    - s1a03 Mausi: hi l06, en l06 and en l22, 0.09 to 0.17;
    - s2a03: DSP en l05 0.09, Nandini en l21 0.10.
  - **[low voice] does not fix it.** Measured retakes:
    - Kiran: s1e01 hi l16 first sentence 0.07 to 0.11; s1e01 en l16 0.35 to 0.53; s1b01 en l01 0.52.
    - Aditya: s1e01 hi l04 0.25.
    - Its only pass is casting aditya_t4, at 0.61.
  - **[calm] and untagged lines stay voiced wherever I found them measured:**
    - Kiran's untagged and [calm] Hindi lines in s1b01: 0.70 to 0.90;
    - Aditya s1a01 hi l14: 0.88;
    - s1e02: 0.73;
    - s2b01: 0.69 to 0.93;
    - s2b03: 0.71 to 0.90.
    - I found no take where [calm] itself whispered. The breathy half of s2a02 en l04 is its [quietly] half. No bare-line retake has been measured yet.
  - **The voices can do quiet and voiced when the tag lands.** kiran_t2's [quietly] half dropped 6 to 7 dB and stayed at 0.87 to 0.88. Aditya's English [quietly] in s1a01 measured 0.69. So the whisper is v4 reading the tag, not a property of one voice.
  - **Reviewers chose three rungs for one fault:** [low voice] in s1e02, the bare line in s1b01, [calm] in s1a01. They also used three triggers: 0.6 in some notes, "this series' 0.35 whisper line" in s1b01, and a centroid-and-flatness signature in s1a01.
  - **Asymmetry:** a voiced take can be brought down in the mix; a whisper cannot be made voiced.
  - **Scale.**
    - All 956 lines in the 34 takes files have a first take (manifest rows with `"take": 1`).
    - 222 first-take texts carry a quiet-family tag (my grep).
    - About 20 whisper retakes are queued, and four Series 1 reviews are still running.
    - A retake costs about 30 to 50 credits; about 63,000 of 730,916 are used.
  - **Kiran.**
    - `kiran.switch_if` names Rudrika if "a [low voice] retake of kiran_t3 also comes out whispered".
    - The alarm line's [low voice] take (s1b01 en l01, take 2) measured 0.52 with flatness 0.078. That is between her plain English lines (0.68 to 0.88) and the kiran_t3 whisper (0.19 on that reviewer's method).
    - Its reviewer did not switch on numbers alone and queued the bare line as take 3.
    - Rudrika is untested, and her preview (276 Hz) sits nearer Chhoti's takes (308 Hz).
    - A switch means a casting test, new pair checks and re-voicing her lines in 8 episodes, about 8,000 to 10,000 credits.
  - **s2b03 l12 is dialogue by design.**
    - D-006 change 11's default already put "भैयाजी की आवाज़" in Nandini's spoken line.
    - The script's own note (script.hi.json) moved the attribution to the front so that she does not sound as if she is calling someone a fake inspector.
    - Shot plan b6 cuts on it: "l12 from 'In Bhaiyaji's voice:' up to 'Inspector!'".
    - Both takes dropped it. In the Hindi take the run before the colon lasts 0.6 s and is heard as 'भैयाजी' alone.
    - The same voice spoke the frame in full, in both languages, on s2a03 l11 ("All thirty have the same line: '…'") and on s2b01 l12 ("say: '…'"). So the colon is not the trigger. The likely trigger is that "in Bhaiyaji's voice" reads to v4 as a performance instruction.
  - **My grep of all 34 scripts.**
    - No other line frames a quote with "in X's voice" or "X की आवाज़ में".
    - The colon-and-quote form occurs only in s2a03 l11, s2b01 l12, s2b03 l12, s2e01 l08 and s2e01 hi l24. None is in Series 1.
    - s2e01's review ran without transcripts, so the frames in its l08 and l24 have not been checked.
- **Decision: (c) for the retake text, (b) for Kiran, (b) for s2b03 l12.**
  1. **The rule, for all pending and future retakes in both series.** The line for runners:
     > **Voice-wanted line and a take under 0.6 voiced (the whole take, or any segment of 0.5 s or more that carries script words): the retake is the script text with every quiet-family tag deleted and the other tags kept, plus [calm] only if no tag is left. If that take is still under 0.6, send the bare line. At the D-011 cap, accept the most-voiced take that has all its words, and log it.**
     - **Voice-wanted:** the note says voiced, fully voiced, not or never whispered, retake if whispered, or must be heard.
     - **Whisper-wanted:** the note says the line must be whispered.
     - **Other lines:** a line whose note says neither is not retaken for voicing (D-0M2).
     - **Quiet family:** [quietly], [low voice], [softly], [hushed], [whispers], [whispering], [whisper], [murmurs], [murmuring], [under his breath], [under her breath], [small voice], [breathy], [barely audible], [sotto voce]. [gently], [calm], [flatly] and the emotion tags are not in it.
     - **Retakes for other faults.** Any retake of a voice-wanted line uses the same quiet-free text, whatever its reason (a wrong word, a spoken tag). A whispered take is never retaken as written, and [low voice] is never a retake rung.
     - **Level and logging.** The edit brings the take down to the note's level. Subtitles stay the script text. The manifest logs the text actually sent.
     - **Queued retakes.** The rule replaces the reviewers' rungs on every retake already queued:
       - s1e01 hi l04, hi l16, en l16;
       - s1b01 hi l14, hi l28, en l01, en l14, en l17;
       - s1e02 hi l07, hi l17, en l07, en l22;
       - s1a01 hi l04, hi l16, hi l20, en l16;
       - the whisper retakes from s1a03, s1b02, s2a03 and s2b03;
       - all reviews still running.
       - A rung a line has already used is skipped. If [calm] was take 2, take 3 is the bare line.
     - **Passed takes stay passed.** A take a reviewer has already passed is not reopened under the 0.6 figure.
  2. **A whisper-wanted line that comes out voiced** (a lost whisper, such as s1a01 hi l24) gets one retake on `eleven_v3`, with [whispers] and the script text. The tag is already the simplest, so v3 is the next step in plan 7.8. If that take is still voiced, accept and log it. v3 is used for that line only, and the manifest records the model.
  3. **Takes files: S10 writes the changes, in all 34 files across both series.**
     - **Ladders.** For every voice-wanted line, the ladder in `note` becomes:
       - rung 1, the rule text;
       - rung 2, the bare line;
       - then whatever came after the bare line in the old ladder (in Series 2: eleven_v3 with the script text, then the recast note).
       - Every rung that carries a quiet-family tag is deleted, including "retake as written" where the script text has one. Duplicate rungs are dropped.
     - **Strike** the instructions that send a [low voice] whisper to `kiran.switch_if`, and every "go to [low voice]" or "no second [quietly] try" instruction.
     - **Whisper-wanted lines** keep [whispers] and gain the v3 rung from rule 2.
     - **`text` stays the script text.** It records take 1, and every first take exists.
     - Each changed note cites D-022.
     - **Review files.** S10 writes the rule's text into `retake_text` for every queued retake.
     - **cast.json.**
       - `kiran.production_direction`: no [low voice]. Quiet lines go out with [calm] or as the bare line, with the level set in the mix.
       - `kiran.switch_if`: the clause in rule 4.
  4. **Kiran stays on Yashvi G. She does not switch now.**
     - The whisper clause in `switch_if` tested the tag, not the voice, and the same tag now fails on six voices.
     - **New clause:** a switch is tested only if Kiran's final take is still under 0.6 after the [calm] and bare rungs on 3 or more voice-wanted lines, across at least 2 episodes, while at least half of the other Series 1 voices' quiet-free retakes pass.
     - **If the clause is met:**
       - S10 runs Rudrika's four casting lines, about 300 credits, with kiran_t3 as "[calm] Mausi... the milk has split.";
       - S10 runs the Chhoti and Mausi pair checks;
       - the result comes back to the Arbiter before anything is re-voiced.
     - The ear clauses are unchanged and stay with the owner: two actors, the same read, or American or British drift.
  5. **At the cap, D-011 applies.**
     - Accept the take with the highest voiced ratio among those with all their words.
     - Log it in the manifest and the morning report.
     - Put it on the owner's ear list as "whispered where voiced wanted, accepted at cap".
     - **One exception:** a line the takes note marks locked or protected (the s1b01 en l01 alarm line, s1b01 hi l14) gets one take past the cap, on the next unused rung. Then it is accepted and logged.
  6. **s2b03 l12 is not a stage direction, and its take is not fine.** It is a missing-words retake.
     - The frame stays in the line text, and S5 changes no script.
     - The retakes send the same words with punctuation changed, so that the frame does not read as an instruction, and without the quiet tag (Nandini's note: low, clear, exact).
       - **Take 2:** hi "[calm] भैयाजी की आवाज़ में, 'नक़ली Inspector! आप ही का तो इंतज़ार था।'"; en "[calm] In Bhaiyaji's voice, 'Fake Inspector! It's you I was waiting for.'"
       - **Take 3:** the same words with no tag and no quote marks.
       - After that, rule 5 applies. Subtitles keep the script's colon and quote marks.
     - **s2e01 check.** S10 transcribes s2e01 hi and en l08 and l24, and checks that their frames are spoken ("तो लिखवाइए, madam", "Then kindly dictate, madam", "SHO त्रिपाठी ने कहा"). If a frame was dropped, that line gets the same punctuation-only fix.
     - **For S5, from now on:** no spoken line frames a quote with "in X's voice" or "X की आवाज़ में".
  7. **Other word retakes** go ahead on their ladders as normal: s2b03 hi l03, l13 and l17, en l17; s1b02 hi l16 and l21. Rule 1's quiet-free text applies wherever the line is voice-wanted.
- **Not (a) for the rule:** it is what produced three rungs for one fault.
- **Not (b) for the rule:** [low voice] failed on every measured retake for Kiran and Aditya.
- **Not switching now:**
  - The fault is on six voices in two series, so a new voice reading the same tags is likely to fail the same way, and it is untested.
  - It would cost about 8,000 to 10,000 credits, plus a test and new pair checks.
- **Not moving l12's frame:** it would bring back the ambiguity the writer removed, and the story needs the attribution.
- **Not verified:**
  - **Nobody has listened.** Voiced ratio stands in for the ear. A take at 0.55 may sound fine, and one at 0.62 may sound whispered.
  - **I re-ran no measure.** I read review rows in s1e01, s1a01, s1b01, s2a02, s2a03, s2b01, s2b03 and s2e01. The s1a03, s1b02 and s2a03 whisper figures come from the coordinator.
  - **[calm] on Mausi in quiet scenes:** not measured. It is measured on other voices and on Kiran's s1b01 Hindi lines.
  - **The comma variant for s2b03 l12:** untested.
  - **The count of 222** comes from a grep over the tag spellings above. The five frame lines are a grep result too, not a read of every line.
- **Would change it:**
  - **[calm] fails too often.** If more than 3 of the first 10 rule-1 retakes ([calm]) come back under 0.6, the bare line becomes rung 1 and [calm] rung 2.
  - **[calm] sounds wrong on Mausi.** If the owner hears [calm] takes on Mausi's code lines as flat or cold, her rung 1 becomes [gently]. Her casting take mausi_t4 stayed voiced on it.
  - **Kiran's clause is met.** If the clause in rule 4 or the owner's ear clause is met, the casting test runs.
  - **The l12 frame is still dropped.** If the comma variant of s2b03 l12 still drops it, S5 writes a wording v4 speaks (for example "ये भैयाजी की आवाज़ है:"). Script and subtitle change together, and the line is logged as a script change.
  - **The owner disagrees.** The owner's ear overrides any of this.

## D-023 Gate 4, wave 1: s1e01 and s2e01 (A0 Arbiter, on Opus, 26 Nov ~13:30 IST)

- **Question:** do s1e01 and s2e01 pass Gate 4? Does the method change before wave 2 (frame budget, retake rate, length, and the "would change it" conditions in D-015, D-017 and D-021)? Which voice fixes need the orchestrator's ElevenLabs runner?
- **Options:**
  - s2e01: (a) pass at the screening's 7/10 and route the owed work as completion; (b) hold the pass until the slates are replaced.
  - s1e01: (a) pass on the editor's scratch diagnostic; (b) leave it unjudged until a real cut exists, and set the pass rule now.
  - Wave 2: (a) hold both series until s1e01 passes; (b) start storyboards and frames in both series now, and hold every wave-2 edit until the toolsmith step lands.
- **Evidence:**
  - **s2e01, screening (S15, the one full screening): 7/10, no blocking issue.**
    - Precondition met: 0 placeholder rows, -14.2/-14.3 LUFS, -1.1 dBTP, and the Hindi and English cuts differ.
    - Length: 109.37 s Hindi, 108.87 s English.
    - Sync: all 25 clips sit at 0 ms offset, and 78 of 79 cues start within 0.2 s of speech. en c031 starts 0.33 s early.
    - Lowest scores: music and effects on their beats 5, picture completeness 5.
    - Six slates (s14, s16, s20, s26, s28, s29), 11.6 s of the Hindi cut.
    - Four one-off effects were never generated, so b5's 3 s crossing beat plays as ambience at about -47 dBFS.
    - No overlays are rendered. s33 and s35 are 1.2x and 1.1x framings of s31.
  - **s2e01, why the slates exist.** S9 rejected three frames:
    - the s26 anchor, for the token on the wrong wrist;
    - s14, for the hand past its 20 % line (s20 is cropped from s14);
    - s16, for the wool in the wrong pocket.
    - s28 and s29 wait on the s26 anchor. None of the three rejects got the one retake D-015 rule 5 allows, so s28 and s29 were never made. **The slates come from a skipped step, not from a failed ladder.**
  - **s1e01: no render exists.**
    - My grep today shows `build_timeline.py` still loads `frames/review.json` as a list (line 118) and reads `shot_id` (lines 805-806). The real file is a dict keyed `shot`.
    - Three more gaps wait behind the crash: second framings and the reused photograph have no png; five lines are listed in two shots each; cut-on-word takes the first match.
    - No toolsmith fix has run. D-0M4 lets only that step edit `production/scripts`.
    - The editor's scratch build changed only its inputs and passed every assemble check: 106.0 s Hindi, 99.5 s English, -14.13/-14.15 LUFS. Screening was right not to spend the one full screening on it.
    - s02, s03, s20 and s21 are rejected with no retake. s05 and s25 are second framings of s03 and s21, so they wait too.
  - **Voice: every line in both episodes is final in `voice/review.json`.**
    - s1e01 uses take 3 for hi l04, hi l16 and en l16.
    - s2e01 uses take 2 for hi and en l18 and hi l23.
    - The quoted frames in s2e01 l08 and l24 are spoken (D-022 rule 6), and screening's whisper.cpp pass heard every s2e01 line in both languages.
  - **Frames (from the two manifests):**
    - s1e01: 27 generations, all attempt 1, 51.7 to 131.5 s each, mean 75.7 s.
    - s2e01: 26 generations, 92.3 to 145.1 s each, mean 119.4 s.
    - Against the budget of 28 frames per episode: s1e01 uses 27; s2e01 plans 28, with 26 made and 2 waiting.
    - First-check rejections: 4 of 27 and 3 of 26, so 7 of 53 (13 %). No retake ran, so the retake-check pass rate is unmeasured.
  - **Props against D-017's trigger.**
    - Kiran's right cuff: S9 checked it in 7 s1e01 frames. s02 and s21 failed (the chooda is down at the wrist where the state says pushed up), and s07 drifted. S9 names a cause: `kiran_hands` view 2 draws the cuff closed at the wrist.
    - Series 2: the wool (s16) and the token (s26) were each wrong once. The s16 prompt gave the pocket in body terms only, which D-013 rule 3 already forbids.
    - Aditya's pocket side (s1e01 s03) is wrong in one frame.
  - **D-015's conditions.**
    - Frame check against screening: screening failed no s2e01 frame that S9 passed, so they did not disagree. s1e01 was not screened.
    - Wave size: wave 1 was two episodes, so it says nothing about idle Codex slots in a wave of five.
    - The changed-items pass can be dropped only if both episodes pass first time. s1e01 was never scored.
  - **D-021's conditions.** S9's s2e01 anchor check found that 0 of 4 first-of-scene frames copy the thana style frame. The s1e01 review does not report this.
  - **Length.** Wave 1 runs 99.5 to 109.4 s a cut, under the 150 s ceiling and under the 120 s aim. The D-018 and D-019 trigger needs the first two finished episodes of a series over 150 s.
  - **Credits.** About 66,700 of about 730,000 are used, with first takes done for all 17 episodes (morning report). D-011's ceiling is not in play.
  - **My own look.** No shell, so I saw no render frames. I viewed source pngs whole at 1125x2000:
    - **Which frames:** s2e01 s01, s02 and s03 (the opening), and s31, s32, s36 and s37. The last 20 s are s32 to s37, and s33 and s35 reuse s31. From s1e01, s01 and s36.
    - **s2e01 opening:** the token in s01 is blank, so the "7" is only heard and subtitled, as screening says. In s02 Nandini holds the token in the hand on the picture-left side (her right), with the helmet on the other side. s03 (Nirala) is clean.
    - **s2e01 ending:** the token is on her right wrist in s31, s32 and s36. s37 is a clean close, with two bars and the pen on the picture-right side.
    - **One thing in neither report:** in s36, the pocket on the picture-right side shows no pen, where s31 and s37 show one. s36 is a 1.0 s insert, and I saw it whole, not cropped.
    - **s1e01:** s01 (powder into the milk) and s36 (the chooda slid down to the wrist) read cleanly.
- **Decision:**
  1. **s2e01 passes Gate 4 at 7/10.** The work still owed is completion, not re-judgment. It is routed by owner, then gets one changed-items pass (D-015 rule 5). The pass stands unless that pass finds a blocking fault.
     - **Frames:** one retake each of s26, s14 and s16 from S9's notes, with every side written in picture terms.
       - s26 goes first: it is the anchor for s28 and s29.
       - Then attempt 1 of s28 and s29. s29 attaches the Nirala/Pushpa line-up sheet if one exists (D-017 amendment 2).
       - Then the single retake check.
       - A retake that still fails is accepted as the better take and logged (D-013 rule 11). No slate stays for a shot that was never tried.
     - **Sound (ElevenLabs runner):** crossing_train first, then lobby_door_swing, tea_pour and file_untie_riffle. One take each, from the prompts in `sound/cues.json`, with rows in the series manifest. A cue that fails plan 7.8's ladder becomes a tagged placeholder row.
     - **Storyboard:** correct `ov_token_7.surface` (s01) and `ov_shield.surface` (s14) in `shots.json` to the frames as drawn, using S9's measurements. Write the overlay text per language if no spec exists.
     - **Editor, after the toolsmith step:**
       - split en c030/c031 at the pause;
       - take the tension note from its steady 2-15 s stretch and add the +3 dB rise as a ramp;
       - raise the caper bed about 6 dB, with true peak at or below -1 dBTP;
       - aim s33's move at her face at scale 1.3 (no new frame, so the budget holds);
       - render the overlays and tag the dropped cues;
       - re-render all four files.
     - **s36's missing pen** is logged. It gets no retake.
  2. **s1e01 is not judged, so it does not pass yet.** The fault is in the toolchain, not the episode. The path, in order:
     - the toolsmith step (rule 3);
     - one retake each of s02, s03, s20 and s21, under S9's fixes and rule 4, item 6;
     - the retake check;
     - the editor reruns `assemble.sh` in the real folder, with en l04 and l05 cut on the second "the";
     - the one full screening.
     - **Pass rule, set now:** if that screening scores 7/10 or more with no blocking fault, s1e01 passes Gate 4 without coming back here. Otherwise it comes back.
     - **`sfx_s1e01_bare_feet`:** not generated. The sound owner marks it dropped in `cues.json`, with the bolt-rattle fallback the cue sheet allows and the cut already uses.
  3. **Toolsmith step (run by the orchestrator, D-0M4), before any wave-2 edit:**
     - **`frames/review.json`:** read either a dict with a `frames` list or a bare list, with the id under `shot` or `shot_id`. "approved" and "approved with logged drift" pass; "rejected" fails.
     - **`second_framing` and `reused_asset` shots:** use `frame.image` with the shot's own move, and inherit the source frame's verdict.
     - **A line listed in two shots** is placed once. The second shot starts at the cut-on-word.
     - **Cut-on-word** takes an occurrence index.
     - **`edit.json`** can override where a line's subtitle splits.
     - **Dropped or missing sound cues** are tagged in `meta.placeholders.sound`.
     - **Slates** print the cut's own language, and wrap rather than truncate.
     - **Overlays:** the flat 2D proof's overlay layer, if the episode build does not have it yet.
     - **Regression:** rebuild s2e01 from its current inputs, and the timeline must match apart from the intended changes. Rebuild s1e01 from the real folder.
  4. **Method for wave 2 onward:**
     1. **The retake is part of the frame stage.** The order is: frame check; one retake for each rejected frame, plus the first attempt of any frame waiting on a rejected anchor; the retake check; then the edit. D-015 rule 3 gains a condition: no screening while a slate stands for a shot whose retake or first attempt never ran.
     2. **Frame budget: 28 an episode in both series, unchanged.** The flat 2D mean of 119.4 s is under D-017's 150 s trigger.
     3. **Retake allowance: 40 % stays for planning.** First-check rejection was 13 %, but no retake has run yet.
     4. **Length: no change.** The 150 s ceiling and the trigger stand.
     5. **D-015's conditions:**
        - no second frame check, because the frame check and screening did not disagree;
        - waves stay at five, because there is no evidence either way;
        - the changed-items pass stays, because its condition is not met.
     6. **D-017's prop trigger is met for Kiran's right cuff (2 failed and 1 drifted in 7 checked frames). Fallback (c) applies to that prop in Series 1:**
        - while the cuff is pushed up, frame it out, or keep it to an edge as s01 does;
        - attach no `kiran_hands` view that contradicts the cuff state, and list its view 2 under do-not-copy;
        - show the cuff's state in inserts made for it;
        - cut nothing from the scripts: the cuff covers the scar the story turns on (D-003, D-005);
        - restage the s02 and s21 retakes this way.
     7. **The trigger is not met for the Series 2 wool or token, or for Aditya's pocket.**
        - Each is one wrong frame. I read "more than one frame in five" as needing at least two wrong frames.
        - The cause is side wording in body terms only, which D-013 rule 3 already forbids.
        - Storyboards and prompts restate every tracked side in picture terms.
     8. **Second framings.** A second framing of a wide does not stand in for a close (s2e01 b12). Storyboards spend a generated frame on any close a beat needs, within the 28.
     9. **One shape for `frames/review.json` in both series:** the s1e01 shape, a dict with a `frames` list and the id under `shot`.
  5. **Wave 2 starts now in both series, for storyboards and frames.** No wave-2 episode in either series goes to edit until rule 3's regression passes. Frames are the bottleneck (D-010) and do not depend on the build.
  6. **Voice fixes for the ElevenLabs runner: none.** The only ElevenLabs work is the four s2e01 effects in rule 1. Ear items go on the owner's list, not into retakes (D-0M2):
     - Nandini's s2e01 hi l03 and hi l19, both measured loud and high;
     - both s2e01 cuts as a whole, once re-rendered.
  7. **Morning report (orchestrator):** log s2e01's six slates and four missing cues as placeholders, s1e01 as blocked on the toolsmith step, and this entry.
- **Not (b) for s2e01:** the method is proven end to end in a finished cut with real audio. The slates come from a skipped step, and the changed-items pass checks the fix.
- **Not (a) for s1e01:** the scratch build ran on changed inputs, and nobody screened it.
- **Not holding Series 1's wave 2:** the blocker is shared tooling that affects both series' edits, not Series 1's picture or voice.
- **Not verified:**
  - **Renders:** I had no shell, so I played, probed and extracted nothing from any render. Burned subtitles, camera moves, slates and the mix are the screener's findings.
  - **Listening:** nobody has listened to either episode.
  - **s1e01 scratch numbers:** nobody has re-measured them.
  - **`build_timeline.py`:** I read only the lines my grep returned.
  - **Render time for a full episode (D-012):** not reported.
  - **D-021's retake check:** I do not know whether it ran for `lane_night` and `pair_kiran_aditya_p1` before s14 and s20 were made. S9 found no report, and `style.json` records only part of that check.
  - **Counts and times:** the cuff count rests on S9's per-frame checks. Frame times are my own sums of the manifests' `seconds` fields.
  - **The s36 pen:** seen by eye at 1125x2000, not cropped.
- **Would change it:**
  - **s2e01's changed-items pass finds a blocking fault** (for example, a retake that brings in a side error). The pass is suspended until the fault is fixed.
  - **s1e01's full screening scores under 7/10 or finds a blocking fault.** The episode comes back here.
  - **The cuff still fails in the restaged s02 or s21 retake.** Accept the better take and log it. Later Series 1 episodes then show the cuff only in inserts.
  - **Wave 2's frame numbers.** If first-check rejection in either series goes over 40 %, or the flat 2D mean goes over 150 s, the D-010 and D-017 cut to 24 frames applies to that series.
  - **The toolsmith regression fails.** Wave-2 editors may use s2e01's workarounds inside their own folder: source pngs copied to the second-framing ids, and `review.json` written as a list. Episodes with lines split across shots wait.
  - **The owner disagrees.** The owner's eye or ear overrides any of this.

## D-024 Clarity pass: the owner's Option 1, writer rules, orientation supers, length and the C1 gate (A0 Arbiter, on Opus, 26 Nov ~14:00 IST)

- **Question:** the owner watched s2e01. He found the flow, picture and direction fine and the dialogue unclear in every episode: "Story is fine the dialogues etc are just not making sense." He chose Option 1 of `docs/clarity-review.md`, a dialogue-only clarity pass on all 17 scripts that keeps every beat, shot and frame, the story and both endings. This entry makes that binding and rules on five things:
  - the writer rules for the pass;
  - whether on-screen text may orient the viewer (against D-004 direction 6);
  - what replaces the character measure (D-018 to D-020);
  - what a writer may not change;
  - whether the cold-reader gate C1 is a hard gate before voice.
- **Options:**
  - Scope: (a) Option 1 on all 17, as the owner chose; (b) the review's own recommendation, Option 2 (new or reordered beats) for s2e01 to s2e03 and Option 1 for the rest.
  - On-screen text: (a) D-004 direction 6 unchanged, so every name, role and place has to be spoken; (b) orientation supers for name and role at first appearance, place and time, and nothing else.
  - Length: (a) keep the character gates and raise them to make room; (b) replace them with a finished-time target under the 150 s ceiling.
  - Clarity check: (a) the critic scores clarity from its own read; (b) the critic scores it from a cold-reader report (C1).
- **Evidence:**
  - **The owner's choice.** It reaches me through my brief and is recorded in `docs/morning-report.md`, issue 5. I did not see the chat. The Arbiter decides what the owner has not decided (plan sections 5 and 9). This one he has decided, and D-021 and D-023 already say his view governs.
  - **Five cold viewers** (`docs/clarity-cold-viewers.md`).
    - One worked from frames and subtitles of the s2e01 review renders, without hearing the audio.
    - Four read the spoken lines, with source frames for s1e01 or s2e01 only.
    - Nobody listened.
    - Scores: Series 1 about 5.5 to 6, Series 2 about 5.5 to 6.5, s2e01 alone 4 to 5. All five say the spine and the endings come through and the lines do not.
    - **Replies to lines nobody heard:** "Arre, talkies?", "And our force doesn't even have caps", "this side of the line", "It'll put me to sleep, though".
    - **Speakers the viewer cannot place:** phone voices subtitled on the listener, an off-screen "Next!", and lines over the wrong face or over slates.
    - **Names long after faces, or never:**
      - Joshi first at 58 s and Tripathi at 92 s;
      - Pushpa never named on path A, and Aditya never named on path A;
      - Sneha and Kiran never bridged.
    - **Dropped threads:** the token, the transfer application, Aditya's vow.
    - **Jargon:** thana, SI, SHO, DSP, FIR and malkhana; bureau, party, shutter and setting.
    - **Numbers:** Series 2 has too many, for example "Frame nine-two-seven" and "Note seven-seven-three".
    - **Clues carried by a picture alone:** the s31 photograph, the cap, the cinema, the almirah, the fresh-milk swap.
    - **Language:** the Hindi readers found the same structural faults. They lost less only on police words.
  - **The clarity review** (S3 as script doctor; not my work).
    - Every critic score was 7.7 to 8.3, on episodes the cold viewers scored 4 to 7.5. The critic reads the bible, so it cannot read cold.
    - The character measure cut set-up lines. s2e01 b6 is staged "Cut in mid-report", so Tripathi answers a report nobody hears.
    - Three rules together removed every cheap way to orient the viewer: no narrator (plan section 3), no hook that opens on set-up, and D-004 direction 6.
    - Its caveat on Option 1: it "cannot fix the order problems in s2e01: the railway shown after the line that names it, the cinema reveal, and why she is there."
  - **My read of that caveat.** Each of the three has a fix inside an existing beat, and the review drafts each one in its section 6:
    - "this side of the railway line" no longer needs the railway shot to come first;
    - "Roopam Talkies Thana", with a place super, names the cinema;
    - "Not one complaint has come to my thana in six weeks. So I came to see where they all go." says why she is there.
    - So lines and supers can reach the s2e01 faults. Whether they are enough is what C1 tests, and ruling 1 keeps a route open for a beat change.
  - **Length room.**
    - Wave 1 cuts run 99.5 to 109.4 s a language cut (D-023), against the 150 s ceiling.
    - Option 1 adds about 250 Hindi and 300 English characters an episode (review estimate).
    - At D-020's slower proof rates (8.4 and 9.8 characters a second), that is about 30 s, so about 130 to 140 s an episode. This is an estimate.
  - **Locks a clarity line could hit** (my grep):
    - Series 1: the sedative is never named or measured, and 'Rekha' and 'Tulsi' are never spoken in branch B.
    - D-004 direction 5's forms of address for the three senior men.
    - Each glimpse's `must_not_reveal` list.
    - None of them forbids saying what the photograph shows.
  - **Cost.**
    - About 66,700 of 730,916 credits are used.
    - Re-voicing the changed lines costs about 25,000 to 35,000 (review estimate).
    - C1 readers cost session time, not credits.
- **Decision: Option 1 on all 17 episodes is binding. On-screen text (b), length (b), clarity check (b).**

  **Ruling 1. What a writer may and may not change.**
  1. **What stays:** the story, both endings, the choice question and both labels, and every beat, shot and frame.
  2. **A writer may:**
     - reword any line, with its tags and targets;
     - add a line inside an existing beat;
     - cut a line;
     - move a line to another existing shot of the same beat, so that its speaker is on screen;
     - edit a beat's `action` only to say which line plays over which shot, or to drop a stage note the new line replaces (s2e01 b6 "Cut in mid-report").
  3. **A writer may not** add, cut, split or reorder a beat, or change what any shot shows.
     - New lines take the next unused line id; nothing is renumbered.
     - No shot is added, and that includes second framings. If added lines make a shot run past about 8 s, the lines are spread over the beat's other shots, or S7 holds the shot on its camera move.
  4. **A fix that truly needs a beat change is listed for the owner, not done.**
     - "Truly" means the fault still fails the second C1 reading, and the writer says why no line or super can carry it.
     - Meanwhile the writer ships the best line-level fix and records the item in `clarity_pass.owner_items`.
     - The orchestrator copies it to "Needs your decision" in the morning report. Nothing waits for the answer (plan 7.8).
  5. **Locks hold.**
     - A clarity line keeps every bible story lock and production lock, D-004 direction 5, and each glimpse's `must_not_reveal` list.
     - If a C1 fault can be fixed only by breaking a lock, the writer does not break it. The item comes here with the C1 quote, under `clarity_pass.lock_conflicts`.
  6. **Protected and balance lines** from earlier gates keep their function. One whose own wording is the C1 fault is reworded, not cut, and logged in `clarity_pass`.
  7. **The review's drafted lines** (its section 6) are defaults a writer may use or improve on. They do not bind.

  **Ruling 2. Writer rules.** The full text is in `.claude/skills/hinglish-screenwriting/SKILL.md`, under "Clarity rules (D-024)". Each rule is judged on each path as a viewer watches it, never against the bible.
  1. **Name or role at first appearance.**
     - Every speaking character, and every silent one the plot turns on, is named or given a role, in a line or a super, by the end of the beat in which they first appear on that path.
     - A person talked about but not seen gets one identifying clause at first mention.
     - An alias is bridged once, in a line.
     - No two people or places share a name.
  2. **Jargon is glossed once on each path, in context,** by a character with a reason to say it.
     - English glosses police and legal words (thana, SI, SHO, DSP, FIR, malkhana).
     - Both languages gloss in-world code words (bureau, party, shutter, setting), or replace them with plain words.
  3. **No reply to a line the viewer did not hear,** and no line that leans on an action no frame shows.
  4. **Each line follows from the one before.**
     - The "because" and "so" clauses come back.
     - Every "it", "this" or "that man" refers to something heard or in shot.
     - When the scene changes place, the first line or a super says where we are.
  5. **At most three load-bearing numbers an episode.** A number is load-bearing if a later line, the choice or an ending needs the viewer to remember it. Serial-type numbers (frame, note and register numbers) are said as words or cut.
  6. **A planted thread pays off in both branches or is cut.** A thread planted in a branch pays off in that branch.
  7. **Phone and off-screen voices are marked.** `heard_as` goes on the line. The first such line of each speaker in a scene says who it is: the listener names them, or they name themselves.
  8. **Every plot clue that is a picture is also spoken once.** The line says what the picture shows, not what it means, and never whose it is before the story reveals it. Example for s1e01: "The bride has a burn on her wrist, like a half moon."
  9. **The choice states what each answer costs and gains.**
     - Both costs and both gains are spoken in the question episode, before the question line.
     - The ballot meanings say the same in plain words.
     - The critic re-reads the vote balance against D-004's 65/35. If a stated gain tilts it past that, the favoured side's cost is raised. The gain is not taken out (D-004 direction 2).
  10. **Keep the lines viewers liked** (list below). Their set-up changes first. A line's own wording changes only if that line itself fails C1, and then its meaning stays.
  - **Guard against exposition.** No "as you know". A name or a gloss rides on a reason to say it: an introduction, a newcomer, an order, an argument, a phone pick-up.
  - **Lines viewers liked,** as the viewers quoted them. The Hindi counterpart of each is protected in the same way.
    - **Series 1, shared:**
      - "Pour in the whole sachet. Half doesn't put me to sleep."
      - "A sedative is bitter, Sneha. That's why the saffron."
      - "I have your SIM."
      - "Bureau, Bhaiya in the car, Mausi on the phone, bride gone by morning." "Bureau" is glossed before it.
      - "Eleven days later, they found Mohit hanging from the fan."
      - "Nobody touched Mohit either."
      - "Our mother's bangles. The lane laughed at him for eleven days."
      - "I know how much puts you to sleep, and how much means you never wake up."
    - **Series 1, branch A:**
      - "It was me who named you Kiran."
      - "Shall I tell him, beta? Whose hand this is?"
      - "There's no Rekha. Mohit's bride was me."
      - "You taught me this."
      - Mohit's last words about the reception.
      - "My mother named me Tulsi."
      - Mausi's "Do eat something, beta".
    - **Series 1, branch B:**
      - "One brother died of shame. Who'll ask about the other?"
      - "This time the whole sachet, beta. With your own hands."
      - "Nobody keeps accounts with daughters."
      - "You." / "Yes. Me."
      - "I'll keep the accounts now."
      - "Go home, Aditya."
      - "Pour in the whole sachet, Chhoti. Half doesn't put them to sleep."
    - **Series 2, shared:**
      - "Kindly sit, madam. First tea, then complaint."
      - "Then kindly dictate, madam: 'Thana has been stolen.'", which gets its set-up.
      - "Where there's no complaint, there's no crime. Have some peanuts."
      - "I'll come with you, madam. I know the way."
      - "All thirty of them... turned away by my own thana."
      - "So before ten tomorrow... who do I arrest?"
      - "Arrest is your right, madam."
      - "The thana is fake. The complaints are real."
      - "Taking a bribe is a crime. Seizing it is duty."
      - "It takes no chest to hear a complaint."
      - "He has a real one."
      - The Hindi "थाना चोरी हो गया" and "talkies वाली चौकी".
    - **Series 2, branch A:**
      - "So the invitation was never for the stamp. It was for you."
      - "Do not put your trust in that. Put it in her."
      - "I was the only fake."
      - "Zero is not zero any more."
      - "Keep your cap straight."
      - "Madam, the bench is full."
    - **Series 2, branch B:**
      - "One more night. My responsibility."
      - "The name they write will be mine."
      - "Item six: SHO Dayashankar Tripathi... present on the spot."
      - "A phone found in an impostor's pocket is not evidence. A phone sent in by an SI is."
      - "Twenty-four envelopes. Not one of them opened?"
      - "Next! Token one."

  **Ruling 3. Orientation supers. This amends D-004 direction 6 to this extent and no further.**
  1. **What a super may carry:** three things only. A character's name and role at first appearance on a path, a place, and a time.
  2. **True and public only.** A super says only what is true and what the story is not hiding at that point. There is no super for an alias (Sneha), a false role (Nirala's "Inspector"), or anything a twist reveals. Those characters are introduced in dialogue.
  3. **Form:**
     - at most two short lines of about four words each;
     - its own text in each language, with names in Devanagari in the Hindi cut;
     - held at least 2 s;
     - inside the 9:16 safe area, clear of the subtitle zone, and never on a shot that carries a plot overlay.
  4. **How often:** a name once per character per path; a place at its first appearance on a path; a time only for a deadline or a jump in time.
  5. **Where it is written:** the writer puts each super in the beat's `supers` list. S7 copies it onto the shot it first falls on in `shots.json`, without changing the shot.
  6. **Who draws it:**
     - By default the edit burns it in, through the overlay layer in D-023 rule 3.
     - The app draws supers instead only if P3 builds that, and the edit then leaves them out.
     - Never both.
  7. **Nothing else may depend on reading.**
     - Token numbers, boards, receipts and file dates stay as D-004 direction 6 set them.
     - Endings stay spoken (D-004 direction 4).
     - There is still no narrator (plan section 3).
     - A super is not "set-up" under the hook rule.

  **Ruling 4. Length: the character measure is replaced.**
  1. **Withdrawn:** the character measure of about 1,050 (D-005 change 9, D-006 change 8, D-007 direction 1, D-016 direction 7), and the gates of 1,100 Hindi and 1,300 English (D-018, D-019, D-020). Counts may still be reported, but they trigger nothing.
  2. **The target is 130 to 140 s finished time per language cut,** under the unchanged 150 s ceiling. The target is room, not a floor: nothing is padded to reach it.
  3. **Projection.** Each language file states its own figure in `clarity_pass.projected_finished_seconds`, with its basis:
     - **Base:** the current cut where one exists (s1e01 scratch 106.0 / 99.5 s; s2e01 109.4 / 108.9 s). Otherwise, the sum of final-take durations in `voice/manifest.jsonl`, plus `silent_seconds`, plus 0.3 s a speaker change.
     - **Adjustment:** add the time for added characters and subtract it for removed ones, at 8.4 a second for Hindi and 9.8 for English (D-020's slower proof rates).
     - **Fallback:** if neither base is to hand, 0.9 times `target_total_seconds`, labelled estimate.
  4. **Clarity lines are never cut to meet a count,** whether of characters or of lines.
     - Each trim order in `writer_notes` is rewritten so that it lists no clarity line.
     - D-018 rule 3 (silences first, then the trim order) and rule 4's trigger stand.
     - An episode that cannot get under 150 s without cutting a clarity line comes here.
  5. **Line count:** 25 to 40 lines stays as guidance. More than 40 is not fatal when the extra lines are clarity lines.
  6. **English adaptation:** "within about 15 per cent of the Hindi line" does not apply to a gloss that English needs and Hindi does not. A gloss needed in one language only goes inside the existing line, so the ids stay paired.

  **Ruling 5. C1 is a hard gate before any voice, and failing it is fatal in script-critique.**
  1. **No new voice before C1.** No take is generated for a new or changed line until its episode has passed three things: C1 on every path that contains it, the critic's round, and the Arbiter gate in item 5. Takes of unchanged lines stay, and no take is deleted.
  2. **Procedure.** The full text is in `.claude/skills/script-critique/SKILL.md`, under "Clarity gate C1 (D-024)". In short:
     - **Packets.** There is one packet per path per language. Each series has paths A and B, so there are 8 packets a round, saved under `content/<series>/clarity/`.
       - A session that is neither the writer nor a reader prepares them.
       - In path order, each holds: one line per shot of what the camera shows (people by look, never by name or role until a line or super has given it); the supers; the spoken lines without tags, with neutral speaker labels and with the markers the subtitles will show; a marker at the end of the first third of e01; and the ballot text from the bible.
     - **Readers.** Fresh Opus sessions that have never seen the series' bible, scripts, notes, reviews or decisions, the clarity review or the cold-viewer reports. One reader per packet, writing the form in order as they go. The second round uses new readers.
     - **Form.** Section 7's form, plus an optional lean at the choice that is not scored.
     - **Pass, per episode,** only if all of these hold:
       - every reading in each language scores 7 or more;
       - the premise is right after the first third of e01;
       - every speaker is identified, correctly, by the end of the beat in which they first appear;
       - in the question episode, both costs and both gains are named before the vote;
       - no reading has more than 2 undecoded lines, and none of them carries the plot;
       - no reading has a confirmed reply to an unheard line.
     - **Tie rule.** If two readings of a shared episode in one language differ by 3 points or more, one more fresh reader reads that path. The middle score of the three counts.
  3. **Critic.**
     - Clarity becomes the 9th criterion. It is scored from the C1 reports, never from the critic's own read: the lowest reading score for that episode, after the tie rule.
     - A failed C1 condition is fatal. Without a C1 report the episode is held, not failed.
     - The overall score is the mean of nine. The pass mark stays 7.5.
  4. **Rounds.** Two at most, as now. Round 2 uses fresh C1 readers. An episode that still fails comes here with both rounds' reports and its `owner_items`.
  5. **Arbiter gate.** When a series' episodes have critic and C1 verdicts, the orchestrator brings them here, in one entry per series. An episode that has passed, with no owner item and no lock conflict, is listed rather than argued again.

  **What this changes in work already running.**
  - **Edit-only fixes (part of Option 1):**
    - **Subtitles.** S12 and the editor mark `heard_as` lines: italic, with the speaker's name or role as a label on the first such line of each speaker in a scene.
    - **Toolsmith.** The toolsmith step (D-023 rule 3) adds that marking and the supers layer before any re-voiced edit.
    - **s1e01.** s31 (the photograph) is held at least 2.5 s, with a push-in on the scar and no new frame.
    - **s2e01.** Each line playing over the wrong face moves to its speaker's shot within the beat, or is marked.
  - **S7** updates the line-to-shot mapping and every cut-on-word anchor for changed lines, and places the supers. No shot changes.
  - **S1:**
    - updates `choice.A.meaning` and `choice.B.meaning` in both bibles to the spoken costs and gains. The question and labels do not change.
    - states in one sentence, in the Series 2 bible, why Nirala stamped Bhaiyaji's slips "as always". The writers carry that in one line.
  - **P4** then syncs `app/public/media/series*/series.json` from the bibles. This closes the flag raised in D-005, D-007 and D-018.
  - **S14** re-cuts any glimpse whose range holds a changed line, against its `must_not_reveal` list.
  - **Screening.**
    - No full screening is spent on a cut whose dialogue predates D-024.
    - s2e01's Gate 4 pass (D-023) stands for picture, and its re-voiced cut gets the changed-items pass.
    - s1e01's one full screening runs on its re-voiced cut, under D-023's pass rule.
  - **Wave 2 frames** go on, because no beat or shot changes.
  - **C2 and C3** (review section 7) are not ruled here. For this pass, ruling 2 items 7 and 8 cover what C2 would check.
- **Not (b) for scope:**
  - The owner chose (a) after watching the very episode the review would restructure, and he called its picture and direction fine.
  - The three order faults the review names have line-level fixes.
  - A beat change stays possible, item by item, through the owner.
- **Not (a) for text:**
  - With no narrator and no set-up before the hook, a name, role or place had to fit into dialogue or be left out. Viewers met Joshi at 58 s and Tripathi at 92 s.
  - A super costs no voice and no frame, and ruling 3 keeps the plot from depending on reading.
- **Not (a) for length:**
  - The measure was set before any speech was measured (D-020), and it is what cut the set-up lines.
  - Cuts run 40 to 50 s under the ceiling, so even a raised count would still push writers to cut.
- **Not (a) for the check:** every critic read the bible and passed scripts that cold viewers could not follow. A reader who knows the answer cannot tell whether the question is clear.
- **Not verified:**
  - **The owner's words** come from my brief and the morning report. I did not see the chat.
  - **What I read:**
    - the clarity review and all five cold-viewer reports, in full;
    - plan sections 3, 5, 7.8 and 9;
    - D-004, D-018 to D-023, and the length directions they cite;
    - both skills, and morning report issue 5;
    - greps of the Series 1 bible for locks.
    - The Read tool returned only line 1 of these files, so I read them through Grep. I read no script, viewed no frame and heard no take.
  - **Length.** The 130 to 140 s figure is an estimate, built from the review's character estimate and two proof scenes' rates. I did not measure the series casts' rates.
  - **Tooling.** Untested: whether the subtitle builder can style and label `heard_as` lines, and whether the overlay layer can draw supers. Both are toolsmith work.
  - **C1's reliability.** One reader per packet, with the tie rule, is my judgement. How much two cold readers of the same packet differ is unmeasured.
  - **The review file.** Line 1 of `docs/clarity-review.md` is a stray save instruction, not review text. The review starts at line 5. I did not edit the file.
- **Would change it:**
  - **Order faults survive.** If the second C1 reading of s2e01, s2e02 or s2e03 still fails on why she is there, the railway or the cinema, those items go to the owner as an Option 2 request, with the C1 quotes. This entry is then amended for those episodes only.
  - **Over the ceiling.** If an episode projects or finishes over 150 s and cannot get under it without cutting a clarity line, it comes here. The ceiling is then weighed against the line.
  - **Supers fail.** If screening finds supers over subtitles or faces, or C1 readers still miss names that a super carried, the names move into dialogue and supers keep only place and time.
  - **Balance.** If the stated costs and gains move the critic's vote read outside 65/35, the favoured side's cost is raised. No gain is removed.
  - **One language lags.** If one language's readings run 2 points or more below the other's on the same lines, that adaptation gets its own pass before voice.
  - **The owner disagrees.** The owner's view overrides any of this.

## D-025 Clarity gate for the dialogue pass: all four paths pass, six word-level fixes before voice, and the re-voice scope (A0 Arbiter, on Opus, 26 Nov ~16:35 IST)

- **Question:** the owner's Option 1 pass (D-024) has rewritten the dialogue of all 17 scripts in both languages. It has had two C1 rounds and a continuity check on both series. Does each series and path pass the gate? Is any fix still needed before voice, and does any line need a beat change, which would go to the owner? Which lines are re-voiced, and at what cost?
- **Options:**
  - (a) Pass all four paths and voice the changed lines exactly as the scripts stand.
  - (b) Pass all four paths, apply a short list of word-level fixes inside lines that are already being re-voiced (plus four more lines), then voice.
  - (c) Hold voice for the critic round that D-024 ruling 5 item 3 asks for, or for a third C1 round.
- **Evidence:**
  - **C1 round 2 (fresh readers, after the fix round), as reported in my brief.** Every reading passes.

    | Path | Hindi | English | Undecoded lines, hi / en | Any undecoded line plot-carrying? |
    |---|---|---|---|---|
    | Series 1 A | 8.2 | 8.0 | 2 / 2 | No |
    | Series 1 B | 8.5 | 8.2 | 2 / 2 | No |
    | Series 2 A | 8.3 | 8.0 | 2 / 2 | No (one en item called "must fix, not fatal") |
    | Series 2 B | 8.5 | 8.0 | 2 / 0 | No |

    - Within each path, Hindi and English differ by 0.2 to 0.5, so D-024's "one language lags" trigger (2 points) is not met.
    - Round 1 also passed on every path, at 7.5 to 8.5. Its Series 1 B English reading shows n=5 next to "pass": true. If n counts undecoded lines, that reading breaks D-024's "no more than 2" rule. Round 2 is the reading that counts (ruling 5 item 4), so the verdict does not change.
  - **What round 2 still could not decode.** Each item comes from one reading unless marked otherwise.
    - **s1e01 l21** "I didn't go. I was at the shop." Flagged by all four Series 1 readings: go where? It is minor, but it is the line that tells us Aditya never saw the bride, which is why he hunts a hand.
    - **s2e03 l33** "And Bhaiyaji would know this thana is not his. The files would go too." Flagged by two readings: whose "his" (A-en, "must fix"), and what "go" means (B-hi). It is a new line in the question episode, so it will be voiced anyway.
    - **s1e02 l15** "Our mother's bangles. The lane laughed at him for eleven days." Flagged by two readings (A-en, A-hi). It is unclear who took the bangles. Both readers call it minor. It is a protected, viewer-liked line (D-024 ruling 2 item 10).
    - **s1b03 l12** (English only) "I kept the blood off your hands…": unclear who she is talking to. In the Hindi, "तेरे" marks Billu (she says तू to Billu and तुम to Aditya). The English loses that.
    - **Single readings, minor, the reader's own words "does not carry the plot":**
      - s1a01 l14 (A-hi);
      - s1e02 l31 (B-hi; either reading works);
      - s1b01 l27 (B-hi; speaker attribution in the text packet; Mausi's voice settles it in the cut);
      - the s2e02 cycle side scene l12, l13, l14 and l37 (A-en, A-hi, B-hi; l13's "say it aloud" plant is restated in full by every payoff line, so no payoff depends on it).
  - **Continuity.**
    - **Series 1** (S4, revision 2): ok, no high-severity item open. P19 (low, s1b03 l05) is a world-fact error: "उससे पहले" puts Mohit's wedding just before the last party, but in the bible two weddings came between them. P20 (nit, s1b01 l26) has "कल" ("tomorrow") about ten minutes before s1b02 says "आज" ("today") for the same day. P25 (nit, s1b03 l07) is "आधा". P26: S7 has not yet remapped the new lines to shots.
    - **Series 2** (`content/series2/continuity.json`, revision 2): no high or medium item. Low items are edit-side: s2e01 l27 heard_as, and the s2b02 cue anchors that still name retired ids.
  - **Owner items and lock conflicts.**
    - My grep found one non-empty `owner_items` across all 34 scripts: s2a03 English, "Forms of address in four kept English lines". The English says "sir" to the DSP where the Hindi says "DSP साहब" (D-004 direction 5, the names rule). The writer asks the owner or the Arbiter to rule. It is not a beat change.
    - Every `lock_conflicts` list is empty.
  - **My read.** I read the spoken lines, with speakers and `heard_as`, of 8 of the 17 episodes:
    - s1e01, s1e02 and s1b03, in both languages;
    - s1a03, s2e01 and s2e03, in both languages (English for s2e03 only around the changed lines);
    - s2a03 and s2b03, in Hindi.
    - On every one of them:
      - names and roles arrive with the face, through supers or introductions;
      - phone and off-screen voices are marked;
      - the s1e01 photograph is spoken (l29);
      - the s2e01 order faults that D-024 tracked each get a line: "railway line के इस पार", the Roopam Talkies super, and why she came (l27).
    - **Both question episodes state both costs and both gains before the question:**
      - s2e03: l18 to l20, l35, l32, with the DSP's FIR threat in l17;
      - s1e02: l20 and l21 (what Kiran loses if Mausi falls), then l24 and l25 (what each phrase sets off).
    - Locked and liked lines I checked are word for word the same.
    - The new lines mostly ride on a reason to speak: an introduction, a phone pick-up or an order. I found no "as you know". Character voice holds; for example, Nirala's courtesy and Mausi's warmth are intact.
    - I found nothing new that a critic would mark down on the other eight criteria. That is my judgement, not a scored critique.
  - **Critic round.** I found no critic review of the clarity pass on disk. Every `review-notes.json` holds the Gate 2 critique, and a grep for a ninth "clarity" score finds only D-024. My brief brings C1 and continuity, not a critic verdict.
  - **Re-voice scope.**
    - Taken from each script's `clarity_pass` lists (reworded, added, retired, plus the C1 fix-round and English-only sublists).
    - I checked the lists against `script.*.prev.json` for 8 of the 34 files: s1e01 hi and en, s1e02 hi, s1b03 hi, s2e01 hi, s2e03 hi, s2b01 hi, and s1e01 en (the English-only l06). All 8 matched exactly.
    - Every episode has a voice manifest, so every listed line has an old take or is new.
    - s2b02's l04 was retired before it was voiced (no manifest row), so it is out of scope.
  - **Cost basis.** Credits run about one per character, tags included. For example, s1e01 hi l01 is 55 characters and cost 55 credits; en l01 is 62 and cost 62. The changed Hindi lines I read average about 50 characters, and the English about 62. First takes so far averaged about 43 credits a line (41,300 for 956 lines, morning report).
- **Decision: (b).** Every path passes; six fixes are applied before voice; no owner item and no beat change.
  1. **Verdict.**
     - Series 1 path A (s1e01, s1e02, s1a01 to s1a03) and path B (s1e01, s1e02, s1b01 to s1b03) pass in both languages.
     - Series 2 path A (s2e01 to s2e03, s2a01 to s2a03) and path B (s2e01 to s2e03, s2b01 to s2b03) pass in both languages.
     - All 17 episodes are cleared for re-voice, subject to item 4.
  2. **The critic round is met this time as follows, and is not run.**
     - Criterion 9 (clarity) is, by D-024's own rule, the lowest C1 reading: 8.0 on every path in round 2.
     - Criteria 1 to 8 carry over from Gate 2 (D-018 to D-020), because no beat, shot, ending, lock or choice label changed (continuity, both series) and my read found no new fault.
     - With the lowest Gate 2 overall at 7.7, the mean of nine is at least (8 × 7.7 + 8.0) / 9 = 7.73, which is above 7.5.
     - The critic reads the bible, and D-024 found exactly that makes it blind to clarity. A round now would cost hours and could not move criterion 9.
     - This amends D-024 ruling 5 items 1 and 3 for this pass only.
  3. **Fixes, applied by S2 (Hindi) and S5 (English) before any take of these lines.** Tags as written. Each is a word-level change inside an existing line. No beat, shot or line id changes.
     - **F1. s1e01 l21, both languages.** hi "[quietly] मैं शादी में गया नहीं। दुकान पे था।"; en "[quietly] I didn't go to the wedding. I was at the shop."
       - Four readings flagged it.
       - It says aloud that Aditya never saw the bride.
       - The line is not locked or protected.
       - Adds 2 lines to the re-voice.
     - **F2. s1b03 l05, both languages (P19).** hi "[quietly] और मोहित वाली शादी में, उसकी माँ के कंगन। नौ तोला।"; en "[quietly] And at Mohit's wedding, his mother's gold bangles. Nine tola."
       - It names the wedding the viewer knows, rather than "the temple wedding". The temple is mentioned once, in s1e01 l24.
       - S4's wording is an acceptable alternative.
       - No wedding number comes back (rule 5).
       - Already in scope.
     - **F3. s1b03 l12, English only.** "[quietly] Billu, I kept the blood off your hands. Mausi was the one putting it on."
       - The Hindi is unchanged; its "तेरे" already does this work.
       - Adds 1 line.
     - **F4. s1b01 l26, both languages (P20).** hi "[calm] तो सब यही कहेंगे: दुल्हन भाग गई, दूल्हा सुबह उठा ही नहीं।"; en "[calm] So they'll all say: the bride ran off, the groom never woke up."
       - Already in scope.
     - **F5. s2e03 l33, both languages.** hi "[quietly] और भैयाजी जान जाते कि ये थाना बिका नहीं। फिर files भी उठवा लेते।"; en "[quietly] And Bhaiyaji would know this thana isn't in his pay. Then he'd have the complaint files taken too."
       - It stays conditional ("would"), so it still does not say that Bhaiyaji knows or that the slip is stamped (s2e03 writer_notes).
       - S2 may improve the wording only if both "who takes the files" and "not in Bhaiyaji's pay" stay explicit.
       - S2 re-projects s2e03 Hindi, which was 148.5 s before the fix.
       - Already in scope.
     - **F6. s2a03 English l03, l20 and l23: this rules on the writer's owner item.** Apply the writer's drafts: "[flatly] Order carried out, DSP sahab."; "[calm] And the eight hundred sacks won't come back, DSP sahab."; "[calm] I am withdrawing it, DSP sahab."
       - The SHO is also present at the press conference, so a bare "sir" is the English form of the bare "साहब" that D-004 direction 5 rules out. The series' English already says "DSP sahab" (s2e01 l30 and l31).
       - l08 ("DSP sir", the reporter) already names the rank and stays.
       - The item leaves `owner_items` and is recorded as ruled here.
       - Adds 3 lines.
  4. **Considered and not changed.**
     - **s1e02 l15.** It is a protected line that viewers quoted as a favourite. Both readers call it minor, so rule 10 keeps its wording. It is a watch item for s1e01 and s1e02's screening.
     - **P25, "आधा".** 12 of 22 and 4 of 9 are both about half. "आधा-अधूरा" means "half-done", which is a different sense.
     - **s2b02 English l12, "Aaiye".** No reader flagged it, and it would cost a take.
     - **The single-reading minor items** (s1a01 l14, s1e02 l31, s1b01 l27, s2e02 l12 to l14 and l37) stay as written.
     - **s1b01 l25 to l28 and s1e02 l15.** When S7 remaps, it starts these lines on a shot where the speaker is visible, if the beat has one. No shot changes.
  5. **For the owner:**
     - no line needs a beat change;
     - no lock conflict;
     - nothing is added to "Needs your decision".
  6. **Re-voice: `content/revoice-clarity.json`** (one row per line: ep, series, lang, line_id, change; plus `awaits`, `replaces` or `replaced_by` where they apply).

     | Series | Hindi lines | English lines | Total to voice | Retired (cut) |
     |---|---|---|---|---|
     | Series 1 | 81 | 86 | 167 | 0 |
     | Series 2 | 80 | 92 | 172 | 8 (s2b02 l07, l15, l29 and l30 in each language; replaced by l40, l37, l38 and l39) |
     | **All** | **161** | **178** | **339** (136 new, 203 reworded) | **8** |

     - **Runner rules for S10:**
       - A row with `awaits` is voiced only after its D-025 fix is in the script.
       - Before each take, compare the script text with the text of the line's current final take in `voice/manifest.jsonl`. If they are byte-identical, skip the line and log it. This guards against list errors.
       - **Take 1 is quiet-free** for every listed line whose tag is in D-022's quiet family. Send the D-022 rule-1 text: quiet-family tags deleted, [calm] if no tag is left.
         - Exception: a line whose takes note says it must be whispered, or whose tag is [whispers].
         - Subtitles keep the script text, the edit sets the level, and the manifest logs the text sent.
         - Why: D-022 measured that the tag whispers on six voices, so sending it as written mostly buys a retake.
       - Retired lines' takes stay on disk (D-024 ruling 5 item 1). They only leave the timeline.
     - **Cost estimate:**
       - first takes about 161 × 50 + 178 × 62 ≈ 19,100 credits;
       - with a 10 per cent retake allowance, about 21,000;
       - likely range 17,000 to 25,000.
       - That is below the clarity review's 25,000 to 35,000, because it is built from measured cost per character rather than the review's guess.
       - About 66,700 of 730,916 credits were used at the morning report's last update.
  7. **Length.**
     - s1e02 (hi 150.9, en 152.3) and s2e01 (hi 150.4, en 150.5) project just over 150 s at the rule rate. Each writer shows a route under 150 s by trimming silences only (s1e02 about 147.0 s; s2e01 149.6 s).
     - F1, F2, F5 and F6 add about 1 to 2 s each to s1e01, s1b03, s2e03 and s2a03, all of which project under 150 s.
     - The measured cut decides. D-024 ruling 4.4 applies only if trimming silences is not enough.
  8. **Downstream work already assigned:**
     - **S7:** shot remap and cut-on-word anchors (P26), and supers onto shots.
     - **S2:** marks s2e01 l27 heard_as off_screen, or S7 keeps l27 on s02 (text unchanged).
     - **S11:** renames the s2b02 cue anchors.
     - **S14:** re-cuts glimpses against `must_not_reveal`.
     - **S1:** applies the bible errata (P15, neighbour_voice) and the choice meanings.
     - **P4:** syncs `series.json`.
- **Not (a):** F2 fixes a world-fact error, and F5 fixes a line that a reader called must-fix in the question episode. Both lines are being re-voiced anyway, so fixing them now costs nothing. Waiting would mean paying for those takes twice.
- **Not (c):**
  - All eight round-2 readings pass, with none of their undecoded lines carrying the plot.
  - A third C1 round is not provided for (ruling 5 item 4). The fixes are additions of a referent, so they cannot plausibly make a line less clear.
  - The critic round is covered by decision 2.
- **Not verified:**
  - **C1:** I read the summaries in my brief, not the readers' forms. No C1 packet or report is saved under `content/<series>/clarity/` (glob: no files). The sub-conditions come from the readings' pass flags; their underlying details are not in my brief:
    - the premise after the first third of e01;
    - every speaker identified;
    - costs and gains before the vote;
    - no reply to an unheard line.
  - **Scope lists:** 26 of the 34 files' lists are taken as declared, without my own diff.
  - **Character averages:** estimated by eye from the lines I read, not counted.
  - **Continuity:** the Series 1 report reached me truncated after "Frames vs. scripts". For Series 2 I read only its problems list, by grep.
  - **What I did not see or hear:** no frame, no take, no cut.
  - **The vote balance:** not re-read against 65/35 by a critic.
  - **How I read the files:** the Read tool returned only line 1 of each file, so I read them through Grep.
- **Would change it:**
  - **A fix fails.** If the screening of any re-voiced episode (s1e01's one full screening, s2e01's changed-items pass) finds a D-025 fix or a clarity line unclear, or finds a new line flat or expository, the critic round runs on that series' remaining episodes before their edits.
  - **Liked lines.** If s1e01 or s1e02's screening finds l15 still undecoded, the set-up line before it changes first (rule 10), and its wording stays.
  - **Length.** If S10's measured cut puts any episode over 150 s after silences, it comes here (D-024 ruling 4.4).
  - **Scope.** If S10's identical-text check skips more than about 5 per cent of rows, the lists are re-derived by diff before the rest is voiced.
  - **The owner disagrees.** The owner's view overrides any of this.

## D-026 Clarity re-voice review, waves 1-2: retake only real faults (orchestrator, 26 Nov ~19:30 IST)

- **Question:** S10's local review of 165 clarity take-1 files found 12 to retake: 4 real faults (s1e01 hi l11 breathed; s1e01 en l06 breathy start; s1e01 hi l16 and s1e02 hi l13 doubtful word) and 8 that fail D-022's per-segment voiced test only on consonants and breath tails while every word is voiced at speaking level.
- **Decision:** retake the 4 real faults (take 2, eleven_v4, per `content/revoice-clarity-retakes.json`). Waive the segment test for the 8 measure-only rows (s1e01 en l11, l18, l21; s2e01 en l27; s1e02 en l20; s1a01 hi l16, en l29; s2e02 en l24); their review.json verdicts are set to ok with a `waived` note.
- **Why:** D-022 exists to catch whispered words; these words are voiced. A take 2 would likely fail the same measure and be accepted at the D-011 cap anyway. The owner asked that Claude usage be conserved.
- **Not verified:** nobody has listened; the 8 stay on the ear list. If screening hears any as breathy, it is retaken then.

## D-027 Gate 4 after the clarity pass: s1e01 and s2e01 pass (orchestrator applying D-023, 26 Nov ~21:00 IST)

- **Evidence:** S15 screenings `content/series1/episodes/s1e01/screening.clarity.json` (full: hi 8, en 8, no blocking fault, D-025 F1 clear) and `content/series2/episodes/s2e01/screening.clarity.json` (changed items: hi 8, en 8, no blocking fault; all D-024 order faults fixed). Judged from frames, whisper.cpp and levels; nobody has listened.
- **Decision:** both pass Gate 4 (D-023: 7/10, no blocking fault). D-025's "fix fails" trigger is not met, so no critic round. The s2e01 placement of su4 on s15 under the shield plate is accepted (plate top 8%, super at ~60% height, never touching), an exception to D-024 ruling 3.3.
- **Deferred, not blocking (owner's usage limit):** s2e01 F1 subtitle marking of off-screen/phone lines (italics + labels) goes into the app install step, since the app draws subtitles from subs.*.json; s1e01 optional polish (lead before l20, missing "1:40" and "No network" overlays, louder chooda click, s18/s19 static stretch).
- **Owner ear list adds:** s1e01 en l11 ("Fine"), l27; s2e01 l29 ("SHO"), the s18 phone call level.
