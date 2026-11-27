"use client";

/**
 * Series page (plan section 4): synopsis, cast with voice samples, and the
 * episode rail with the branch point and the locked episodes.
 * OWNER: flow engineer.
 */
import { Body, Button, ButtonLink, Caption, Countdown, EpisodeRail, GlassPanel, Label, LanguageSwitch, Stage, StageBottom, StageTop, StatusChip, Title, storyLang, type ChipKind } from "@/components/ds";
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
            <section className="flow-endings" aria-labelledby="series-endings">
              <Label as="h3" id="series-endings">Endings</Label>
              {!choicesKnown ? (
                <Caption>Finish episode {series.branchAfterEpisode} {rules.isDayTwo ? "to see which ending became official." : "to reach the choice."}</Caption>
              ) : null}
              {(["A", "B"] as Choice[]).map((choice) => {
                const branch = rules.history.branches[choice];
                const notes = choicesKnown ? branchNote(branch) : null;
                const badge: { kind: ChipKind; label: string } =
                  !choicesKnown || branch.availability === "locked" ? { kind: "locked", label: "Locked" }
                  : branch.availability === "expired" ? { kind: "alert", label: "Expired" }
                  : branch.isOfficial ? { kind: "canon", label: "Official" }
                  : branch.isOfficial === false ? { kind: "live", label: "Kept from Day 1" }
                  : branch.watched === "finished" ? { kind: "plain", label: "Watched" }
                  : branch.isYourChoice ? { kind: "live", label: "Your ending" }
                  : { kind: "live", label: "Available" };
                return (
                  <div key={choice} className="flow-ending-card" data-branch={choice}>
                    <div className="flow-between flow-ending-head">
                      <div className="flow-ending-name">
                        <span className={choice === "B" ? "uw-letter uw-letter--b" : "uw-letter"} aria-hidden="true">{choice}</span>
                        <div>
                          <h4>Ending {choice}</h4>
                          {choicesKnown ? <p lang={l}>{series.choices[choice].label[lang]}</p> : null}
                        </div>
                      </div>
                      <StatusChip kind={badge.kind}>{badge.label}</StatusChip>
                    </div>
                    {notes ? <Caption>{notes}</Caption> : null}
                    <EpisodeRail
                      className="flow-ending-rail"
                      items={rail.branches[choice].map((item) => ({ ...item, label: `Episode ${item.label}` }))}
                      label={`Ending ${choice}`}
                    />
                  </div>
                );
              })}
            </section>
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
                      <img className="flow-portrait" src={member.portrait} alt="" width={60} height={60} loading="lazy" />
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
