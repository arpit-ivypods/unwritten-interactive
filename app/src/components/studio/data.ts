/**
 * Loads the Studio manifest. Server only (reads the file at build time, so the
 * walkthrough is prerendered and its large text never ships as client JS).
 * OWNER: studio engineer.
 *
 * After `node scripts/build-studio.mjs`, restart nothing in dev (the page reads
 * the file on each render); a production build must be rebuilt.
 */
import fs from "node:fs";
import path from "node:path";
import type { StudioManifest } from "./types";

const FILE = path.join(process.cwd(), "public/media/studio/studio.json");

const EMPTY: StudioManifest = { version: 1, generatedAt: "", generator: "app/scripts/build-studio.mjs", projects: [], warnings: [] };

export function loadStudio(): StudioManifest {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8")) as StudioManifest;
    return Array.isArray(data.projects) ? data : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function studioParams(): Array<{ projectId: string }> {
  return loadStudio().projects.map((p) => ({ projectId: p.id }));
}
