"use client";

/**
 * The supporting panel on the screens around the ballot: which series this
 * is, the day status, and a way back to its page. OWNER: flow engineer.
 */
import type { ReactNode } from "react";
import { ButtonLink, GlassPanel, Heading, Label, StatusChip } from "@/components/ds";
import type { Lang, Series } from "@/content/schema";
import { routes } from "@/lib/routes";
import type { SeriesRules } from "@/state";
import { useCountdown } from "../hooks";
import { dayStatus } from "../logic/view";

export function SeriesContext({ series, rules, lang, children }: { series: Series; rules: SeriesRules; lang: Lang; children?: ReactNode }) {
  const countdown = useCountdown();
  const status = dayStatus(rules, countdown.text);
  return (
    <GlassPanel variant="compact" data-part="context">
      <Label>{series.genre ?? "Series"}</Label>
      <Heading as="h2" lang={lang}>
        {series.title[lang]}
      </Heading>
      <StatusChip kind={status.kind} style={{ alignSelf: "flex-start" }} data-testid="day-status">
        {status.full}
      </StatusChip>
      {children}
      <ButtonLink variant="glass" size="sm" href={routes.series(series.id)}>
        Episodes and cast
      </ButtonLink>
    </GlassPanel>
  );
}
