"use client";

/**
 * Home (plan section 4, section 9): tonight's series on the stage with the day
 * status and the countdown, a dock that switches series, the two live series
 * and three "coming next" teasers. OWNER: flow engineer.
 */
import { Body, ButtonLink, Caption, Countdown, GlassPanel, Hero, Label, Segmented, SeriesCard, Stage, StageBottom, StageTop, StatusChip, TeaserTile } from "@/components/ds";
import { allSeries, getSeries, pathLength, teasers } from "@/content";
import { routes, stepHref } from "@/lib/routes";
import { useSeriesRules } from "@/state";
import { useFlowUi } from "../chrome/ui";
import { useCountdown, useLang } from "../hooks";
import { countdownLabel, dayStatus, pathSegments, seriesMeta, stepLabel, stepStill } from "../logic/view";
import { ScreenLoading, StageCaption, StagePlayLink, StageScreen } from "./shared";

export function HomeScreen() {
  const stagedSeriesId = useFlowUi((state) => state.stagedSeriesId);
  const stageSeries = useFlowUi((state) => state.stageSeries);
  const series = getSeries(stagedSeriesId) ?? allSeries[0];
  const rules = useSeriesRules(series);
  const lang = useLang();
  const countdown = useCountdown();

  if (!rules.hydrated) return <ScreenLoading screen="home" room={series.backdrop} />;

  const status = dayStatus(rules, countdown.text);
  const nextHref = stepHref(series.id, rules.next);
  const nextLabel = stepLabel(series, rules.next, rules.progress);
  const tonight = series.id === allSeries[0].id;

  return (
    <StageScreen
      screen="home"
      room={series.backdrop}
      sheet="left"
      stage={
        <Stage still={stepStill(series, rules.next)} scrim>
          <StageTop segments={pathSegments(rules.history)} nowFraction={0} title={series.genre ?? "Unwritten"} meta={`${pathLength(series)} episodes`} />
          <StagePlayLink href={nextHref} label={nextLabel} />
          <StageBottom>
            <StageCaption label={tonight ? "Tonight" : "Also live"} title={series.title[lang]} lang={lang} />
          </StageBottom>
        </Stage>
      }
      left={
        <GlassPanel className="flow-sheet" data-part="hero">
          <div className="flow-between">
            <Label>{tonight ? "Tonight on Unwritten" : "Also live"}</Label>
            <StatusChip kind={status.kind} data-testid="day-status">
              {status.full}
            </StatusChip>
          </div>
          <Hero lang={lang} className="flow-hero">
            {series.title[lang]}
          </Hero>
          <Body lang={lang} className="flow-lead">
            {series.synopsis[lang]}
          </Body>
          <div className="flow-actions">
            <ButtonLink variant="primary" icon="play" href={nextHref}>
              {nextLabel}
            </ButtonLink>
            <ButtonLink variant="glass" href={routes.series(series.id)}>
              Synopsis and cast
            </ButtonLink>
          </div>
          {rules.isDayTwo ? (
            <Caption>Day 1 is over and voting has closed. Only the ending the audience chose is open to new viewers.</Caption>
          ) : (
            <Countdown remainingMs={countdown.remainingMs} alert={rules.isLastHour} label={countdownLabel(rules)} />
          )}
        </GlassPanel>
      }
      right={
        <>
          <GlassPanel variant="compact" data-part="live">
            <Label as="h2">Live now</Label>
            <div className="flow-pair">
              {allSeries.map((s) => (
                <SeriesCard
                  key={s.id}
                  href={routes.series(s.id)}
                  poster={s.poster}
                  title={s.title[lang]}
                  lang={lang}
                  meta={seriesMeta(s)}
                  status={{ kind: status.kind, label: rules.isDayTwo ? "Day 2" : rules.isLastHour ? "Last hour" : "Day 1" }}
                />
              ))}
            </div>
          </GlassPanel>
          <GlassPanel variant="compact" data-part="rule">
            <Label as="h2">How it works</Label>
            <ul className="flow-rules">
              <li>
                <b>Day 1</b>
                <span>Both endings are open. Vote once, watch your ending, then the other one.</span>
              </li>
              <li>
                <b>Day 2</b>
                <span>Only the ending the audience chose remains.</span>
              </li>
            </ul>
          </GlassPanel>
        </>
      }
      dock={
        <Segmented
          label="Series on the stage"
          value={series.id}
          onChange={(id) => {
            stageSeries(id);
            window.scrollTo({ top: 0 });
          }}
          options={allSeries.map((s) => ({ value: s.id, label: s.title[lang], lang: lang === "hi" ? ("hi" as const) : undefined }))}
        />
      }
    >
      <section className="flow-section" aria-labelledby="coming-next" data-part="coming-next">
        <Label as="h2" id="coming-next">
          Coming next
        </Label>
        <ul className="flow-shelf" tabIndex={0} aria-labelledby="coming-next">
          {teasers.slice(0, 3).map((teaser) => (
            <li key={teaser.id}>
              <TeaserTile hook={teaser.hook[lang]} title={teaser.title[lang]} visualStyle={teaser.visualStyle} lang={lang} />
            </li>
          ))}
        </ul>
      </section>
    </StageScreen>
  );
}
