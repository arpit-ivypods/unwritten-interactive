// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LONG_PRESS_MS, attachLongPress, isDrawerShortcut } from "./longPress";

function pointer(type: string, target: Element, init: { x?: number; y?: number; button?: number; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.x ?? 10, clientY: init.y ?? 10, button: init.button ?? 0 });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  target.dispatchEvent(event);
  return event;
}

describe("long press on the wordmark", () => {
  let wordmark: HTMLElement;
  let inner: HTMLElement;
  let other: HTMLElement;
  let onLongPress: ReturnType<typeof vi.fn<() => void>>;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `<a class="uw-wordmark" href="/"><svg></svg><b id="inner">Unwritten</b></a><button id="other">Other</button>`;
    wordmark = document.querySelector(".uw-wordmark")!;
    inner = document.getElementById("inner")!;
    other = document.getElementById("other")!;
    onLongPress = vi.fn<() => void>();
    detach = attachLongPress(document, ".uw-wordmark", onLongPress);
  });

  afterEach(() => {
    detach();
    vi.useRealTimers();
  });

  it("fires after the pointer has been held, also on a child of the wordmark", () => {
    pointer("pointerdown", inner);
    vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire for a tap, and leaves the tap's click alone", () => {
    pointer("pointerdown", wordmark);
    vi.advanceTimersByTime(200);
    pointer("pointerup", wordmark);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(pointer("click", wordmark).defaultPrevented).toBe(false);
  });

  it("swallows the click that follows a long press, once", () => {
    pointer("pointerdown", wordmark);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer("pointerup", wordmark);
    expect(pointer("click", wordmark).defaultPrevented).toBe(true);
    expect(pointer("click", wordmark).defaultPrevented).toBe(false);
  });

  it("is cancelled by a drag or a scroll, but not by a small wobble", () => {
    pointer("pointerdown", wordmark, { x: 10, y: 10 });
    pointer("pointermove", wordmark, { x: 14, y: 12 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    pointer("pointerdown", wordmark, { x: 10, y: 10 });
    pointer("pointermove", wordmark, { x: 40, y: 10 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    pointer("pointerdown", wordmark);
    pointer("pointercancel", wordmark);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("ignores presses elsewhere and the secondary mouse button", () => {
    pointer("pointerdown", other);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    pointer("pointerdown", wordmark, { button: 2 });
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("takes a touch browser's early context menu as the long press and suppresses the menu", () => {
    pointer("pointerdown", wordmark, { pointerType: "touch" });
    vi.advanceTimersByTime(400);
    const menu = pointer("contextmenu", wordmark);
    expect(menu.defaultPrevented).toBe(true);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("leaves an ordinary right click alone", () => {
    expect(pointer("contextmenu", wordmark).defaultPrevented).toBe(false);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("stops listening when detached", () => {
    detach();
    pointer("pointerdown", wordmark);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

describe("the presenter shortcut", () => {
  const key = (init: Partial<KeyboardEvent> & { target?: EventTarget | null }) =>
    ({ key: "D", shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, target: document.body, ...init }) as Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target">;

  it("is Shift + D with no other modifier", () => {
    expect(isDrawerShortcut(key({}))).toBe(true);
    expect(isDrawerShortcut(key({ key: "d" }))).toBe(true);
    expect(isDrawerShortcut(key({ shiftKey: false, key: "d" }))).toBe(false);
    expect(isDrawerShortcut(key({ metaKey: true }))).toBe(false);
    expect(isDrawerShortcut(key({ ctrlKey: true }))).toBe(false);
    expect(isDrawerShortcut(key({ altKey: true }))).toBe(false);
    expect(isDrawerShortcut(key({ key: "F" }))).toBe(false);
  });

  it("is left alone while the viewer is typing or picking from a list", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isDrawerShortcut(key({ target: document.createElement(tag) }))).toBe(false);
    }
    expect(isDrawerShortcut(key({ target: document.createElement("button") }))).toBe(true);
  });
});
