"use client";

/**
 * Pointer tilt for the desktop side panels. OWNER: motion.
 *
 * Only where a panel already leans toward the stage (the flow and player CSS
 * tilt them from 1240px and 1024px, and not under prefers-reduced-motion), and
 * only with a fine pointer that can hover. The pointer adds at most 3 degrees,
 * sized per panel so text never moves more than 6px (see tilt.ts).
 *
 * Cost per frame: one inline transform per panel, written in GSAP's ticker.
 * Nothing is read from layout while the pointer moves; sizes are read once
 * when the panels are collected (on a route change, a resize, or when a panel
 * is replaced).
 *
 * Which panels: the children of `.flow-left` / `.flow-right` (the flow
 * screens), the player's `.uwp-info` and `.uwp-controls`, and anything marked
 * `data-motion-tilt` (an element that should lean on its own; it must not set
 * its own transform).
 */
import { useEffect } from "react";
import { gsap } from "gsap";
import { maxTiltDeg, pointerVector, tiltTransform } from "./tilt";

interface Target {
  el: HTMLElement;
  maxDeg: number;
}

/** host: an element that leans at rest. targets: what the pointer tilts, found from the host. */
const TILT_RULES: { host: string; targets: (host: Element) => Element[] }[] = [
  { host: ".flow-layout > .flow-left, .flow-layout > .flow-right", targets: (host) => [...host.children] },
  { host: ".uwp-info > .uw-glass, .uwp-controls-inner", targets: (host) => (host.parentElement ? [host.parentElement] : []) },
];
const OPT_IN = "[data-motion-tilt]";
const QUERIES = {
  pointer: "(hover: hover) and (pointer: fine)",
  reduced: "(prefers-reduced-motion: reduce)",
  wide: "(min-width: 1024px)",
};
/** How often (ms) the panel list may be rebuilt while the pointer moves, when a panel was replaced. */
const RECOLLECT_MS = 300;

export function usePointerTilt(routeKey: string): void {
  useEffect(() => {
    const pointer = window.matchMedia(QUERIES.pointer);
    const reduced = window.matchMedia(QUERIES.reduced);
    const wide = window.matchMedia(QUERIES.wide);

    const proxy = { x: 0, y: 0 };
    const toX = gsap.quickTo(proxy, "x", { duration: 0.6, ease: "power3.out" });
    const toY = gsap.quickTo(proxy, "y", { duration: 0.6, ease: "power3.out" });

    let targets: Target[] = [];
    const owned = new Set<HTMLElement>();
    let viewport = { width: window.innerWidth, height: window.innerHeight };
    let lastCollect = -Infinity;
    let drawn = { x: NaN, y: NaN };
    let ticking = false;

    const enabled = () => pointer.matches && !reduced.matches && wide.matches;

    const release = (el: HTMLElement) => {
      el.style.removeProperty("transform");
      owned.delete(el);
    };

    // Reads only: computed transforms and sizes. Runs outside the ticker.
    const collect = () => {
      lastCollect = performance.now();
      const next: Target[] = [];
      if (enabled()) {
        const seen = new Set<Element>();
        const add = (el: Element) => {
          if (!(el instanceof HTMLElement) || seen.has(el)) return;
          seen.add(el);
          // Never fight a transform someone else set.
          if (!owned.has(el) && getComputedStyle(el).transform !== "none") return;
          const maxDeg = maxTiltDeg(el.offsetWidth, el.offsetHeight);
          if (maxDeg > 0) next.push({ el, maxDeg });
        };
        for (const rule of TILT_RULES) {
          for (const host of document.querySelectorAll(rule.host)) {
            if (getComputedStyle(host).transform === "none") continue;
            rule.targets(host).forEach(add);
          }
        }
        document.querySelectorAll(OPT_IN).forEach(add);
      }
      const keep = new Set(next.map((t) => t.el));
      for (const el of [...owned]) if (!keep.has(el)) release(el);
      targets = next;
      drawn = { x: NaN, y: NaN };
      if (targets.length > 0) startTicking();
      else stopTicking();
    };

    // Writes only.
    const render = () => {
      if (proxy.x === drawn.x && proxy.y === drawn.y) return;
      drawn = { x: proxy.x, y: proxy.y };
      for (const target of targets) {
        target.el.style.transform = tiltTransform(proxy, target.maxDeg);
        owned.add(target.el);
      }
    };
    const startTicking = () => {
      if (ticking) return;
      ticking = true;
      gsap.ticker.add(render);
    };
    const stopTicking = () => {
      if (!ticking) return;
      ticking = false;
      gsap.ticker.remove(render);
    };

    const stale = () => targets.length === 0 || targets.some((t) => !t.el.isConnected);

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !enabled()) return;
      if (stale() && performance.now() - lastCollect > RECOLLECT_MS) collect();
      if (targets.length === 0) return;
      const vector = pointerVector(event.clientX, event.clientY, viewport.width, viewport.height);
      toX(vector.x);
      toY(vector.y);
    };
    const onLeave = (event: PointerEvent) => {
      if (event.relatedTarget === null) {
        toX(0);
        toY(0);
      }
    };
    let resizeTimer = 0;
    const onResize = () => {
      viewport = { width: window.innerWidth, height: window.innerHeight };
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(collect, 150);
    };
    const onQuery = () => {
      if (!enabled()) {
        proxy.x = 0;
        proxy.y = 0;
      }
      collect();
    };

    // Panels mount after the stores load, so collect again shortly after a route change.
    const first = window.setTimeout(collect, 50);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize, { passive: true });
    for (const query of [pointer, reduced, wide]) query.addEventListener("change", onQuery);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      for (const query of [pointer, reduced, wide]) query.removeEventListener("change", onQuery);
      stopTicking();
      gsap.killTweensOf(proxy);
      for (const el of [...owned]) release(el);
    };
  }, [routeKey]);
}
