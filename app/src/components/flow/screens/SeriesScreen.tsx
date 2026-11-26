"use client";

/**
 * Series page (plan section 4): synopsis, cast with voice samples, and the
 * episode rail with the branch point and the locked episodes.
 * OWNER: flow engineer.
 */
import { Body, Button, ButtonLink, Caption, Countdown, EpisodeRail, GlassPanel, Label, LanguageSwitch, Stage, StageBottom, StageTop, StatusChip, Title, storyLang } from "@/components/ds";
import type { Choice } from "@/content/schema";
import { stepHref } from "@/lib/routes";
import { useViewerStore } from "@/state";
import { useCountdown, useSeriesFlow, useVoiceSample } from "../hooks";
import { branchNote, countdownLabel, dayStatus, pathSegments, railView, stepLabel, stepStill, visualStyleLabel } from "../logic/view";
import { ScreenLoading, StageCaption, StagePlayLink, StageScreen } from "./shared";

export function SeriesScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const countdown = useCountdown();
  const setLanguage = useViewerStore((state) => state.setLanguage);
  const voice = useVoiceSample();

  if (!rules.hydrated) return <ScreenLoading screen="series" room={series.backdrop} />;

  const status = dayStatus(rules, countdown.text);
  const nextHref = stepHref(series.id, rules.next);
  const nextLabel = stepLabel(series, rules.next, rules.progress);
  const rail = railView(series, rules.history, rules.question.reached);
  // The two choices are introduced by the question and its glimpses, never before.
  const choicesKnown = rules.question.reached;
  const l = storyLang(lang);

  return (
    <StageScreen
      screen="series"
      room={series.backdrop}
      sheet="left"
      stage={
        <Stage still={stepStill(series, rules.next)} scrim>
          <StageTop segments={pathSegments(rules.history)} nowFraction={0} title={series.title[lang]} lang={lang} meta={visualStyleLabel(series.visualStyle)} />
          <StagePlayLink href={nextHref} label={nextLabel} />
          <StageBottom>
            <StageCaption label={series.genre} title={series.title[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={
        <GlassPanel className="flow-sheet" data-part="hero">
          <div className="flow-between">
            <Label>
              {series.genre ? `${series.genre} · ` : ""}
              {visualStyleLabel(series.visualStyle)}
            </Label>
            <StatusChip kind={status.kind} data-testid="day-status">
              {status.full}
            </StatusChip>
          </div>
          <Title as="h1" lang={lang}>
            {series.title[lang]}
          </Title>
          <Body lang={lang} className="flow-lead">
            {series.synopsis[lang]}
          </Body>
          <ButtonLink variant="primary" icon="play" block href={nextHref}>
            {nextLabel}
          </ButtonLink>
          {rules.isDayTwo ? (
            <Caption>Day 1 is over and voting has closed. Only the ending the audience chose is open to new viewers.</Caption>
          ) : (
            <Countdown remainingMs={countdown.remainingMs} alert={rules.isLastHour} label={countdownLabel(rules)} />
          )}
          <LanguageSwitch value={lang} onChange={setLanguage} className="uw-seg--full" />
        </GlassPanel>
      }
      right={
        <>
          <GlassPanel variant="compact" data-part="episodes">
            <Label as="h2">Episodes</Label>
            <EpisodeRail items={rail.shared} label="Shared episodes and the choice" />
            {(["A", "B"] as Choice[]).map((choice) => {
              const note = branchNote(rules.history.branches[choice]);
              return (
                <div key={choice} className="flow-branch" data-branch={choice}>
                  <span className="flow-branch-name">
                    <span className={choice === "B" ? "uw-letter uw-letter--b" : "uw-letter"}>{choice}</span>
                    {choicesKnown ? <span lang={l}>{series.choices[choice].label[lang]}</span> : `Ending ${choice}`}
                  </span>
                  <EpisodeRail items={rail.branches[choice]} label={`Ending ${choice}`} />
                  {note ? <Caption>{note}</Caption> : null}
                </div>
              );
            })}
          </GlassPanel>
          <GlassPanel variant="compact" data-part="cast">
            <Label as="h2">Cast and voices</Label>
            <ul className="flow-list">
              {series.cast.map((member) => {
                const playing = voice.playingId === member.id;
                return (
                  <li key={member.id} className="flow-row">
                    {member.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element -- stills are served as they are from /media
                      <img className="flow-portrait" src={member.portrait} alt="" />
                    ) : (
                      <span className="flow-portrait" aria-hidden="true" />
                    )}
                    <span className="flow-row-text">
                      <span lang={l}>{member.name[lang]}</span>
                      <small lang={l}>{member.role[lang]}</small>
                    </span>
                    <Button
                      variant="glass"
                      iconOnly
                      icon={playing ? "pause" : "sound"}
                      aria-label={`${playing ? "Stop" : "Play"} the voice of ${member.name.en}`}
                      aria-pressed={playing}
                      onClick={() => voice.toggle(member.id, member.voiceSample[lang])}
                    />
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        </>
      }
    />
  );
}
