/**
 * The question, the vote and the endings (design system: BallotOption,
 * BallotSheet, TrailerCard, TallyBar, OtherEndingPanel, ResultPanel).
 *
 * A is always violet and on the left, B always saffron and on the right, and
 * the letter is always shown beside the colour.
 *
 * Plan section 9 overrides the BallotSheet README: glimpses are optional, so
 * the cast button needs only a selected option, never watched glimpses.
 */
/* eslint-disable @next/next/no-img-element -- stills are served as they are from /media */
import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";
import type { Choice, Lang } from "@/content/schema";
import { Icon } from "./Icon";
import { StatusChip } from "./Status";
import { storyLang } from "./Surface";

export const otherChoice = (c: Choice): Choice => (c === "A" ? "B" : "A");

// ---------------------------------------------------------------------------
// BallotOption
// ---------------------------------------------------------------------------

export interface BallotOptionProps {
  choice: Choice;
  /** The choice in the character's words. */
  label: ReactNode;
  /** Its plain meaning, shown under a code-phrase label (decision D-003). */
  meaning?: ReactNode;
  lang?: Lang;
  /** "Glimpse watched", "Glimpse not watched yet", "Voting closed after day 1". */
  helper: ReactNode;
  /** A still from that choice's glimpse. */
  still?: string;
  stillPosition?: string;
  selected?: boolean;
  /** Day 2: no ballot. Never disabled for an unwatched glimpse. */
  disabled?: boolean;
  onSelect?: () => void;
}

