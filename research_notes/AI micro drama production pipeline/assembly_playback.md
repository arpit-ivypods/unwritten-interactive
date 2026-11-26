# Assembly and web playback of 9:16 "motion-still" micro-drama episodes (state as of 25 Nov 2026)

Scope: ~2-minute 1080x1920 episodes built from AI stills with slow camera moves, layered dialogue/music/SFX, timed subtitles, Hindi + English; playback in a Next.js 16 / React 19 app on Vercel (polished demo, not production).

Conventions used below: "Checked" = verified in this session against a primary page or registry on 24-25 Nov 2026. "Secondary" = vendor blog / aggregator, treat as approximate. "Local check" = observed on the project Mac (Apple M5 Pro, 15 cores, Homebrew ffmpeg 8.1.1), no URL.

---

## 1. Assembly options compared (Remotion, ffmpeg, in-browser real-time, Motion Canvas / Revideo / Editly / Shotstack / Creatomate)

### Takeaway
Remotion is the best-supported route for this exact job (React components, per-frame deterministic render, first-party caption and ElevenLabs packages, same composition usable for MP4 render and in-browser Player). Plain ffmpeg is viable only for flat Ken Burns and for audio mastering; its `zoompan` filter has a long-standing sub-pixel jitter bug, and the ffmpeg installed on the project Mac cannot burn in text at all.

### Cited Findings

