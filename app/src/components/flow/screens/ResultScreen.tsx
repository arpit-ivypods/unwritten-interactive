"use client";

/**
 * Day-2 result (plan section 4, section 9): "The audience chose ...", the
 * split, then straight into the official ending. A late viewer may still open
 * both glimpses; there is no ballot. OWNER: flow engineer.
 */
import { ButtonLink, ResultPanel, Stage, StageBottom, StageTop } from "@/components/ds";
import { cliffhangerStill } from "@/content";
import { routes, stepHref } from "@/lib/routes";
import { useRedirect, useSeriesFlow } from "../hooks";
import { resultActionLabel, resultCaption } from "../logic/view";
import { SeriesContext } from "./SeriesContext";
import { HELD_SEGMENTS, ScreenLoading, StageCaption, StageScreen } from "./shared";

export function ResultScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  // The result exists on day 2 only, and only for a viewer who has reached the question.
  const misplaced = rules.hydrated && (!rules.isDayTwo || !rules.question.reached);
  useRedirect(misplaced, stepHref(series.id, rules.next));

  if (!rules.hydrated || misplaced) return <ScreenLoading screen="result" room={series.backdrop} />;

  const result = rules.result;
  const frame = cliffhangerStill(series);

  return (
    <StageScreen
      screen="result"
      srHeading="What the audience chose"
      room={frame}
      stage={
        <Stage dim still={frame} scrim>
          <StageTop segments={HELD_SEGMENTS} title={series.title[lang]} lang={lang} meta="The result" />
          <StageBottom>
            <StageCaption label="The question" title={series.question[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={<SeriesContext series={series} rules={rules} lang={lang} />}
      right={
        <ResultPanel
          className="flow-sheet"
          official={result.official}
          officialLabel={series.choices[result.official].label[lang]}
          lang={lang}
          percentA={result.tally.percentA}
          percentB={result.tally.percentB}
          actionLabel={resultActionLabel(series, result, rules.progress)}
          actionHref={stepHref(series.id, result.enter)}
          caption={resultCaption(series, result)}
        >
          {result.glimpsesAvailable ? (
            <ButtonLink variant="glass" block icon="eye" href={routes.glimpses(series.id)}>
              See both glimpses
            </ButtonLink>
          ) : null}
        </ResultPanel>
      }
    />
  );
}
