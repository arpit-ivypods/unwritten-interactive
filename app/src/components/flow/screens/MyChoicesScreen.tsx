"use client";

/**
 * My choices (plan section 4): per series, what you chose, what won, what
 * expired, and where to resume. OWNER: flow engineer.
 */
import { Ambient, ButtonLink, Caption, GlassPanel, Label, SeriesCard, StageLoading, Stage, StatusChip, Title, Verdict, storyLang } from "@/components/ds";
import { allSeries } from "@/content";
import type { Choice, Series } from "@/content/schema";
import { routes, stepHref } from "@/lib/routes";
import { useHydrated, useSeriesRules } from "@/state";
import { useCountdown, useLang } from "../hooks";
import { branchChips, branchNote, closesIn, dayStatus, resumeLabel, seriesMeta, stepLabel } from "../logic/view";

export function MyChoicesScreen() {
  const hydrated = useHydrated();
  const room = allSeries[0]?.backdrop;
  return (
    <Ambient as="main" screen still={room} className="flow-screen flow-bleed" data-screen="my-choices">
      <div className="flow-page">
        <div className="uw-stack" style={{ gap: "var(--space-2)" }}>
          <Label>On this device</Label>
          <Title as="h1">My choices</Title>
          <Caption>What you chose, what won, what has expired, and where you stopped. Simulated demo ballots.</Caption>
        </div>
        {hydrated ? (
          allSeries.map((series, index) => <SeriesHistory key={series.id} series={series} primary={index === 0} />)
        ) : (
          <div style={{ width: "100%", maxWidth: 280, margin: "0 auto" }}>
            <Stage data-state="loading">
              <StageLoading />
            </Stage>
          </div>
        )}
      </div>
    </Ambient>
  );
}

function SeriesHistory({ series, primary }: { series: Series; primary: boolean }) {
  const rules = useSeriesRules(series);
  const lang = useLang();
  const countdown = useCountdown();
  const history = rules.history;
  const status = dayStatus(rules, countdown.text);
  const l = storyLang(lang);
  // A choice is named only once the viewer has reached the question that introduces it.
  const choicesKnown = rules.question.reached;
  const nameOf = (choice: Choice) => (choicesKnown ? series.choices[choice].label[lang] : `Ending ${choice}`);
  const nameLang = choicesKnown ? lang : undefined;
  const closing = closesIn(rules, countdown.text);

  let noBallot: string;
  if (history.phase === "day-two") noBallot = "You did not vote. Voting closed when day 1 ended.";
  else if (!history.started) noBallot = "Not started yet.";
  else if (choicesKnown) noBallot = "No ballot yet. The question is waiting for you.";
  else noBallot = `No ballot yet. The question comes after episode ${series.branchAfterEpisode}.`;

  return (
    <GlassPanel as="section" variant="compact" aria-label={series.title.en} data-part="history" data-series={series.id}>
      <div className="flow-history">
        <div className="flow-history-poster">
          <SeriesCard
            href={routes.series(series.id)}
            poster={series.poster}
            title={series.title[lang]}
            lang={lang}
            meta={seriesMeta(series)}
            status={{ kind: status.kind, label: rules.isDayTwo ? "Day 2" : rules.isLastHour ? "Last hour" : "Day 1" }}
          />
        </div>
        <div className="uw-stack">
          <div className="flow-columns">
            <div className="uw-stack" style={{ gap: "var(--space-2)" }} data-part="you-chose">
              <Label as="h2">You chose</Label>
              {history.choice ? (
                <Verdict
                  choice={history.choice}
                  label={nameOf(history.choice)}
                  lang={nameLang}
                  note={history.moved ? "Your ballot is here · moved once" : "Your ballot is here"}
                />
              ) : (
                <Caption>{noBallot}</Caption>
              )}
            </div>
            <div className="uw-stack" style={{ gap: "var(--space-2)" }} data-part="what-won">
              <Label as="h2">What won</Label>
              {history.official ? (
                <Verdict
                  choice={history.official}
                  label={nameOf(history.official)}
                  lang={nameLang}
                  note={history.choseOfficial === null ? "The official ending" : history.choseOfficial ? "The official ending · your side" : "The official ending · not your side"}
                />
              ) : (
                <Caption>Nothing yet. The ending that is ahead when day 1 ends becomes official.{closing ? ` ${closing}.` : ""}</Caption>
              )}
            </div>
          </div>

          <div className="uw-stack" style={{ gap: "var(--space-2)" }} data-part="endings">
            <Label as="h2">Endings</Label>
            <ul className="flow-list">
              {(["A", "B"] as Choice[]).map((choice) => {
                const branch = history.branches[choice];
                const note = branchNote(branch);
                return (
                  <li key={choice} className="flow-row" data-branch={choice} data-availability={branch.availability}>
                    <span className="flow-row-text" style={{ gap: "var(--space-2)", padding: "var(--space-1) 0 var(--space-1) var(--space-2)" }}>
                      <span>
                        <span className={choice === "B" ? "uw-letter uw-letter--b" : "uw-letter"}>{choice}</span>
                        <span lang={choicesKnown ? l : undefined}>{nameOf(choice)}</span>
                      </span>
                      <span className="flow-chips">
                        {branchChips(series, branch).map((chip) => (
                          <StatusChip key={chip.label} kind={chip.kind}>
                            {chip.label}
                          </StatusChip>
                        ))}
                      </span>
                      {note ? <small>{note}</small> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flow-actions" data-part="resume">
            <ButtonLink variant={primary ? "primary" : "ink"} icon="play" href={stepHref(series.id, history.next)}>
              {history.resume ? resumeLabel(series, history.resume) : stepLabel(series, history.next, rules.progress)}
            </ButtonLink>
            {history.choice ? (
              <ButtonLink variant="glass" icon="share" href={routes.share(series.id)}>
                Share card
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
