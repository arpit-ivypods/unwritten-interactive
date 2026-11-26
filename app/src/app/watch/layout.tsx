/**
 * Layout of /watch. OWNER: player.
 *
 * The player lives here and not in the page, so it stays mounted while the
 * viewer moves from one episode to the next (the layout is above the dynamic
 * segments). See src/components/player/PlayerHost.tsx for why that matters.
 */
import type { ReactNode } from "react";
import { PlayerHost } from "@/components/player/PlayerHost";

export default function WatchLayout({ children }: { children: ReactNode }) {
  return <PlayerHost>{children}</PlayerHost>;
}
