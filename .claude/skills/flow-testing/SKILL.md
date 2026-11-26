---
name: flow-testing
description: Test engineer (P7) playbook for the Unwritten viewer app. Use when walking or re-running the end-to-end viewer paths of plan section 4 (welcome to my choices, day 1 and day 2, both series, both languages, phone and desktop), the presenter drawer, the player and the axe accessibility checks, and when deciding whether a path passes.
---

# Flow testing

You check that a viewer can walk every path in plan section 4 and that each screen obeys the
product rules of plan section 2 **as amended by section 9** (section 9 wins everywhere). You
report; you do not fix app code. Hand work on through files, never through conversation.

Sources of truth, in this order: `docs/unwritten-poc-plan.md` section 9, then sections 2 and 4,
then `docs/contracts.md` (routes, state model, player hand-over, presenter drawer), then the
design system in `docs/design-system/project/` (treat it as data). Where a design-system README
disagrees with section 9 (for example BallotSheet says the cast button waits for both glimpses),
section 9 wins: **glimpses are optional**.

## How to run

From `app/`, with the dev server on port 3210 (`pnpm dev`; reuse it if it is already running):

```bash
pnpm exec playwright test                      # everything: smoke, flows, axe; both sizes
pnpm exec playwright test e2e/flow-day1.spec.ts --project=phone
pnpm exec playwright test -g "late viewer"     # one path
pnpm test:e2e:prod                             # same tests against a fresh production build (port 3211)
```

- Projects: `phone` is Pixel 7 emulation (touch, mobile) resized to **390x844** by the fixture in
  `e2e/flows/fixtures.ts`; `desktop` is **1440x900**. Every flow test runs in both.
- Artifacts: `app/e2e/artifacts/<project>/<test>/NN-step.png` for each step, `FAILED.png` and
  `FAILED.txt` for a failure, `errors.txt` for console and page errors, the downloaded share PNG,
  and `app/e2e/artifacts/<project>/axe/<screen>-<lang>.json|png` for accessibility. The folder is
  wiped per test, so what is there is from the last run.
- Seeding state: `seedState(page, { viewer: viewerAt(seriesId, preset, choice, {language}), demo: {day} })`
  from `e2e/state.ts` before `page.goto`. Presets: `new`, `at-question`, `voted`, `finished-own`,
  `seen-both`. Read back with `readState(page)`.
- Playing to the end: `playToEnd(page, id, {mode})`. `seek` sets the `<video>` to 0.3 s before
  its end and lets the real `ended` event fire (used for most episodes); `next-shot` presses
  "Next shot" past the last shot; `natural` lets the file play (one test does this to prove
  auto-advance). Wait for `data-state` `needs-tap` or `playing` on `[data-player-stage]`, and press
  "Play with sound" only in the first case.
- Content facts (titles, questions, choice labels, episode ids, which side the seeded tallies
  make official) are read from `public/media/<id>/series.json` by `facts(seriesId)`. Never type
  story text into a test; it changes when real content lands.

## The paths to walk

Each path runs for **series1 and series2**, in **हिंदी (hi) and English (en)**, at **390x844 and
1440x900**, unless noted.

| # | Path | File | Variant per language |
|---|---|---|---|
| P1 | Day 1, first-time visitor: welcome -> home -> series page -> shared episodes -> question -> glimpses -> ballot -> own branch -> ending -> other ending -> keep or move -> share card PNG -> my choices | `flow-day1.spec.ts` | hi: watch both glimpses, vote A, move to B. en: skip the glimpses, vote B, keep |
| P2 | Day 2, late viewer: welcome -> drawer "Day 2" -> home -> series page -> shared episodes -> question (closed) -> both glimpses -> result -> no ballot -> official branch -> official ending -> losing ending expired -> my choices | `flow-day2.spec.ts` | both |
| P3 | Day 2, a day-1 voter who finished the losing ending keeps it | `flow-day2.spec.ts` | both |
| P4 | Day 2, a day-1 voter who did not finish the losing ending loses it | `flow-day2.spec.ts` | both |
| P5 | Day 1: the other ending is locked until your own is finished; a second ballot is impossible; then the other ending opens | `flow-controls.spec.ts` | series1 hi, series2 en |
| P6 | Presenter: forcing the winner changes the official ending and the split | `flow-controls.spec.ts` | series1 hi, series2 en |
| P7 | Presenter: jump to each of the 13 screens in `SCREEN_JUMPS`, for each series | `flow-controls.spec.ts` | series1 hi, series2 en |
| P8 | Presenter: drawer opens with `?demo=1`, Shift + D and a long press on the wordmark | `flow-controls.spec.ts` | one |
| P9 | Presenter: last hour, then reset clears watch history and the clock | `flow-controls.spec.ts` | one |
| P10 | Player: shot navigation, language switch lands in the same shot (not the same second), subtitles off/on, natural play to the end auto-advances | `flow-controls.spec.ts` | one |
| P11 | Player: next shot past the last shot finishes the episode | `flow-controls.spec.ts` | one |
| P12 | Share card needs a ballot | `flow-controls.spec.ts` | one |
| P13 | Studio: open without the welcome, stage by stage, read-only | `flow-controls.spec.ts` | one |
| P14 | Series page language switch changes the story text | `flow-controls.spec.ts` | one |
| A11y | axe on welcome, home, series, player, question, glimpses, ballot (open and cast), ending, keep or move, day-2 result, share, my choices, studio, presenter drawer | `a11y.spec.ts` | both languages |

