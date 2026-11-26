/**
 * Which part of the app a URL belongs to, and what surrounds it.
 * OWNER: flow engineer. Pure; tested in sections.test.ts.
 */
import { routes } from "@/lib/routes";

export type NavId = "tonight" | "series" | "my-choices" | "studio";

export interface ChromeFor {
  /**
   * full: the nav pill, and on phones the dock.
   * nav: the nav pill only. A screen with a bottom sheet has no dock (design system, phone layout).
   * none: nothing. The welcome is the only onboarding screen, the player fills the viewport,
   * and /ds is a review page.
   */
  chrome: "full" | "nav" | "none";
  /** The nav destination to mark as current, if any. */
  current: NavId | null;
  /** False for pages a first-time visitor may open without doing the welcome first. */
  gated: boolean;
  /** The series this URL is about, if it names one. */
  seriesId: string | null;
}

const under = (pathname: string, base: string): boolean => pathname === base || pathname.startsWith(`${base}/`);

export function chromeFor(pathname: string): ChromeFor {
  if (under(pathname, routes.welcome())) return { chrome: "none", current: null, gated: false, seriesId: null };
  if (under(pathname, "/ds")) return { chrome: "none", current: null, gated: false, seriesId: null };
  if (under(pathname, routes.studio())) return { chrome: "full", current: "studio", gated: false, seriesId: null };
  if (under(pathname, routes.myChoices())) return { chrome: "full", current: "my-choices", gated: true, seriesId: null };

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "watch") return { chrome: "none", current: "series", gated: true, seriesId: parts[1] ?? null };
  if (parts[0] === "series") {
    const seriesId = parts[1] ?? null;
    // /series/[id] is a browse screen with the dock; everything under it has a sheet.
    return { chrome: parts.length <= 2 ? "full" : "nav", current: "series", gated: true, seriesId };
  }
  return { chrome: "full", current: pathname === routes.home() ? "tonight" : null, gated: true, seriesId: null };
}
