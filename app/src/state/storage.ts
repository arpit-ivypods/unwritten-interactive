/**
 * Where the stores keep their state: localStorage in the browser, nothing on
 * the server and in tests without a DOM. Keys and version are part of the
 * contract (the end-to-end tests seed them directly; see e2e/state.ts).
 *
 * localStorage can refuse to work: reading `window.localStorage` throws in
 * some private modes and when site data is blocked, and a write throws when
 * the quota is full. The app must still run, so the first time it throws the
 * stores switch to memory for the rest of the page's life: the demo works,
 * it is just not remembered after a reload.
 */
import { createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";

export const VIEWER_STORAGE_KEY = "unwritten:viewer";
export const DEMO_STORAGE_KEY = "unwritten:demo";
/** Bump when a stored shape changes in a way sanitize* cannot read. */
export const STORAGE_VERSION = 1;

const nowhere: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * A StateStorage that uses `getLocal()` (localStorage) while it works and
 * memory once it has thrown. Every write also goes to memory, so after the
 * switch nothing written in this page is lost. Never throws.
 */
export function fallbackStorage(getLocal: () => Pick<Storage, "getItem" | "setItem" | "removeItem">): StateStorage & { usingMemory: () => boolean } {
  const memory = new Map<string, string>();
  let failed = false;
  const fail = (error: unknown) => {
    if (!failed) console.warn(`[state] localStorage is not available, keeping state in memory: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  };
  const attempt = <T>(run: (local: Pick<Storage, "getItem" | "setItem" | "removeItem">) => T): { ok: true; value: T } | { ok: false } => {
    if (failed) return { ok: false };
    try {
      return { ok: true, value: run(getLocal()) };
    } catch (error) {
      fail(error);
      return { ok: false };
    }
  };
  return {
    getItem: (name) => {
      const read = attempt((local) => local.getItem(name));
      return read.ok ? read.value : (memory.get(name) ?? null);
    },
    setItem: (name, value) => {
      memory.set(name, value);
      attempt((local) => local.setItem(name, value));
    },
    removeItem: (name) => {
      memory.delete(name);
      attempt((local) => local.removeItem(name));
    },
    usingMemory: () => failed,
  };
}

/** `window.localStorage` (falling back to memory if it throws), or a store that remembers nothing when there is no window. */
export function deviceStorage<T>() {
  const storage = typeof window === "undefined" ? nowhere : fallbackStorage(() => window.localStorage);
  return createJSONStorage<T>(() => storage);
}
