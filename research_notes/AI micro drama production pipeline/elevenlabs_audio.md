# ElevenLabs audio pipeline for full-cast Hindi + English micro-drama (state as of 25 Nov 2026)

Research method note: all official pages below were read on 25 Nov 2026 through an automated page-reader that summarises and quotes. Quoted strings are as returned by that reader; re-check any load-bearing string against the live page before hard-coding it. The single biggest finding is that the brief's framing ("v3 vs Multilingual v2 vs Flash/Turbo") is out of date: **Eleven v4 (`eleven_v4`) launched 28 Sep 2026 and is now the documented flagship; Eleven v3 is labelled "previous generation"; Turbo v2/v2.5 are deprecated.**

---

## 1. Which TTS model is best for expressive Hindi? Status, API availability, character limits, cost

### Takeaway
Use `eleven_v4` as the primary model (flagship since 28 Sep 2026, 90+ languages incl. Hindi `hi`, audio tags, multi-speaker dialogue, 100,000-char request limit, 1 credit/char or $0.08 per 1K chars); keep `eleven_v3` (GA, "previous generation", 5,000 chars) as the A/B fallback and `eleven_multilingual_v2` as the stable/no-tags fallback. No independent, documented Hindi listening test of v4 vs v3 was found, so the "best for Hindi" claim rests on ElevenLabs' own positioning and must be confirmed by a bake-off on real script lines.

