/**
 * The Studio walkthrough: how an episode is made, stage by stage, from the real
 * artefacts listed in public/media/studio/studio.json. Read-only.
 * OWNER: studio engineer.
 *
 * Layout: hero panel, then the pipeline overview (PipelineStep, in hand-off
 * order, parallel steps side by side) and one GlassPanel per stage. On desktop
 * the overview is a sticky column beside the stages; on phones it sits above.
 */
import type { ReactNode } from "react";
import { Ambient, Body, ButtonLink, Caption, GlassPanel, Heading, Hero, Label, PipelineStep, StatusChip } from "@/components/ds";
import { routes } from "@/lib/routes";
import { EditStage, FinalStage, LookStage, ScreeningStage, ScriptStage, SoundStage, StoryStage, StoryboardStage, VoiceStage } from "./Stages";
import type { StageKey, StudioManifest, StudioProject } from "./types";

/** The agents of plan section 5 who own each stage, and what they hand on. */
const STAGES: Array<{
  key: StageKey;
  title: string;
  agents: Array<[code: string, role: string]>;
  handsOn: string;
  body: (p: StudioProject) => ReactNode;
}> = [
  { key: "story", title: "Story", agents: [["S1", "Showrunner"]], handsOn: "Series bible, characters, branch map, cliffhanger plan", body: (p) => <StoryStage p={p} /> },
  {
    key: "script",
    title: "Script",
    agents: [["S2", "Episode writer"], ["S3", "Script critic"], ["S4", "Continuity keeper"], ["S5", "English adapter"]],
    handsOn: "Hinglish script with emotion cues, English adaptation, continuity ledger",
    body: (p) => <ScriptStage p={p} />,
  },
  { key: "look", title: "Look", agents: [["S6", "Art director"]], handsOn: "Visual bible, character sheets, location plates", body: (p) => <LookStage p={p} /> },
  {
    key: "storyboard",
    title: "Storyboard",
    agents: [["S7", "Storyboard artist"], ["S8", "Frame artist"], ["S9", "Visual checker"]],
    handsOn: "Shot list with framing and camera moves; every frame drawn and checked",
    body: (p) => <StoryboardStage p={p} />,
  },
  { key: "voice", title: "Voice", agents: [["S10", "Casting and voice director"]], handsOn: "Cast voices, directed takes, word timings", body: (p) => <VoiceStage p={p} /> },
  { key: "sound", title: "Sound", agents: [["S11", "Sound designer and composer"]], handsOn: "Theme, cues, effects per shot, dialogue-first mix", body: (p) => <SoundStage p={p} /> },
  {
    key: "edit",
    title: "Edit",
    agents: [["S13", "Editor"], ["S12", "Subtitle editor"]],
    handsOn: "Timeline of frames, camera moves, voice, music, effects and subtitles",
    body: (p) => <EditStage p={p} />,
  },
  { key: "screening", title: "Screening", agents: [["S15", "Screening reviewer"]], handsOn: "Sign-off, or fixes filed to the owning agent", body: (p) => <ScreeningStage p={p} /> },
  { key: "final", title: "Final cut", agents: [["S13", "Editor"]], handsOn: "The finished cut in Hinglish and English", body: (p) => <FinalStage p={p} /> },
];

/** Voice and sound run side by side after the storyboard (plan section 6). */
const PARALLEL: StageKey[] = ["voice", "sound"];

export const studioProjectHref = (id: string) => `${routes.studio()}/${id}`;
const anchor = (k: StageKey) => `stage-${k}`;

function chipKind(state: string): "plain" | "alert" | "locked" {
  return state === "done" ? "plain" : state === "running" ? "alert" : "locked";
}

