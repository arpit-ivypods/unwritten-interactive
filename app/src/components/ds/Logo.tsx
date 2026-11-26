/**
 * The mark and the wordmark (design system, Logos).
 *
 * The mark is a path that forks in two inside a rounded square, with a saffron
 * dot at the point of choice. The design system's SVG files were not saved
 * with the local copy, so this is drawn from that description: violet square
 * (`brand`), white path, `saffron` dot; `mono` uses `ink` where violet clashes
 * with artwork. Minimum size 24px.
 *
 * The wordmark is live text: "Unwritten" at weight 800, -0.02em, and a full
 * stop in `brand-text` (saffron on the stage).
 */
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export interface LogoMarkProps {
  size?: number;
  mono?: boolean;
  className?: string;
  /** Accessible name. Without it the mark is decorative (the wordmark names it). */
  title?: string;
}

export function LogoMark({ size = 28, mono = false, className, title }: LogoMarkProps) {
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };
  return (
    <svg
      viewBox="0 0 32 32"
      width={Math.max(24, size)}
      height={Math.max(24, size)}
      className={clsx("uw-mark", className)}
      style={{ marginRight: "var(--space-2)", flex: "none" }}
      focusable="false"
      {...a11y}
    >
      <rect width="32" height="32" rx="9" fill={mono ? "var(--ink)" : "var(--brand)"} />
      <path
        d="M16 26.5V17.5M16 17.5C16 12.5 9.5 13 9.5 6.5M16 17.5C16 12.5 22.5 13 22.5 6.5"
        fill="none"
        stroke={mono ? "var(--on-ink)" : "var(--on-brand)"}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="17.5" r="3.4" fill="var(--saffron)" />
    </svg>
  );
}

export interface WordmarkProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Makes the wordmark a link (usually routes.home()). */
  href?: string;
  /** On the stage or the share card: on-stage text, saffron stop, no mark. */
  onStage?: boolean;
  /** Show the mark before the text. Default: true, except on the stage. */
  showMark?: boolean;
  markSize?: number;
  children?: ReactNode;
}

export function Wordmark({ href, onStage = false, showMark, markSize = 28, className, ...rest }: WordmarkProps) {
  const withMark = showMark ?? !onStage;
  const cls = clsx("uw-wordmark", onStage && "uw-wordmark--on-stage", className);
  const content = (
    <>
      {withMark ? <LogoMark size={markSize} /> : null}
      Unwritten<i>.</i>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} aria-label="Unwritten, home" {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <span className={cls} {...rest}>
      {content}
    </span>
  );
}
