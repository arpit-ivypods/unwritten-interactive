"use client";

/**
 * Hooks shared by the flow screens. OWNER: flow engineer.
 * The rules come from `@/state` (useSeriesRules); nothing is re-derived here.
 */
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSeries } from "@/content";
import type { Lang, Series } from "@/content/schema";
import { useSeriesRules, useViewerStore } from "@/state";
import type { DayOneCountdown, SeriesRules } from "@/state";
import { useFlowUi } from "./chrome/ui";

/** The audio language. Only meaningful once the stores are hydrated. */
export function useLang(): Lang {
  return useViewerStore((state) => state.language);
}

/**
 * The countdown to the end of day 1. AppChrome runs the one timer and shares
 * it, so the nav chip and the screen under it never tick apart.
 */
export const CountdownContext = createContext<DayOneCountdown>({ remainingMs: null, text: null, closingSoon: false });

export function useCountdown(): DayOneCountdown {
  return use(CountdownContext);
}

export interface SeriesFlow {
  series: Series;
  rules: SeriesRules;
  lang: Lang;
}

/** The series, its rules for this viewer and the audio language, for a screen under /series/[seriesId]. */
export function useSeriesFlow(seriesId: string): SeriesFlow {
  const series = getSeries(seriesId);
  // Every route is prerendered for known ids only (dynamicParams = false), so this cannot happen in the app.
  if (!series) throw new Error(`Unknown series: ${seriesId}`);
  const rules = useSeriesRules(series);
  const lang = useLang();
  return { series, rules, lang };
}

/**
 * Send the viewer somewhere else once `when` is true (a screen they cannot be
 * on yet). Callers pass `rules.hydrated && ...`, so nothing redirects for the
 * server's new viewer. Never redirects a page to itself.
 */
export function useRedirect(when: boolean, href: string): void {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (when && href !== pathname) router.replace(href);
  }, [when, href, pathname, router]);
}

/** Cast voice samples: one plays at a time; a second tap stops it. */
export function useVoiceSample(): { playingId: string | null; toggle: (id: string, src: string) => void } {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const toast = useFlowUi((state) => state.toast);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = useCallback(
    (id: string, src: string) => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (playingId === id) {
        setPlayingId(null);
        return;
      }
      const audio = new Audio(src);
      audio.addEventListener("ended", () => setPlayingId((current) => (current === id ? null : current)));
      audio.addEventListener("error", () => {
        setPlayingId((current) => (current === id ? null : current));
        toast("That voice sample did not load.");
      });
      audioRef.current = audio;
      setPlayingId(id);
      audio.play().catch(() => {
        // Interrupted by another tap, or refused by the browser: show it as stopped.
        setPlayingId((current) => (current === id ? null : current));
      });
    },
    [playingId, toast],
  );

  return { playingId, toggle };
}
