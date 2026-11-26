"use client";

/**
 * App chrome. OWNER: flow engineer. Wraps every page (src/app/layout.tsx).
 *
 * What it puts around a page:
 * - The nav pill at the top. From 768px it carries the four destinations and
 *   the audio-language button; below that only the wordmark and the day status
 *   chip, and the destinations move to the dock at the bottom.
 * - The welcome gate: once the stores are loaded, a viewer who has not done
 *   the welcome is sent to /welcome from any viewer screen (not from /studio
 *   or /ds).
 * - The presenter drawer: hold the wordmark, press Shift + D, or add ?demo=1.
 * - Toasts, and the saved light or dark theme.
 *
 * Which pages get what is decided in chrome/sections.ts:
 * - /welcome, /watch/... and /ds get no nav and no dock. The player fills the
 *   viewport and draws its own way back; the drawer still opens with Shift + D
 *   or ?demo=1, and holding any design-system wordmark on the page opens it too.
 * - Screens with a bottom sheet (everything under /series/[id]/...) get the
 *   nav pill but no dock.
 *
 * Room for the chrome: a page starts below the nav pill and ends above the
 * dock without doing anything (padding on .flow-chrome). The space is also in
 * two CSS variables, --chrome-top and --chrome-bottom. To let a page's Ambient
 * backdrop run behind the nav, put the class `flow-bleed` on its root.
 */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Dock, NavBar, StatusChip, ThemeSync, Toast, ToastRegion } from "@/components/ds";
import type { NavItem } from "@/components/ds";
import { getSeries } from "@/content";
import { DEMO_QUERY_FLAG, routes } from "@/lib/routes";
import { isDayTwo, isLastHour, useDayOneCountdown, useDemoState, useHydrated, useViewerStore } from "@/state";
import { attachLongPress, isDrawerShortcut } from "./chrome/longPress";
import { PresenterDrawer } from "./chrome/PresenterDrawer";
import { chromeFor } from "./chrome/sections";
import { useFlowUi } from "./chrome/ui";
import { CountdownContext } from "./hooks";
import { dayStatus } from "./logic/view";
import "./flow.css";

const TOAST_MS = 4000;

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const welcomeSeen = useViewerStore((state) => state.welcomeSeen);
  const demo = useDemoState();
  const countdown = useDayOneCountdown();
  const section = chromeFor(pathname);

  const stagedSeriesId = useFlowUi((state) => state.stagedSeriesId);
  const stageSeries = useFlowUi((state) => state.stageSeries);
  const drawerOpen = useFlowUi((state) => state.drawerOpen);
  const openDrawer = useFlowUi((state) => state.openDrawer);
  const closeDrawer = useFlowUi((state) => state.closeDrawer);
  const toggleDrawer = useFlowUi((state) => state.toggleDrawer);

  // The welcome gate. Never before the stores are loaded: the server's viewer is always new.
  const mustWelcome = hydrated && section.gated && !welcomeSeen;
  useEffect(() => {
    if (mustWelcome) router.replace(routes.welcome());
  }, [mustWelcome, router]);

  // The "Series" destination opens the series the viewer was last on.
  const urlSeriesId = section.seriesId && getSeries(section.seriesId) ? section.seriesId : null;
  useEffect(() => {
    if (urlSeriesId) stageSeries(urlSeriesId);
  }, [urlSeriesId, stageSeries]);

  // Presenter drawer: hold the wordmark, Shift + D, or ?demo=1. Escape closes it.
  useEffect(() => attachLongPress(document, ".uw-wordmark", openDrawer), [openDrawer]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isDrawerShortcut(event)) {
        event.preventDefault();
        toggleDrawer();
      } else if (event.key === "Escape" && useFlowUi.getState().drawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleDrawer, closeDrawer]);
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get(DEMO_QUERY_FLAG);
    if (flag !== null && flag !== "0") openDrawer();
  }, [pathname, openDrawer]);

  const items: NavItem[] = [
    { id: "tonight", label: "Tonight", href: routes.home(), icon: "home" },
    { id: "series", label: "Series", href: routes.series(stagedSeriesId), icon: "series" },
    { id: "my-choices", label: "My choices", href: routes.myChoices(), icon: "check" },
    { id: "studio", label: "Studio", href: routes.studio(), icon: "studio" },
  ];
  const current = section.current ?? undefined;
  const status = dayStatus({ isDayTwo: isDayTwo(demo), isLastHour: isLastHour(demo) }, countdown.text);

  return (
    <CountdownContext value={countdown}>
      <ThemeSync />
      <div className="flow-chrome" data-chrome={section.chrome}>
        {section.chrome === "none" ? null : (
          <>
            <NavBar className="flow-nav flow-nav--desktop" items={items} current={current} homeHref={routes.home()} action={<AudioLanguageButton />} />
            <NavBar
              phone
              className="flow-nav flow-nav--phone"
              items={items}
              current={current}
              homeHref={routes.home()}
              status={
                hydrated ? (
                  <StatusChip kind={status.kind} data-testid="day-chip">
                    {status.short}
                  </StatusChip>
                ) : null
              }
            />
            {section.chrome === "full" ? <Dock fixed className="flow-dock" items={items} current={current} /> : null}
          </>
        )}
        {mustWelcome ? null : children}
      </div>
      <ToastHost />
      {drawerOpen ? <PresenterDrawer /> : null}
    </CountdownContext>
  );
}

/** The one ink button in the desktop nav: the audio language. Pressing it switches to the other one. */
function AudioLanguageButton() {
  const hydrated = useHydrated();
  const language = useViewerStore((state) => state.language);
  const setLanguage = useViewerStore((state) => state.setLanguage);
  if (!hydrated) {
    return (
      <Button variant="ink" size="sm" icon="language" disabled>
        Audio
      </Button>
    );
  }
  const other = language === "hi" ? "en" : "hi";
  // The accessible name starts with the visible label and adds what pressing it does.
  return (
    <Button variant="ink" size="sm" icon="language" data-testid="audio-language" onClick={() => setLanguage(other)}>
      <span>
        <span className="sr-only">Audio language: </span>
        {language === "hi" ? <span lang="hi">हिंदी</span> : "English"}
        <span className="sr-only">. Switch to {other === "hi" ? "Hindi" : "English"}</span>
      </span>
    </Button>
  );
}

/** One-line confirmations. Each leaves after four seconds. */
function ToastHost() {
  const toasts = useFlowUi((state) => state.toasts);
  const dismissToast = useFlowUi((state) => state.dismissToast);
  const latest = toasts[toasts.length - 1];
  useEffect(() => {
    if (!latest) return;
    const timer = window.setTimeout(() => dismissToast(latest.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [latest, dismissToast]);
  return (
    <ToastRegion>
      {toasts.map((toast) => (
        <Toast key={toast.id} icon={toast.icon}>
          {toast.text}
        </Toast>
      ))}
    </ToastRegion>
  );
}
