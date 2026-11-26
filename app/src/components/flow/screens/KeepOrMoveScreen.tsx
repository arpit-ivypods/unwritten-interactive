"use client";

/**
 * Keep or move (plan section 4, section 9): a day-1 viewer who has finished
 * both endings keeps their ballot or moves it, once, with the live split.
 * OWNER: flow engineer.
 */
import { useState } from "react";
import { ButtonLink, Caption, GlassPanel, Heading, KeepOrMovePanel, Label, Stage, StageBottom, StageTop, TallyBar, Verdict } from "@/components/ds";
import { cliffhangerStill } from "@/content";
import { routes, stepHref } from "@/lib/routes";
import { useViewerStore } from "@/state";
import { useFlowUi } from "../chrome/ui";
import { useRedirect, useSeriesFlow } from "../hooks";
import { ballotDecision, decisionCaption } from "../logic/view";
import { NextSeriesLink } from "./EndingScreen";
import { SeriesContext } from "./SeriesContext";
import { HELD_SEGMENTS, ScreenLoading, StageCaption, StageScreen } from "./shared";

export function KeepOrMoveScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const moveBallot = useViewerStore((state) => state.moveBallot);
  const keepBallot = useViewerStore((state) => state.keepBallot);
  const toast = useFlowUi((state) => state.toast);
  // Wording only: "Ballot moved" right after the tap, "Ballot already moved" on a later visit.
  // What the screen shows comes from the stored ballot, never from this.
  const [movedHere, setMovedHere] = useState(false);

  const ballot = rules.progress.ballot;
  const verdict = rules.canMoveBallot;
  // Moved or kept is stored and final, so the outcome shows on every later visit (and on day 2).
  const decision = ballotDecision(ballot);
  const misplaced = rules.hydrated && decision === null && !verdict.allowed;
  useRedirect(misplaced, stepHref(series.id, rules.next));

  if (!rules.hydrated || misplaced || !ballot) return <ScreenLoading screen="keep-or-move" room={series.backdrop} />;

  const frame = cliffhangerStill(series);
  const deciding = decision === null && verdict.allowed;

  const move = () => {
    const target = ballot.choice === "A" ? "B" : "A";
    const result = moveBallot(series.id);
    if (result.ok) {
      setMovedHere(true);
      toast(`Ballot moved to ${target}.`, "check");
    } else {
      toast("Your ballot could not be moved.");
    }
  };

  const keep = () => {
    const result = keepBallot(series.id);
    if (result.ok) toast(`Ballot kept on ${ballot.choice}.`, "check");
    else toast("Your ballot could not be kept.");
  };

  const outcomeLabel = decision === "kept" ? "Ballot kept" : movedHere ? "Ballot moved" : "Ballot already moved";
  const note = rules.isDayTwo
    ? decision === "moved"
      ? "Moved once on day 1"
      : "Kept where you cast it on day 1"
    : decision === "moved"
      ? "Moved once. It cannot move again."
      : "Kept where you cast it";

  return (
    <StageScreen
      screen="keep-or-move"
      srHeading="Keep or move your ballot"
      room={frame}
      stage={
        <Stage dim still={frame} scrim>
          <StageTop segments={HELD_SEGMENTS} title={series.title[lang]} lang={lang} meta="Both endings seen" />
          <StageBottom>
            <StageCaption label="The question" title={series.question[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={<SeriesContext series={series} rules={rules} lang={lang} />}
      right={
        deciding ? (
          <KeepOrMovePanel
            className="flow-sheet"
            current={ballot.choice}
            currentLabel={series.choices[ballot.choice].label[lang]}
            lang={lang}
            percentA={rules.tally.percentA}
            percentB={rules.tally.percentB}
            onKeep={keep}
            onMove={move}
          />
        ) : (
          <GlassPanel variant="compact" className="flow-sheet" data-part="outcome" data-outcome={decision ?? "undecided"}>
            <Label>{outcomeLabel}</Label>
            <Heading as="h2">Your ballot is on {ballot.choice}.</Heading>
            <Verdict choice={ballot.choice} label={series.choices[ballot.choice].label[lang]} lang={lang} note={note} />
            <TallyBar percentA={rules.tally.percentA} percentB={rules.tally.percentB} />
            <Caption>{decisionCaption(rules, rules.official)}</Caption>
            {rules.isDayTwo ? (
              <ButtonLink variant="primary" block href={routes.result(series.id)}>
                See what the audience chose
              </ButtonLink>
            ) : null}
            <ButtonLink variant={rules.isDayTwo ? "glass" : "primary"} block icon="share" href={routes.share(series.id)}>
              Make my share card
            </ButtonLink>
            <div className="flow-actions">
              <NextSeriesLink currentId={series.id} />
              <ButtonLink variant="glass" size="sm" href={routes.myChoices()}>
                My choices
              </ButtonLink>
            </div>
          </GlassPanel>
        )
      }
    />
  );
}
