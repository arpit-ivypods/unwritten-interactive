// @vitest-environment jsdom
/**
 * When localStorage refuses to work (private modes, blocked site data, a full
 * quota), the app still loads and runs, from memory.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackStorage } from "./storage";

function fakeLocal(fail: { get?: boolean; set?: boolean } = {}) {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => {
      if (fail.get) throw new DOMException("denied", "SecurityError");
      return data.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (fail.set) throw new DOMException("full", "QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key: string) => void data.delete(key),
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fallbackStorage", () => {
  it("uses localStorage while it works", () => {
    const local = fakeLocal();
    const storage = fallbackStorage(() => local);
    storage.setItem("k", "v");
    expect(local.data.get("k")).toBe("v");
    expect(storage.getItem("k")).toBe("v");
    expect(storage.usingMemory()).toBe(false);
  });

  it("falls back to memory when localStorage cannot even be reached", () => {
    const storage = fallbackStorage(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(storage.getItem("k")).toBeNull();
    expect(() => storage.setItem("k", "v")).not.toThrow();
    expect(storage.getItem("k")).toBe("v");
    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
    expect(storage.usingMemory()).toBe(true);
  });

  it("keeps the latest write when a write is refused (quota full)", () => {
    const local = fakeLocal();
    const storage = fallbackStorage(() => local);
    storage.setItem("k", "old");
    local.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(() => storage.setItem("k", "new")).not.toThrow();
    expect(storage.getItem("k")).toBe("new");
    expect(storage.usingMemory()).toBe(true);
  });

  it("falls back when a read throws", () => {
    const storage = fallbackStorage(() => fakeLocal({ get: true }));
    expect(storage.getItem("k")).toBeNull();
    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");
  });
});

describe("the stores when localStorage throws", () => {
  it("still hydrate, so the app leaves its loading state, and work from memory", async () => {
    // Blocked before the stores are even created, as in a browser with site data turned off.
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => window.localStorage).toThrow();
    vi.resetModules();
    const state = await import("./index");

    // The persist API exists, so a change in another window can still be followed.
    expect(state.useViewerStore.persist).toBeDefined();
    expect(state.useDemoStore.persist).toBeDefined();
    await state.hydrateStores();
    expect(state.storesHydrated()).toBe(true);
    expect(state.useViewerStore.getState()).toMatchObject({ language: "hi", welcomeSeen: false, series: {} });
    expect(state.useDemoStore.getState().launchAt).not.toBeNull();

    // Actions do not throw, and the state survives a rehydrate (another window's storage event).
    state.useViewerStore.getState().setLanguage("en");
    state.useViewerStore.getState().applyPreset("series1", "at-question");
    expect(state.useViewerStore.getState().castBallot("series1", "B")).toEqual({ ok: true });
    state.useDemoStore.getState().setDay("last-hour");
    await state.hydrateStores();
    expect(state.useViewerStore.getState().language).toBe("en");
    expect(state.useViewerStore.getState().series.series1.ballot?.choice).toBe("B");
    expect(state.useDemoStore.getState().day).toBe("last-hour");
  });
});
