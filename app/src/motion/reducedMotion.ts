"use client";

/**
 * prefers-reduced-motion for components that animate from script. OWNER: motion.
 *
 * Design system (Motion): with reduced motion, cross-fades stay; tilt,
 * parallax and anything that travels are removed. The CSS in motion.css does
 * this for everything it animates (--uw-motion becomes 0). A component that
 * runs its own GSAP or Web Animations should ask this hook first.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the viewer asked for reduced motion. False on the server and before hydration. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** The same, outside React. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}
