"use client";

/**
 * Question (plan section 4): the stage holds on the cliffhanger frame and the
 * question appears in the character's words. The two choices are never shown
 * here; the glimpses and the ballot introduce them. OWNER: flow engineer.
 */
import { ButtonLink, Caption, GlassPanel, Heading, Label, QuestionCard, Stage, StageTop, StatusChip, TallyBar, Verdict } from "@/components/ds";
import { cliffhangerStill } from "@/content";
import { routes, stepHref } from "@/lib/routes";
import { useCountdown, useRedirect, useSeriesFlow } from "../hooks";
import { closesIn, stepLabel } from "../logic/view";
import { SeriesContext } from "./SeriesContext";
import { HELD_SEGMENTS, ScreenLoading, StageScreen } from "./shared";

export function QuestionScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const countdown = useCountdown();
  const question = rules.question;
  const misplaced = rules.hydrated && !question.reached;
  useRedirect(misplaced, stepHref(series.id, question.primary));

  if (!rules.hydrated || misplaced) return <ScreenLoading screen="question" room={series.backdrop} />;

  const primaryHref = stepHref(series.id, question.primary);
  const closing = closesIn(rules, countdown.text);
  const frame = cliffhangerStill(series);

  return (
    <StageScreen
      screen="question"
      room={frame}
      stageMode="full"
      stage={
        <Stage dim still={frame} scrim data-mode={question.mode}>
          <StageTop segments={HELD_SEGMENTS} title={series.title[lang]} lang={lang} meta="The question" />
          <QuestionCard
            headingLevel="h1"
            label={question.mode === "result" ? "Day 2 · voting has closed" : "Your call"}
            question={series.question[lang]}
            context={series.questionContext?.[lang]}
            lang={lang}
            action={
              <ButtonLink variant="primary" block icon={question.mode === "voted" ? "play" : "eye"} href={primaryHref}>
                {stepLabel(series, question.primary, rules.progress)}
              </ButtonLink>
            }
          />
        </Stage>
      }
      left={<SeriesContext series={series} rules={rules} lang={lang} />}
      right={
        question.mode === "vote" ? (
          <GlassPanel variant="compact" data-part="next">
            <div className="flow-between">
              <Label>Episode {series.branchAfterEpisode} stops here</Label>
              {closing ? <StatusChip kind="alert">{closing}</StatusChip> : null}
            </div>
            <Heading as="h2">One ballot, and it is yours.</Heading>
            <Caption>Each choice has a short glimpse. Watching them is optional: you can go straight to the ballot.</Caption>
            {question.ballotOpen ? (
              <ButtonLink variant="glass" href={routes.ballot(series.id)}>
                Go straight to the ballot
              </ButtonLink>
            ) : null}
          </GlassPanel>
        ) : question.mode === "voted" && question.yourChoice ? (
          <GlassPanel variant="compact" data-part="next">
            <div className="flow-between">
              <Label>Your ballot is in</Label>
              {closing ? <StatusChip kind="alert">{closing}</StatusChip> : null}
            </div>
            <Verdict choice={question.yourChoice} label={series.choices[question.yourChoice].label[lang]} lang={lang} note="Your ballot is here" />
            {question.splitVisible ? <TallyBar percentA={rules.tally.percentA} percentB={rules.tally.percentB} /> : null}
            {question.glimpsesAvailable ? (
              <ButtonLink variant="glass" href={routes.glimpses(series.id)}>
                See both glimpses
              </ButtonLink>
            ) : null}
          </GlassPanel>
        ) : (
          <GlassPanel variant="compact" data-part="next">
            <div className="flow-between">
              <Label>Day 2</Label>
              <StatusChip kind="canon">Official ending only</StatusChip>
            </div>
            <Heading as="h2">The audience has decided.</Heading>
            <Caption>
              {question.isLateViewer
                ? "Voting closed when day 1 ended, so there is no ballot. You can still watch both glimpses to see what you missed."
                : "Voting closed when day 1 ended. See how your ballot did."}
            </Caption>
            {question.glimpsesAvailable ? (
              <ButtonLink variant="glass" href={routes.glimpses(series.id)}>
                See both glimpses
              </ButtonLink>
            ) : null}
          </GlassPanel>
        )
      }
    />
  );
}
