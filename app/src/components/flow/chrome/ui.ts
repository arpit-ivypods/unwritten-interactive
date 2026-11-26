"use client";

/**
 * Interface state that belongs to no rule and is not saved: whether the
 * presenter drawer is open, which series is on the home stage, and the toasts
 * on screen. OWNER: flow engineer. Viewer and demo state live in `@/state`.
 */
import { create } from "zustand";
import { allSeries } from "@/content";

export interface ToastItem {
  id: number;
  text: string;
  icon?: "check" | "clock" | "share" | "replay";
}

interface FlowUi {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  /** The series on the home stage; the "Series" nav link opens it. */
  stagedSeriesId: string;
  stageSeries: (seriesId: string) => void;
  toasts: ToastItem[];
  /** Show a one-line confirmation. It leaves after four seconds (ToastHost). */
  toast: (text: string, icon?: ToastItem["icon"]) => void;
  dismissToast: (id: number) => void;
}

let nextToastId = 1;

export const useFlowUi = create<FlowUi>()((set) => ({
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  stagedSeriesId: allSeries[0]?.id ?? "",
  stageSeries: (stagedSeriesId) => set({ stagedSeriesId }),
  toasts: [],
  // One toast at a time: a new confirmation replaces the last.
  toast: (text, icon) => set({ toasts: [{ id: nextToastId++, text, icon }] }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
