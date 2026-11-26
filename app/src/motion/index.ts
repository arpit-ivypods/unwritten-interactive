/**
 * Motion exports for other teams. OWNER: motion.
 *
 * Opt-in hooks in markup (no import needed), for screens motion.css does not
 * already cover:
 * - `data-motion="rise"` inside a screen root: the element rises in when it
 *   mounts (dur-move, ease-out). Put it on the glass panel itself, not on a
 *   wrapper around glass (the fade would cut the blur off while it runs).
 * - `data-motion="press"`: press feedback (dur-tap scale).
 * - `data-motion-tilt`: on desktop with a mouse, the element leans with the
 *   pointer (at most 3 degrees, text moves at most 6px). It must not set its
 *   own `transform`.
 */
export { MotionRoot } from "./MotionRoot";
export { prefersReducedMotion, usePrefersReducedMotion } from "./reducedMotion";
export { crossfadeRoom, frontStill, watchRoomCrossfades } from "./roomCrossfade";
export { displacementPx, maxTiltDeg, pointerVector, tiltTransform, TILT_LIMIT_PX, TILT_MAX_DEG, TILT_PERSPECTIVE_PX } from "./tilt";