export function BallotOption({ choice, label, meaning, lang, helper, still, stillPosition, selected = false, disabled = false, onSelect }: BallotOptionProps) {
  const l = storyLang(lang);
  return (
    <button type="button" className="uw-option" aria-pressed={disabled ? undefined : selected} disabled={disabled} onClick={onSelect}>
      {still ? <img src={still} alt="" style={stillPosition ? { objectPosition: stillPosition } : undefined} /> : null}
      <span className="uw-option-text">
        <span>
          <span className={clsx("uw-letter", choice === "B" && "uw-letter--b")}>{choice}</span>
          <span lang={l}>{label}</span>
        </span>
        {meaning ? (
          <span className="uw-option-meaning" lang={l}>
            {meaning}
          </span>
        ) : null}
        <small>{helper}</small>
      </span>
      {disabled ? (
        <span className="uw-radio uw-radio--locked">
          <Icon name="lock" />
        </span>
      ) : (
        <span className="uw-radio">{selected ? <Icon name="check" /> : null}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// BallotSheet
// ---------------------------------------------------------------------------

export interface BallotSheetProps {
  /** The question, as uw-title. */
  question: ReactNode;
  lang?: Lang;
  label?: ReactNode;
  /** The countdown chip text, e.g. "Closes in 02:14:09". */
  closesIn?: ReactNode;
  /** The two BallotOption rows, A then B. */
  options: ReactNode;
  /** Selected letter, or null. The cast button is enabled once one is selected. */
  selected: Choice | null;
  onCast?: () => void;
  /** When set, the button is disabled and says this (e.g. "Voting closed"). */
  disabledReason?: string;
  /** Replace the cast button entirely (e.g. after casting, show the split). */
  action?: ReactNode;
  footnote?: ReactNode;
  /** sheet: phone bottom sheet. panel: compact glass panel beside the stage (desktop). */
  variant?: "sheet" | "panel";
  className?: string;
}

export function BallotSheet({
  question,
  lang,
  label = "Your ballot",
  closesIn,
  options,
  selected,
  onCast,
  disabledReason,
  action,
  footnote = "One ballot. You can move it once, after watching both endings.",
  variant = "sheet",
  className,
}: BallotSheetProps) {
  const sheet = variant === "sheet";
  const castLabel = disabledReason ?? (selected ? `Cast my ballot for ${selected}` : "Pick A or B to cast your ballot");
  return (
    <div className={clsx("uw-glass", sheet ? "uw-glass--sheet" : "uw-glass--compact uw-stack", className)}>
      {sheet ? <span className="uw-sheet-grabber" aria-hidden="true" /> : null}
      <div className="uw-sheet-head" style={sheet ? undefined : { padding: 0 }}>
        <div className="uw-row" style={{ justifyContent: "space-between" }}>
          <span className="uw-label">{label}</span>
          {closesIn ? <StatusChip kind="alert">{closesIn}</StatusChip> : null}
        </div>
        <h2 className="uw-title" lang={storyLang(lang)}>
          {question}
        </h2>
      </div>
      <div role="group" aria-label="Choices" className="uw-stack" style={{ gap: "var(--space-3)" }}>
        {options}
      </div>
      {action ?? (
        <button
          type="button"
          className="uw-btn uw-btn--primary uw-btn--block"
          disabled={Boolean(disabledReason) || !selected}
          onClick={onCast}
        >
          {castLabel}
        </button>
      )}
      {footnote ? (
        <p className="uw-caption" style={{ textAlign: "center" }}>
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrailerCard (a glimpse)
// ---------------------------------------------------------------------------

export interface TrailerCardProps {
  choice: Choice;
  title: ReactNode;
  lang?: Lang;
  /** Length and watched state: "0:20 · not watched". */
  meta: ReactNode;
  /** Never a frame that reveals the outcome. */
  still?: string;
  stillPosition?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/** 9:13 glimpse card. Always shown as a pair, side by side. Watching is optional. */
export function TrailerCard({ choice, title, lang, meta, still, stillPosition, href, onClick, className }: TrailerCardProps) {
  const body = (
    <>
      {still ? <img src={still} alt="" style={stillPosition ? { objectPosition: stillPosition } : undefined} /> : null}
      <span className="uw-trailer-body">
        <span className={clsx("uw-trailer-tag", choice === "B" && "uw-trailer-tag--b")}>{choice} · Glimpse</span>
        <span>
          <span className="uw-trailer-title" style={{ display: "block" }} lang={storyLang(lang)}>
            {title}
          </span>
          <span className="uw-trailer-meta" style={{ display: "block" }}>
            {meta}
          </span>
        </span>
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={clsx("uw-trailer", className)} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={clsx("uw-trailer", className)} onClick={onClick}>
      {body}
    </button>
  );
}

// ---------------------------------------------------------------------------
// TallyBar
// ---------------------------------------------------------------------------

export interface TallyBarProps {
  /** Whole percentages that add up to 100 (rules.tally gives both). */
  percentA: number;
  percentB: number;
  /** Default "Simulated demo ballots." Pass null to leave it out (when the panel says it elsewhere). */
  caption?: ReactNode | null;
  className?: string;
}

/** A left in brand, B right in saffron, percentages written out. */
export function TallyBar({ percentA, percentB, caption = "Simulated demo ballots.", className }: TallyBarProps) {
  const a = Math.min(100, Math.max(0, percentA));
  return (
    <div className={clsx("uw-tally", className)}>
      <div className="uw-tally-row">
        <span>A · {percentA}%</span>
        <span>{percentB}% · B</span>
      </div>
      <div className="uw-tally-bar" aria-hidden="true">
        <i style={{ width: `${a}%` }} />
        <i />
      </div>
      {caption ? <p className="uw-caption">{caption}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

export interface VerdictProps {
  choice: Choice;
  label: ReactNode;
  lang?: Lang;
  /** "The official ending", "Your ballot is here", "3 episodes · only open on day 1". */
  note?: ReactNode;
  className?: string;
}

/** Which choice won, or which one the viewer holds: letter badge plus the choice in the story's words. */
export function Verdict({ choice, label, lang, note, className }: VerdictProps) {
  return (
    <div className={clsx("uw-verdict", choice === "B" && "uw-verdict--b", className)}>
      <span className="uw-verdict-letter">{choice}</span>
      <span className="uw-verdict-text">
        <span lang={storyLang(lang)}>{label}</span>
        {note ? <small>{note}</small> : null}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OtherEndingPanel: the offer, then keep or move
// ---------------------------------------------------------------------------

export interface OtherEndingOfferProps {
  /** The ending the viewer just finished. */
  finished: Choice;
  /** The other choice's label, in the story's words. */
  otherLabel: ReactNode;
  lang?: Lang;
  /** "3 episodes · only open on day 1". */
  otherNote?: ReactNode;
  closesIn?: ReactNode;
  /** The primary button. Use `watchHref` or a custom node. */
  watchHref?: string;
  onWatch?: () => void;
  /** The quiet way out. */
  dismissHref?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}

/** Day 1 only, after the viewer's own ending: offer the other branch. */
export function OtherEndingOffer({
  finished,
  otherLabel,
  lang,
  otherNote,
  closesIn,
  watchHref,
  onWatch,
  dismissHref,
  onDismiss,
  dismissLabel = "Not now",
  className,
}: OtherEndingOfferProps) {
  const other = otherChoice(finished);
  return (
    <div className={clsx("uw-glass uw-glass--compact uw-stack", className)}>
      <span className="uw-label">You finished ending {finished}</span>
      <h3 className="uw-heading">There is another way this goes.</h3>
      <Verdict choice={other} label={otherLabel} lang={lang} note={otherNote} />
      {closesIn ? (
        <StatusChip kind="alert" style={{ alignSelf: "flex-start" }}>
          {closesIn}
        </StatusChip>
      ) : null}
      <ActionButton variant="primary" href={watchHref} onClick={onWatch} icon>
        Watch the other ending
      </ActionButton>
      {dismissHref || onDismiss ? (
        <ActionButton variant="glass" href={dismissHref} onClick={onDismiss}>
          {dismissLabel}
        </ActionButton>
      ) : null}
    </div>
  );
}

export interface KeepOrMovePanelProps {
  /** Where the viewer's ballot is now. */
  current: Choice;
  currentLabel: ReactNode;
  lang?: Lang;
  percentA: number;
  percentB: number;
  onKeep?: () => void;
  onMove?: () => void;
  keepHref?: string;
  className?: string;
}

/** Both endings finished, day 1: keep (ink) or move (glass), equal width. Moving is allowed once. */
export function KeepOrMovePanel({ current, currentLabel, lang, percentA, percentB, onKeep, onMove, keepHref, className }: KeepOrMovePanelProps) {
  const other = otherChoice(current);
  return (
    <div className={clsx("uw-glass uw-glass--compact uw-stack", className)}>
      <span className="uw-label">You have seen both endings</span>
      <h3 className="uw-heading">Keep your ballot, or move it?</h3>
      <Verdict choice={current} label={currentLabel} lang={lang} note="Your ballot is here" />
      <TallyBar percentA={percentA} percentB={percentB} caption={null} />
      <ActionButton variant="ink" href={keepHref} onClick={onKeep}>
        Keep my ballot on {current}
      </ActionButton>
      <ActionButton variant="glass" onClick={onMove}>
        Move my ballot to {other}
      </ActionButton>
      <p className="uw-caption">You can move it once. The leading ending becomes official on day 2. Simulated demo ballots.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultPanel
// ---------------------------------------------------------------------------

export interface ResultPanelProps {
  official: Choice;
  officialLabel: ReactNode;
  lang?: Lang;
  percentA: number;
  percentB: number;
  /** "Watch the official ending". */
  actionLabel?: ReactNode;
  actionHref?: string;
  onAction?: () => void;
  /** Who can still watch what. Must label the numbers as simulated. */
  caption?: ReactNode;
  /** Extra content under the button (e.g. links to both glimpses for late viewers). */
  children?: ReactNode;
  className?: string;
}

export function ResultPanel({
  official,
  officialLabel,
  lang,
  percentA,
  percentB,
  actionLabel = "Watch the official ending",
  actionHref,
  onAction,
  caption = "Voting closed when day 1 ended. You can still watch both glimpses; the other ending was only open on day 1. Simulated demo ballots.",
  children,
  className,
}: ResultPanelProps) {
  return (
    <div className={clsx("uw-glass uw-glass--compact uw-stack", className)}>
      <div className="uw-row" style={{ justifyContent: "space-between" }}>
        <span className="uw-label">The audience chose</span>
        <StatusChip kind="canon">Day 2 · official ending</StatusChip>
      </div>
      <Verdict choice={official} label={officialLabel} lang={lang} note="The official ending" />
      <TallyBar percentA={percentA} percentB={percentB} caption={null} />
      <ActionButton variant="primary" href={actionHref} onClick={onAction} icon>
        {actionLabel}
      </ActionButton>
      {children}
      {caption ? <p className="uw-caption">{caption}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ActionButton({
  variant,
  href,
  onClick,
  icon = false,
  children,
}: {
  variant: "primary" | "ink" | "glass";
  href?: string;
  onClick?: () => void;
  icon?: boolean;
  children: ReactNode;
}) {
  const cls = clsx("uw-btn", `uw-btn--${variant}`, "uw-btn--block");
  const content = (
    <>
      {icon ? <Icon name="play" /> : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}
