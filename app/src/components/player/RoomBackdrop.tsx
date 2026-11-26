"use client";

/**
 * The room behind the stage. OWNER: player.
 *
 * "The room follows the film": when the shot changes, the blurred backdrop
 * cross-fades to a still from it (dur-scene, ease-in-out; the transition is on
 * `.uw-ambient-img` in the design system). Two stacked images take turns: the
 * new still is loaded into the hidden one and the two swap opacity once it has
 * arrived, so the room never blinks to the bare ground.
 *
 * The cross-fade stays under prefers-reduced-motion (design system, Motion).
 *
 * Render it as the first child of a `uw-ambient` element.
 */
/* eslint-disable @next/next/no-img-element -- a blurred backdrop served as it is from /media */
import { useState } from "react";

type Slot = 0 | 1;

interface Layers {
  srcs: [string, string];
  /** The slot that is visible, or fading in. */
  front: Slot;
  /** The still last asked for. */
  target: string;
}

export function RoomBackdrop({ still }: { still: string }) {
  const [layers, setLayers] = useState<Layers>(() => ({ srcs: [still, still], front: 0, target: still }));

  // A new still was asked for: put it on the hidden layer. This is state
  // derived from a prop, adjusted while rendering (no effect, no extra paint).
  if (layers.target !== still) {
    const back: Slot = layers.front === 0 ? 1 : 0;
    if (layers.srcs[layers.front] === still) {
      setLayers({ ...layers, target: still });
    } else if (layers.srcs[back] === still) {
      // Already decoded on the hidden layer (a step back to the shot before): swap at once.
      setLayers({ ...layers, front: back, target: still });
    } else {
      const srcs: [string, string] = [layers.srcs[0], layers.srcs[1]];
      srcs[back] = still;
      setLayers({ srcs, front: layers.front, target: still });
    }
  }

  // The hidden layer has its image (or failed to get one): bring it forward.
  const settle = (slot: Slot) => () => {
    setLayers((current) => (current.front !== slot && current.srcs[slot] === current.target ? { ...current, front: slot } : current));
  };

  return (
    <>
      {([0, 1] as const).map((slot) => (
        <img
          key={slot}
          className="uw-ambient-img"
          src={layers.srcs[slot]}
          alt=""
          aria-hidden="true"
          data-room-layer={layers.front === slot ? "front" : "back"}
          style={{ opacity: layers.front === slot ? 1 : 0 }}
          onLoad={settle(slot)}
          onError={settle(slot)}
        />
      ))}
    </>
  );
}
