"use client";

/**
 * Light and dark theme. The layout renders <html data-theme="light">; this
 * sets data-theme on <html> from the viewer's stored choice after mount and
 * when they switch. Stored under its own key, `unwritten:theme`, outside the
 * viewer and demo stores. Same layout in both themes; the stage never changes.
 *
 * Mount `ThemeSync` once (for example in AppChrome) to apply a stored theme on
 * every page; `ThemeSwitch` also applies it.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Segmented } from "./Navigation";

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "unwritten:theme";

const listeners = new Set<() => void>();

function readStored(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode: the switch still works for this page.
  }
  apply(theme);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      apply(readStored());
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current theme; "light" on the server and before mount. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readStored, () => "light" as Theme);
  useEffect(() => {
    apply(theme);
  }, [theme]);
  const set = useCallback((t: Theme) => setTheme(t), []);
  return [theme, set];
}

export function ThemeSync() {
  useTheme();
  return null;
}

export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, set] = useTheme();
  return (
    <Segmented<Theme>
      label="Theme"
      value={theme}
      onChange={set}
      className={className}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
