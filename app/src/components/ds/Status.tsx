/**
 * StatusChip, Countdown and Toast (design system, Status).
 */
import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { renderIcon, type IconName } from "./Icon";

// ---------------------------------------------------------------------------
// StatusChip
// ---------------------------------------------------------------------------

/**
 * live: day 1, both endings open. alert: closing countdown, expired.
 * canon: day 2, the official ending. locked: an expired or locked ending.
 * plain: neutral metadata (no dot). The words always state the state.
 */
export type ChipKind = "live" | "alert" | "canon" | "locked" | "plain" | "default";

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  kind?: ChipKind;
  children: ReactNode;
}

export function StatusChip({ kind = "default", className, children, ...rest }: StatusChipProps) {
  return (
    <span className={clsx("uw-chip", kind !== "default" && `uw-chip--${kind}`, className)} {...rest}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

export interface CountdownParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Split a duration into hours, minutes and seconds (hours are not capped at 24). */
export function countdownParts(remainingMs: number): CountdownParts {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "02:14:09", for chips ("Closes in 02:14:09"). */
export function formatCountdown(remainingMs: number): string {
  const { hours, minutes, seconds } = countdownParts(remainingMs);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export interface CountdownProps {
  /** Time left in day 1. `null` before the page has mounted: shows "--". */
  remainingMs: number | null;
  /** The last hour: figures turn to `alert`. The label must say so too. */
  alert?: boolean;
  /** Label above the tiles, e.g. "Day 1 ends in" or "Last hour". */
  label?: ReactNode;
  className?: string;
}

/**
 * Three tabular-figure tiles. Once per screen (home, series page); inside
 * sheets and panels use an alert chip. role="timer" with an aria-label in
 * words that changes once a minute, not every second.
 */
export function Countdown({ remainingMs, alert = false, label, className }: CountdownProps) {
  const parts = remainingMs == null ? null : countdownParts(remainingMs);
  const unit = (value: number | undefined, name: string) => (
    <span className="uw-countdown-unit">
      <b>{value == null ? "--" : pad(value)}</b>
      <span>{name}</span>
    </span>
  );
  const aria = parts ? `${parts.hours} hours ${parts.minutes} minutes left` : "Time left loading";
  const timer = (
    <div className={clsx("uw-countdown", alert && "uw-countdown--alert", !label && className)} role="timer" aria-label={aria}>
      {unit(parts?.hours, "hrs")}
      {unit(parts?.minutes, "min")}
      {unit(parts?.seconds, "sec")}
    </div>
  );
  if (!label) return timer;
  return (
    <div className={clsx("uw-stack", className)} style={{ gap: 10 }}>
      <span className="uw-label" style={alert ? { color: "var(--alert)" } : undefined}>
        {label}
      </span>
      {timer}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export interface ToastProps {
  /** One line. */
  children: ReactNode;
  icon?: IconName | ReactNode;
  /** One text action, 44px tall, such as Undo. A toast with an action stays until dismissed. */
  action?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * A short confirmation in an ink pill, role="status". Never for an error that
 * blocks playback (that is a stage state). Place toasts in a `ToastRegion`:
 * bottom centre above the dock on phones, bottom left on desktop. Removing it
 * after four seconds is the caller's job.
 */
export function Toast({ children, icon, action, className }: ToastProps) {
  return (
    <div className={clsx("uw-toast", !action && "uw-toast--plain", className)} role="status">
      {renderIcon(icon)}
      {children}
      {action ? (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export function ToastRegion({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("uw-toast-region", className)} {...rest} />;
}
