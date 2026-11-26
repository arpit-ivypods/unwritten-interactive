"use client";

/**
 * Plays one voice take or sound cue. Only one plays at a time across the page.
 * OWNER: studio engineer.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ds";

let current: { audio: HTMLAudioElement; stop: () => void } | null = null;

export function AudioButton({
  src,
  label,
  placeholder = false,
  durationS,
}: {
  src: string;
  /** What is played, for the accessible name: "l01 Hinglish". */
  label: string;
  placeholder?: boolean;
  durationS?: number | null;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        if (current?.audio === a) current = null;
      }
    };
  }, []);

  const toggle = () => {
    let a = audioRef.current;
    if (!a) {
      a = new Audio(src);
      a.preload = "auto";
      a.addEventListener("ended", () => setPlaying(false));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("play", () => setPlaying(true));
      audioRef.current = a;
    }
    if (!a.paused) {
      a.pause();
      return;
    }
    if (current && current.audio !== a) current.stop();
    current = { audio: a, stop: () => a.pause() };
    a.currentTime = 0;
    void a.play().catch(() => setPlaying(false));
  };

  const secs = durationS != null ? ` · ${durationS.toFixed(1)} s` : "";
  const text = placeholder ? `Silent placeholder${secs}` : `${playing ? "Stop" : "Play"}${secs}`;
  return (
    <Button
      variant="glass"
      size="sm"
      icon={playing ? "pause" : "play"}
      onClick={toggle}
      aria-pressed={playing}
      // WCAG 2.5.3: the accessible name starts with the visible text, then says what plays.
      aria-label={`${text}, ${label}${placeholder ? " (no take recorded)" : ""}`}
    >
      {text}
    </Button>
  );
}