**Remotion (programmatic React video)**
- Latest npm release is `remotion@4.0.547`, published 24 Nov 2026; all `@remotion/*` packages (`player`, `captions`, `elevenlabs`, `media`, `lambda`) are at the same version. Checked via npm registry — [npm: remotion](https://www.npmjs.com/package/remotion)
- All `remotion` and `@remotion/*` packages must be pinned to the same exact version (remove `^`); upgrade with `npx remotion upgrade` — [Remotion: Upgrading](https://www.remotion.dev/docs/upgrading)
- Captions are processed in TypeScript with a `Caption` type and styled with HTML/CSS; can be exported burned-in or as `.srt` — [Remotion: Captions](https://www.remotion.dev/docs/captions/)
- Audio: `<Audio>` from `@remotion/media` is the recommended tag; `volume` is a number that can be computed per frame with `interpolate()` + `useCurrentFrame()` (fade example: `interpolate(frame, [0, 30], [0, 1])`); supports `trimBefore`, `durationInFrames`, `playbackRate`, `loop`, `toneFrequency`; remote URLs must be CORS-enabled; audio is extracted with Mediabunny rather than FFmpeg during render — [Remotion: Audio](https://www.remotion.dev/docs/media/audio)
- Render-speed tuning is done with `--concurrency` and `npx remotion benchmark`; default concurrency is half the available threads; higher resolution renders slower — [Remotion: Performance](https://www.remotion.dev/docs/performance), [Remotion: benchmark](https://remotion.dev/docs/cli/benchmark)

**Plain ffmpeg**
- `zoompan` options: `zoom` (range 1-10, default 1), `x`, `y`, `d` (frames per input image, default 90), `s` (default `hd720`), `fps` (default 25). Doc example for a centred zoom: `zoompan=z='min(zoom+0.0015,1.5)':d=700:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'` — [FFmpeg filters: zoompan](https://ffmpeg.org/ffmpeg-filters.html#zoompan)
- `zoompan` produces shaky output on slow zooms; ticket #4298 has been open ~10 years, the cause is attributed to sub-pixel rounding, and changing swscale algorithm does not help — [FFmpeg trac #4298](https://trac.ffmpeg.org/ticket/4298)
- The standard workaround is to upscale before zoompan (e.g. `scale=iw*8:ih*8` then zoompan), at high memory cost for large inputs — [ffmpeg-user 2016 thread](https://lists.ffmpeg.org/pipermail/ffmpeg-user/2016-February/030613.html), [FFmpeg trac #4298](https://trac.ffmpeg.org/ticket/4298)
- A fix was proposed in 2020 ("avfilter/vf_zoompan: fix shaking when zooming") and a 2025 `subpixel_zoompan` branch was posted to the ticket; neither is confirmed merged — [ffmpeg-devel patch 2020](https://lists.ffmpeg.org/pipermail/ffmpeg-devel/2020-February/257073.html), [FFmpeg trac #4298 (2025 comments)](https://ffmpeg.org/pipermail/ffmpeg-trac/2025-April/073180.html)
- `still-motion` (PyPI) wraps the same idea: scale to output x a temp factor, zoompan, scale back down — [PyPI: still-motion](https://pypi.org/project/still-motion/)
- Burning in Hindi text with ffmpeg needs libass built with HarfBuzz; without it Indic conjuncts/reordering break ("your ass library is missing harfbuzz, this cannot be fixed in FFmpeg"). The log line `Shaper: FriBidi ... (SIMPLE) HarfBuzz-ng ... (COMPLEX)` shows whether complex shaping is available — [FFmpeg trac #8738](https://lists.ffmpeg.org/pipermail/ffmpeg-trac/2020-June/054649.html), [FFmpeg trac #10384](https://trac.ffmpeg.org/ticket/10384)
- `drawtext` with Hindi fonts has its own open rendering ticket — [FFmpeg trac #9200](https://trac.ffmpeg.org/ticket/9200)
- Upstream ffmpeg download page lists releases 9.1, 9.0.2 and 8.1.3 (dates on page include 2026-11-20; version-to-date pairing not verified) — [FFmpeg download](https://ffmpeg.org/download.html)

**In-browser real-time composition**
- Remotion `<Player>` plays the same composition in the browser; previews in Studio or Player do not count as renders for licensing — [Remotion licence FAQ](https://www.remotion.dev/docs/license/faq)
- Player + audio on mobile: Mobile Safari is the strictest browser; `autoPlay` is discouraged when there is audio; call `play(e)` from a user gesture and pass the event; use `onClickCapture` not `onClick` for Safari; audio tags that start later in the timeline may be blocked unless shared audio tags are warmed up (`numberOfSharedAudioTags`, default 5 in v4, 0 in v5) — [Remotion: Player autoplay](https://www.remotion.dev/docs/player/autoplay)
- Web Audio: an `AudioContext` created before a user gesture starts `suspended` and needs `resume()` after a gesture (Chrome 71+) — [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- `gsap@3.15.1` is current on npm (11 Nov 2026). Checked via npm registry — [npm: gsap](https://www.npmjs.com/package/gsap)

**Other tools**
- Motion Canvas: MIT, 20.2k stars, repo last pushed 2 Jul 2026, but `@motion-canvas/core` latest npm release is 3.17.2 from Feb 2025. Checked — [GitHub: motion-canvas](https://github.com/motion-canvas/motion-canvas), [npm: @motion-canvas/core](https://www.npmjs.com/package/@motion-canvas/core)
- Motion Canvas has no headless render service and a smaller ecosystem; recommended for explainers/diagrams rather than batch rendering (Secondary) — [PkgPulse comparison 2026](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026)
- Revideo: the GitHub repo `redotvideo/revideo` now redirects to `midrender/revideo` (MIT, 4.2k stars, last push 15 Jul 2026); `@revideo/core` latest is 0.11.0 (10 Jul 2026). Checked — [GitHub: midrender/revideo](https://github.com/midrender/revideo), [npm: @revideo/core](https://www.npmjs.com/package/@revideo/core)
- Revideo is described as a Motion Canvas fork adding headless rendering and a library API; a vendor blog says it "folded into Midrender", a commercial visual editor (Secondary; the repo move is consistent with this) — [PkgPulse comparison 2026](https://www.pkgpulse.com/guides/remotion-vs-motion-canvas-vs-revideo-programmatic-video-2026), [Wireflow: Remotion alternatives](https://www.wireflow.ai/blog/best-remotion-alternatives-in-2026)
- Editly: MIT, 5.7k stars, not archived, but last repo push 12 May 2025 and latest npm `editly@0.14.2` from Jan 2025. Checked — [GitHub: mifi/editly](https://github.com/mifi/editly), [npm: editly](https://www.npmjs.com/package/editly)
- Shotstack: pay-as-you-go $0.30 per rendered minute (prepaid packs, one-time $75 setup fee, credits valid 1 year); subscription $39/month for 200 credits ($0.20/min); 1 credit = 1 rendered minute up to 1080p; free sandbox with 10 credits for 30 days — [Shotstack pricing](https://www.shotstack.io/pricing)
- Creatomate: credit pricing scales with pixels and frame rate, so 1080p costs more per minute than 720p; entry plan reported as $54/month (or $45 yearly) for 2,000 credits by one source and $41/month by another (Secondary, conflicting) — [Wireflow: Creatomate pricing](https://www.wireflow.ai/blog/creatomate-pricing); contradicted by [autoae: Creatomate vs Shotstack](https://autoae.online/blog/creatomate-vs-shotstack-2026)

### Inferences
- Comparison matrix (judgement based on the findings above plus general knowledge of the tools; not benchmarked in this session):

| Option | Slow pan/zoom quality | Audio mix / ducking | Captions | Render speed | Determinism | Effort |
|---|---|---|---|---|---|---|
| Remotion render | Browser-composited CSS transforms, any easing curve, spring/bezier; no zoompan-style stepping | Per-frame `volume` curves on each `<Audio>`; ducking is a keyframed curve, not signal-driven | First-party `@remotion/captions`, word-level, any CSS/webfont (browser shaping handles Devanagari) | Seconds on Lambda, minutes locally (no local figure found) | High: each frame is a pure function of frame number | Medium; React skills reused |
| ffmpeg scripts | Jittery with `zoompan` unless 4-8x pre-upscale; linear/expression easing only | Best-in-class: `sidechaincompress`, `loudnorm`, `amix` | Needs libass + HarfBuzz build; limited styling; karaoke via ASS `\k` tags | Fast | High | Low for simple, high for polish |
| Browser real-time (Remotion Player or GSAP/WAAPI + Web Audio) | GPU-smooth on capable phones; frame drops possible on low-end devices | Web Audio gain nodes; subject to autoplay/gesture rules; multi-track sync risk on iOS | Full DOM styling, live language switch without re-render | No render at all | Lower: depends on device, decode timing, thermal state | Medium-high; hardest to make robust on iOS |
| Motion Canvas / Revideo | Canvas-based, smooth | Basic | DIY | OK | High | Higher; smaller ecosystem, Motion Canvas releases stale |
| Editly | Has built-in Ken Burns-style zoom; coarse control | Basic mixing | Limited | OK | High | Low but project is dormant |
| Shotstack / Creatomate | Template-driven pan/zoom | Basic | Template captions; Devanagari support unverified | Cloud | High | Low, but per-minute fees and least control |

- Recommended split for the demo: compose and render picture + captions in Remotion; master audio stems in ffmpeg (ducking + loudnorm) and feed the mastered stem per language into the composition, or mux afterward.
- Because ffmpeg `zoompan` needs heavy pre-upscaling and still limits easing to expressions, it is a poor fit for "polished" slow moves; it remains the right tool for audio post and final transcodes/HLS packaging.
- Local check: the Homebrew ffmpeg 8.1.1 on the project Mac lists `zoompan`, `loudnorm`, `sidechaincompress`, `ebur128`, `alimiter`, `displace`, `remap`, and VideoToolbox encoders, but its build config has no libass/libfreetype/HarfBuzz, so `subtitles`, `ass` and `drawtext` filters are absent. Burned-in subtitles via ffmpeg would need a different build; rendering captions in Remotion avoids this.

### Gaps
- No measured, like-for-like quality or speed benchmark of Remotion vs ffmpeg vs Revideo for Ken Burns work was found.
- Whether the zoompan jitter fix has landed in ffmpeg 9.x was not confirmed.
- Shotstack/Creatomate rendering of Devanagari text and their easing options were not verified.

---

## 2. Remotion specifics in late 2026

### Takeaway
Remotion is still on 4.0.x (4.0.547); 5.0 is documented as "not yet released". It is free for individuals and teams of up to 3 people; larger for-profit teams need a Company Licence ($25/seat/month for Creators, or $0.01/render with a $100/month minimum for Automators, which is the bucket that covers embedding the Player). React 19 is supported and official templates are on Next.js 16.

### Cited Findings
- Version: `latest` dist-tag is 4.0.547 (24 Nov 2026); peer dependency is `react >=16.8.0`, `react-dom >=16.8.0`. Checked via npm registry — [npm: remotion](https://www.npmjs.com/package/remotion)
- "Remotion 5.0 is not yet released"; planned breaking changes include: licence key / telemetry required for company licence holders (free users pass `"free-license"`), `<Player>` `numberOfSharedAudioTags` default 5 -> 0, premount default 0 -> 2 s, `colorSpace` default `bt709`, Lambda `x264Preset` default `veryfast`, `@remotion/media-parser`, `@remotion/webcodecs`, `@remotion/whisper-web` dropped, contractors count toward team size — [Remotion: v5.0 migration](https://www.remotion.dev/docs/5-0-migration)
- React 19 has been supported since 4.0.x (guide covers upgrading `react`/`react-dom` and types); the guide's Next.js note still refers to Next.js 15 (older text) — [Remotion: React 19](https://www.remotion.dev/docs/react-19)
- Remotion's template updates in 2026 moved to Next.js 16.2.x (release notes mention 16.2.3 for a CVE fix and later 16.2.11); exact release numbers not individually verified — [Remotion release notes via newreleases.io](https://newreleases.io/project/github/remotion-dev/remotion/release/v4.0.498)
- Free Licence: individuals or teams of no more than three people; all features, unlimited commercial use — [Remotion: Licence and pricing](https://www.remotion.dev/docs/license/pricing)
- Company Licence, "Remotion for Creators": $25 per seat per month, for low-volume manual creation including with AI agents and Studio — [Remotion: Licence and pricing](https://www.remotion.dev/docs/license/pricing)
- Company Licence, "Remotion for Automators": $0.01 per render, billed in 1,000-render increments ($10), $100 monthly minimum; covers batch rendering and automated products "including embedding the Remotion Player" — [Remotion: Licence and pricing](https://www.remotion.dev/docs/license/pricing)
- Enterprise from $500/month — [Remotion: Licence and pricing](https://www.remotion.dev/docs/license/pricing)
- Headcount: total company headcount counts; contractors/freelancers/agencies working on the same Remotion project add to it; 4 or more needs a licence. If a client only receives a finished video file, the client's staff do not count. AI agents do not need a seat — [Remotion licence FAQ](https://www.remotion.dev/docs/license/faq)
- Evaluation is covered by the Free Licence while not yet used commercially. Non-profits qualify for free regardless of headcount; "unprofitable" companies do not — [Remotion licence FAQ](https://www.remotion.dev/docs/license/faq)
- A render = one successful output of a video, audio file, GIF or image sequence; stills do not count (as of Nov 2026); Studio/Player previews do not count — [Remotion licence FAQ](https://www.remotion.dev/docs/license/faq)
- `@remotion/captions` APIs: `Caption` type, `parseSrt()`, `parseVtt()`, `serializeSrt()`, `createTikTokStyleCaptions()`; install with `npx remotion add @remotion/captions` — [Remotion: captions API](https://www.remotion.dev/docs/captions/api)
- `Caption` fields: `text`, `startMs`, `endMs`, `timestampMs`, `confidence` (plus optional `pageBreakAfter`). `createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds, breakOnSilenceAfterMilliseconds?})` returns `{pages}`; each page has `text`, `startMs`, `durationMs`, `tokens[]` with `text`, `fromMs`, `toMs`. Available from 4.0.216; `breakOnSilenceAfterMilliseconds` from 4.0.514. Words need a leading space and the container needs `white-space: pre` — [Remotion: createTikTokStyleCaptions](https://www.remotion.dev/docs/captions/create-tiktok-style-captions)
- Transcription bridges into `Caption`: `@remotion/install-whisper-cpp` (`toCaptions()`), `@remotion/whisper-webgpu` (`toCaptions()`), `@remotion/openai-whisper` (`openAiWhisperApiToCaptions()`), `@remotion/elevenlabs` (`elevenLabsTranscriptToCaptions()`) — [Remotion: captions API](https://www.remotion.dev/docs/captions/api)
- `elevenLabsTranscriptToCaptions({transcript})` (since 4.0.443) accepts the ElevenLabs Speech-to-Text response (`words[]`, requires `timestamps_granularity: "word"`, example uses `model_id: scribe_v2`) or an ElevenLabs JSON export with `segments[]` (since 4.0.530). It does not document support for the Text-to-Speech "with timestamps" response — [Remotion: elevenLabsTranscriptToCaptions](https://www.remotion.dev/docs/elevenlabs/elevenlabs-transcript-to-captions)
- ElevenLabs TTS `POST /v1/text-to-speech/{voice_id}/with-timestamps` returns base64 audio plus `alignment` and `normalized_alignment` objects with parallel arrays `characters`, `character_start_times_seconds`, `character_end_times_seconds` (character-level, not word-level) — [ElevenLabs API: convert with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps/llms.txt), [ElevenLabs: streaming with timestamps](https://elevenlabs.io/docs/api-reference/streaming-with-timestamps)
- Lambda cost examples (Remotion 4.0.381, 2048 MB, us-east-1): 1-minute video (1,440 frames) $0.017 in 18.91 s warm; 10-minute HD video (14,315 frames) $0.103 in 56.09 s; 10-second 4K $0.013 in 45.28 s. Compute only; S3/egress extra; teams of 4+ still need a licence — [Remotion: Lambda cost examples](https://www.remotion.dev/docs/lambda/cost-example)
- Hardware acceleration in Remotion on macOS uses VideoToolbox, is disabled by default, and (per the docs snippet retrieved) supports only ProRes — [Remotion: hardware acceleration](https://remotion.dev/docs/hardware-acceleration)

### Inferences
- Word-level captions from ElevenLabs TTS need a small custom step: walk the `characters` array, split on spaces, take first-char start and last-char end per word, then emit `Caption` objects with a leading space. For Hindi, split on whitespace only (never per code point) so matras/conjuncts stay inside one token. Alternatively run the generated audio back through ElevenLabs Speech-to-Text (Scribe) and use `elevenLabsTranscriptToCaptions()` directly, at the cost of possible transcription errors versus the known script.
- Licence position for this demo: if the whole team touching the project (employees + contractors) is 3 or fewer, Remotion is free including the Player. If it is 4+, rendering MP4s manually falls under Creators ($25/seat/month); shipping the Remotion Player inside the app falls under Automators ($100/month minimum). Pre-rendering to MP4 and playing with a plain `<video>` avoids the Automators bucket.
- A 2-minute 1080x1920 30 fps episode is 3,600 frames. Scaling the Lambda examples (1,440 frames in ~19 s, 14,315 frames in ~56 s), a Lambda render should land around 20-40 s and a few cents; this is an extrapolation, not a measurement, and image-heavy compositions with large stills may differ.
- For a demo with a handful of episodes, local rendering on the M5 Pro is simpler than setting up Lambda (no AWS account/S3); Lambda only pays off for many episodes or re-renders.
- Remotion 5.0 could ship at any time; pin 4.0.547 and avoid relying on defaults that v5 changes (`numberOfSharedAudioTags`, premount, colour space).

### Gaps
- No published local macOS render time for a 2-minute 1080x1920 30 fps composition was found; run `npx remotion benchmark` on the M5 Pro.
- No 5.0 release date was found.
- The LICENSE.md text itself was not re-read; licence facts above come from the pricing page and FAQ.
- Whether `@remotion/media` `<Audio>` has any signal-driven (sidechain) ducking helper was not found; the docs only show keyframed `volume`.

---

## 3. Beyond flat Ken Burns: 2.5D parallax from one still

### Takeaway
The scripted recipe is: monocular depth map -> (optional) layer split + background inpainting -> depth-displacement or layered parallax render. Depth Anything V2 / DA3 Mono-Large (Apache-2.0 for the smaller checkpoints) and Apple Depth Pro (sharper edges, Apple licence) are the practical depth models; DepthFlow is the ready-made open-source renderer but is AGPL-3.0.

### Cited Findings
- Depth Anything 3 (ByteDance Seed, arXiv Nov 2025) is a visual-geometry model for any number of views; variants include Small/Base/Large/Giant plus `DA3MONO-LARGE` (monocular relative depth) and `DA3METRIC-LARGE` — [arXiv 2511.10647](https://arxiv.org/pdf/2511.10647v1), [ComfyUI docs: Depth Anything 3](https://docs.comfy.org/tutorials/utility/depth-anything-3.md)
- DA3 repo code is Apache-2.0 (6.7k stars, last push 27 Jul 2026). Checked — [GitHub: Depth-Anything-3](https://github.com/ByteDance-Seed/Depth-Anything-3)
- DA3 Giant and Nested-Giant checkpoints are CC BY-NC 4.0 (non-commercial); DA3-BASE is Apache-2.0 — [HF: da3-giant](https://huggingface.co/depth-anything/da3-giant), [HF: DA3-BASE](https://huggingface.co/depth-anything/DA3-BASE/blob/main/README.md)
- Depth Anything V2 repo is Apache-2.0 (9.2k stars). Checked — [GitHub: Depth-Anything-V2](https://github.com/DepthAnything/Depth-Anything-V2)
- Depth Pro (Apple) claims sharp boundary delineation "including fine structures", metric depth without intrinsics, in under a second; code/weights under Apple's own licence — [arXiv 2410.02073](https://arxiv.org/pdf/2410.02073), [Ultralytics: depth model guide](https://www.ultralytics.com/pt/blog/best-depth-estimation-models)
- Depth Pro repo now lives at `apple-aiml-research/ml-depth-pro` (last push 11 Sep 2026; licence not a standard SPDX). Checked — [GitHub: ml-depth-pro](https://github.com/apple-aiml-research/ml-depth-pro)
- Classic single-image pipeline (Facebook "One Shot 3D Photography"): estimate depth, lift to a layered depth image, synthesise geometry in disoccluded regions, inpaint colour there — [arXiv 2008.12298](https://arxiv.org/pdf/2008.12298)
- A 2025 student pipeline (MonoPop3D) combines SAM segmentation + MiDaS depth + LaMa background inpainting + alpha matting for cleaner boundaries — [U Toronto project report](https://www.cs.toronto.edu/~lindell/teaching/2529/past_projects/2025/report/lynn-li.pdf)
- DepthFlow: open-source "image to 2.5D parallax video" shader tool, AGPL-3.0, 1.6k stars, last push 13 Nov 2026; estimates depth with Depth Anything V2, exports H.264/HEVC/AV1, presets, seamless loops, optional upscaler; `pip install depthflow` — [GitHub: DepthFlow](https://github.com/BrokenSource/DepthFlow), [PyPI: depthflow](https://pypi.org/project/depthflow/)

### Inferences
- Scripted pipeline that fits this project: (1) run DA V2-Large or DA3 Mono-Large (or Depth Pro for hair/fine edges) on each still, save a 16-bit depth PNG; (2a) simplest: render with DepthFlow CLI to a short clip per shot and import clips into Remotion; or (2b) more control: segment foreground (SAM / matting), inpaint the background behind it (LaMa or an image-edit model), export 2-3 RGBA layers, and animate them in Remotion with different translate/scale per layer (true multiplane, no stretching artefacts); or (2c) in-browser: a WebGL depth-displacement shader (three.js / react-three-fiber) driven by the frame clock.
- Depth-displacement (2a/2c) stretches pixels at depth edges; it only holds up for small camera travel (a few percent of frame width) and slow moves. Layered + inpainted (2b) tolerates larger moves but needs per-shot QA.
- Photoreal stills: monocular depth is trained mainly on photos, so results are generally convincing for small moves. Flat 2D illustration (cel shading, line art): there are no real shading/perspective cues, so depth maps tend to be blobby or wrong across flat colour regions and line art "swims"; for flat styles, explicit layer separation (character / mid / background generated or cut as separate layers) is the safer route. This is engineering judgement; no benchmark comparing photoreal vs flat-illustration parallax quality was found.
- Licensing: DepthFlow's AGPL only matters if its code is distributed or served; using it as an offline tool to produce video files is the usual low-risk pattern, but that is a legal judgement the team should confirm. Avoid DA3 Giant checkpoints for anything commercial.
- ffmpeg has `displace` and `remap` filters (present in the local build), so a depth-displacement parallax can in principle be done in ffmpeg, but nothing found documents a robust recipe.

### Gaps
- No source describing a DA3-specific single-image parallax pipeline, and no quantitative comparison of parallax quality on illustrated vs photoreal inputs.
- Licence of `DA3MONO-LARGE` only confirmed from third-party listings (reported Apache-2.0); check the Hugging Face model card.
- Exact Depth Pro licence terms were not read.

---

## 4. Optional image-to-video motion (state of the art, late 2026)

### Takeaway
The field has moved on from the models named in the brief: as of Nov 2026 the listed leaders are Kling 4.0 / 3.0, Seedance 2.0 / 2.5, Wan 3.0, Veo 3.1 (Vertex only), Hailuo 3 / MiniMax H3, Runway Gen-4.5 and Luma Ray 3.2; the Sora 2 API was shut down on 24 Sep 2026. Typical list prices are $0.05-0.25 per second at 720p and $0.17-0.60 at 1080p, so a fully animated 2-minute episode costs roughly $15-60 per take versus effectively zero for camera moves on stills.

### Cited Findings
- Price/spec table, official API list prices checked 8 Nov 2026 by the source (Secondary, single aggregator; 720p unless noted): Kling 4.0 (launched 15 Oct 2026) 3-30 s, ~$0.157/s, 1080p ~$0.235/s; Kling 4.0 Flash ~$0.094/s 720p only; Kling 3.0 3-15 s, ~$0.094/s silent, ~$0.14/s with audio, start/end frame; Seedance 2.0 4-15 s ~$0.15/s (1080p ~$0.37); Seedance 2.5 4-30 s ~$0.23/s (1080p ~$0.57), up to 30 image references; Wan 3.0 up to 30 s, $0.0825/s (1080p $0.165); MiniMax H3 4-15 s $0.08/s at 768p; Veo 3.1 Standard 4/6/8 s $0.40/s with audio, Fast $0.10, Lite $0.05; Runway Gen-4.5 2-10 s $0.12/s at 720x1280 or 1280x720, no audio via API, "no new Runway model since Dec 2025"; Luma Ray 3.2 10 s cap $0.06/s (1080p $0.24); Pika 2.5 $0.04/s; LTX-2.5 Fast/Pro $0.09/$0.12, open weights; Gemini Omni 1.2 Flash (Google, released 5 Nov 2026) ~$0.07/s — [Teamday: best AI video models, Nov 2026](https://www.teamday.ai/blog/best-ai-video-models-2026)
- Same source: Veo 3.1 Gemini API preview was shut on 22 Oct 2026 (remains on Vertex AI); Sora 2 removed from the API on 24 Sep 2026 with no replacement listed — [Teamday: best AI video models, Nov 2026](https://www.teamday.ai/blog/best-ai-video-models-2026)
- Sora shutdown corroborated: OpenAI notified developers on 24 Mar 2026; the Sora app and sora.com closed 26 Apr 2026; Videos API and `sora-2` / `sora-2-pro` removed 24 Sep 2026 (secondary reports citing OpenAI's deprecations page) — [DEV: Sora 2 shutdown](https://dev.to/mr_manushukla/sora-2-and-the-videos-api-shut-down-on-24-september-2026-the-migration-and-the-real-cost-per-second-bek), [WaveSpeed migration guide](https://wavespeed.ai/blog/ai-guides/sora-2-api-shutdown-migration-guide/)
- Image-to-video comparison (published 29 Sep 2026, updated 15 Oct 2026): Veo 3.1 / Fast / Lite support 16:9 and 9:16, 4/6/8 s, first + last frame ($0.20-0.60, $0.08-0.30, $0.03-0.08 per second); Kling v3.0 Pro $0.112/s silent, $0.168 with audio, 3-15 s, 16:9 / 9:16 / 1:1, first + last frame; Kling v3.0 Std $0.084 / $0.126; Seedance 2.0 from $0.067/s (480p), 4-15 s, up to 4K; Seedance 2.5 from $0.103/s (480p), 4-30 s; Hailuo 3 $0.13/s at 2K, 5-15 s; Hailuo 2.3 $0.0817/s, 6 or 10 s, 1080p; Wan 3.0 $0.05 (480p) to $0.20 (1080p), 2-30 s, first frame only; Wan 2.7 $0.10; Runway Gen-4.5 $0.12/s, 16:9 and 9:16, first frame only; Grok Imagine Video 1.5 $0.08-0.25 — [OpenRouter: image-to-video models compared](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- The OpenRouter article states that specs do not reveal motion quality and recommends testing finalists on your own images — [OpenRouter: image-to-video models compared](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- Veo gained native 9:16 and 1080p output in Sept 2025; image-to-video billed at the same rate as text-to-video (older, 2025) — [Google Developers Blog: Veo 3 pricing/configs](https://developers.googleblog.com/en/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution), [The Decoder](https://the-decoder.com/google-veo-3-adds-1080p-916-video-and-drops-prices-by-half/)
- Stylised/anime handling (Secondary, vendor/affiliate blogs that disagree with each other): Kling 3.0 Pro called the strongest overall for anime/stylised video with camera-driven shots; Seedance repeatedly described as strongest on identity preservation; Hailuo 2.3 described as "committing to illustrated proportions" rather than forcing realistic physics; Wan positioned as the cheap/open-weights option for style fine-tuning — [Infer: AI models for anime video](https://tryinfer.com/best/ai-models-for-anime-video), [Screenweaver: best AI video model for anime](https://www.screenweaver.ai/blog/best-ai-video-model-anime), [8frame: best image-to-video 2026](https://www.8frame.co/blog/best-image-to-video-ai-2026)
- Chinese AI "manju" (anime/comic-styled AI dramas) deliberately favour an illustrated look to sidestep the photoreal uncanny valley; about 220,000 new ones reportedly hit Douyin in H1 2026 (second-hand DataEye/FT figure) — [aidramareviews: what are AI dramas](https://aidramareviews.com/guides/what-are-ai-dramas.html), [Substack: The hit anime series Japan didn't make](https://jeromemazandarani.substack.com/p/the-hit-anime-series-japan-didnt)

### Inferences
- Cost arithmetic for one 2-minute episode animated end to end as ~30 five-second clips (150 s), single take, no retries: Kling 3.0 silent 720p ~ $14; Kling 4.0 1080p ~ $35; Seedance 2.5 720p ~ $35; Seedance 2.0 1080p ~ $56; Veo 3.1 Standard ~ $60. Real cost is typically 2-4x after rejects. Camera moves on stills cost only render time.
- Most cheap tiers output 720p; 1080x1920 delivery needs either the 1080p tier (roughly 1.5-2.5x the price) or an upscale pass.
- For "subtle living motion from a still" (blink, hair, breath, drifting smoke) with character consistency, first-frame-conditioned models with start/end-frame control (Kling 3.0/4.0, Seedance 2.x, Veo 3.1) are the natural shortlist; using the same still as first and last frame constrains drift and gives loopable ambient motion. This is a workflow inference, not something the sources tested.
- Flat 2D illustration is the higher-risk case: models may re-render line art with shading/3D-ish motion or let features drift. The sources that address it are low-quality and disagree, so a bake-off on 3-5 of the project's own stills across Kling, Seedance and Hailuo is the only reliable answer.
- When it is worth it: hero shots where stillness reads as cheap (episode hook in the first 3-5 s, emotional close-ups, the cliffhanger beat, physical action), not for every shot. A hybrid of roughly 3-6 animated clips per episode plus camera-moved/parallax stills keeps cost in the low single-digit dollars per episode and limits consistency risk.
- Use the video models' audio off (silent tier where offered); dialogue and music come from the project's own pipeline.

### Gaps
- No primary vendor pricing pages were read; all prices come from two aggregators whose numbers differ (e.g. Wan 3.0 $0.0825 vs $0.05-0.20; Seedance per-second vs token billing). Verify on each vendor's page before budgeting.
- No rigorous, independent late-2026 benchmark for image-to-video on flat 2D illustration or for subtle-motion fidelity was found.
- 9:16 support is confirmed in sources only for Veo 3.1, Kling 3.0 and Runway Gen-4.5; unconfirmed here for Seedance, Wan, Hailuo, Luma (likely supported, not verified).
- "Gemini Omni 1.2 Flash" and "Kling 4.0" appear only in the Teamday roundup; not corroborated by a second source in this session.

---

## 5. Delivery and playback (MP4/HLS vs real-time; autoplay; hosting; two audio languages; subtitles)

### Takeaway
For a polished demo, pre-render each episode to H.264 MP4 and play it in a plain `<video playsInline>`; treat real-time composition as an optional enhancement. Start playback from the user's tap (which also satisfies sound rules), preload only the next episode, and render subtitles as a custom DOM overlay driven by caption JSON rather than native WebVTT `::cue`. Two languages are simplest as two mastered files per episode (or one Mux asset with an alternate audio track); HLS alternate audio works but has an open iOS 26 switching bug.

### Cited Findings

**Autoplay and sound**
- Chrome: muted autoplay always allowed; autoplay with sound allowed if the user has interacted with the domain (click/tap), or on desktop the Media Engagement Index threshold is crossed, or the site is installed/added to home screen. MEI applies to desktop only. Always handle the `play()` promise rejection and show a play button — [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay)
- WebKit/iOS: video can autoplay without a gesture only if it has no audio track or is `muted`; if it becomes un-muted without a user gesture, playback pauses; `playsinline` keeps it inline (policy dates from iOS 10; still the baseline) — [WebKit: New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)
- Safari may allow more media to play for a while after a gesture, but this depends on battery saver mode and thermal pressure; attempt playback with audio and handle failure — [Remotion: Player autoplay](https://www.remotion.dev/docs/player/autoplay)
- Next.js guidance: with `autoPlay` also set `muted` and `playsInline` for iOS; use `preload="none"` with a `poster`; set dimensions or `aspect-ratio` to avoid layout shift; subtitles via `<track>`; hosting options named are Vercel Blob, `next-video`, Mux, Cloudinary (page updated 31 Aug 2026) — [Next.js: videos guide](https://nextjs.org/docs/app/guides/videos)
- Current versions: `next@16.4.6`, `react@19.3.1`, `hls.js@1.7.4`, `@mux/mux-player-react@3.14.1` (peer deps include React 19), `next-video@2.8.3`. Checked via npm registry — [npm: next](https://www.npmjs.com/package/next), [npm: hls.js](https://www.npmjs.com/package/hls.js), [npm: @mux/mux-player-react](https://www.npmjs.com/package/@mux/mux-player-react)

**HLS vs progressive MP4, preloading**
- For short clips Mux's own guidance is that MP4 may be more compatible and easier to preload, with HLS for longer content or adaptive quality — [Mux: background video guidelines](https://www.mux.com/articles/guidelines-for-better-website-background-videos)
- Mux documented a Mobile Safari bug with short looping HLS and recommended an MP4 fallback (2021, older) — [Mux blog: Mobile Safari HLS bug](https://mux.com/blog/mobile-safari-hls-bug-with-short-form-looping-videos)
- hls.js supports iOS Safari 17.1+ via Managed Media Source since hls.js 1.5; older iPhones have no MSE and use native HLS — [GitHub: hls.js](https://github.com/video-dev/hls.js/)
- Meta's Reels/Facebook feeds use an "adjacent preload" strategy that keeps the videos right after the current one ready (Android Media3 case study, Mar 2026) — [Android Developers Blog](https://android-developers.googleblog.com/2026/03/instagram-and-facebook-deliver-instant.html)

**Hosting costs**
- Mux: Free plan stores up to 10 on-demand assets of any duration/quality with 100,000 free delivery minutes per month; small Mux badge on the player unless a card is added (launched 1 May 2025; the 1080p cap on free minutes was later removed) — [Mux blog: free plan](https://www.mux.com/blog/free-plan), [Mux pricing](https://www.mux.com/pricing)
- Mux list rates (1080p, basic): encoding free; storage $0.003/min/month; delivery $0.001/min after the 100,000 free; Launch plan $20/month for $100 credit; Mux Player and Mux Data included — [Mux pricing](https://www.mux.com/pricing)
- Mux alternate audio: add each language with the create-asset-track API (audio file URL + language code) once the asset is `ready`; Mux adds it to the HLS manifest automatically; Mux Player shows an audio menu; alternate tracks are billed at audio-only rates; supported on baseline assets since Aug 2024 — [Mux: alternate audio tracks](https://www.mux.com/docs/guides/add-alternate-audio-tracks-to-your-videos)
- Cloudflare Stream: storage $5 per 1,000 minutes stored (prepaid), delivery $1 per 1,000 minutes delivered, encoding and ingress free, no free tier noted (page updated 27 Oct 2026) — [Cloudflare Stream pricing](https://developers.cloudflare.com/stream/pricing/)
- Vercel Blob: Hobby includes 1 GB storage, 10 GB data transfer, 10,000 simple and 2,000 advanced operations per month; exceeding Hobby limits blocks Blob access for 30 days rather than billing; Pro example rates $0.023/GB storage and $0.05/GB transfer (iad1); 512 MB per-blob cache limit; 5 TB max file (page updated 23 Sep 2026) — [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)

**Two audio languages**
- HLS alternate audio is declared with `#EXT-X-MEDIA:TYPE=AUDIO` renditions sharing one `GROUP-ID`; with hls.js the switcher uses `hls.audioTracks` and the `AUDIO_TRACKS_UPDATED` event; on the native path the OS audio menu is driven by the manifest — [DEV: multi-language audio in HLS](https://dev.to/masonwritescode/ship-multi-language-audio-in-hls-author-the-manifest-wire-the-hlsjs-switcher-c7)
- One player vendor states iOS Safari does not allow programmatic switching of audio tracks on the native player (only via the native menu) — [Player.js docs: audio tracks](https://playerjs.com/docs/en=audiotracks)
- Open iOS 26 bug: with native HLS (also reproduced in THEOplayer), selecting some alternate tracks falls back to the `DEFAULT=YES` track, or switching back to the default fails; not reproducible on iOS 17/18; reporter's workaround is to list the `DEFAULT=YES` rendition last in the manifest; no Apple reply — [Apple Developer Forums thread 818465](https://developer.apple.com/forums/thread/818465)

**Subtitles**
- Native WebVTT styling via `::cue` is inconsistent across browsers and severely limited, and karaoke-style captions are not supported out of the box in most browsers; cue positioning is interpreted differently per browser — [npm: media-captions README](https://www.npmjs.com/package/media-captions)
- Chrome and Safari do not support WebVTT line-align/position-align — [W3C WebVTT implementation report](https://www.w3.org/wiki/TimedText/WebVTT_Implementation_Report)
- `media-captions` (custom VTT/SRT/SSA renderer) is at 0.0.18, last published Jul 2024 (stale). Checked via npm registry — [npm: media-captions](https://www.npmjs.com/package/media-captions)

### Inferences
- Recommended demo architecture: (1) Remotion renders one picture-only (or picture + default audio) 1080x1920 H.264 MP4 per episode with `+faststart`; (2) either two fully mastered MP4s per episode (hi/en) hosted on Vercel Blob, or one Mux asset per episode with the second language as an alternate audio track; (3) subtitles shipped as JSON (the same `Caption[]` used in Remotion) and drawn by a React overlay synced with `requestVideoFrameCallback` / `timeupdate`.
- Two MP4s per episode is the most robust language switch for a demo: swap `src`, seek to the saved `currentTime`, resume inside the same tap handler. Cost is double storage and a brief rebuffer. A separate `<audio>` element per language synced to a muted `<video>` avoids the rebuffer but drifts and is fragile on iOS (two media elements, one gesture) and is not recommended.
- HLS alternate audio is the "correct" streaming answer and gives seamless switching through hls.js on iOS 17.1+ (MMS) and desktop; but given the open iOS 26 native-path bug and the conflicting statements about programmatic switching on iOS, it needs device testing. If used, force the hls.js/MMS path where available and put the default rendition last.
- Adaptive bitrate adds little for 2-minute clips on a demo; a single ~3-4 Mbps 1080x1920 H.264 rendition (roughly 45-60 MB per episode, estimate) plus optionally a 720x1280 fallback is enough. With Mux, ABR comes for free.
- Hosting fit: Mux Free covers a demo of up to 10 episodes when languages are alternate tracks on the same asset (it would not if each language were a separate asset beyond 10). Vercel Blob Hobby's 10 GB/month transfer is about 170-220 full plays of a ~50 MB episode (estimate), and overrunning locks the store for 30 days, so Blob on Hobby is only safe for a privately shown demo; Blob on Pro is roughly $0.05/GB. Cloudflare Stream is $5/month minimum with no free delivery.
- Sound-on UX: do not attempt unmuted autoplay on load. Use an explicit "tap to play" poster for the first episode; that gesture unlocks sound for the session in Chrome and usually for subsequent programmatic plays in Safari. On swipe to the next episode, call `play()` inside the gesture handler and fall back to muted + "tap for sound" if the promise rejects (Low Power Mode, thermal state).
- Preloading: keep at most the next episode warm. For MP4, a hidden `<video preload="auto" muted playsInline>` or `<link rel="preload" as="video">` for the next file; for HLS, attach the next source so the first segments buffer. Avoid preloading more than one ahead on mobile data.
- Custom subtitle overlay beats both alternatives here: burned-in text cannot switch language and doubles the number of renders; native WebVTT cannot do reliable karaoke or consistent styling. A DOM overlay gets browser text shaping for free, which handles Devanagari conjuncts and mixed Hindi/Latin runs correctly, provided a font with both scripts is loaded (e.g. Noto Sans Devanagari paired with a Latin face, or a single family covering both) and `lang="hi"` is set.
- Karaoke highlighting rules for Hindi: tokenise by whitespace-delimited word (as `createTikTokStyleCaptions` does), never by character or code point; if sub-word animation is ever needed, segment with `Intl.Segmenter` grapheme clusters so matras and half-forms are not split. Avoid letter-spacing and per-letter transforms on Devanagari.
- If subtitles are burned in for social cut-downs, do it in Remotion (Chromium shaping), not ffmpeg, given the libass/HarfBuzz dependency and the local build lacking libass.
- Real-time composition (Remotion Player or GSAP + Web Audio) gives instant language/subtitle switching and tiny payloads (stills + audio), but is the riskiest path on iOS: delayed audio tags can be blocked, decode/thermal hitches show as stutter in slow moves, and 4+ person teams pay the Automators licence. Reasonable as a desktop "director's mode", not as the primary mobile player.

### Gaps
- No current (2025-2026) WebKit statement on autoplay relaxations in iOS 17+ was found; one secondary write-up claims a single gesture can unlock several videos, unverified.
- Whether iOS Safari's `video.audioTracks` allows programmatic switching on native HLS in iOS 26 is unresolved (sources conflict); needs a device test.
- No source specifically on Devanagari rendering inside native WebVTT cues on iOS Safari.
- Mux per-minute rates for 720p and audio-only tracks, and Vercel Blob regional rates beyond the iad1 example, were not retrieved.
- hls.js configuration specifics for alternate-audio switching on Managed Media Source were not read.

---

## 6. How existing micro-drama apps and AI motion-comic tools structure episodes

### Takeaway
The documented convention is vertical 9:16, 1-2 minute episodes (60-90 s is common for paid apps), 50-100 episodes per series, a hook in the first seconds and a cliffhanger at the end of nearly every episode, with a paywall around episodes 8-12. Hard, measured data on shot length and subtitle styling is not publicly documented; the available numbers are vendor guidance (roughly 3-5 s average shot, faster at peaks).

### Cited Findings
- Micro-dramas typically run 1-2 minutes per episode, 20-100 episodes per series, shot in 9:16, professionally produced, fast-paced and melodramatic; nearly every episode ends on a cliffhanger; common genres are billionaire/CEO romance, revenge, identity reveal, family drama — [Wikipedia: Microdrama](https://en.wikipedia.org/wiki/Microdrama)
- Monetisation: pay-per-episode typically $0.30-0.50 or $10-15 per series in high-income markets; ad-supported or hybrid elsewhere; in China ad-driven overtook pay-per-episode by 2025 — [Wikipedia: Microdrama](https://en.wikipedia.org/wiki/Microdrama)
- Scale: ReelShort about $400M revenue in 2024 and 45M MAU (70% women, half in the US); DramaBox $323M revenue in 2024, ~44M MAU; global revenue about $11B in 2025 (figures as cited there from Sensor Tower and trade sources) — [Wikipedia: Microdrama](https://en.wikipedia.org/wiki/Microdrama)
- ReelShort/DramaBox-style series typically run 60-100 episodes with a paywall between roughly episode 8 and 12; an episode carries about 180-360 spoken words in 2-4 scenes with a turn roughly every 30 seconds (script-tool guide, advisory) — [SceneMixer: vertical short drama script format](https://scenemixer.com/guides/vertical-short-drama-script-format/)
- A 90-second beat template: hook in the first ~5 s, setup, escalation, cliffhanger at 70-90 s (advisory blog) — [Scenepaper: how to write a vertical micro-drama script](https://scenepaper.com/blog/how-to-write-a-vertical-micro-drama-script)
- Editing-pace guidance from an AI studio vendor (no methodology or dataset given): 60-90 s is standard and 75 s most common; a 75 s episode has 15-25 cuts; average shot about 3-5 s versus 8-12 s in long-form TV drama; hook (0-15 s) 2-4 s per cut, escalation (15-60 s) 1-2 s per cut, spike/button (60-90 s) sometimes under 1 s; series 50-90 episodes — [Axis AI Studios: editing vertical dramas](https://www.axisaistudios.com/blog/editing-vertical-dramas-pacing-and-cut-rhythm)
- Framing: faces large; two-person close-ups dominate 9:16 (AI production guide) — [SceneMixer: make ReelShort-style dramas](https://scenemixer.com/guides/make-reelshort-style-dramas/)
- India market (Nov 2026): more than 118M people watch microdramas monthly; analysts expect $3-4B annual revenue by 2030; Redseer says 40M+ have paid at least once but only 15-17M pay monthly; Ormax says 72% have never paid — [TechCrunch, 3 Nov 2026](https://techcrunch.com/2026/11/03/indias-eloelo-nabs-80m-from-nbc-universal-to-bet-on-the-countrys-rising-microdrama-market/)
- Story TV (EloElo): 33M+ active users (analyst estimate), 5,000+ titles in six languages, 95 minutes average daily use, monthly/quarterly/yearly subscriptions plus some free ad-supported content; in-house "Dolphin AI" editor with templates and image/audio/video models; raised $80M led by Hornbill and NBCUniversal at a $500M valuation; content described as "snackable", not appointment viewing — [TechCrunch, 3 Nov 2026](https://techcrunch.com/2026/11/03/indias-eloelo-nabs-80m-from-nbc-universal-to-bet-on-the-countrys-rising-microdrama-market/)
- Kuku TV launched with episodes of up to two minutes and 50+ episodes per series on a subscription model (launch coverage, early 2025, older) — [IndianStartupNews: Kuku TV launch](https://indianstartupnews.com/news/kuku-fm-enters-indias-video-streaming-market-with-microdrama-ott-platform-kuku-tv-8721360)
- Kuku showed "India's first AI-generated microdrama" slate at the India AI Impact Summit 2026 (article dated 3 Mar 2026): mytho-inspired, futuristic and superhero genres; Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali; generative AI across script, dialogue, visuals and edit; claimed cost drop from about Rs 1 crore over 3-6 months to about Rs 20 lakh in about a week for a short film (investor blog) — [3one4 Capital blog](https://www.3one4capital.com/blogs/kuku-launches-indias-first-slate-of-ai-powered-microdramas)
- Pocket Toons (Pocket Entertainment) is an AI-first comics platform (beta Jan 2025, 30+ titles at launch); its "Blaze!" studio claims 20x throughput at one-third the cost and three comic episodes per day versus an industry norm of three per week; $15M committed with a $100M ARR target by 2026 (2025 coverage; it is a webcomic reader, not a motion-video format) — [YourStory, Feb 2025](https://yourstory.com/2025/02/pocket-fm-pocket-toons-ai-powered-comics-platform)
- "AI dramas" are described as vertical 60-120 second serials made with generative AI; the Chinese "AI manju" variant is comic/anime-styled, mostly fully AI-generated with humans handling story, prompts, continuity and final edit — [aidramareviews: what are AI dramas](https://aidramareviews.com/guides/what-are-ai-dramas.html)

### Inferences
- A ~2-minute episode sits at the long end of the convention (Indian apps "up to two minutes"; paid Western apps 60-90 s). For a demo, 90-120 s with a hard hook in the first 3-5 s and a cliffhanger button in the last 5-10 s matches audience expectation.
- Shot budget for motion-stills: live-action guidance of 3-5 s average implies 25-40 shots in 120 s. Stills with slow moves read better held slightly longer (about 3-6 s), with faster 1-2 s inserts at peaks; plan roughly 25-35 stills per episode. This is a derived planning number, not a measured norm for motion comics.
- Subtitle convention observed generally in the category (bottom-centre, large bold sans with dark outline/shadow, 1-2 short lines, inside the safe area above app chrome) could not be sourced; treat as an assumption and verify by watching reference apps.
- Indian apps are subscription-led and multilingual by default, so a Hindi/English toggle on audio and subtitles is consistent with the category.

### Gaps
- No measured shot-length study of ReelShort/DramaBox/Kuku TV/Story TV episodes was found; all pacing numbers are vendor or blog guidance.
- No documented subtitle-style conventions (font, size, placement, burned-in vs toggle) for any of the named apps.
- No engineering blog from ReelShort, DramaBox, Kuku or Story TV on their player/delivery stack was found.
- No evidence that Pocket Toons ships a vertical motion-comic video format; no 2026 update on it was found.
- Episode length and visual technique (image-to-video vs animated stills) of Kuku's AI microdramas are not documented in the sources read.

---

## 7. Audio post: loudness targets, ducking, scripted mastering with ffmpeg

### Takeaway
There is no official loudness spec for mobile short-video platforms; -14 LUFS integrated with a -1 dBTP ceiling is the most widely cited target and a sound default for a phone-first web player. Do ducking with `sidechaincompress` (music keyed by dialogue) and finish with two-pass `loudnorm`, applying identical settings to the Hindi and English mixes.

### Cited Findings
- Platform targets: YouTube about -14 LUFS (observed, not published); TikTok/Instagram/Meta publish no target (about -14 observed, context-adaptive), -1 dBTP advised; Spotify -14 LUFS official; Apple Podcasts -16 LUFS +/-1 official; Netflix -27 LKFS dialogue-gated, -2 dBTP; EBU R128 -23 LUFS, -1 dBTP — [Fora Soft: LUFS targets per platform 2026](https://www.forasoft.com/learn/audio-for-video/articles-audio/lufs-targets-per-platform-2026)
- AES TD1008 recommends normalising speech to about -18 LUFS versus -16 LUFS for music because speech reads louder at the same meter value; EBU R128 s4 caps loudness-to-dialogue ratio at 5 LU for cinematic mixes (as summarised by the same article) — [Fora Soft: LUFS targets per platform 2026](https://www.forasoft.com/learn/audio-for-video/articles-audio/lufs-targets-per-platform-2026)
- Other vendor guides give louder short-form figures (-9 to -12 LUFS) or -16 LUFS; they disagree (Secondary) — [Opus: loudness normalizers](https://opus.pro/blog/best-loudness-normalizers), [OpenClip: audio normalization](https://openclip.app/learn/audio-normalization)
- A social-video tooling repo standardises on `loudnorm` I=-14, TP=-1, LRA=11 — [video-use loudness doc](https://instagit.com/browser-use/video-use/social-media-loudness-normalization-targets.md)
- `loudnorm`: EBU R128 normalisation with single-pass and double-pass modes; options `I` (range -70 to -5, default -24), `LRA` (1-50, default 7), `TP` (-9 to 0, default -2), `measured_I`, `measured_LRA`, `measured_TP`, `measured_thresh`, `offset`, `linear` (default true; needs all measured values, else reverts to dynamic), `dual_mono`, `print_format` (summary/json/none). In dynamic mode audio is upsampled to 192 kHz, so set the output rate explicitly with `-ar` — [FFmpeg filters: loudnorm](https://ffmpeg.org/ffmpeg-filters.html#loudnorm)
- `sidechaincompress`: two inputs (signal to compress, then sidechain), one output; `threshold` default 0.125 (range 0.00097563-1), `ratio` default 2 (1-20), `attack` default 20 ms, `release` default 250 ms, `makeup` default 1, `knee` default 2.82843, `detection` rms by default, `level_sc`, `mix`. Doc example: `ffmpeg -i main.flac -i sidechain.flac -filter_complex "[1:a]asplit=2[sc][mix];[0:a][sc]sidechaincompress[compr];[compr][mix]amerge"` — [FFmpeg filters: sidechaincompress](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress)

### Inferences
- Suggested targets for this project: integrated -14 LUFS, true peak -1 dBTP (use -1.5 if encoding to low-bitrate AAC), LRA about 7-11 so quiet lines survive phone speakers; dialogue stem itself around -16 to -18 LUFS before the final normalise; music bed about 12-18 dB under dialogue while speech is present (rule of thumb, not sourced).
- Scripted chain per language (built from the documented filters; parameter values are starting points to tune by ear):
  1. Build stems: `dialogue_<lang>.wav` (all lines placed on the timeline), `music.wav`, `sfx.wav`.
  2. Duck music under dialogue and mix:
     `ffmpeg -i music.wav -i dialogue_hi.wav -i sfx.wav -filter_complex "[1:a]asplit=2[dlg][key];[0:a][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[duck][dlg][2:a]amix=inputs=3:normalize=0[mix]" -map "[mix]" premix_hi.wav`
  3. Pass 1 measure: `ffmpeg -i premix_hi.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -`
  4. Pass 2 apply with the measured values: `-af loudnorm=I=-14:TP=-1:LRA=11:measured_I=...:measured_LRA=...:measured_TP=...:measured_thresh=...:offset=...:linear=true -ar 48000 -c:a aac -b:a 192k`
  5. Verify with `ebur128` (present in the local build).
- Run the same chain for Hindi and English so both tracks land at the same loudness and switching languages has no level jump; duck from each language's own dialogue stem because line timings differ.
- Alternative: do ducking as keyframed `volume` curves in Remotion from the known dialogue timings (deterministic, no signal detection) and use ffmpeg only for the final two-pass loudnorm on the rendered audio.
- Phone speakers reproduce little below roughly 150-200 Hz, so keep dialogue intelligibility in the mids and avoid relying on sub-bass SFX; check mixes on an actual phone speaker. General engineering practice, not sourced here.

### Gaps
- No official loudness specification from TikTok, Instagram, ReelShort, DramaBox or the Indian apps was found.
- No authoritative source for music-under-dialogue ducking depth in dB; one unattributed blog figure of 12-14 dB below voice surfaced in search but could not be traced to a specific page.
- `amix` option details (`normalize=0`) and AAC true-peak overshoot behaviour were not re-read in the ffmpeg docs during this session.
