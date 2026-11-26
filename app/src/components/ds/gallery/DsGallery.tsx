"use client";

/**
 * The /ds review page: every component, light and dark side by side (stacked
 * on phones). Each cell is its own themed `Ambient`, so both themes are on one
 * screen whatever <html> says. Sample text comes from series 1 (placeholder
 * story text) and the design-system previews; the story-language switch at the
 * top flips every story string between Hinglish and English.
 */
import { useState, type ReactNode } from "react";
import type { Choice, Lang, Localized } from "@/content/schema";
import {
  Ambient,
  BallotOption,
  BallotSheet,
  Button,
  Caption,
  Countdown,
  DemoDrawer,
  Dock,
  DrawerField,
  EpisodeRail,
  GlassPanel,
  Heading,
  Hero,
  Icon,
  ICON_NAMES,
  KeepOrMovePanel,
  Label,
  LanguagePicker,
  LanguageSwitch,
  LogoMark,
  NavBar,
  OtherEndingOffer,
  PipelineStep,
  QuestionCard,
  ResultPanel,
  Segmented,
  SeriesCard,
  ShareCard,
  Stage,
  StageBottom,
  StageExpired,
  StageFailed,
  StageLoading,
  StagePlayButton,
  StageTapToPlay,
  StageTop,
  StatusChip,
  Subtitles,
  SubtitlesSwitch,
  TallyBar,
  TeaserTile,
  Title,
  Toast,
  TrailerCard,
  Wordmark,
  formatCountdown,
  type NavItem,
  type Theme,
} from "@/components/ds";

export interface GallerySample {
  backdrop: string;
  poster1: string;
  poster2: string;
  title1: Localized;
  title2: Localized;
  question: Localized;
  questionContext: Localized | null;
  choices: Record<Choice, { label: Localized; meaning: Localized | null }>;
  glimpseA: string;
  glimpseB: string;
  cliffhanger: string;
  shot: string;
  teasers: { id: string; title: Localized; hook: Localized; visualStyle: string }[];
}

const NAV: NavItem[] = [
  { id: "tonight", label: "Tonight", href: "/", icon: "home" },
  { id: "series", label: "Series", href: "/series/series1", icon: "series" },
  { id: "choices", label: "My choices", href: "/my-choices", icon: "check" },
  { id: "studio", label: "Studio", href: "/studio", icon: "studio" },
];

const SUB_WORDS_HI = "रुको! यह file किसने खोली?".split(" ").map((text) => ({ text }));
const SUB_WORDS_EN = "Wait. Who opened this file?".split(" ").map((text) => ({ text }));

interface CellProps {
  theme: Theme;
  lang: Lang;
  s: GallerySample;
}

type Specimen = {
  id: string;
  name: string;
  note?: string;
  render: (p: CellProps) => ReactNode;
};

