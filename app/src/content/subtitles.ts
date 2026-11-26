/**
 * Loading subtitle files in the browser. Subtitles are not bundled: the player
 * fetches the track for the current language when an episode opens.
 */
import { parseSubtitleTrack, validateSubtitleTrack } from "./schema";
import type { SubtitleTrack } from "./schema";

const cache = new Map<string, Promise<SubtitleTrack>>();

/**
 * Fetch one subtitle file (a `subtitles.hi` / `subtitles.en` path from the
 * manifest). Results are cached per URL for the life of the page.
 *
 * Rejects only if the file is missing or cannot be drawn at all; the player
 * then carries on without subtitles. A file that can be drawn but breaks a
 * finer rule (a cue past the end, words that do not spell the text) is used
 * as it is and the problems are logged: `pnpm content:check` is where those
 * are meant to be caught.
 */
export function fetchSubtitleTrack(url: string, durationMs?: number): Promise<SubtitleTrack> {
  const cached = cache.get(url);
  if (cached) return cached;
  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Subtitles not found: ${url} (${response.status})`);
    const json: unknown = await response.json();
    const shape = parseSubtitleTrack(json);
    if (!shape.ok) throw new Error(`Subtitles do not match the contract: ${url}\n- ${shape.errors.join("\n- ")}`);
    const full = validateSubtitleTrack(json, durationMs);
    if (!full.ok) console.warn(`[content] ${url}:\n- ${full.errors.join("\n- ")}`);
    return shape.value;
  })();
  cache.set(url, request);
  request.catch(() => cache.delete(url));
  return request;
}
