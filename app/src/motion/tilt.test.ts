import { describe, expect, it } from "vitest";
import { displacementPx, maxTiltDeg, pointerVector, tiltTransform, TILT_LIMIT_PX, TILT_MAX_DEG } from "./tilt";

describe("pointer tilt", () => {
  it("never adds more than 3 degrees", () => {
    expect(TILT_MAX_DEG).toBe(3);
    expect(maxTiltDeg(10, 10)).toBe(3);
    expect(maxTiltDeg(200, 120)).toBe(3);
  });

  it("gives big panels less, so a corner moves at most the limit", () => {
    for (const [w, h] of [
      [430, 300],
      [430, 640],
      [430, 900],
      [360, 520],
      [980, 1400],
    ]) {
      const deg = maxTiltDeg(w, h);
      expect(deg).toBeGreaterThan(0);
      expect(deg).toBeLessThanOrEqual(3);
      expect(displacementPx(Math.hypot(w / 2, h / 2), deg)).toBeLessThanOrEqual(TILT_LIMIT_PX + 1e-6);
    }
    expect(maxTiltDeg(430, 900)).toBeLessThan(maxTiltDeg(430, 300));
  });

  it("the limit leaves room under the design system's 6px for text", () => {
    expect(TILT_LIMIT_PX).toBeLessThan(6);
  });

  it("tilts nothing without a size", () => {
    expect(maxTiltDeg(0, 300)).toBe(0);
    expect(maxTiltDeg(Number.NaN, 300)).toBe(0);
  });

  it("maps the pointer to a vector no longer than 1", () => {
    expect(pointerVector(720, 450, 1440, 900)).toEqual({ x: 0, y: 0 });
    expect(pointerVector(1440, 450, 1440, 900)).toEqual({ x: 1, y: 0 });
    const corner = pointerVector(0, 0, 1440, 900);
    expect(Math.hypot(corner.x, corner.y)).toBeCloseTo(1, 6);
    expect(corner.x).toBeLessThan(0);
    expect(corner.y).toBeLessThan(0);
    // Outside the window (a drag) is clamped.
    expect(pointerVector(5000, 450, 1440, 900)).toEqual({ x: 1, y: 0 });
    expect(pointerVector(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("writes one transform with its own perspective", () => {
    expect(tiltTransform({ x: 0, y: 0 }, 3)).toBe("perspective(1200px) rotateX(0deg) rotateY(0deg)");
    expect(tiltTransform({ x: 1, y: -1 }, 2)).toBe("perspective(1200px) rotateX(2deg) rotateY(2deg)");
    expect(tiltTransform({ x: -0.5, y: 0.25 }, 3)).toBe("perspective(1200px) rotateX(-0.75deg) rotateY(-1.5deg)");
  });
});