export function DsGallery({ sample }: { sample: GallerySample }) {
  const [lang, setLang] = useState<Lang>("hi");
  return (
    <Ambient as="main" screen still={sample.backdrop} className="uw" data-testid="ds-gallery">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-6 md:px-10 md:py-10">
        <GlassPanel variant="compact" className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Wordmark />
            <div className="flex flex-wrap items-center gap-3">
              <span className="uw-caption">Story text</span>
              <LanguageSwitch value={lang} onChange={setLang} />
            </div>
          </div>
          <Hero>Design system</Hero>
          <Caption>
            Direction C, Spatial Stage. Every component in the light theme (left) and the dark theme (right; below on phones).
            Story text is placeholder content from series 1. Source: docs/design-system/project.
          </Caption>
          <nav aria-label="Components" className="flex flex-wrap gap-2">
            {SPECIMENS.map((sp) => (
              <a key={sp.id} href={`#${sp.id}`} className="uw-chip uw-chip--plain no-underline">
                {sp.name}
              </a>
            ))}
          </nav>
        </GlassPanel>

        {SPECIMENS.map((sp) => (
          <section key={sp.id} id={sp.id} aria-labelledby={`${sp.id}-h`} className="flex scroll-mt-6 flex-col gap-3">
            <div className="flex flex-col gap-1 px-2">
              <h2 id={`${sp.id}-h`} className="text-display-heading text-ink">
                {sp.name}
              </h2>
              {sp.note ? <p className="text-caption text-ink-muted">{sp.note}</p> : null}
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {(["light", "dark"] as const).map((theme) => (
                <div key={theme} data-theme={theme} className="uw min-w-0">
                  <Ambient still={sample.backdrop} className="rounded-2xl p-5 md:p-7" data-cell={`${sp.id}-${theme}`}>
                    <p className="text-label mb-4 uppercase text-ink-muted">{theme}</p>
                    {sp.render({ theme, lang, s: sample })}
                  </Ambient>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Ambient>
  );
}

// ---------------------------------------------------------------------------
// Specimens
// ---------------------------------------------------------------------------

const t = (l: Localized, lang: Lang) => l[lang];

function BallotDemo({ lang, s, variant }: CellProps & { variant: "sheet" | "panel" }) {
  const [selected, setSelected] = useState<Choice | null>("A");
  return (
    <BallotSheet
      variant={variant}
      question={t(s.question, lang)}
      lang={lang}
      closesIn="Closes in 02:14:09"
      selected={selected}
      onCast={() => undefined}
      options={(["A", "B"] as const).map((c) => (
        <BallotOption
          key={c}
          choice={c}
          label={t(s.choices[c].label, lang)}
          meaning={s.choices[c].meaning ? t(s.choices[c].meaning!, lang) : undefined}
          lang={lang}
          helper={c === "A" ? "Glimpse watched" : "Glimpse not watched yet"}
          still={c === "A" ? s.glimpseA : s.glimpseB}
          selected={selected === c}
          onSelect={() => setSelected(c)}
        />
      ))}
    />
  );
}

function SegDemo({ theme }: CellProps) {
  const [audio, setAudio] = useState<Lang>("hi");
  const [subs, setSubs] = useState(true);
  return (
    <div className="uw-row" style={{ gap: 16 }}>
      <LanguageSwitch value={audio} onChange={setAudio} />
      <SubtitlesSwitch on={subs} onChange={setSubs} />
      <span className="sr-only">{theme}</span>
    </div>
  );
}

function PickerDemo() {
  const [value, setValue] = useState<Lang>("hi");
  return (
    <LanguagePicker
      className="mx-auto max-w-[420px]"
      value={value}
      onChange={setValue}
      intro="Both endings are open on day 1 only. After that, the one the audience picks becomes the story."
    />
  );
}

function DrawerDemo({ theme }: CellProps) {
  const [day, setDay] = useState<"1" | "last-hour" | "2">("1");
  const [win, setWin] = useState<"A" | "B" | "votes">("votes");
  const [viewer, setViewer] = useState("new");
  const id = (x: string) => `dd-${x}-${theme}`;
  return (
    <DemoDrawer overlay={false} onClose={() => undefined} className="ml-auto">
      <DrawerField id={id("day")} label="Demo clock">
        <Segmented
          full
          labelledBy={`${id("day")}-label`}
          value={day}
          onChange={setDay}
          options={[
            { value: "1", label: "Day 1" },
            { value: "last-hour", label: "Last hour" },
            { value: "2", label: "Day 2" },
          ]}
        />
      </DrawerField>
      <DrawerField id={id("win")} label="Winning ending">
        <Segmented
          full
          labelledBy={`${id("win")}-label`}
          value={win}
          onChange={setWin}
          options={[
            { value: "A", label: "A" },
            { value: "B", label: "B" },
            { value: "votes", label: "By votes" },
          ]}
        />
      </DrawerField>
      <DrawerField id={id("view")} label="Viewer">
        <Segmented
          full
          labelledBy={`${id("view")}-label`}
          value={viewer}
          onChange={setViewer}
          options={[
            { value: "new", label: "New" },
            { value: "voted", label: "Voted" },
            { value: "seen-both", label: "Seen both" },
          ]}
        />
      </DrawerField>
      <DrawerField id={id("jump")} label="Jump to screen">
        <select className="uw-select" aria-labelledby={`${id("jump")}-label`} defaultValue="ballot">
          <option value="home">Home</option>
          <option value="question">Question</option>
          <option value="ballot">Ballot</option>
          <option value="result">Day-2 result</option>
        </select>
      </DrawerField>
      <Button variant="glass" block icon="replay">
        Reset this viewer
      </Button>
    </DemoDrawer>
  );
}

const SPECIMENS: Specimen[] = [
  {
    id: "type",
    name: "Type and colour",
    note: "Plus Jakarta Sans and Anek Devanagari in one stack. Hindi elements carry lang=\"hi\": no tracking, taller lines, 700 at display sizes.",
    render: ({ lang, s }) => (
      <div className="flex flex-col gap-4">
        <Label>Ballot open</Label>
        <Title lang={lang}>{t(s.question, lang)}</Title>
        <Heading lang={lang}>{t(s.title1, lang)}</Heading>
        <p className="text-lead text-ink">Two-minute dramas. Two possible endings.</p>
        <p className="uw-body">One ballot each. You can move it once, after watching both endings.</p>
        <Caption>Simulated demo ballots</Caption>
        <p className="text-display-title text-ink" lang="hi">
          यह file किसने खोली?
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {["ground", "glass", "glass-strong", "ink", "ink-muted", "brand", "brand-text", "brand-soft", "saffron", "saffron-text", "live", "alert"].map(
            (c) => (
              <div key={c} className="flex flex-col gap-1">
                <span className="block h-10 rounded-lg border border-hairline" style={{ background: `var(--${c})` }} />
                <span className="text-[11px] font-semibold text-ink-muted">{c}</span>
              </div>
            ),
          )}
        </div>
      </div>
    ),
  },
  {
    id: "icons",
    name: "Icons and logo",
    note: "24px grid, 1.75 stroke, round caps. The mark is drawn from the README description: the SVG files were not in the local copy.",
    render: () => (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-4 text-ink">
          {ICON_NAMES.map((n) => (
            <span key={n} className="flex w-16 flex-col items-center gap-1">
              <Icon name={n} />
              <span className="text-[11px] font-semibold text-ink-muted">{n}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <LogoMark size={48} title="Unwritten mark" />
          <LogoMark size={48} mono title="Unwritten mark, mono" />
          <LogoMark size={24} />
          <Wordmark />
          <span className="rounded-xl bg-stage px-4 py-3">
            <Wordmark onStage />
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "button",
    name: "Button",
    render: () => (
      <div className="uw-row" style={{ gap: 12 }}>
        <Button variant="primary" icon="play">
          Play episode 1
        </Button>
        <Button variant="ink">Cast my ballot</Button>
        <Button variant="glass">Watch the other ending</Button>
        <Button variant="glass" size="sm">
          Invite
        </Button>
        <Button variant="glass" iconOnly aria-label="Share" icon="share" />
        <Button variant="primary" disabled icon="lock">
          Voting closed
        </Button>
      </div>
    ),
  },
  {
    id: "glass",
    name: "GlassPanel",
    render: () => (
      <div className="flex flex-wrap items-start gap-5">
        <GlassPanel className="w-[380px] max-w-full">
          <Label>Hero panel</Label>
          <Title>The ending is yours.</Title>
          <Caption>radius-2xl, space-9 padding, shadow-panel. One per screen beside the stage.</Caption>
        </GlassPanel>
        <GlassPanel variant="compact" stack={false} className="flex w-[300px] max-w-full flex-col gap-2">
          <Label>Compact panel</Label>
          <Heading>A friend can change the result.</Heading>
          <Caption>radius-xl, space-6 padding. Supporting cards.</Caption>
        </GlassPanel>
      </div>
    ),
  },
  {
    id: "nav",
    name: "NavBar and dock",
    note: "Desktop pill (links hide below 640px), phone pill with one chip, and the phone dock.",
    render: () => (
      <div className="flex flex-col gap-5">
        <NavBar
          items={NAV}
          current="tonight"
          action={
            <button type="button" className="uw-btn uw-btn--ink uw-btn--sm" lang="hi">
              हिंदी
            </button>
          }
        />
        <div className="mx-auto flex w-full max-w-[358px] flex-col gap-3">
          <NavBar phone items={NAV} status={<StatusChip kind="live">Day 1</StatusChip>} />
          <Dock items={NAV} current="tonight" />
        </div>
      </div>
    ),
  },
  {
    id: "browse",
    name: "SeriesCard and TeaserTile",
    note: "Home: two live series and three coming-next teasers (plan section 9).",
    render: ({ lang, s }) => (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <SeriesCard
          href="/series/series1"
          poster={s.poster1}
          title={t(s.title1, lang)}
          lang={lang}
          meta="Live action · 5 episodes"
          status={{ kind: "live", label: "Day 1" }}
        />
        <SeriesCard
          href="/series/series2"
          poster={s.poster2}
          title={t(s.title2, lang)}
          lang={lang}
          meta="2D animation · 6 episodes"
          status={{ kind: "canon", label: "Official ending" }}
        />
        {s.teasers.map((tz) => (
          <TeaserTile key={tz.id} hook={t(tz.hook, lang)} title={t(tz.title, lang)} visualStyle={tz.visualStyle} lang={lang} />
        ))}
      </div>
    ),
  },
  {
    id: "status",
    name: "StatusChip",
    render: () => (
      <div className="uw-row" style={{ gap: 10 }}>
        <StatusChip kind="live">Day 1 · both endings open</StatusChip>
        <StatusChip kind="alert">Closes in {formatCountdown(2 * 3600_000 + 14 * 60_000 + 9_000)}</StatusChip>
        <StatusChip kind="canon">Day 2 · official ending</StatusChip>
        <StatusChip kind="locked">Other ending · day 1 only</StatusChip>
        <StatusChip kind="plain">Episode 3 of 5</StatusChip>
      </div>
    ),
  },
  {
    id: "countdown",
    name: "Countdown",
    render: () => (
      <div className="uw-row" style={{ gap: 28, alignItems: "flex-start" }}>
        <Countdown label="Day 1 ends in" remainingMs={(14 * 3600 + 32 * 60 + 9) * 1000} />
        <Countdown label="Last hour" alert remainingMs={(14 * 60 + 52) * 1000} />
        <Countdown label="Before mount" remainingMs={null} />
      </div>
    ),
  },
  {
    id: "rail",
    name: "EpisodeRail",
    render: () => (
      <EpisodeRail
        items={[
          { key: "1", label: "1", state: "done", href: "/watch/series1/s1e01" },
          { key: "2", label: "2", state: "done" },
          { key: "c", label: "Choice", state: "choice" },
          { key: "3a", label: "3A", state: "now" },
          { key: "4a", label: "4A", state: "todo" },
          { key: "5a", label: "5A", state: "todo" },
          { key: "b", state: "locked", ariaLabel: "Other ending, locked" },
          { key: "x", label: "3B", state: "expired", ariaLabel: "3B, expired" },
        ]}
      />
    ),
  },
  {
    id: "stage",
    name: "PlayerStage and Subtitles",
    note: "Desktop stage (6px bezel, radius-stage) and phone stage. Film is dark in both themes.",
    render: ({ lang, s }) => (
      <div className="flex flex-wrap items-end justify-center gap-8">
        <Stage still={s.shot} scrim style={{ width: 308 }}>
          <StageTop segments={["done", "done", "now", "todo", "todo"]} nowFraction={0.3} title={`${t(s.title1, lang)} · Ep 3`} lang={lang} meta="0:52" />
          <StagePlayButton />
          <StageBottom>
            <Subtitles speaker="Meera" words={lang === "hi" ? SUB_WORDS_HI : SUB_WORDS_EN} activeWord={lang === "hi" ? 2 : 2} lang={lang} />
          </StageBottom>
        </Stage>
        <Stage phone still={s.glimpseA} scrim style={{ width: 236 }}>
          <StageTop segments={["done", "now", "todo", "todo", "todo"]} title="Ep 2" meta="1:10" />
          <StageBottom>
            <Subtitles small text="Wait. Who opened this file?" />
          </StageBottom>
        </Stage>
      </div>
    ),
  },
  {
    id: "subtitles",
    name: "Subtitles",
    render: () => (
      <div className="grid gap-7 rounded-xl bg-stage p-7" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))" }}>
        <Subtitles speaker="Meera" lang="hi" words={SUB_WORDS_HI} activeWord={2} />
        <Subtitles speaker="Meera" lang="en" words={SUB_WORDS_EN} activeWord={2} />
        <Subtitles lang="hi">
          मुझे लगा था station पर कोई नहीं होगा,
          <br />
          लेकिन platform की <b>light</b> जल रही थी।
        </Subtitles>
        <Subtitles small speaker="Inspector · on phone" lang="hi">
          दस मिनट में <b>report</b> चाहिए।
        </Subtitles>
      </div>
    ),
  },
  {
    id: "lang",
    name: "LanguageSwitch",
    render: (p) => <SegDemo {...p} />,
  },
  {
    id: "picker",
    name: "LanguagePicker",
    render: () => <PickerDemo />,
  },
  {
    id: "states",
    name: "StageStates",
    render: ({ s }) => (
      <div className="grid justify-center gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,236px))" }}>
        <Stage phone style={{ width: "100%" }}>
          <StageLoading label="Loading episode 3" />
        </Stage>
        <Stage phone still={s.shot} style={{ width: "100%" }}>
          <StageTapToPlay />
        </Stage>
        <Stage phone style={{ width: "100%" }}>
          <StageFailed onRetry={() => undefined} />
        </Stage>
        <Stage phone dim still={s.glimpseB} style={{ width: "100%" }}>
          <StageExpired
            action={
              <Button variant="primary" size="sm">
                Official ending
              </Button>
            }
          />
        </Stage>
      </div>
    ),
  },
  {
    id: "toast",
    name: "Toast",
    render: () => (
      <div className="uw-stack" style={{ gap: 12, alignItems: "flex-start" }}>
        <Toast icon="check">Ballot cast for A</Toast>
        <Toast action={{ label: "Undo", onClick: () => undefined }}>Audio switched to English</Toast>
        <Toast icon="clock">Both endings close in 1 hour</Toast>
      </div>
    ),
  },
  {
    id: "question",
    name: "QuestionCard",
    render: ({ lang, s }) => (
      <div className="flex justify-center">
        <Stage dim still={s.cliffhanger} style={{ width: 320, maxWidth: "100%" }}>
          <StageTop segments={["done", "done", "done", "todo", "todo"]} title={`${t(s.title1, lang)} · Ep 2`} lang={lang} meta="The question" />
          <QuestionCard
            question={t(s.question, lang)}
            context={s.questionContext ? t(s.questionContext, lang) : undefined}
            lang={lang}
            action={
              <Button variant="primary" block icon="eye">
                See both glimpses
              </Button>
            }
          />
        </Stage>
      </div>
    ),
  },
  {
    id: "trailer",
    name: "TrailerCard",
    note: "Glimpses are optional: the ballot never waits for them.",
    render: ({ lang, s }) => (
      <div className="grid justify-center gap-4" style={{ gridTemplateColumns: "repeat(2,minmax(0,200px))" }}>
        <TrailerCard choice="A" title={t(s.choices.A.label, lang)} lang={lang} meta="0:20 · not watched" still={s.glimpseA} href="/watch/series1/s1ga" />
        <TrailerCard choice="B" title={t(s.choices.B.label, lang)} lang={lang} meta="0:20 · watched" still={s.glimpseB} href="/watch/series1/s1gb" />
      </div>
    ),
  },
  {
    id: "ballot-sheet",
    name: "BallotSheet",
    note: "Phone sheet. The cast button needs only a selection, not watched glimpses (plan section 9 overrides the README).",
    render: (p) => (
      <div className="mx-auto max-w-[390px]">
        <BallotDemo {...p} variant="sheet" />
      </div>
    ),
  },
  {
    id: "ballot-panel",
    name: "BallotSheet, desktop panel",
    render: (p) => (
      <div className="max-w-[420px]">
        <BallotDemo {...p} variant="panel" />
      </div>
    ),
  },
  {
    id: "ballot-option",
    name: "BallotOption",
    render: ({ lang, s }) => (
      <GlassPanel variant="compact" stack={false} className="flex max-w-[420px] flex-col gap-3">
        <BallotOption choice="A" label={t(s.choices.A.label, lang)} lang={lang} helper="Glimpse watched" still={s.glimpseA} selected />
        <BallotOption choice="B" label={t(s.choices.B.label, lang)} lang={lang} helper="Glimpse not watched yet" still={s.glimpseB} />
        <BallotOption choice="B" label={t(s.choices.B.label, lang)} lang={lang} helper="Voting closed after day 1" still={s.glimpseB} disabled />
      </GlassPanel>
    ),
  },
  {
    id: "tally",
    name: "TallyBar",
    render: () => (
      <GlassPanel variant="compact" stack={false} className="max-w-[420px]">
        <TallyBar percentA={58} percentB={42} caption="Simulated demo ballots. The leading choice becomes the official story on day 2." />
      </GlassPanel>
    ),
  },
  {
    id: "other-ending",
    name: "OtherEndingPanel",
    note: "Day 1 only: the offer after the viewer's ending, then keep or move (once).",
    render: ({ lang, s }) => (
      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
        <OtherEndingOffer
          finished="A"
          otherLabel={t(s.choices.B.label, lang)}
          lang={lang}
          otherNote="3 episodes · only open on day 1"
          closesIn="Closes in 02:14:09"
          onWatch={() => undefined}
          onDismiss={() => undefined}
        />
        <KeepOrMovePanel current="A" currentLabel={t(s.choices.A.label, lang)} lang={lang} percentA={58} percentB={42} onKeep={() => undefined} onMove={() => undefined} />
      </div>
    ),
  },
  {
    id: "result",
    name: "ResultPanel",
    render: ({ lang, s }) => (
      <ResultPanel className="max-w-[420px]" official="B" officialLabel={t(s.choices.B.label, lang)} lang={lang} percentA={47} percentB={53} onAction={() => undefined} />
    ),
  },
  {
    id: "share",
    name: "ShareCard",
    render: ({ lang, s }) => (
      <div className="uw-row" style={{ gap: 28, justifyContent: "center", alignItems: "flex-end" }}>
        <ShareCard
          still={s.cliffhanger}
          seriesLine={`${t(s.title1, lang)} · Ep 2`}
          question={t(s.question, lang)}
          lang={lang}
          choice="A"
          choiceLabel={t(s.choices.A.label, lang)}
        />
        <div className="uw-stack" style={{ gap: 10, maxWidth: 240 }}>
          <Button variant="primary" icon="share">
            Save story card
          </Button>
          <Caption>Exported at 1080 × 1920. Shows the question and the viewer&apos;s choice, never what happens next.</Caption>
        </div>
      </div>
    ),
  },
  {
    id: "pipeline",
    name: "PipelineStep",
    render: () => (
      <div className="flex max-w-[520px] flex-col gap-2.5">
        <PipelineStep number={1} name="Showrunner" output="Series bible, branch map, cliffhanger plan" state="done" stateLabel="Approved" />
        <PipelineStep number={2} name="Dialogue writer" output="Hinglish script with emotion cues, English adaptation" state="running" stateLabel="Writing…" />
        <PipelineStep number={3} name="Voice director" output="Cast voices, performed takes, word timings" state="waiting" />
      </div>
    ),
  },
  {
    id: "drawer",
    name: "DemoDrawer",
    note: "Shell and controls only; the flows engineer wires it to the state model.",
    render: (p) => <DrawerDemo {...p} />,
  },
];
