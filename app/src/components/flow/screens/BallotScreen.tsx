"use client";

/**
 * Ballot (plan section 4, section 9): two options, the countdown to the end of
 * day 1 and the cast button. After casting, the audience split appears.
 * Glimpses are optional: the button needs only a selected option.
 * OWNER: flow engineer.
 */
import { useState } from "react";
import { BallotOption, BallotSheet, ButtonLink, Caption, Stage, StageBottom, StageTop, TallyBar, Verdict } from "@/components/ds";
import { cliffhangerStill } from "@/content";
import type { Choice } from "@/content/schema";
import { routes, stepHref } from "@/lib/routes";
import { useViewerStore } from "@/state";
import { useFlowUi } from "../chrome/ui";
import { useCountdown, useRedirect, useSeriesFlow } from "../hooks";
import { ballotFootnote, closesIn, stepLabel } from "../logic/view";
import { SeriesContext } from "./SeriesContext";
import { HELD_SEGMENTS, ScreenLoading, StageCaption, StageScreen } from "./shared";

export function BallotScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const countdown = useCountdown();
  const castBallot = useViewerStore((state) => state.castBallot);
  const toast = useFlowUi((state) => state.toast);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [refused, setRefused] = useState(false);

  const question = rules.question;
  const misplaced = rules.hydrated && !question.reached;
  useRedirect(misplaced, stepHref(series.id, rules.next));

  if (!rules.hydrated || misplaced) return <ScreenLoading screen="ballot" room={series.backdrop} />;

  const frame = cliffhangerStill(series);
  const ballot = rules.progress.ballot;
  const open = rules.canCastBallot.allowed;
  const nextHref = stepHref(series.id, rules.next);
  const nextLabel = stepLabel(series, rules.next, rules.progress);

  const cast = () => {
    if (!selected) return;
    const result = castBallot(series.id, selected);
    if (result.ok) toast(`Ballot cast for ${selected}.`, "check");
    else setRefused(true);
  };

  const helper = (choice: Choice) => {
    if (!open) return "Voting closed after day 1";
    return rules.progress.glimpsesWatched[choice] ? "Glimpse watched" : "Glimpse not watched yet";
  };

  return (
    <StageScreen
      screen="ballot"
      srHeading="Ballot"
      room={frame}
      stage={
        <Stage dim still={frame} scrim>
          <StageTop segments={HELD_SEGMENTS} title={series.title[lang]} lang={lang} meta="The ballot" />
          <StageBottom>
            <StageCaption label={`Episode ${series.branchAfterEpisode} stopped here`} line={series.questionContext?.[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={
        <SeriesContext series={series} rules={rules} lang={lang}>
          {question.glimpsesAvailable ? (
            <div className="flow-actions">
              {(["A", "B"] as Choice[]).map((choice) => (
                <ButtonLink key={choice} variant="glass" size="sm" icon="eye" href={routes.watch(series.id, series.glimpses[choice].id)}>
                  Glimpse {choice}
                  {rules.progress.glimpsesWatched[choice] ? " · watched" : ""}
                </ButtonLink>
              ))}
            </div>
          ) : null}
        </SeriesContext>
      }
      right={
        ballot ? (
          // Cast: the split appears (TallyBar: only after the viewer's own ballot on day 1).
          <BallotSheet
            variant="panel"
            className="flow-sheet"
            label="Your ballot is in"
            question={series.question[lang]}
            lang={lang}
            closesIn={closesIn(rules, countdown.text) ?? undefined}
            selected={ballot.choice}
            options={
              <>
                <Verdict choice={ballot.choice} label={series.choices[ballot.choice].label[lang]} lang={lang} note="Your ballot is here" />
                {rules.splitVisible ? <TallyBar percentA={rules.tally.percentA} percentB={rules.tally.percentB} /> : null}
              </>
            }
            action={
              <>
                <ButtonLink variant="primary" block icon="play" href={nextHref}>
                  {nextLabel}
                </ButtonLink>
                <ButtonLink variant="glass" block icon="share" href={routes.share(series.id)}>
                  Make my share card
                </ButtonLink>
              </>
            }
            footnote={ballotFootnote(rules, ballot)}
          />
        ) : (
          <BallotSheet
            variant="panel"
            className="flow-sheet"
            label={open ? "Your ballot" : "Voting closed"}
            question={series.question[lang]}
            lang={lang}
            closesIn={closesIn(rules, countdown.text) ?? undefined}
            selected={open ? selected : null}
            onCast={cast}
            options={
              <>
                {(["A", "B"] as Choice[]).map((choice) => (
                  <BallotOption
                    key={choice}
                    choice={choice}
                    label={series.choices[choice].label[lang]}
                    meaning={series.choices[choice].meaning?.[lang]}
                    lang={lang}
                    helper={helper(choice)}
                    still={series.glimpses[choice].poster}
                    selected={selected === choice}
                    disabled={!open}
                    onSelect={() => {
                      setSelected(choice);
                      setRefused(false);
                    }}
                  />
                ))}
                {refused ? <Caption role="alert">That ballot was not accepted. Reload the page and try again.</Caption> : null}
              </>
            }
            action={
              open ? undefined : (
                <ButtonLink variant="primary" block href={nextHref}>
                  {nextLabel}
                </ButtonLink>
              )
            }
            footnote={open ? "One ballot. You can move it once, after watching both endings." : "Voting closed when day 1 ended. Simulated demo ballots."}
          />
        )
      }
    />
  );
}
