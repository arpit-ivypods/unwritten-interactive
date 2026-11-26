"use client";

/**
 * Glimpses (plan section 4, section 9): two cards side by side, one per
 * choice. Each plays in the stage (the player route) and comes back here.
 * Watching them is optional. On day 2 they stay, and the ballot is replaced by
 * the result. OWNER: flow engineer.
 */
import { ButtonLink, Caption, GlassPanel, Label, Stage, StageBottom, StageTop, StatusChip, Title, TrailerCard } from "@/components/ds";
import { cliffhangerStill } from "@/content";
import type { Choice } from "@/content/schema";
import { routes, stepHref } from "@/lib/routes";
import { useCountdown, useRedirect, useSeriesFlow } from "../hooks";
import { closesIn, formatClock, stepLabel } from "../logic/view";
import { SeriesContext } from "./SeriesContext";
import { HELD_SEGMENTS, ScreenLoading, StageCaption, StageScreen } from "./shared";

export function GlimpsesScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const countdown = useCountdown();
  const question = rules.question;
  const misplaced = rules.hydrated && !question.glimpsesAvailable;
  useRedirect(misplaced, stepHref(series.id, rules.next));

  if (!rules.hydrated || misplaced) return <ScreenLoading screen="glimpses" room={series.backdrop} />;

  const frame = cliffhangerStill(series);
  const closing = closesIn(rules, countdown.text);
  const watched = rules.progress.glimpsesWatched;

  // vote: on to the ballot. voted: back to their ending. result (day 2): the audience result.
  const primary =
    question.mode === "vote"
      ? { href: routes.ballot(series.id), label: "Go to the ballot" }
      : { href: stepHref(series.id, question.primary), label: stepLabel(series, question.primary, rules.progress) };

  return (
    <StageScreen
      screen="glimpses"
      room={frame}
      stage={
        <Stage dim still={frame} scrim>
          <StageTop segments={HELD_SEGMENTS} title={series.title[lang]} lang={lang} meta="Glimpses" />
          <StageBottom>
            <StageCaption label="The question" title={series.question[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={<SeriesContext series={series} rules={rules} lang={lang} />}
      right={
        <GlassPanel variant="compact" className="flow-sheet" data-part="glimpses">
          <div className="flow-between">
            <Label>{question.mode === "result" ? "What you missed" : question.mode === "voted" ? "The two choices" : "Before you vote"}</Label>
            {closing ? <StatusChip kind="alert">{closing}</StatusChip> : null}
          </div>
          <Title as="h1" lang={lang}>
            {series.question[lang]}
          </Title>
          <div className="flow-pair">
            {(["A", "B"] as Choice[]).map((choice) => {
              const glimpse = series.glimpses[choice];
              return (
                <TrailerCard
                  key={choice}
                  choice={choice}
                  href={routes.watch(series.id, glimpse.id)}
                  title={series.choices[choice].label[lang]}
                  lang={lang}
                  meta={`${formatClock(glimpse.durationMs[lang])} · ${watched[choice] ? "watched" : "not watched"}`}
                  still={glimpse.poster}
                />
              );
            })}
          </div>
          <ButtonLink variant="primary" block href={primary.href}>
            {primary.label}
          </ButtonLink>
          <Caption style={{ textAlign: "center" }}>
            {question.mode === "result"
              ? "Voting closed when day 1 ended. The glimpses stay, so you can see what you missed."
              : "Each glimpse ends on a new question. Watching them is optional."}
          </Caption>
        </GlassPanel>
      }
    />
  );
}
