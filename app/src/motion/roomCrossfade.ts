/**
 * The room cross-fade between screens. OWNER: motion.
 *
 * Design system (Motion): the backdrop cross-fades (dur-scene, ease-in-out)
 * when the picture behind it changes. Inside the player, RoomBackdrop already
 * does this shot by shot with two stacked stills. This module covers the
 * cases nobody else sees, because the old still is gone by the time the new
 * one is drawn:
 *
 * - a route change, or a screen remounting after the stores load: the old
 *   screen root (`.uw-ambient--screen`) leaves the page and a new one arrives;
 * - a screen root's single still changing its `src` in place (Home's series
 *   dock switches the series on the stage).
 *
 * In both cases a copy of the old still (same classes, so the same blur and
 * placement) is laid over the new one inside the new root, and faded out once
 * the new still has loaded, so the room never blinks to the bare ground.
 * It stays under prefers-reduced-motion: it is a cross-fade, not movement.
 * Only opacity is animated, with the Web Animations API (compositor).
 *
 * The copy is not part of React's tree. It is a sibling after the screen's
 * own stills; React only inserts and removes its own nodes, and the copy is
 * removed when the fade ends (or with its root).
 */

export const SCREEN_ROOT = ".uw-ambient--screen";
const STILL = "img.uw-ambient-img";
export const GHOST_ATTR = "data-motion-ghost";
/** A screen root removed this long before the next one arrives still counts as the screen before. */
const HANDOVER_MS = 1200;
/** The fade starts when the new still has loaded, or after this long. */
const LOAD_TIMEOUT_MS = 1200;

export interface RoomCrossfadeOptions {
  /** Fade length in ms. Default: --dur-scene from the tokens, else 900. */
  durationMs?: () => number;
  /** CSS easing. Default: --ease-in-out from the tokens. */
  easing?: () => string;
  /** Resolves when an image has loaded or failed (tests replace it). */
  whenLoaded?: (img: HTMLImageElement) => Promise<void>;
  now?: () => number;
}

/** The still a screen root is showing: the player's front layer, else its first still. */
export function frontStill(root: Element): HTMLImageElement | null {
  const front = root.querySelector<HTMLImageElement>(`:scope > ${STILL}[data-room-layer="front"]`);
  if (front) return front;
  return root.querySelector<HTMLImageElement>(`:scope > ${STILL}:not([${GHOST_ATTR}])`);
}

function screenRootsIn(node: Node): Element[] {
  if (!(node instanceof Element)) return [];
  const roots = node.matches(SCREEN_ROOT) ? [node] : [];
  return roots.concat([...node.querySelectorAll(SCREEN_ROOT)]);
}

function absolute(src: string | null): string | null {
  if (!src) return null;
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return src;
  }
}

function stillSrc(img: HTMLImageElement | null): string | null {
  return img ? absolute(img.getAttribute("src")) : null;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function defaultDuration(): number {
  const value = cssVar("--dur-scene");
  const ms = value.endsWith("ms") ? parseFloat(value) : value.endsWith("s") ? parseFloat(value) * 1000 : NaN;
  return Number.isFinite(ms) && ms > 0 ? ms : 900;
}

function defaultEasing(): string {
  return cssVar("--ease-in-out") || "ease-in-out";
}

function defaultWhenLoaded(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, LOAD_TIMEOUT_MS);
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });
}

/**
 * Lay `oldSrc` over the room of `root` and fade it out. Returns the copy, or
 * null when there is nothing to fade (no still, or the same picture).
 */
export function crossfadeRoom(root: Element, oldSrc: string, options: RoomCrossfadeOptions = {}): HTMLImageElement | null {
  const base = frontStill(root);
  if (!base || stillSrc(base) === absolute(oldSrc)) return null;

  const ghost = base.cloneNode(false) as HTMLImageElement;
  ghost.removeAttribute("data-room-layer");
  ghost.setAttribute(GHOST_ATTR, "");
  ghost.setAttribute("aria-hidden", "true");
  ghost.alt = "";
  ghost.style.opacity = "1";
  ghost.src = oldSrc;
  const stills = root.querySelectorAll(`:scope > ${STILL}`);
  (stills[stills.length - 1] ?? base).after(ghost);

  const whenLoaded = options.whenLoaded ?? defaultWhenLoaded;
  const duration = (options.durationMs ?? defaultDuration)();
  const easing = (options.easing ?? defaultEasing)();
  void whenLoaded(base).then(() => {
    if (!ghost.isConnected) return;
    if (typeof ghost.animate !== "function") {
      ghost.remove();
      return;
    }
    const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing, fill: "forwards" });
    fade.finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
  });
  return ghost;
}

/** Watch the document for screens and stills that change, and cross-fade the room. Returns a stop function. */
export function watchRoomCrossfades(target: Node = document.body, options: RoomCrossfadeOptions = {}): () => void {
  const now = options.now ?? (() => performance.now());
  let departed: { src: string; at: number } | null = null;

  const observer = new MutationObserver((records) => {
    const arrived: Element[] = [];
    const swapped: { root: Element; oldSrc: string }[] = [];

    for (const record of records) {
      if (record.type === "childList") {
        record.removedNodes.forEach((node) => {
          for (const root of screenRootsIn(node)) {
            const src = stillSrc(frontStill(root));
            if (src) departed = { src, at: now() };
          }
        });
        record.addedNodes.forEach((node) => arrived.push(...screenRootsIn(node)));
      } else if (record.type === "attributes" && record.target instanceof HTMLImageElement) {
        const img = record.target;
        const root = img.parentElement;
        if (!root || !root.matches(SCREEN_ROOT) || !img.matches(STILL)) continue;
        // The player's two layers cross-fade themselves (RoomBackdrop); copies are ours.
        if (img.hasAttribute("data-room-layer") || img.hasAttribute(GHOST_ATTR)) continue;
        const oldSrc = absolute(record.oldValue);
        if (oldSrc && oldSrc !== stillSrc(img)) swapped.push({ root, oldSrc });
      }
    }

    const before = departed && now() - departed.at <= HANDOVER_MS ? departed.src : null;
    if (before) {
      for (const root of arrived) {
        if (root.isConnected) crossfadeRoom(root, before, options);
      }
      if (arrived.length > 0) departed = null;
    }
    for (const { root, oldSrc } of swapped) {
      if (!arrived.includes(root)) crossfadeRoom(root, oldSrc, options);
    }
  });

  observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"], attributeOldValue: true });
  return () => observer.disconnect();
}