function Overview({ p }: { p: StudioProject }) {
  const steps = STAGES.map((s, i) => ({ ...s, n: i + 1 }));
  const step = (s: (typeof steps)[number]) => {
    const st = p.stages[s.key];
    return (
      <a key={s.key} href={`#${anchor(s.key)}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text">
        <PipelineStep
          number={s.n}
          state={st.state}
          stateLabel={st.label}
          name={
            <>
              {s.title} <span className="font-semibold text-ink-muted">· {s.agents[0][1]}</span>
            </>
          }
          output={st.summary ?? s.handsOn}
        />
      </a>
    );
  };
  const out: ReactNode[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.key === PARALLEL[0]) {
      const pair = steps.filter((x) => PARALLEL.includes(x.key));
      out.push(
        <div key="parallel" className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-ink-muted">These two run side by side, after the storyboard</span>
          <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-1">{pair.map(step)}</div>
        </div>,
      );
      i += pair.length - 1;
    } else {
      out.push(step(s));
    }
  }
  return (
    <nav aria-label="Stages" className="flex flex-col gap-2.5">
      {out}
    </nav>
  );
}

export function StudioWalkthrough({ manifest, project }: { manifest: StudioManifest; project: StudioProject | null }) {
  if (!project) {
    return (
      <Ambient screen as="main" className="min-h-dvh">
        <div className="mx-auto max-w-[720px] px-4 py-10">
          <GlassPanel>
            <Label>Studio</Label>
            <Hero>How an episode is made</Hero>
            <Body>No studio manifest yet. Run `node scripts/build-studio.mjs` in app/ to collect the production artefacts.</Body>
          </GlassPanel>
        </div>
      </Ambient>
    );
  }
  const p = project;
  const done = STAGES.filter((s) => p.stages[s.key].state === "done").length;
  return (
    <Ambient screen still={p.still ?? undefined} as="main" className="flow-bleed min-h-dvh overflow-clip">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 pt-2 pb-16 md:gap-6 md:px-8 md:pt-4">
        <GlassPanel as="header">
          <Label>Studio · read-only</Label>
          <Hero>How an episode is made</Hero>
          <Body className="max-w-[68ch]">
            Every step below is owned by one agent of the content studio and shows what it actually handed on for this production: the script, the reference sheets, the frames, the takes, the timeline, the screening report and the cut. Nothing here is edited from the app.
          </Body>
          {manifest.projects.length > 1 ? (
            <nav aria-label="Productions" className="flex flex-wrap gap-2">
              {manifest.projects.map((x) => (
                <ButtonLink key={x.id} href={studioProjectHref(x.id)} variant={x.id === p.id ? "ink" : "glass"} size="sm" aria-current={x.id === p.id ? "page" : undefined}>
                  {x.label}
                </ButtonLink>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {p.title.hi ? (
              <StatusChip kind="plain" lang="hi">
                {p.title.hi}
              </StatusChip>
            ) : null}
            {p.title.en ? <StatusChip kind="plain">{p.title.en}</StatusChip> : null}
            <StatusChip kind="plain">
              {done} of {STAGES.length} stages done
            </StatusChip>
            {p.placeholders.length ? <StatusChip kind="alert">{p.placeholders.length} placeholders</StatusChip> : null}
          </div>
          {p.placeholders.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {p.placeholders.map((x, i) => (
                <li key={i} className="text-caption text-ink-muted">
                  {x}
                </li>
              ))}
            </ul>
          ) : null}
          <Caption>
            Source: {p.source} · collected {manifest.generatedAt ? manifest.generatedAt.slice(0, 16).replace("T", " ") + " UTC" : "unknown"}
          </Caption>
        </GlassPanel>

        <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <GlassPanel variant="compact" as="aside" className="lg:sticky lg:top-[calc(var(--chrome-top,0px)+8px)] lg:max-h-[calc(100dvh-var(--chrome-top,0px)-24px)] lg:overflow-y-auto">
            <Label as="h2">The pipeline</Label>
            <Overview p={p} />
          </GlassPanel>

          <div className="flex min-w-0 flex-col gap-4 md:gap-6">
            {STAGES.map((s, i) => {
              const st = p.stages[s.key];
              return (
                <GlassPanel key={s.key} as="section" variant="compact" id={anchor(s.key)} aria-labelledby={`${anchor(s.key)}-h`} className="scroll-mt-[calc(var(--chrome-top,0px)+16px)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Label>Step {i + 1}</Label>
                      <Heading as="h2" id={`${anchor(s.key)}-h`}>
                        {s.title}
                      </Heading>
                    </div>
                    <StatusChip kind={chipKind(st.state)}>{st.label}</StatusChip>
                  </div>
                  <div className="flex flex-wrap gap-2" aria-label="Agents">
                    {s.agents.map(([code, role]) => (
                      <StatusChip key={code} kind="plain">
                        <b className="text-brand-text">{code}</b> {role}
                      </StatusChip>
                    ))}
                  </div>
                  <Caption>Hands on: {s.handsOn}.</Caption>
                  {s.body(p)}
                </GlassPanel>
              );
            })}
          </div>
        </div>
      </div>
    </Ambient>
  );
}
