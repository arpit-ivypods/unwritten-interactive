"use client";

/**
 * Motion root. OWNER: motion engineer. Wraps the whole app (src/app/layout.tsx).
 *
 * The motion follows the design system's Motion section and enhances other
 * teams' markup without changing it:
 *
 * - motion.css: panels and sheets rise as a screen arrives (dur-move,
 *   ease-out), press feedback (dur-tap), the held ballot moment (the stage
 *   dims, the question card rises, then the two glimpses side by side), the
 *   tally split, toasts and the presenter drawer. Transform and opacity only,
 *   except the stage dim (a filter on one still, as the design system draws it).
 * - The room cross-fade between screens (roomCrossfade.ts, dur-scene).
 * - Pointer tilt on the desktop side panels (usePointerTilt.ts).
 *
 * prefers-reduced-motion: tilt and anything that travels are removed, the
 * cross-fades and fades stay.
 *
 * GSAP is registered here once (with @gsap/react's useGSAP), so any client
 * component can `import { gsap } from "gsap"` and `useGSAP` from "@gsap/react".
 */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { watchRoomCrossfades } from "./roomCrossfade";
import { usePointerTilt } from "./usePointerTilt";
import "./motion.css";

gsap.registerPlugin(useGSAP);

export function MotionRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => watchRoomCrossfades(document.body), []);
  usePointerTilt(pathname);

  return <>{children}</>;
}