### Cited Findings
- Models page lists `eleven_v4` as the flagship: "Eleven v4 is our state of the art speech synthesis model, delivering our highest quality audio"; 90+ languages; Hindi included as `hi`; "Support for natural multi-speaker dialogue"; character limit 100,000 (~100 min of audio). — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- `eleven_v4_turbo`: "Our most expressive, real-time speech synthesis model (~100ms)", audio tags supported, used via the Text to Dialogue WebSocket; no per-request character limit listed. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- `eleven_v3`: "Eleven v3 is our previous generation speech synthesis model"; 70+ languages incl. Hindi (`hi`); 5,000 characters (~5 min) per request; "Dramatic delivery and performance"; multi-speaker dialogue. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- `eleven_v3_conversational`: previous-generation real-time model, ~165 ms, audio tags. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- `eleven_multilingual_v2`: 29 languages incl. Hindi, 10,000 chars (~10 min), described as "most stable on long-form generations". — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- `eleven_flash_v2_5`: 32 languages incl. Hindi, 40,000 chars, ~100 ms, 50% lower price per character; text normalisation off by default. `eleven_flash_v2` is English-only (30,000 chars). — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- `eleven_turbo_v2_5` and `eleven_turbo_v2` are **deprecated** (replace with Flash v2.5 / Flash v2); no removal date given. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- Eleven v4 and v4 Turbo were published 28 Sep 2026 (page last updated 23 Nov 2026) and are "Live now in ElevenAgents, ElevenCreative and API"; "more than 90 languages"; IVC from "just 10 seconds of audio"; "Eleven v4 also adds support for Professional Voice Clones (PVC)". The page does not use the words alpha/GA for v4. — [ElevenLabs blog: Introducing Eleven v4](https://elevenlabs.io/blog/eleven-v4)
- Launch date and positioning corroborated by press: launched Monday 28 Sep 2026; previous version supported 70 languages, v4 over 90; biggest quality gains named were Japanese, Brazilian Portuguese, Mandarin and Cantonese (Hindi not named); v4 "expands these tags and lets users stack multiple tags". — [TechCrunch, 28 Sep 2026](https://techcrunch.com/2026/09/28/elevenlabs-new-v4-speech-model-supports-more-expression-control-and-90-languages/)
- Changelog 28 Sep 2026: "Eleven v4 (`eleven_v4`) ... for content creation and long-form audio" via the Text to Dialogue API; `eleven_v4_turbo` "for agents and interactive applications" via the Text to Dialogue WebSocket; "Eleven v4 provides higher-quality, more expressive speech and improved voice cloning across more than 90 languages." SDK releases that day: JS v2.70.0, Python v2.70.0, CLI v1.4.0. — [ElevenLabs changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28.md)
- The models endpoint fields `max_characters_request_free_user` / `max_characters_request_subscribed_user` are deprecated and "are not enforced"; use `maximum_text_length_per_request` (query `GET /v1/models`). — [ElevenLabs changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28.md)
- Eleven v3 status: the v3 launch post (dated 3 Jun 2025, "Eleven v3 (alpha)") now carries the line "Eleven v3 is no longer in alpha, and is now generally available"; an ElevenLabs post titled "Eleven v3 is now generally available" exists (date not captured). — [ElevenLabs blog: Eleven v3](https://elevenlabs.io/blog/eleven-v3); [ElevenLabs blog: v3 GA](https://elevenlabs.io/blog/eleven-v3-is-now-generally-available)
- API list prices (per 1K characters): Eleven v4 $0.08; Eleven v4 Turbo $0.04; v3 $0.08; v2 Multilingual $0.08; Flash/Turbo class $0.04. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- Credit cost per character via API: Eleven v4 = 1, v3 = 1, Multilingual v2 = 1, Turbo = 0.5, Flash = 0.5, v3 Conversational = 0.5; on the website every model costs 1 credit per character. — [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Concurrency by plan (Multilingual-class models): Free 2, Starter 3, Creator 5, Pro 10, Scale 15, Business 15 (pricing page shows Business 25 — conflict), Enterprise elevated. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models); contradicted on Business by [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Practitioner view (dated 21 Sep 2026, i.e. one week before v4; first-hand testing not documented): Hindi is on v3, Multilingual v2 and Flash v2.5; v2 is "the safe, predictable option", v3 more expressive but "can over-act" on flat explainers. — [BundledSEO ElevenLabs review](https://bundledseo.com/blog/elevenlabs-review/)
- Older third-party comparison (2025-era, surfaced via search summary, not opened): ElevenLabs Hindi "improving but still trails native-Indian-language tools on conversational expression", while winning on English-Hindi crossover. — [VoisLabs Hindi TTS comparison](https://www.voislabs.com/best/hindi-text-to-speech)

### Inferences
- For a drama (not an explainer), v3-style "over-acting" is a feature; v4 is positioned as strictly better than v3 for expression and for PVC/Voice Library voices, so v4 should be the default and v3 the comparison arm.
- The 100,000-char v4 limit applies to plain TTS; the Text to Dialogue endpoint has its own 2,000-char reliability ceiling (section 3), which is the binding limit for multi-speaker scenes.
- Flash v2.5 / v4 Turbo (0.5 credit/char) are only useful here for cheap scratch tracks and timing drafts, not finals.
- Because v4 is under two months old, expect model behaviour and docs to keep shifting; pin `model_id` explicitly in every request and record it per take.

### Gaps
- No ElevenLabs statement or independent test specifically rating v4 Hindi quality was found; launch material names other languages as the biggest gainers.
- No v3 deprecation/removal date found; v3 is only labelled "previous generation".
- Launch-period promo pricing ($22 / $11 per million chars through 12 Oct 2026) was reported only in a search-result summary of launch coverage and has in any case expired; not verified on an ElevenLabs page.
- Whether pre-launch IVC/PVC clones must be retrained for v4 was reported in a search summary of launch coverage ("instant and professional clones made before launch need retraining") but was not found on the official pages read; verify before relying on existing clones.

---

## 2. How emotion/audio tags work: syntax, model support, Hindi limitations, prompting best practice

### Takeaway
Tags are free-form natural-language directions in square brackets placed inline before/after the text they affect (e.g. `[whispers]`, `[angry]`, `[sighs]`); they work on Eleven v4, v4 Turbo, v3 and v3 Conversational only, are not an enum, and are voice-dependent and not always obeyed. There is no Hindi-specific tag guidance from ElevenLabs; tags should be written in English inside Devanagari lines and validated per voice.

### Cited Findings
- "Eleven v4 and Eleven v3 support audio tags. We recommend Eleven v4." — [ElevenLabs Text to Speech product guide](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- Syntax: tags go in square brackets before or after the text they modify, e.g. `[whispers] I never knew it could be this way.`; tags "can be combined"; describe voice quality clearly (e.g. "[low, gravelly voice]") so it is not read as a sound cue. — [ElevenLabs prompting guide (v4/v3)](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
- Documented voice tags: `[laughs]`, `[laughs harder]`, `[starts laughing]`, `[wheezing]`, `[whispers]`, `[sighs]`, `[exhales]`, `[sarcastic]`, `[curious]`, `[excited]`, `[crying]`, `[snorts]`, `[mischievously]`. Sound-effect tags: `[gunshot]`, `[applause]`, `[clapping]`, `[explosion]`, `[swallows]`, `[gulps]`. Special: `[strong X accent]`, `[sings]`, `[woo]`. "likely many more effective tags beyond this list." — [ElevenLabs prompting guide (v4/v3)](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
- Further tags used in official examples/enhancement prompt: `[sad]`, `[angry]`, `[whisper]`, `[annoyed]`, `[appalled]`, `[thoughtful]`, `[surprised]`, `[laughing]`, `[chuckles]`, `[clears throat]`, `[short pause]`, `[long pause]`, `[exhales sharply]`, `[inhales deeply]`, `[happy gasp]`, `[frustrated sigh]`, `[giggles]`, `[dismissive]`, `[sympathetic]`, `[questioning]`, `[reassuring]`, `[pause]`. — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- v4 examples of stacked / descriptive tags: "[excited, happy]", "[sleepy drowsy voice]", "[said angrily in French accent]", reactions "[laughs]", "[yawning]", inline SFX "[light rain]", "[phone buzzing]". — [ElevenLabs blog: Introducing Eleven v4](https://elevenlabs.io/blog/eleven-v4)
- Dialogue-page categories: emotions/delivery `[sad]`, `[laughing]`, `[whispering]`; audio events `[leaves rustling]`, `[gentle footsteps]`, `[applause]`; overall direction `[football]`, `[wrestling match]`, `[auctioneer]`. Tags are "natural-language instructions, not an enum parameter." — [ElevenLabs Text to Dialogue capability](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- Punctuation: ellipses add pauses and weight; CAPITALS increase emphasis; standard punctuation gives rhythm. Example: `It was a VERY long day [sigh] … nobody listens anymore.` Hyphens/em dashes show interruptions (`[jumping in] —test our new timing features?`). — [ElevenLabs prompting guide (v4/v3)](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
- "Eleven v4 and Eleven v3 do not support SSML break tags." Use tags, ellipses and text structure for pauses; on older models `<break time="x.xs" />` works up to 3 s. — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- Limitations: tags are not always followed; "Some experimental tags may be less consistent across different voices"; a tag can be read as a sound effect or vice versa. — [ElevenLabs prompting guide (v4/v3)](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
- Voice choice: deliveries present in the voice's training data are easier to reproduce — "Asking for something outside that data is harder"; "Professional Voice Clones (PVCs) are not fully optimized for Eleven v3"; "PVCs are supported in v4" and v4 is recommended for PVCs and Voice Library voices. — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- Emotion can also be driven by narrative text ("she said excitedly") and punctuation; "Explicit dialogue tags yield more predictable results than relying solely on context." — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- Voice settings on TTS endpoints: `stability` (default 0.5), `similarity_boost` (0.75), `style` (0), `use_speaker_boost` (true), `speed` (default 1.0, range 0.7–1.2), `clone_strength` (0–1, "Applies only to professional voice clones fine-tuned for the selected v4 model"). Dialogue endpoint `settings`: `stability` (0.5), `similarity` (0.75), `clone_strength`. — [TTS with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps); [Text to Dialogue API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert)
- Output is nondeterministic: "Several generations might be required to achieve the desired results"; `seed` (0–4294967295) helps but "Determinism is not guaranteed." — [ElevenLabs Text to Dialogue capability](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- No dedicated non-English/Hindi tag guidance exists in the prompting guide. — [ElevenLabs prompting guide (v4/v3)](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)

### Inferences
- Write tags in English even inside Devanagari lines (all official examples are English and tags are interpreted as instructions); test whether the model ever voices the tag text aloud in Hindi lines.
- Lower `stability` gives more tag responsiveness and more variance; plan 2–4 takes per emotional line with different `seed` values and pick by ear.
- Inline SFX tags (`[phone buzzing]`) bake effects into the dialogue stem and break clean mixing/subtitle alignment; for a drama keep SFX on a separate track (section 7) and reserve tags for vocal performance only.
- Choose Voice Library voices whose preview already shows range (conversational/character use-case) rather than narration-style voices.

### Gaps
- The 2025 v3 guide's stability presets (Creative / Natural / Robust) and "prompts over ~250 characters are more stable" advice are recalled from mid-2025 documentation but did **not** appear in the current combined v4/v3 guide as read; treat as older and unverified for v4.
- No documentation or credible practitioner report on tag reliability specifically in Hindi (v3 or v4).
- Whether audio-tag characters are billed as characters is not stated on the pages read (assume yes).

---

## 3. Text to Dialogue API: endpoint, request shape, speaker limits, timestamps, per-line vs per-scene

### Takeaway
`POST /v1/text-to-dialogue` takes an ordered `inputs` array of `{text, voice_id}` turns and renders one continuous performance; `/v1/text-to-dialogue/with-timestamps` additionally returns character-level alignment plus per-turn `voice_segments`. Hard practical limit is ~2,000 total characters per request (roughly one 2-minute episode or less), so generate per scene, not per episode or per isolated line.

### Cited Findings
- Endpoint: `POST https://api.elevenlabs.io/v1/text-to-dialogue` — "Converts a list of text and voice ID pairs into speech (dialogue) and returns audio." — [Text to Dialogue API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert)
- Body: `inputs` (required list of `{text, voice_id}`); `model_id` (default `eleven_v3` — must be set to `eleven_v4` explicitly); `language_code` (ISO 639-1; "not supported for multilingual_v2 models"); `settings` {`stability` 0.5, `similarity` 0.75, `clone_strength` 0–1}; `pronunciation_dictionary_locators` ("up to 3 locators per request"); `seed`; `apply_text_normalization` (`auto`|`on`|`off`); query `output_format` (default `mp3_44100_128`). — [Text to Dialogue API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert)
- Speaker limit: "The maximum number of unique voice IDs is 10." — [Text to Dialogue API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert); contradicted by "There is no limit to the number of speakers in a dialogue." — [Text to Dialogue capability page](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- Length: "For reliable generation, keep the total character count across all `inputs[].text` values at or below 2,000 characters per request"; longer requests "can terminate early in streaming responses or return a validation error". For longer scripts split into chunks and concatenate audio in your application. — [Text to Dialogue API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert); [Text to Dialogue capability page](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- Timestamps variant: `POST https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps` returns `audio_base64`, `voice_segments` (each: `voice_id`, `start_time_seconds`, `end_time_seconds`, `character_start_index`, `character_end_index` (exclusive), `dialogue_input_index`), `alignment` and `normalized_alignment` (each: `characters`, `character_start_times_seconds`, `character_end_times_seconds`). Timing is character-level; no word-level field. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- Continuity fields on the dialogue endpoints: `previous_request_ids` / `next_request_ids` (up to 3 each), `previous_text` / `future_text` (max 100 characters each). Changelog: "Text to Dialogue requests can use preceding or following text and request IDs to maintain continuity across generations." — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps); [changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28.md)
- `audio_effects` body field on the dialogue with-timestamps endpoint: filter preset, distance, reverb environment, background noise, send level, pan; unknown effect IDs return 404; reverb or non-zero `pan` with `ulaw_*`/`alaw_*`/`pcm_*` formats returns 400. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- `use_pvc_as_ivc` (default `false`): "Text to Dialogue requests can use the Instant Voice Clone version of a Professional Voice Clone" to reduce latency or improve expressiveness. — [changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28.md)
- Output-format gating: MP3 192 kbps requires Creator or above; PCM and WAV at 44.1 kHz require Pro or above. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- Models: Text to Dialogue supports Eleven v4 and Eleven v3; "We recommend Eleven v4." WebSocket variant uses `eleven_v4_turbo` / `eleven_v3_conversational`; sockets close after 20 s idle without `keep_alive`. — [Text to Dialogue capability page](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue); [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- v4 multi-speaker behaviour: "Speakers respond to the context of the conversation." — [ElevenLabs blog: Introducing Eleven v4](https://elevenlabs.io/blog/eleven-v4)
- Regional/residency hosts exist for all these endpoints, including India: `api.in.residency.elevenlabs.io`. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- Free regenerations (up to 2, identical content and parameters) are dashboard-only, not API. — [Text to Dialogue capability page](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)

### Inferences
- Per-scene generation (one request per scene/beat of roughly 300–1,500 characters, well under the 2,000 ceiling) is the best default for drama: it gets cross-speaker reactions, interruptions and consistent room tone, and `voice_segments` gives exact cut points per line for editing and per-line subtitle cues.
- Per-line generation (plain TTS endpoint per line) loses interplay but makes retakes cheap; a hybrid is practical: render the scene with Text to Dialogue, then patch a bad line either by regenerating the scene with a new `seed` or by a single-line TTS call using `previous_text`/`next_text` or `previous_request_ids`/`next_request_ids` for prosodic continuity.
- A ~2-minute episode is ~1,500–2,200 characters of dialogue, i.e. at or over the reliability ceiling once tags are added; split into 2–4 scene requests and chain them with `previous_request_ids`.
- Treat 10 unique voices per request as the real limit (API reference is more specific than the marketing-style capability page).
- No extra per-request dialogue surcharge is documented; assume the per-character model rate applies.

### Gaps
- ElevenLabs publishes no explicit per-line vs per-scene recommendation for drama.
- Pricing of Text to Dialogue is not separately listed on the API pricing page.
- Whether `alignment.characters` includes the bracketed audio-tag text (and how tag time is represented) is not documented on the pages read; must be tested.
- The plain `/v1/text-to-dialogue/stream` and `/stream/with-timestamps` paths were not opened (index: [text-to-dialogue llms.txt](https://elevenlabs.io/docs/api-reference/text-to-dialogue/llms.txt)).

---

## 4. Word/character timestamps for subtitles: with-timestamps endpoints vs Forced Alignment; most reliable route for Devanagari + Latin

### Takeaway
Both with-timestamps endpoints return **character-level** timing only (original and normalised text); word timings must be derived by grouping characters on whitespace. The Forced Alignment API returns ready-made `words` with a per-word `loss` score and lists Hindi among its supported languages, but says nothing about mixed-script text — so the recommended design is generation-time alignment as primary, forced alignment on the final edited stem as a cross-check/fallback, with a mandatory test on code-mixed lines.

### Cited Findings
- TTS endpoint: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps`; response `audio_base64`, `alignment`, `normalized_alignment`, each with `characters`, `character_start_times_seconds`, `character_end_times_seconds`; described as "precise character-level timing information". No model restrictions are listed for the endpoint; default `model_id` is `eleven_multilingual_v2`. — [TTS with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- The same endpoint documents `clone_strength` as applying to "professional voice clones fine-tuned for the selected v4 model", i.e. v4 is addressable on this endpoint. — [TTS with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- Dialogue endpoint with timestamps (default model `eleven_v3`) returns the same character-level alignment plus `voice_segments` mapping each dialogue turn to time and character-index ranges. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- Forced Alignment: `POST https://api.elevenlabs.io/v1/forced-alignment` (multipart/form-data) with `file` and `text`; response `characters` [{`text`,`start`,`end`}], `words` [{`text`,`start`,`end`,`loss`}], and overall `loss`. "The input text can be in any format, however diarization is not supported at this time." — [Forced Alignment API reference](https://elevenlabs.io/docs/api-reference/forced-alignment/create)
- Forced Alignment capability page: language list is the 29 "multilingual v2" languages and includes Hindi; limits 3 GB file, 10 hours audio, 675,000 characters of text; billed at the same rate as Speech to Text; text must be a plain string; "providing diarized text will produce unexpected results". — [Forced Alignment capability page](https://elevenlabs.io/docs/overview/capabilities/forced-alignment); file-size limit contradicted ("must be less than 1GB") by [Forced Alignment API reference](https://elevenlabs.io/docs/api-reference/forced-alignment/create)
- Speech to Text batch price (the rate Forced Alignment follows): Scribe v3 / v2 $0.20 per hour of audio. — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- Scribe models `scribe_v3` (batch, 90+ languages) exist as an alternative way to obtain word timings from audio. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)

### Inferences
- Most reliable route for Devanagari + Latin lines: (1) generate with `/with-timestamps` (dialogue or TTS) and build word cues by splitting the **original-text** `alignment.characters` on spaces — this preserves the exact script as written, including Latin-script English words, so subtitles match the script byte-for-byte; (2) for the final edited/mixed episode, or wherever cuts were moved, run Forced Alignment against the clean dialogue stem with tag-stripped text and flag words with high `loss` for manual review.
- Devanagari caveat: one visible syllable is several code points (consonant + matra + virama/conjuncts), so never time subtitles per character; aggregate to whitespace-delimited words (first char start to last char end).
- Use `alignment` (original) rather than `normalized_alignment` for subtitles, because normalisation rewrites numbers/abbreviations.
- Strip bracketed audio tags from the text sent to Forced Alignment and from subtitle text; non-verbal tags (`[sighs]`, `[laughs]`) produce audio with no words and can skew neighbouring word boundaries.
- Forced Alignment cost is negligible for this project (70 min ≈ 1.2 hours ≈ $0.25 at $0.20/hour).
- Forced Alignment should be run on speech-only stems, not on the music+SFX mix.

### Gaps
- No documentation on Forced Alignment accuracy for Hindi, nor on mixed Devanagari+Latin input; no practitioner report found. This is the highest-risk unknown for subtitles and needs an empirical test (e.g. 20 code-mixed lines, check word `loss` and boundary error).
- Whether v3/v4 alignment arrays include tag characters, and whether alignment is ever null for v4, is undocumented on the pages read.
- No word-level timestamp field exists in any TTS/dialogue response as documented.

---

## 5. Handling code-mixed Devanagari + Latin-script English: pronunciation guidance, dictionaries, `language_code`

### Takeaway
ElevenLabs publishes no guidance on code-mixed Hindi-English input. Available levers are `language_code: "hi"` (supported on v3/v4/Flash, not Multilingual v2), alias-type pronunciation dictionaries (up to 3 per request), inline IPA in slashes on v4, and text normalisation controls; the only practitioner statement found says a Devanagari sentence with an occasional Latin-script English word "generally reads acceptably" on v3.

### Cited Findings
- `language_code`: ISO 639-1 code on TTS and dialogue endpoints; "This parameter is not supported for multilingual_v2 models"; ignored if the model does not support it. Models page: "The `language_code` parameter accepts ISO 639-1 two-letter codes for most languages." Hindi code is `hi`. — [TTS with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps); [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- Pronunciation dictionaries: rules are phoneme or alias type; matching is case-sensitive; "the dictionary is checked from start to end and only the very first replacement is used"; upload as TXT or .PLS; passed via `pronunciation_dictionary_locators` (`pronunciation_dictionary_id`, optional `version_id`), up to 3 per request, applied in order. — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices); [TTS with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)
- Phoneme tags: "Phoneme tags are only compatible with the `eleven_flash_v2`" model (English-only); alias tags are the route for models without phoneme support (e.g. Multilingual v2). — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- v4 inline IPA: "Eleven v4 understands IPA symbols when they are wrapped in forward slashes in your text" (`/IPA_transcription/`, with ˈ and ˌ stress marks); "IPA pronunciation is more consistent than in previous models, but results can still vary by voice and phrase." — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- Text normalisation: `apply_text_normalization` = `auto` | `on` | `off`; "Normalization is enabled by default for all TTS models"; numbers, currencies, dates, phone numbers and URLs are common failure points; mitigate by spelling them out in the script. `apply_language_text_normalization` is deprecated and "Currently only supported for Japanese." — [TTS with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps); [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)
- v4 cross-lingual behaviour: "a voice recorded in one language also speaks any other fluently"; accent adherence is stronger so the voice "no longer drifts back toward its source accent". The v4 post does not address code-switching. — [ElevenLabs blog: Introducing Eleven v4](https://elevenlabs.io/blog/eleven-v4)
- Practitioner (21 Sep 2026, pre-v4, testing not documented): Hinglish typed in Latin letters sounds poor because English pronunciation rules are applied — write Hindi in Devanagari; a Devanagari sentence with one Latin-script English word "generally reads acceptably" on v3 "in our experience"; the reverse (English sentence with Devanagari words) is less reliable; "test your exact mix". — [BundledSEO ElevenLabs review](https://bundledseo.com/blog/elevenlabs-review/)
- Third-party note that per-language pronunciation lists let Hindi and English pronounce the same word differently on ElevenLabs voices (surfaced in search summary; page not opened). — [Bolna: Hindi TTS](https://www.bolna.ai/hindi-text-to-speech)

### Inferences
- The project's script convention (Hindi in Devanagari, English words left in Latin) matches the configuration the one practitioner source reports as acceptable; it should be kept, with `language_code: "hi"` set on Hindi episodes and `language_code: "en"` on the English version.
- Build one alias dictionary per language for recurring problem words (character names, brands, acronyms, English words the Hindi voice mangles). For Hindi runs, alias a mispronounced Latin word to a Devanagari respelling (e.g. an English word → its Devanagari phonetic spelling); keep the Latin form in the subtitle text, since aliases only affect audio.
- Caveat for timestamps: alias replacement changes the spoken text, so check that `alignment` (original text) still maps cleanly for aliased words; if not, forced alignment against the original script is the fallback.
- Spell out numbers, dates, currency (₹) and abbreviations in the target language in the script itself rather than relying on normalisation; consider `apply_text_normalization: "off"` once scripts are pre-normalised, to keep character alignment identical to the script.
- For single stubborn words on v4, inline `/IPA/` is available but changes the text stream (and thus subtitles/alignment) — prefer alias dictionaries.

### Gaps
- No official ElevenLabs documentation on code-mixed/Hinglish input, on whether `language_code: "hi"` degrades embedded English words, or on pronunciation-dictionary support specifically for `eleven_v3`/`eleven_v4` (the dialogue endpoint accepts locators, but alias behaviour on v4 with Devanagari targets is untested).
- No v4-era practitioner report on Hindi code-mixing found.

---

## 6. Finding and choosing professional Hindi voices: Voice Library API, notable voices, licensing, one voice for Hindi + Indian English

### Takeaway
Use `GET /v1/shared-voices` with `language=hi`, `gender`, `age`, `accent`, `category=professional|high_quality`, `use_cases`, and sort by `usage_character_count_1y` or `trending`; inspect `verified_languages` (language + `model_id` + accent/locale per voice) to find voices verified for both Hindi and English, then add with `POST /v1/voices/add/{public_user_id}/{voice_id}`. Library voices carry a commercial-use licence on paid plans, but each voice has a creator-set notice period and possibly a custom rate — filter on both. No authoritative "best Hindi voices" list exists; shortlist by audition.

### Cited Findings
- Endpoint: `GET https://api.elevenlabs.io/v1/shared-voices`; query params `page_size` (default 30, max 100), `category` (`professional` | `famous` | `high_quality`), `gender`, `age`, `accent`, `language`, `locale`, `search`, `use_cases`, `descriptives`, `featured`, `min_notice_period_days`, `include_custom_rates`, `include_live_moderated`, `reader_app_enabled`, `owner_id`, `sort` (`created_date` | `usage_character_count_1y` | `trending` | `cloned_by_count`), `page`. — [List shared voices API reference](https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared)
- Response per voice includes `public_owner_id`, `voice_id`, `name`, `accent`, `gender`, `age`, `descriptive`, `use_case`, `category`, `language`, `locale`, `description`, `preview_url`, `usage_character_count_1y`/`_7d`, `cloned_by_count`, `free_users_allowed`, `live_moderation_enabled`, `rate` (rate multiplier), `fiat_rate` (USD per 1000 credits; null if default), `notice_period`, and `verified_languages` (each entry: `language`, `model_id`, optional `accent`, `locale`, `preview_url`). — [List shared voices API reference](https://elevenlabs.io/docs/api-reference/voices/voice-library/get-shared)
- Add a library voice to the account: `POST https://api.elevenlabs.io/v1/voices/add/{public_user_id}/{voice_id}` with body `new_name` (required), `bookmarked` (default true). — [Add shared voice API reference](https://elevenlabs.io/docs/api-reference/voices/voice-library/share)
- Licence: ElevenLabs' own materials state Voice Library voices come with a commercial-use licence (as summarised from the Voice Library announcement and voice guide); the Text to Dialogue page states you retain ownership of generated audio and "Commercial use requires a paid plan." — [ElevenLabs blog: Voice Library](https://elevenlabs.io/blog/voice-library); [ElevenLabs voice guide](https://elevenlabs.io/voice-guide); [Text to Dialogue capability page](https://elevenlabs.io/docs/overview/capabilities/text-to-dialogue)
- Notice period: voice owners specify a "Notice Period" when sharing and may remove a shared voice, subject to that period (Voice Library Addendum, last updated 6 Mar 2026). — [Voice Library Addendum](https://elevenlabs.io/vla)
- Commercial licence is listed on every paid plan from Starter up. — [ElevenLabs pricing](https://elevenlabs.io/pricing)
- v4 with library voices and accents: v4 recommended for PVCs and Voice Library voices; "a voice recorded in one language also speaks any other fluently"; `[strong X accent]` tag exists for accent direction. — [ElevenLabs TTS best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices); [ElevenLabs blog: Introducing Eleven v4](https://elevenlabs.io/blog/eleven-v4); [ElevenLabs prompting guide](https://elevenlabs.io/docs/best-practices/prompting/eleven-v3)
- Third-party directory lists ~598 ElevenLabs voices tagged Hindi and names frequently used ones including Bunty, Anjali, Taksh, Krishna, Vidya, Niraj, Viraj (trait labels on that directory were not reliably attributable per voice). — [json2video: ElevenLabs Hindi voices](https://json2video.com/ai-voices/elevenlabs/languages/hindi/); [json2video Hindi ranking, Oct 2026](https://json2video.com/ai-voices/ranking/hindi/)
- Practitioner advice: the language tag does not reveal how a voice handles particular vocabulary; audition a 30-second paragraph on several candidates and let target-audience listeners choose. — [BundledSEO ElevenLabs review](https://bundledseo.com/blog/elevenlabs-review/)
- Voice design models exist if no library voice fits (`eleven_ttv_v3`, 70+ languages), and v4 IVC needs only ~10 s of audio. — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models); [ElevenLabs blog: Introducing Eleven v4](https://elevenlabs.io/blog/eleven-v4)

### Inferences
- Casting query recipe: `language=hi&category=professional&sort=usage_character_count_1y&page_size=100`, repeated per `gender`/`age` (age values such as young / middle_aged / old are recalled from prior API behaviour, not re-verified); then keep only voices whose `verified_languages` contains both `hi` and `en` entries (ideally `en` with an Indian accent/locale and a v3/v4 `model_id`). This is the documented, data-driven way to find one voice that can do Hindi and Indian-accented English.
- Risk filters for a series: require `min_notice_period_days` as long as available (so a creator cannot pull a lead character's voice mid-season on short notice), set `include_custom_rates=false` or check `rate`/`fiat_rate` (custom-rate voices cost more than 1 credit/char), and prefer `live_moderation_enabled=false` voices to avoid moderation latency/blocks on dramatic content.
- For leads, the lowest-risk option for continuity is a voice the production controls (Voice Design or a consented clone), with library voices for supporting cast; library voices can be withdrawn after their notice period.
- Child voices: no evidence of a reliable catalogue of Hindi child voices; expect to use young-adult voices or Voice Design.

### Gaps
- No verified, current list of high-quality Hindi male/female/elderly/child voices with IDs was found; the names above come from a third-party directory and their quality on v4 is unverified. Nothing found for elderly or child Hindi voices specifically.
- Exact allowed enum values for `age`, `gender`, `accent`, `language` are not documented on the endpoint page (typed as free strings).
- Typical notice-period lengths and what happens to already-generated audio after a voice is withdrawn were not confirmed from the Addendum text (only that a notice period exists).
- The reported claim that all 17,500+ library voices work with v4 comes from a search summary of launch coverage, not from a page opened in this research.

---

## 7. Music and sound effects: Eleven Music API and Sound Effects API (models, duration, looping, licensing, cost); suitability for score and foley

### Takeaway
Both are usable via API for underscore and spot effects: Music via `POST /v1/music` (`music_v2_5`, instrumental mode, composition plans, inpainting; $0.15/min or ~900 credits/min) and SFX via `POST /v1/sound-generation` (`eleven_text_to_sound_v3`, up to 30 s, `loop` flag; 40 credits/s or $0.12/min). The critical caveat is licensing: on all self-serve plans Eleven Music commercial rights exclude "film, TV, radio, and Studio Games" — whether an app/social-distributed micro-drama counts as "film/TV" must be checked against the Music Terms (or Enterprise Music obtained).

### Cited Findings
- Music models: `music_v2_5` (most advanced, "improved audio quality and prompt adherence"), `music_v2` (UI default), `music_v1` deprecated — "will be removed on January 31, 2027". — [Eleven Music capability page](https://elevenlabs.io/docs/overview/capabilities/music); [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- Compose endpoint: `POST https://api.elevenlabs.io/v1/music`; body `prompt` (xor `composition_plan`), `music_length_ms` ("Must be between 3000ms and 600000ms", prompt mode only), `model_id` (API default still `music_v1`; options `music_v1` | `music_v2` | `music_v2_5` — set explicitly), `force_instrumental` (default false; "guarantees that the generated song will be instrumental"; prompt mode only), `seed` (not with prompt), `finetune_id`, `store_for_inpainting`, `sign_with_c2pa`; query `output_format` default `auto` = "mp3_44100_128 for v1 models and mp3_48000_192 for v2 models". — [Compose music API reference](https://elevenlabs.io/docs/api-reference/music/compose)
- Composition plan (v2/v2.5): `chunks`, each with `text` (section name in square brackets, lyrics, inline directions in curly braces), `duration_ms` 3000–120000, `positive_styles` (required), `negative_styles`, `context_adherence` (`low`|`medium`|`high`), optional `conditioning_ref` + `condition_strength`; section durations are always enforced on v2 models. — [Compose music API reference](https://elevenlabs.io/docs/api-reference/music/compose)
- Duration: capability page says "minimum duration of 3 seconds and a maximum duration of 5 minutes"; API reference allows `music_length_ms` up to 600000 (10 min) — conflict. — [Eleven Music capability page](https://elevenlabs.io/docs/overview/capabilities/music); contradicted by [Compose music API reference](https://elevenlabs.io/docs/api-reference/music/compose)
- Other music features: inpainting (regenerate one section), Audio Reference (up to ~30 s reference track; v2/v2.5 "on all paid plans"), finetunes. "The Music API is available for paid subscribers." — [Eleven Music capability page](https://elevenlabs.io/docs/overview/capabilities/music)
- Music licensing (Music Terms, last updated 9 Oct 2026): Free, Starter, Creator, Pro, Scale, Business and Enterprise Music Lite — "All online and offline commercial use permitted, except film, TV, radio, and Studio Games."; Enterprise Music — "All online and offline commercial use permitted." Free requires attribution, no downloads; paid plans need no attribution. Eligibility: Starter/Creator/Pro "individual use only"; Scale fewer than 10 employees; Business fewer than 50 employees. API: Starter and above. Music-streaming distribution prohibited on Free/Starter, permitted from Creator. Monthly generation caps: Starter 17 min, Creator 62 min, Pro 304 min, Scale 1,100 min, Business 4,800 min. On downgrade, "Output remains subject to the plan in effect when that Output was created." — [Eleven Music Terms](https://elevenlabs.io/music-terms)
- Marketing statement that Eleven Music is "cleared for nearly all commercial uses, from film and television to podcasts and social media videos, and from advertisements to gaming", with per-plan detail deferred to the music terms. — [Eleven Music capability page](https://elevenlabs.io/docs/overview/capabilities/music); in tension with the per-plan table in [Eleven Music Terms](https://elevenlabs.io/music-terms)
- Music cost: $0.15 per minute (plus $1.50 per finetune) on the API price list; about 900 credits per minute on subscription credits ("exact cost varies by plan and is shown before generation"). — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api); [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Sound effects endpoint: `POST https://api.elevenlabs.io/v1/sound-generation`; body `text` (required), `loop` (default false; "loops smoothly"), `duration_seconds` (0.5–30; auto if unset), `prompt_influence` (0–1, default 0.3), `model_id` (default `eleven_text_to_sound_v2`; option `eleven_text_to_sound_v3`); query `output_format` default `mp3_44100_128`. — [Sound effects API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- SFX models: `eleven_text_to_sound_v2` is still the default but deprecated ("will be removed on March 1, 2027"); `eleven_text_to_sound_v3` follows multi-part prompts more closely, supports looping, is less likely to clip on high-frequency sounds; compare both on your prompts. — [Sound effects capability page](https://elevenlabs.io/docs/overview/capabilities/sound-effects); [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- SFX duration "0.1 to 30 seconds" (capability page) vs minimum 0.5 (API reference); max 30 s per generation; looping intended for beds longer than 30 s; MP3 for all effects, WAV 48 kHz only for non-looping effects. — [Sound effects capability page](https://elevenlabs.io/docs/overview/capabilities/sound-effects); [Sound effects API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- SFX cost: "40 credits per second when duration is specified"; 200 credits per generation when duration is automatic; $0.12 per minute on the API price list. — [Sound effects capability page](https://elevenlabs.io/docs/overview/capabilities/sound-effects); [ElevenLabs pricing](https://elevenlabs.io/pricing); [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- SFX prompting: describe action, setting, atmosphere, performance ("Rain against a window in a quiet apartment."); sequence events in order ("Footsteps on gravel, then a metallic door opens."); useful terms Ambience, Drone, Braam, Impact, Whoosh, Glitch; exact repetition counts are not always honoured. — [Sound effects capability page](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- Dialogue-side spatial processing exists via `audio_effects` (reverb environment, distance, pan, background noise) on Text to Dialogue. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)

### Inferences
- Suitable for the job: short instrumental cues (10–60 s stings, tension beds, theme) from `music_v2_5` with `force_instrumental: true` or a composition plan whose chunk durations match scene lengths; ambience loops and spot foley (door, phone, footsteps, slap, glass) from `eleven_text_to_sound_v3` with `loop: true` for room tone. A per-episode budget of ~2 min music + ~60 s SFX costs roughly 1,800 + 2,400 = ~4,200 credits (or ~$0.30 + ~$0.12 at API list price).
- For series identity, generate a small reusable cue library (main theme, 4–6 mood beds, stingers) once and reuse across episodes rather than scoring each episode from scratch; inpainting helps fix one bad section of a cue.
- Licensing is the real constraint, not capability: the self-serve exclusion of "film, TV" and the "individual use only" (Starter–Pro) / headcount (Scale, Business) eligibility rules mean a company producing a commercial web series should get the definition of "film/TV" confirmed in writing, or use Enterprise Music, or license music elsewhere. Social-media-style distribution appears to be within the permitted scope; OTT/TV-style distribution may not be.
- Set `model_id` explicitly for both music and SFX: both API defaults currently point at deprecated models.

### Gaps
- Sound Effects commercial/royalty terms were not found on the pages read (capability page is silent); presumed covered by the general paid-plan commercial licence — unverified.
- Exact definitions of "film", "TV" and "Studio Games" in the Music Terms were not extracted; nor whether vertical micro-drama apps fall inside them.
- Music stems/stem-separation and streaming endpoints were not opened (index: [music API llms.txt](https://elevenlabs.io/docs/api-reference/music/llms.txt)).
- Max music duration conflict (5 min vs 10 min) unresolved.

---

## 8. Plan needed for API, commercial licence, v3/v4 access; credits for ~70 minutes of final speech in two languages incl. retakes

### Takeaway
Any paid plan gives a commercial licence and API use; **Pro ($99/month, 600,000 credits, 10 concurrent requests, 44.1 kHz PCM/WAV via API)** is the sensible tier — it comfortably covers the speech budget with retakes and unlocks lossless output for mixing. At 1 credit per character and ~1,000 characters per minute of audio, 70 minutes of final speech is ~70,000 credits before retakes; with 3–4× takes, ~210,000–280,000 credits (double that if "70 minutes" means per language).

### Cited Findings
- Plans (USD/month, credits/month): Free $0 / 10,000; Starter $6 / 30,000; Creator $22 / 121,000; Pro $99 / 600,000; Scale $299 / 1,800,000; Business $990 / 6,000,000; Enterprise custom. Commercial licence: listed "Yes" from Starter upward, not listed for Free. — [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Included TTS minutes shown as ~10 / ~30 / ~121 / ~600 / ~1,800 / ~6,000 (i.e. ~1,000 credits per minute); extra TTS minute ~ $0.20 (Starter), ~$0.18 (Creator), ~$0.17 (Pro/Scale/Business). — [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Models page equates 100,000 characters to ~100 minutes and 5,000 characters to ~5 minutes of audio (i.e. ~1,000 chars/min). — [ElevenLabs Models](https://elevenlabs.io/docs/overview/models)
- API credit rates: v4 = 1 credit/char, v3 = 1, Multilingual v2 = 1, Flash/Turbo = 0.5. — [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Audio quality: Pro lists "44.1kHz PCM via API"; API reference confirms "PCM and WAV at 44.1 kHz require Pro tier or above" and MP3 192 kbps requires Creator or above. — [ElevenLabs pricing](https://elevenlabs.io/pricing); [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)
- Concurrency: Free 2, Starter 3, Creator 5, Pro 10, Scale 15. — [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Alternative dollar view from the API pricing page: v4 at $0.08 per 1K characters; plan dollars expressed as included v4 characters — Starter 75,000, Creator 275,000, Pro 1,238,000, Scale 3,738,000, Business 12,375,000; Free 10,000 (API access is included on Free per the FAQ). — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api); these included-character figures conflict with the credit allowances on [ElevenLabs pricing](https://elevenlabs.io/pricing)
- Pay-as-you-go credit top-ups exist and expire after 12 months; self-serve PAYG converts at the plan's rate (no per-1,000-credit overage price shown). — [ElevenLabs pricing](https://elevenlabs.io/pricing); [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- Music Terms eligibility: Starter/Creator/Pro are "individual use only"; Scale is for organisations with fewer than 10 employees; Business fewer than 50 (applies to Eleven Music rights). — [Eleven Music Terms](https://elevenlabs.io/music-terms)
- Hindi character-count caution: Devanagari conjuncts and vowel signs make characters-per-minute differ from English; measure credits per minute with a 500-character sample. — [BundledSEO ElevenLabs review](https://bundledseo.com/blog/elevenlabs-review/)
- Black Friday first-year discounts are live on the pricing page until 1 December 2026 (e.g. Creator $99 first year, Pro $445.50 first year). — [ElevenLabs pricing](https://elevenlabs.io/pricing)

### Inferences
- Speech estimate (1 credit/char, ~1,000 chars/min, to be recalibrated for Devanagari):
  - Reading A — 70 min total across both languages: ~70,000 credits final; ×3 takes ≈ 210,000; ×4 ≈ 280,000.
  - Reading B — 70 min per language (140 min total): ~140,000 final; ×3 ≈ 420,000; ×4 ≈ 560,000.
  - Audio tags and scene-level regeneration (re-rendering a whole scene to fix one line) inflate usage further; budget an extra 20–30%.
  - At API list price ($0.08/1K chars): Reading A ×4 ≈ $22; Reading B ×4 ≈ $45.
- Music + SFX for ~35 two-minute episodes (if ~2 min music and ~60 s SFX each, shared across both language versions): ~63,000 + ~84,000 = ~147,000 credits; far less with a reusable cue library.
- Plan fit: Creator (121,000 credits) covers only the bare final speech of Reading A with under 2 takes — too tight and lacks PCM/WAV; **Pro (600,000 credits)** covers Reading A with all retakes plus music/SFX in one month and Reading B with ~3× takes; Scale is only needed for higher volume, team seats, or because of Music Terms organisation-eligibility wording.
- v3/v4 access by plan was not extractable from the pricing table, but the API pricing page shows a v4 character allowance even on Free, which implies v4 is not plan-gated beyond credits.

### Gaps
- The two official pricing pages give inconsistent allowances (credits on /pricing vs dollar-derived v4 characters on /pricing/api); it is unclear whether API usage is billed in credits or dollars for a given account. Confirm in the account's usage dashboard before budgeting.
- Per-plan v3/v4 access rows and the overage price per 1,000 credits did not survive extraction; verify on the live pricing table.
- Whether Starter–Pro "individual use only" eligibility applies beyond Eleven Music (i.e. to TTS commercial use by a company) was not established.
- Characters-per-minute for Devanagari on v4 not measured; all credit figures assume the English-derived ~1,000 chars/min.

---

## 9. Official CLI, MCP server, SDKs for scripting batch generation

### Takeaway
Use the official SDKs for the batch pipeline — Python `elevenlabs` or Node `@elevenlabs/elevenlabs-js` (both at v2.70.0 as of the 28 Sep 2026 v4 release) — calling the dialogue/TTS/music/SFX/alignment endpoints directly. An official CLI (`@elevenlabs/cli`, v1.4.0) and a hosted MCP server (`https://api.elevenlabs.io/v1/mcp`, OAuth) exist and are useful for interactive/agent-driven work, but no ElevenLabs page recommends either as the batch-generation path; the old local `elevenlabs-mcp` server is deprecated and archived.

### Cited Findings
- Official REST SDKs: Python package `elevenlabs` ([GitHub](https://github.com/elevenlabs/elevenlabs-python), PyPI) and JavaScript/Node package `@elevenlabs/elevenlabs-js` ([GitHub](https://github.com/elevenlabs/elevenlabs-js), npm). — [ElevenLabs libraries page](https://elevenlabs.io/docs/eleven-api/resources/libraries.md)
- SDK escape hatch for brand-new parameters: pass them as "additional body parameter[s]" in request options; the SDK "merges these values into the JSON request body as given, without validating them." — [ElevenLabs libraries page](https://elevenlabs.io/docs/eleven-api/resources/libraries.md)
- Official CLI `@elevenlabs/cli`: install via `brew install elevenlabs/tap/elevenlabs` (recommended on macOS), Scoop on Windows, `npm install -g @elevenlabs/cli`, or curl installer from `elevenlabs/cli` GitHub releases; `elevenlabs auth login` opens browser auth; `elevenlabs generate-skills` writes a `SKILL.md` per command group into `skills/` (`--output-dir` to change). — [ElevenLabs libraries page](https://elevenlabs.io/docs/eleven-api/resources/libraries.md)
- Versions released with v4 on 28 Sep 2026: JavaScript SDK v2.70.0, Python SDK v2.70.0, ElevenLabs CLI v1.4.0 (adds Text to Dialogue PVC-as-IVC options and related types). — [ElevenLabs changelog 2026-09-28](https://elevenlabs.io/docs/changelog/2026/9/28.md)
- MCP: "The local ElevenLabs MCP server and MCP player are deprecated in favor of the hosted MCP server. Both repositories are archived and will no longer receive updates." "The hosted server is available at `https://api.elevenlabs.io/v1/mcp`", it "signs in with your ElevenLabs account through OAuth and requires no local installation or API key." — [ElevenLabs changelog 2026-08-22](https://elevenlabs.io/docs/changelog/2026/8/22.md)
- The archived local server repo/PyPI pages still exist and describe the old API-key setup (outdated). — [GitHub: elevenlabs/elevenlabs-mcp](https://github.com/elevenlabs/elevenlabs-mcp)
- A Rust crate named `elevenlabs-cli` on docs.rs is community-built and "not an official ElevenLabs release" — do not confuse with `@elevenlabs/cli`. — [docs.rs: elevenlabs-cli](https://docs.rs/crate/elevenlabs-cli/0.1.8/source/README.md)
- Auth for direct REST calls uses the `xi-api-key` header; regional hosts include `api.us.elevenlabs.io`, `api.eu.residency.elevenlabs.io`, `api.in.residency.elevenlabs.io`, `api.sg.residency.elevenlabs.io`. — [Sound effects API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- Request-stitching/history features depend on logging: `enable_logging=false` (zero-retention, enterprise only) disables history features such as request stitching. — [Text to Dialogue with-timestamps API reference](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert-with-timestamps)

### Inferences
- Recommended batch architecture: a script (Python or Node SDK, version ≥ 2.70.0) that, per episode and per language, (1) posts each scene to `/v1/text-to-dialogue/with-timestamps` with `model_id: "eleven_v4"`, `language_code`, explicit `seed`, `output_format` PCM/WAV 44.1 kHz (Pro), dictionary locators, and `previous_request_ids` chaining; (2) stores audio + `alignment` + `voice_segments` + request ID + seed per take; (3) generates music/SFX with explicit non-deprecated `model_id`s; (4) runs `/v1/forced-alignment` on final dialogue stems as QC. Respect plan concurrency (10 on Pro) with a small worker pool and retry on 422/429.
- Use the CLI/hosted MCP for casting and exploration (searching the Voice Library, quick auditions) rather than for the deterministic render pipeline; an OAuth-interactive MCP is a poor fit for unattended batch jobs.
- Pin SDK versions; v4-era fields (`audio_effects`, `future_text`, `clone_strength`) may lag in typed SDKs — use the documented additional-body-parameters escape hatch if so.

### Gaps
- No ElevenLabs statement naming a "recommended" tool for batch generation was found; the recommendation above is an inference.
- The CLI's actual TTS/dialogue/music command set was not enumerated on the page read (only `auth login` and `generate-skills`); check `elevenlabs --help` or the generated skills.
- Hosted MCP tool list (whether it exposes Text to Dialogue, with-timestamps, music, SFX) was not verified.
- No official asynchronous "batch API" for TTS (submit many jobs, collect later) was found in the pages read; absence not conclusively confirmed.
