/**
 * Pointer tilt for the desktop side panels: the pure part. OWNER: motion.
 *
 * Design system (Motion): panels beside the stage lean toward it by at most
 * 7 degrees (the flow and player CSS set 6), the pointer adds at most 3
 * degrees, and text never moves more than 6px. The extra tilt is applied to a
 * panel around its own centre with its own perspective, so how far a point
 * moves depends only on the panel's size: a point at distance r from the
 * centre, rotated by an angle a, comes toward the viewer by r * sin(a) and so
 * moves on screen by about r * (r * sin(a)) / (P - r * sin(a)), plus the
 * in-plane r * (1 - cos(a)). The largest r is the half diagonal, so each
 * panel gets the largest angle that keeps its corners inside the limit.
 */

/** The perspective the extra tilt is drawn with, in px. */
export const TILT_PERSPECTIVE_PX = 1200;
/** Most extra rotation the pointer may add, in degrees (design system: 3). */
export const TILT_MAX_DEG = 3;
/**
 * Most a panel corner may move, in px. The design system allows 6 for text;
 * this leaves room for the resting tilt and perspective around the panel,
 * which enlarge the movement slightly, and text never sits in the corner.
 */
export const TILT_LIMIT_PX = 4.5;

const RAD = Math.PI / 180;

/** How far (px) a point at distance r (px) from the centre moves when the panel turns by `deg`. */
export function displacementPx(r: number, deg: number, perspective = TILT_PERSPECTIVE_PX): number {
  const a = Math.abs(deg) * RAD;
  const depth = r * Math.sin(a);
  if (depth >= perspective) return Infinity;
  return (r * depth) / (perspective - depth) + r * (1 - Math.cos(a));
}

/**
 * The largest extra tilt (degrees) for a panel of this size: never more than
 * `capDeg`, and never enough to move a corner more than `limitPx`.
 */
export function maxTiltDeg(
  width: number,
  height: number,
  { perspective = TILT_PERSPECTIVE_PX, limitPx = TILT_LIMIT_PX, capDeg = TILT_MAX_DEG } = {},
): number {
  if (!(width > 0) || !(height > 0)) return 0;
  const r = Math.hypot(width / 2, height / 2);
  if (displacementPx(r, capDeg, perspective) <= limitPx) return capDeg;
  let lo = 0;
  let hi = capDeg;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (displacementPx(r, mid, perspective) <= limitPx) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Where the pointer is, as a vector from the centre of the viewport, each
 * component in -1..1 and the whole vector no longer than 1 (so a corner does
 * not tilt further than an edge).
 */
export function pointerVector(clientX: number, clientY: number, width: number, height: number): { x: number; y: number } {
  if (!(width > 0) || !(height > 0)) return { x: 0, y: 0 };
  const x = clamp((clientX / width) * 2 - 1);
  const y = clamp((clientY / height) * 2 - 1);
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/**
 * The inline transform for one panel. The side under the pointer leans away a
 * little, as if pressed. `vector` comes from pointerVector, `maxDeg` from maxTiltDeg.
 */
export function tiltTransform(vector: { x: number; y: number }, maxDeg: number, perspective = TILT_PERSPECTIVE_PX): string {
  const rotateX = round(-vector.y * maxDeg);
  const rotateY = round(vector.x * maxDeg);
  return `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function round(value: number): number {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
