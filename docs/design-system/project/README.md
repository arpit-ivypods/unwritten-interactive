# Unwritten

Two-minute dramas where the audience picks the ending. This is the design system for the Unwritten viewer app, built from design direction C, "Spatial Stage": one vertical player in the middle of the room, frosted glass panels around it, and a page lit by whatever is playing.

## The idea in one picture

- **The stage.** A vertical 9:16 player is the deepest, darkest object on every screen. Film is always dark, in both themes.
- **The room.** The page behind it is a heavily blurred still from the current episode under a veil. The colour of the interface comes from the story, not from decoration.
- **The glass.** Everything the viewer reads or presses sits on frosted glass floating between the room and the stage.

If a screen has no stage, no backdrop still, or glass on a flat colour, it is off system.

## Voice and content

- **Say what happens.** Buttons name the result: "Cast my ballot", "Watch the other ending", "Play episode 3". Never "OK", "Next" or "Submit".
- **Interface in English, story in the story's language.** Navigation, status and help text are English. Titles, questions, choices and subtitles are in the language of the audio.
- **Hinglish is written the way it is spoken.** Hindi words in Devanagari, English words in Latin script, in the same line: "यह file किसने खोली?". Never transliterate an English word into Devanagari and never write Hindi in Roman letters. The same text is sent to the voice model, so what is read is what is heard.
- **English mode is a full adaptation,** not a word-for-word translation. Names, places and kinship words (Papa, chacha, didi) stay as they are.
- **Choices are in the character's world.** "सच बता दो", not "Option A: confront".
- **Be exact about time.** "Closes in 02:14:09", "Day 1 · both endings open", "Only open on day 1". The day-one rule is the product; never soften it to "limited time".
- **Demo numbers are labelled.** Any tally in the prototype says "Simulated demo ballots".
- Sentence case everywhere. Uppercase only in `text-label` and the speaker tag, and only for Latin script.

## Colour

| Role | Tokens | Rule |
|---|---|---|
| Room | `ground`, `veil` | `ground` under a blurred still (`blur-ambient`), `veil` over it. |
| Glass | `glass`, `glass-strong`, `glass-border`, `hairline` | `glass` for panels, `glass-strong` for rows and secondary controls on a panel. |
| Text | `ink`, `ink-muted`, `on-ink` | `ink` and `ink-muted` on room and glass; `on-ink` on ink fills. |
| Violet | `brand`, `brand-text`, `on-brand`, `brand-soft` | The product's voice and choice A. `brand` is a fill, `brand-text` is text. |
| Saffron | `saffron`, `saffron-text`, `on-saffron` | The second voice and choice B. Also the dot in the mark and the speaker tag. |
| State | `live`, `alert` | Day-one open and closing/expired. Small, and always with words. |
| Film | `stage`, `on-stage`, `scrim`, `subtitle-plate`, `subtitle-active` | Only inside the player. Identical in both themes. |

- Violet and saffron are a fixed pair: A is always violet and on the left, B is always saffron and on the right. They differ in lightness as well as hue, and are always accompanied by the letter.
- One primary (`brand`) button per screen.
- Text meets 4.5:1 on the grounds named in each token's note. Text over artwork is only ever `on-stage` on `scrim` or `subtitle-plate`.
- Dark theme is the same layout with the dark values; the stage does not change.

## Type

Plus Jakarta Sans for Latin and Anek Devanagari for Devanagari, loaded from Google Fonts and combined in one stack (`font-sans`) so every line, subtitles included, picks the right face per script. There is no separate Devanagari stack.

- `display-hero` 78px: one per desktop screen. `display-title` 34px: ballot question and phone titles. `display-heading` 24px: series and panel headings.
- `text-lead` 18px, `text-body` 15px, `text-caption` 13px, `text-label` 12px uppercase.
- `subtitle` 20px/1.4 bold on `subtitle-plate`; two lines, about 32 characters each; the spoken word in `subtitle-active`.
- Devanagari needs room: never set it tighter than 1.3 line height, never track it, never uppercase it, and set display sizes at weight 700 rather than 800. Mark every Hindi element with `lang="hi"`; the stylesheet then removes tracking and applies the taller line height and lighter weight for you.

