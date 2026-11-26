/**
 * axe-core checks on the key screens, at both sizes, in both audio languages.
 *
 * Pass: no violation of impact "serious" or "critical" against WCAG 2.0/2.1
 * A and AA. Moderate and minor violations, and axe's "incomplete" items
 * (contrast it cannot decide over blurred stills and glass), are written to
 * e2e/artifacts/<project>/axe/<screen>-<lang>.json and reported, not failed.
 *
 * Motion is reduced so the scan sees the resting screen, not an entrance.
 */
import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Lang } from "../src/content/schema";
import type { ViewerPresetId } from "../src/state/presets";
import { seedState, viewerAt } from "./state";
import { ARTIFACTS, expect, facts, screen, test } from "./flows/fixtures";

test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

interface Target {
  name: string;
  url: string;
  preset: ViewerPresetId | null;
  choice?: "A" | "B";
  day?: 1 | 2;
  ready: (page: Page) => Promise<void>;
}

const f = facts("series1");
const onScreen = (id: string) => async (page: Page) => void (await screen(page, id));

const TARGETS: Target[] = [
  { name: "welcome", url: "/welcome", preset: null, ready: async (page) => void (await expect(page.locator('main[data-screen="welcome"]')).toBeVisible()) },
  { name: "home", url: "/", preset: "new", ready: onScreen("home") },
  { name: "series", url: "/series/series1", preset: "new", ready: onScreen("series") },
  {
    name: "player",
    url: `/watch/series1/${f.shared[0]}`,
    preset: "new",
    ready: async (page) => {
      await expect.poll(async () => page.locator("[data-player-stage]").getAttribute("data-state"), { timeout: 20_000 }).toMatch(/^(needs-tap|playing)$/);
    },
  },
  { name: "question", url: "/series/series1/question", preset: "at-question", ready: onScreen("question") },
  { name: "glimpses", url: "/series/series1/glimpses", preset: "at-question", ready: onScreen("glimpses") },
  { name: "ballot", url: "/series/series1/ballot", preset: "at-question", ready: onScreen("ballot") },
  { name: "ballot-cast", url: "/series/series1/ballot", preset: "voted", ready: onScreen("ballot") },
  { name: "ending", url: "/series/series1/ending/A", preset: "finished-own", ready: onScreen("ending") },
  { name: "keep-or-move", url: "/series/series1/keep-or-move", preset: "seen-both", ready: onScreen("keep-or-move") },
  { name: "result-day-2", url: "/series/series1/result", preset: "at-question", day: 2, ready: onScreen("result") },
  { name: "share", url: "/series/series1/share", preset: "voted", ready: onScreen("share") },
  { name: "my-choices", url: "/my-choices", preset: "finished-own", ready: onScreen("my-choices") },
  { name: "studio", url: "/studio", preset: "new", ready: async (page) => void (await expect(page.getByRole("navigation", { name: "Stages" })).toBeVisible()) },
  {
    name: "presenter-drawer",
    url: "/?demo=1",
    preset: "new",
    ready: async (page) => void (await expect(page.getByRole("complementary", { name: "Presenter controls" })).toBeVisible()),
  },
];

const LANGS: Lang[] = ["hi", "en"];

for (const target of TARGETS) {
  for (const lang of LANGS) {
    test(`axe · ${target.name} · ${lang}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const viewer = target.preset ? viewerAt("series1", target.preset, target.choice ?? "A", { language: lang }) : { language: lang, welcomeSeen: false };
      await seedState(page, { viewer, demo: { day: target.day ?? 1 } });
      await page.goto(target.url);
      await target.ready(page);
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const dir = path.join(ARTIFACTS, testInfo.project.name, "axe");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${target.name}-${lang}.json`),
        JSON.stringify(
          {
            url: target.url,
            lang,
            violations: results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 200), summary: n.failureSummary })) })),
            incomplete: results.incomplete.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
          },
          null,
          2,
        ),
      );
      await page.screenshot({ path: path.join(dir, `${target.name}-${lang}.png`) });
      const blocking: string[] = [];
      for (const v of results.violations) {
        const line = `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} nodes: ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")})`;
        if (v.impact === "serious" || v.impact === "critical") blocking.push(line);
        else testInfo.annotations.push({ type: "axe", description: line });
      }
      expect(blocking, `serious or critical axe violations on ${target.name} (${lang})`).toEqual([]);
    });
  }
}
