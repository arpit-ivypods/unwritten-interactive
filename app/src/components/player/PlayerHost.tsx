"use client";

/**
 * Mounts the player for the route /watch/[seriesId]/[playableId]. OWNER: player.
 *
 * It sits in the layout of /watch (src/app/watch/layout.tsx), above the two
 * dynamic segments, so it is NOT remounted when the viewer goes from one
 * episode to the next: only the params change. The pages under /watch render
 * nothing themselves; they exist for their static params and the 404.
 */
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { findPlayable, getSeries } from "@/content";
import { PlayerScreen } from "./PlayerScreen";

export function PlayerHost({ children }: { children?: ReactNode }) {
  const params = useParams<{ seriesId?: string; playableId?: string }>();
  const series = params.seriesId ? getSeries(params.seriesId) : undefined;
  const playable = series && params.playableId ? findPlayable(series, params.playableId) : undefined;
  // An unknown id: the route's own 404 is in `children`.
  if (!series || !playable) return <>{children}</>;
  return (
    <>
      <PlayerScreen series={series} playable={playable} />
      {children}
    </>
  );
}