## Shape, depth and glass

- Everything is rounded. Controls are pills (`radius-pill`); rows `radius-lg`; panels `radius-xl` or `radius-2xl`; the stage `radius-stage` (desktop) or `radius-2xl` (phone).
- Glass recipe: `glass` fill + `backdrop-filter: blur(blur-glass) saturate(180%)` + 1px `glass-border` + `shadow-panel`. No gradients on glass. No glass inside glass.
- Three depths only: floating controls (`shadow-float`), panels (`shadow-panel`), the stage (`shadow-stage`). The phone sheet uses `shadow-sheet`, the panel shadow cast upward.
- Desktop layout: stage centred, hero panel left, ballot and supporting panels right, nav pill top, series dock bottom. Side panels may tilt up to 7 degrees toward the stage.
- Phone layout: slim nav pill at the top, stage full width with 16px gutters, one bottom sheet (`uw-glass--sheet`) over the lower part of the stage, and the dock at the bottom when no sheet is open. Nothing tilts.
- Inside the stage, controls and cards are dark glass: `stage-glass` for small controls, `scrim` behind anything that carries text, both edged with `stage-glass-border`.

## Motion

- `dur-tap` 160ms for press feedback, `dur-move` 420ms for panels and sheets, `dur-scene` 900ms for the backdrop cross-fade. `ease-out` for anything arriving; `ease-in-out` for camera moves and cross-fades.
- The room follows the film: when the shot or episode changes, the backdrop cross-fades to a still from it.
- Pointer tilt on desktop panels is at most 3 degrees of extra rotation and never moves text more than 6px.
- The ballot is a held moment: the stage dims (`uw-stage--dim`), the question card rises, then the two glimpses side by side, and nothing else moves.
- Loading uses a slow pulse on skeleton bars and one spinner inside the stage; nothing else on the page animates while it waits.
- With `prefers-reduced-motion`, cross-fades stay, tilt and parallax are removed, and camera moves inside episodes are replaced by cuts.

## Iconography and logo

- Line icons, 24px grid, 1.75px stroke, round caps. The set in **Icons** covers play, pause, check, arrow, clock, lock, share, sound, captions, language, replay, branch, eye and close. For anything else use the matching Lucide icon at the same stroke.
- The mark is a path forking in two with a saffron dot at the fork. The wordmark is live text: "Unwritten" at weight 800 followed by a `brand-text` full stop. See **Logos**.
- No emoji, no illustrations in the interface. Pictures only come from the stories.

## Using the system in code

- Load `tokens.css`, then `components/bundle.css`. Wrap the app in an element with class `uw`; set `data-theme="light"` or `"dark"` on `<html>`.
- Every screen root is `uw-ambient` containing an `img.uw-ambient-img` (a still from the current episode).
- Components are plain classes prefixed `uw-` (`uw-glass`, `uw-btn`, `uw-stage`, `uw-option` and so on); each component page shows the markup. There is no JavaScript bundle: behaviour is written in the app.
- Put `lang="hi"` on every element whose text is Hindi (titles, options, subtitle lines). It drives the Devanagari type rules and screen-reader pronunciation.
- In Tailwind v4, map the tokens once in `@theme` (for example `--color-brand: var(--brand)`) and keep using the token names.
- Fonts: `Plus Jakarta Sans` (400–800) and `Anek Devanagari` (500–800) from Google Fonts, or `next/font/google` in the app.

## The screens and their components

| Step in the product | Components |
|---|---|
| Welcome | LanguagePicker |
| Home and series | NavBar, SeriesCard, TeaserTile, StatusChip, Countdown, EpisodeRail |
| Watching | PlayerStage, Subtitles, LanguageSwitch, StageStates, Toast |
| The question and the vote | QuestionCard, TrailerCard, BallotSheet, BallotOption, TallyBar |
| After an ending (day 1) | OtherEndingPanel, ShareCard |
| Day 2 | ResultPanel, StageStates (expired) |
| Studio | PipelineStep, GlassPanel |
| Presenting the demo | DemoDrawer |

## What is placeholder

The three images in **Stills** come from the earlier concept note and only demonstrate how components sit over film. Sample titles, questions and subtitle lines in the previews are specimens, not story content.
