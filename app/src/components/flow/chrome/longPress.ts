/**
 * Long press, by event delegation. OWNER: flow engineer.
 *
 * The presenter drawer opens when the wordmark is held down. The wordmark is
 * drawn by the design system in several places (the nav pill, the welcome
 * panel), so the press is detected on the document for anything matching a
 * selector, and no component needs a handler of its own.
 *
 * A press counts when the pointer stays down for `ms` without moving more
 * than `tolerance` pixels. The click that follows the release is swallowed,
 * so holding the wordmark (a link to home) does not also navigate. On touch
 * screens the browser may raise `contextmenu` before the time is up and
 * cancel the pointer; that event is taken as the long press and suppressed.
 */
export interface LongPressOptions {
  /** How long the pointer must stay down. */
  ms?: number;
  /** How far it may move, in px, and still count. */
  tolerance?: number;
}

export const LONG_PRESS_MS = 650;

export function attachLongPress(root: Document | HTMLElement, selector: string, onLongPress: () => void, options: LongPressOptions = {}): () => void {
  const ms = options.ms ?? LONG_PRESS_MS;
  const tolerance = options.tolerance ?? 10;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  /** True from the moment a press fires until the click it causes has been swallowed. */
  let swallowClick = false;

  const matches = (event: Event): boolean => event.target instanceof Element && event.target.closest(selector) !== null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    start = null;
  };

  const fire = () => {
    cancel();
    swallowClick = true;
    onLongPress();
  };

  const onDown = (event: Event) => {
    const pointer = event as PointerEvent;
    cancel();
    swallowClick = false;
    if (!matches(event)) return;
    if (pointer.pointerType === "mouse" && pointer.button !== 0) return;
    start = { x: pointer.clientX, y: pointer.clientY };
    timer = setTimeout(fire, ms);
  };

  const onMove = (event: Event) => {
    if (!start) return;
    const pointer = event as PointerEvent;
    if (Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) > tolerance) cancel();
  };

  const onContextMenu = (event: Event) => {
    if (timer === null && !swallowClick) return; // an ordinary right click
    if (!matches(event)) return;
    event.preventDefault();
    if (timer !== null) fire();
  };

  const onClick = (event: Event) => {
    if (!swallowClick) return;
    swallowClick = false;
    if (!matches(event)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const target = root as HTMLElement;
  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", cancel);
  target.addEventListener("pointercancel", cancel);
  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("click", onClick, true);
  return () => {
    cancel();
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", cancel);
    target.removeEventListener("pointercancel", cancel);
    target.removeEventListener("contextmenu", onContextMenu);
    target.removeEventListener("click", onClick, true);
  };
}

/** True when a key press should be left to the element that has focus (typing, picking from a list). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/** The presenter shortcut: Shift + D, with no other modifier, outside text fields. */
export function isDrawerShortcut(event: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target">): boolean {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key !== "D" && event.key !== "d") return false;
  return !isTypingTarget(event.target);
}
