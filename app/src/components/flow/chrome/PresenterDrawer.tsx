"use client";

/**
 * The presenter drawer (plan section 4, "Demo controls"; contracts section 9).
 * OWNER: flow engineer.
 *
 * It adds no logic: every control calls the state model (setDay,
 * setWinnerOverride, applyPreset, resetDemo, jumpToScreen). A change applies
 * at once and only on this device. Opened from AppChrome.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, DemoDrawer, DrawerField, LanguageSwitch, Segmented, ThemeSwitch } from "@/components/ds";
import { allSeries, getSeries, listPlaceholders } from "@/content";
import type { Choice } from "@/content/schema";
import { routes } from "@/lib/routes";
import { SCREEN_JUMPS, VIEWER_PRESETS, jumpToScreen, resetDemo, useDemoState, useDemoStore, useHydrated, useSeriesProgress, useViewerStore } from "@/state";
import type { DemoDay, ScreenId, ViewerPresetId } from "@/state";
import { matchPreset } from "../logic/view";
import { useFlowUi } from "./ui";

type DayValue = "1" | "last-hour" | "2";
type WinnerValue = "votes" | "A" | "B";

const DAY_OF: Record<DayValue, DemoDay> = { "1": 1, "last-hour": "last-hour", "2": 2 };
const PRESETS_WITH_BALLOT: ViewerPresetId[] = ["voted", "finished-own", "seen-both"];

export function PresenterDrawer() {
  const router = useRouter();
  const hydrated = useHydrated();
  const demo = useDemoState();
  const setDay = useDemoStore((state) => state.setDay);
  const setWinnerOverride = useDemoStore((state) => state.setWinnerOverride);
  const language = useViewerStore((state) => state.language);
  const setLanguage = useViewerStore((state) => state.setLanguage);
  const applyPreset = useViewerStore((state) => state.applyPreset);

  const closeDrawer = useFlowUi((state) => state.closeDrawer);
  const stagedSeriesId = useFlowUi((state) => state.stagedSeriesId);
  const stageSeries = useFlowUi((state) => state.stageSeries);
  const toast = useFlowUi((state) => state.toast);

  const series = getSeries(stagedSeriesId) ?? allSeries[0];
  const progress = useSeriesProgress(series.id);
  const preset = matchPreset(series, progress);

  // Where a preset or a jump puts the ballot. Follows the viewer's own ballot until the presenter picks.
  const [pickedChoice, setPickedChoice] = useState<Choice | null>(null);
  const choice: Choice = pickedChoice ?? progress.ballot?.choice ?? "A";
  const [screen, setScreen] = useState<ScreenId>("home");

  // Move focus into the drawer when it opens.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  const placeholderCount = allSeries.reduce((sum, s) => sum + listPlaceholders(s).length, 0);

  return (
    // In tests, find the drawer by its role: getByRole("complementary", { name: "Presenter controls" }).
    <div ref={ref}>
      <DemoDrawer
        onClose={closeDrawer}
        footnote={
          <>
            Only visible in the demo. Changes apply to this device at once. Shift + D opens and closes this drawer.
            {placeholderCount > 0 ? ` ${placeholderCount} pieces of content are still placeholders.` : null}
          </>
        }
      >
        <DrawerField id="demo-clock" label="Demo clock">
          <Segmented<DayValue>
            full
            labelledBy="demo-clock-label"
            value={hydrated ? (String(demo.day) as DayValue) : null}
            onChange={(value) => setDay(DAY_OF[value])}
            options={[
              { value: "1", label: "Day 1" },
              { value: "last-hour", label: "Last hour" },
              { value: "2", label: "Day 2" },
            ]}
          />
        </DrawerField>

        <DrawerField id="demo-winner" label="Winning ending">
          <Segmented<WinnerValue>
            full
            labelledBy="demo-winner-label"
            value={hydrated ? (demo.winnerOverride ?? "votes") : null}
            onChange={(value) => setWinnerOverride(value === "votes" ? null : value)}
            options={[
              { value: "votes", label: "By votes" },
              { value: "A", label: "A wins" },
              { value: "B", label: "B wins" },
            ]}
          />
        </DrawerField>

        <DrawerField id="demo-series" label="Series">
          <select
            className="uw-select"
            aria-labelledby="demo-series-label"
            value={series.id}
            onChange={(event) => {
              stageSeries(event.target.value);
              setPickedChoice(null);
            }}
          >
            {allSeries.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title.en}
              </option>
            ))}
          </select>
        </DrawerField>

        <DrawerField id="demo-viewer" label="Viewer">
          <select
            className="uw-select"
            aria-labelledby="demo-viewer-label"
            value={preset ?? "custom"}
            onChange={(event) => {
              if (event.target.value !== "custom") applyPreset(series.id, event.target.value as ViewerPresetId, choice);
            }}
          >
            {preset === null ? (
              <option value="custom" disabled>
                As watched
              </option>
            ) : null}
            {VIEWER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <Segmented<Choice>
            full
            label="Where the viewer's ballot goes"
            value={choice}
            onChange={(value) => {
              setPickedChoice(value);
              if (preset && PRESETS_WITH_BALLOT.includes(preset)) applyPreset(series.id, preset, value);
            }}
            options={[
              { value: "A", label: "Ballot on A" },
              { value: "B", label: "Ballot on B" },
            ]}
          />
        </DrawerField>

        <DrawerField id="demo-jump" label="Jump to a screen">
          <div className="flow-drawer-grid">
            <select className="uw-select" aria-labelledby="demo-jump-label" value={screen} onChange={(event) => setScreen(event.target.value as ScreenId)}>
              {SCREEN_JUMPS.map((jump) => (
                <option key={jump.id} value={jump.id}>
                  {jump.label}
                </option>
              ))}
            </select>
            <Button
              variant="ink"
              size="sm"
              onClick={() => {
                // Puts the viewer in the state that screen needs first (contracts section 9).
                const href = jumpToScreen(screen, series.id, choice);
                closeDrawer();
                router.push(href);
              }}
            >
              Open screen
            </Button>
          </div>
        </DrawerField>

        <DrawerField id="demo-language" label="Audio language">
          <LanguageSwitch value={language} onChange={setLanguage} className="uw-seg--full" />
        </DrawerField>

        <DrawerField id="demo-theme" label="Theme">
          <ThemeSwitch className="uw-seg--full" />
        </DrawerField>

        <Button
          variant="glass"
          size="sm"
          block
          icon="replay"
          onClick={() => {
            resetDemo();
            toast("Watch history cleared. Back to day 1.", "replay");
            router.push(routes.home());
          }}
        >
          Reset watch history and clock
        </Button>
      </DemoDrawer>
    </div>
  );
}
