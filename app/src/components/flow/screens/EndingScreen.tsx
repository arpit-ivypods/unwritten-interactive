"use client";

/**
 * Ending (plan section 4): the final frame, the audience split, and on day 1
 * the offer to watch the other ending. OWNER: flow engineer.
 */
import { ButtonLink, Caption, GlassPanel, Heading, Label, OtherEndingOffer, Stage, StageBottom, StageTop, StatusChip, TallyBar, Verdict } from "@/components/ds";
import { allSeries, branchEpisodes, endingEpisode } from "@/content";
import type { Choice } from "@/content/schema";
import { routes, stepHref } from "@/lib/routes";
import { useCountdown, useLang, useRedirect, useSeriesFlow } from "../hooks";
import { closesIn, endingRole, finalFrame, stepLabel } from "../logic/view";
import { HELD_SEGMENTS, ScreenLoading, StageCaption, StageScreen } from "./shared";

export function EndingScreen({ seriesId, branch }: { seriesId: string; branch: Choice }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const countdown = useCountdown();
  const view = rules.ending(branch);
  // An ending the viewer has not finished has no ending screen (it would show its last frame).
  const misplaced = rules.hydrated && !view.finished;
  useRedirect(misplaced, stepHref(series.id, rules.next));

  if (!rules.hydrated || misplaced) return <ScreenLoading screen="ending" room={series.backdrop} />;

  const frame = finalFrame(series, endingEpisode(series, branch).id);
  const ballot = rules.progress.ballot;
  const role = endingRole(view, ballot?.choice ?? null);
  const closing = closesIn(rules, countdown.text);
  const other = view.otherBranch;
  const nextIsElsewhere = !(rules.next.type === "ending" && rules.next.branch === branch);

  return (
    <StageScreen
      screen="ending"
      srHeading={`Ending ${branch}`}
      room={frame}
      stage={
        <Stage still={frame} scrim data-branch={branch}>
          <StageTop segments={HELD_SEGMENTS} title={series.title[lang]} lang={lang} meta={`Ending ${branch}`} />
          <StageBottom>
            <StageCaption label={role} title={series.choices[branch].label[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={
        <>
          {view.splitVisible ? (
            <GlassPanel variant="compact" data-part="split">
              <div className="flow-between">
                <Label as="h2">{view.official ? "How the audience voted" : "How the audience is voting"}</Label>
                {view.official ? <StatusChip kind="canon">Day 2</StatusChip> : closing ? <StatusChip kind="alert">{closing}</StatusChip> : null}
              </div>
              {view.official ? (
                <Verdict choice={view.official} label={series.choices[view.official].label[lang]} lang={lang} note="The official ending" />
              ) : ballot ? (
                <Verdict choice={ballot.choice} label={series.choices[ballot.choice].label[lang]} lang={lang} note="Your ballot is here" />
              ) : null}
              <TallyBar percentA={rules.tally.percentA} percentB={rules.tally.percentB} />
              {view.official && ballot ? <Caption>Your ballot was on {ballot.choice}.</Caption> : null}
              {view.official ? null : <Caption>The ending that is ahead when day 1 ends becomes the official one.</Caption>}
            </GlassPanel>
          ) : null}
          <GlassPanel variant="compact" data-part="after">
            <Label>After the ending</Label>
            <div className="flow-actions">
              {ballot ? (
                <ButtonLink variant="glass" size="sm" icon="share" href={routes.share(series.id)}>
                  Make my share card
                </ButtonLink>
              ) : null}
              <ButtonLink variant="glass" size="sm" href={routes.myChoices()}>
                My choices
              </ButtonLink>
              {nextIsElsewhere || view.offerOtherEnding || view.offerKeepOrMove ? <NextSeriesLink currentId={series.id} /> : null}
            </div>
          </GlassPanel>
        </>
      }
      right={
        view.offerOtherEnding && view.otherEndingStart ? (
          <OtherEndingOffer
            className="flow-sheet"
            finished={branch}
            otherLabel={series.choices[other].label[lang]}
            lang={lang}
            otherNote={`${branchEpisodes(series, other).length} episodes · only open on day 1`}
            closesIn={closing ?? undefined}
            watchHref={routes.watch(series.id, view.otherEndingStart)}
            dismissHref={routes.home()}
            dismissLabel="Not now"
          />
        ) : view.offerKeepOrMove ? (
          <GlassPanel variant="compact" className="flow-sheet" data-part="next">
            <Label>You have seen both endings</Label>
            <Heading as="h2">Keep your ballot, or move it?</Heading>
            <Caption>You can move it once, and only today.</Caption>
            <ButtonLink variant="primary" block href={routes.keepOrMove(series.id)}>
              Keep or move my ballot
            </ButtonLink>
          </GlassPanel>
        ) : (
          <GlassPanel variant="compact" className="flow-sheet" data-part="next">
            <Label>{role}</Label>
            <Heading as="h2">
              {view.official === null
                ? "You have seen how this one ends."
                : view.official === branch
                  ? "This is how the story ends."
                  : "This ending lost the vote."}
            </Heading>
            <Caption>
              {view.official === null
                ? "Both endings stay open until day 1 ends. After that only the audience's choice remains."
                : view.official === branch
                  ? "The audience chose it on day 1. It is the only ending open to new viewers."
                  : "You keep it because you finished it on day 1. New viewers get only the official ending."}
            </Caption>
            {nextIsElsewhere ? (
              <ButtonLink variant="primary" block icon="play" href={stepHref(series.id, rules.next)}>
                {stepLabel(series, rules.next, rules.progress)}
              </ButtonLink>
            ) : (
              <NextSeriesLink currentId={series.id} primary />
            )}
          </GlassPanel>
        )
      }
    />
  );
}

/** "Next series" (plan section 4: after an ending, the share card and the next series). */
export function NextSeriesLink({ currentId, primary = false }: { currentId: string; primary?: boolean }) {
  const lang = useLang();
  const next = allSeries.find((s) => s.id !== currentId);
  if (!next) return null;
  return (
    <ButtonLink variant={primary ? "primary" : "glass"} size={primary ? "md" : "sm"} block={primary} href={routes.series(next.id)}>
      <span>
        Next series: <span lang={lang === "hi" ? "hi" : undefined}>{next.title[lang]}</span>
      </span>
    </ButtonLink>
  );
}