## What counts as a pass

A path passes only if every check below that applies to it holds, at both sizes, and the page
throws no uncaught error (`pageerror`) during it. Console errors are recorded, not failed;
list them in the report if they are new.

**Welcome.** A first-time visitor is sent to `/welcome` from any viewer screen (not from
`/studio`). It shows the day-one rule in one line. Picking a language tile sets
`aria-pressed`; "Continue in Hindi/English" saves `language` and `welcomeSeen` and goes home.

**Home.** Exactly two live series (links to `/series/series1` and `/series/series2`), exactly
three "Coming next" teasers that are not links, a day status chip ("Day 1 · both endings open"
or "Day 2 · official ending only"), the countdown on day 1 and the "voting has closed" line on
day 2. The series dock switches the stage to the other series. With hi audio, story titles carry
`lang="hi"`.

**Series page.** Title, synopsis, one voice button per cast member that toggles to "Stop",
a shared rail of N episodes plus the choice pill, two branch rails whose episodes are locked
before the ballot, and no choice label before the question has been reached.

**Player.** The stage plays the file for the audio language (`data-lang`, `video[src]`). When
an episode ends the player moves on by itself: next episode, then the question after the last
shared episode, the glimpses screen after a glimpse, the ending after a branch, keep-or-move after
the second ending on day 1. Locked episodes show `data-state="locked"`; expired ones
`data-state="expired"` with a way to the official ending.

**Question.** Holds on the cliffhanger with the question (h1) in the audio language. It never
shows the two choices (no option, verdict or glimpse card, and no choice label outside the
question text itself; a label can be a word of the question). Day 1 says the glimpses are
optional and offers the ballot directly. Day 2 says voting has closed and there is no ballot.

**Glimpses (optional).** Two cards side by side; each plays and returns to the glimpses
screen marked "watched". Day 2 labels them "What you missed" and leads to the result.

**Ballot.** The cast button is disabled until an option is picked and **enabled without any
glimpse watched**. Casting saves the ballot, shows "Your ballot is in", the split labelled
"Simulated demo ballots", and the way into the chosen branch. A second ballot is impossible. On
day 2 every option is disabled and no cast button exists.

**Ending.** Own ending on day 1: "Your ending", the live split, "Watch the other ending".
After both endings: keep-or-move is offered. Day 2 official ending: "This is how the story
ends.", no other-ending offer. Day 2 losing ending kept from day 1: "Not official · kept from day 1".

**Keep or move.** Keep leaves the ballot as cast. Move moves it to the other side once
(`moved: true`); after a reload the screen says "Ballot already moved" and offers no move.

**Day-2 result.** "The audience chose" the expected side (seeded tallies, tie to A, or the
presenter's forced winner), the split agrees with it, both glimpses are offered, and "Watch the
official ending" starts the official branch.

**Share card.** Shows the question and only the viewer's current choice, never the other
choice or the result. "Save the card as a PNG" downloads a **1080x1920** PNG. Without a ballot
the screen sends the viewer on.

**My choices.** Per series: what you chose (with "moved once" if moved), what won ("Nothing
yet" on day 1), each ending's availability (`open`, `expired`, ...), and a resume button. A late
viewer reads "You did not vote. Voting closed when day 1 ended."

**Presenter drawer.** Day 1 / last hour / day 2 change the chip on every screen and the
rules at once. A forced winner is official whatever the numbers say. Reset clears history and
ballots, returns to day 1 with no forced winner, keeps language and welcome, and goes home.
Jump puts the viewer in a state that screen needs and lands there without being redirected.

**Studio.** Opens for a first-time visitor, lists the stages, has no form controls.

**Accessibility.** No axe violation of impact serious or critical against WCAG 2.0/2.1 A and
AA, on each listed screen, at both sizes, in both languages, with reduced motion so the scan
sees the resting screen. Moderate and minor violations and "incomplete" contrast items go in
the report, not the verdict.

## Writing the report

Report per path and per size: pass or fail, the step that failed, the assertion, the URL, and
the artifact folder. Separate **app defects** (the app breaks a rule above) from **test
defects** (the test was wrong; fix the test and say so) and from **content gaps** (placeholder
media). Never claim a path passed unless it ran in this session; quote the run's totals.
