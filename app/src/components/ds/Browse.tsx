/**
 * SeriesCard, TeaserTile and EpisodeRail (design system: Browse, Player).
 */
/* eslint-disable @next/next/no-img-element -- stills are served as they are from /media */
import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";
import type { Lang } from "@/content/schema";
import { Icon } from "./Icon";
import { StatusChip, type ChipKind } from "./Status";
import { storyLang } from "./Surface";

// ---------------------------------------------------------------------------
// SeriesCard
// ---------------------------------------------------------------------------

export interface SeriesCardProps {
  href: string;
  /** 3:4 character-led still, never a title card. */
  poster: string;
  posterPosition?: string;
  title: ReactNode;
  lang?: Lang;
  /** One line: visual style and episode count, e.g. "Live action · 5 episodes". */
  meta: ReactNode;
  status?: { kind: ChipKind; label: ReactNode };
  className?: string;
  onClick?: () => void;
}

export function SeriesCard({ href, poster, posterPosition, title, lang, meta, status, className, onClick }: SeriesCardProps) {
  return (
    <Link className={clsx("uw-series", className)} href={href} onClick={onClick}>
      <img src={poster} alt="" style={posterPosition ? { objectPosition: posterPosition } : undefined} />
      <span className="uw-series-body">
        {status ? (
          <StatusChip kind={status.kind} style={{ alignSelf: "flex-start" }}>
            {status.label}
          </StatusChip>
        ) : (
          <span />
        )}
        <span>
          <span className="uw-series-title" style={{ display: "block" }} lang={storyLang(lang)}>
            {title}
          </span>
          <span className="uw-series-meta" style={{ display: "block" }}>
            {meta}
          </span>
        </span>
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// TeaserTile
// ---------------------------------------------------------------------------

export interface TeaserTileProps {
  poster?: string;
  hook: ReactNode;
  title: ReactNode;
  /** "Live action", "2D animation". */
  visualStyle: ReactNode;
  lang?: Lang;
  chip?: ReactNode;
  className?: string;
}

/** An announced series with no playable episodes. */
export function TeaserTile({ poster, hook, title, visualStyle, lang, chip = "Coming next", className }: TeaserTileProps) {
  const l = storyLang(lang);
  if (poster) {
    return (
      <article className={clsx("uw-teaser uw-teaser--poster", className)}>
        <img className="uw-teaser-art" src={poster} alt="" loading="lazy" />
        <div className="uw-teaser-copy">
          <h3 className="uw-teaser-title" lang={l}>{title}</h3>
          <p className="uw-teaser-meta">{visualStyle}</p>
          <p className="uw-teaser-description" lang={l}>{hook}</p>
        </div>
      </article>
    );
  }
  return (
    <div className={clsx("uw-teaser", className)}>
      {chip ? <StatusChip kind="plain" style={{ alignSelf: "flex-start" }}>
        {chip}
      </StatusChip> : null}
      <div>
        <p className="uw-teaser-hook" lang={l}>
          {hook}
        </p>
        <span className="uw-teaser-meta">
          <span lang={l}>{title}</span> · {visualStyle}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EpisodeRail
// ---------------------------------------------------------------------------

/**
 * done: watched. now: current. choice: the branch point (saffron, branch icon).
 * locked: dashed with a lock (the other ending before the viewer finishes
 * theirs, or anything `episodeAccess` calls locked). expired: shown like
 * locked, with its own accessible label; the player shows the Expired state.
 */
export type RailState = "todo" | "done" | "now" | "choice" | "locked" | "expired";

export interface RailItem {
  key: string;
  /** "1", "3A", "Choice". Locked items may leave it empty: only the lock shows. */
  label?: ReactNode;
  state: RailState;
  href?: string;
  ariaLabel?: string;
}

export function EpisodeRail({ items, label = "Episodes", className }: { items: RailItem[]; label?: string; className?: string }) {
  return (
    <ol className={clsx("uw-rail", className)} aria-label={label}>
      {items.map((item) => {
        const locked = item.state === "locked" || item.state === "expired";
        const cls = clsx(
          item.state === "done" && "is-done",
          item.state === "now" && "is-now",
          item.state === "choice" && "is-choice",
          locked && "is-locked",
          item.state === "expired" && "is-expired",
        );
        const content = (
          <>
            {item.state === "choice" ? <Icon name="branch" size={16} /> : null}
            {locked ? <Icon name="lock" size={16} /> : null}
            {item.label}
          </>
        );
        return (
          <li
            key={item.key}
            className={cls || undefined}
            aria-label={item.href ? undefined : item.ariaLabel}
            aria-current={item.state === "now" ? "step" : undefined}
          >
            {item.href ? (
              <Link href={item.href} aria-label={item.ariaLabel}>
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
