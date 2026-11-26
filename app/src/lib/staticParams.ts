/**
 * generateStaticParams helpers. Every dynamic route in the app is prerendered
 * for the ids in the content manifests and 404s for anything else
 * (`export const dynamicParams = false` in the page).
 */
import { allSeries, playableIds } from "@/content";

export function seriesParams(): Array<{ seriesId: string }> {
  return allSeries.map((series) => ({ seriesId: series.id }));
}

export function endingParams(): Array<{ seriesId: string; branch: string }> {
  return allSeries.flatMap((series) => [
    { seriesId: series.id, branch: "A" },
    { seriesId: series.id, branch: "B" },
  ]);
}

/** Episodes and glimpses: everything the player route can play. */
export function watchParams(): Array<{ seriesId: string; playableId: string }> {
  return allSeries.flatMap((series) => playableIds(series).map((playableId) => ({ seriesId: series.id, playableId })));
}
