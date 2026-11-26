/**
 * The content the app runs on.
 *
 * The manifests are imported at build time from app/public/media, the same
 * folder the media is served from, so there is one copy of each. In `pnpm dev`
 * a change to a series.json reloads the page. A production build has to be
 * rebuilt (`pnpm build`) after a manifest changes; video, still and subtitle
 * files can be swapped without a rebuild because they are fetched by URL.
 *
 * Everything is validated on load. A manifest that fails validation is still
 * used as it is, so the demo keeps running (plan 7.8), and every problem is
 * listed in `contentProblems` and logged. `pnpm content:check` and the unit
 * tests fail on the same problems.
 */
import catalogJson from "../../public/media/catalog.json";
import series1Json from "../../public/media/series1/series.json";
import series2Json from "../../public/media/series2/series.json";
import { validateCatalog, validateSeries } from "./schema";
import type { Catalog, Series, Teaser } from "./schema";

export * from "./schema";
export * from "./helpers";

const problems: string[] = [];

function loadSeries(json: unknown, label: string): Series {
  const result = validateSeries(json);
  if (result.ok) return result.value;
  for (const error of result.errors) problems.push(`${label}: ${error}`);
  return json as Series;
}

function loadCatalog(json: unknown): Catalog {
  const result = validateCatalog(json);
  if (result.ok) return result.value;
  for (const error of result.errors) problems.push(`catalog.json: ${error}`);
  return json as Catalog;
}

const bundled: Series[] = [
  loadSeries(series1Json, "series1/series.json"),
  loadSeries(series2Json, "series2/series.json"),
];

export const catalog: Catalog = loadCatalog(catalogJson);

for (const id of catalog.series) {
  if (!bundled.some((s) => s.id === id)) {
    problems.push(`catalog.json: series "${id}" is listed but src/content/index.ts does not import it`);
  }
}

/** Live series in catalog order. The first is tonight's series. */
export const allSeries: Series[] = [
  ...catalog.series.map((id) => bundled.find((s) => s.id === id)).filter((s): s is Series => Boolean(s)),
  ...bundled.filter((s) => !catalog.series.includes(s.id)),
];

export const seriesIds: string[] = allSeries.map((s) => s.id);

/** The "coming next" tiles. No episodes, not links. */
export const teasers: Teaser[] = catalog.teasers;

export function getSeries(seriesId: string): Series | undefined {
  return allSeries.find((s) => s.id === seriesId);
}

/** Validation problems found in the bundled manifests. Empty when the content is sound. */
export const contentProblems: readonly string[] = problems;

if (problems.length > 0 && typeof console !== "undefined") {
  console.error(`[content] ${problems.length} problem(s) in the content manifests:\n- ${problems.join("\n- ")}`);
}
