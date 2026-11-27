/**
 * The stage and what is drawn on it (design system: PlayerStage, Subtitles,
 * StageStates, QuestionCard).
 *
 * This is the shell only. The player engineer puts the <video> inside `Stage`
 * (it sits where the still does) and drives the progress, the subtitle line
 * and the states. Film is always dark, in both themes; everything drawn over
 * artwork is on-stage and sits on the scrim or the subtitle plate.
 */
/* eslint-disable @next/next/no-img-element -- stills are served as they are from /media */
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import type { Lang, SubtitleVoiceMode } from "@/content/schema";
import { Icon } from "./Icon";
import { storyLang } from "./Surface";

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

export interface StageProps extends HTMLAttributes<HTMLDivElement> {
  /** Phone: 5px bezel, radius-2xl. Desktop: 6px bezel, radius-stage. */
  phone?: boolean;
  /** Dim the frame (the question, the expired state, the ballot moment). */
  dim?: boolean;
  /** The still drawn behind everything (poster, cliffhanger frame). */
  still?: string;
  stillPosition?: string;
  /** Draw the top and bottom gradient that keeps on-stage text legible. */
  scrim?: boolean;
  children?: ReactNode;
}

export function Stage({ phone = false, dim = false, still, stillPosition, scrim = false, className, children, ...rest }: StageProps) {
  return (
    <div className={clsx("uw-stage", phone && "uw-stage--phone", dim && "uw-stage--dim", className)} {...rest}>
      {still ? <img src={still} alt="" style={stillPosition ? { objectPosition: stillPosition } : undefined} /> : null}
      {scrim ? <div className="uw-stage-scrim" /> : null}
      {children}
    </div>
  );
}

export type SegmentState = "done" | "now" | "todo";

export interface StageProgressProps {
  /** One segment per shot group. */
  segments: SegmentState[];
  /** Progress through the `now` segment, 0..1. Default: the bundle's 45%. */
  nowFraction?: number;
}

export function StageProgress({ segments, nowFraction }: StageProgressProps) {
  return (
    <div className="uw-progress" aria-hidden="true">
      {segments.map((s, i) => (
        <i
          key={i}
          className={s === "done" ? "is-done" : s === "now" ? "is-now" : undefined}
          style={
            s === "now" && nowFraction != null
              ? ({ "--uw-seg": `${Math.round(Math.min(1, Math.max(0, nowFraction)) * 1000) / 10}%` } as CSSProperties)
              : undefined
          }
        />
      ))}
    </div>
  );
}

export interface StageTopProps extends StageProgressProps {
  /** Left of the meta row: "Series title · Ep 3". */
  title?: ReactNode;
  /** Right of the meta row: time, or "The question". */
  meta?: ReactNode;
  lang?: Lang;
  children?: ReactNode;
}

export function StageTop({ segments, nowFraction, title, meta, lang, children }: StageTopProps) {
  return (
    <div className="uw-stage-top">
      <StageProgress segments={segments} nowFraction={nowFraction} />
      {title != null || meta != null ? (
        <div className="uw-stage-meta">
          <span lang={storyLang(lang)}>{title}</span>
          <span>{meta}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export interface StagePlayButtonProps extends Omit<HTMLAttributes<HTMLButtonElement>, "children"> {
  playing?: boolean;
  /** Default "Play" / "Pause". */
  label?: string;
  /** In a stage state the button is part of the column, not centred absolutely. */
  inline?: boolean;
  onClick?: () => void;
}

export function StagePlayButton({ playing = false, label, inline = false, className, style, ...rest }: StagePlayButtonProps) {
  return (
    <button
      type="button"
      className={clsx("uw-stage-play", className)}
      aria-label={label ?? (playing ? "Pause" : "Play")}
      style={inline ? { position: "static", margin: 0, ...style } : style}
      {...rest}
    >
      <Icon name={playing ? "pause" : "play"} />
    </button>
  );
}

export function StageBottom({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("uw-stage-bottom", className)} {...rest} />;
}

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------

export interface SubtitlesProps {
  /** Speaker tag selected by the track's labeling rules. */
  speaker?: ReactNode;
  /** Italic dialogue for a caller or an off-screen voice. */
  heardAs?: SubtitleVoiceMode;
  /** The line as spoken. Ignored when `words` is given. */
  text?: string;
  /** Whole words in order; joined by spaces they are the line. `breakBefore` starts a new line at that word. */
  words?: { text: string; breakBefore?: boolean }[];
  /** Index into `words` of the word being spoken; it takes subtitle-active. */
  activeWord?: number;
  lang?: Lang;
  /** Below 360px stage width. */
  small?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Two lines at most, about 32 characters a line, centred on the subtitle plate. */
export function Subtitles({ speaker, heardAs, text, words, activeWord = -1, lang, small = false, className, children }: SubtitlesProps) {
  let line: ReactNode = children ?? text;
  if (!children && words && words.length > 0) {
    line = words.map((w, i) => (
      <span key={i}>
        {i > 0 ? w.breakBefore ? <br /> : " " : null}
        {i === activeWord ? <b>{w.text}</b> : w.text}
      </span>
    ));
  }
  return (
    <div className={clsx("uw-sub", small && "uw-sub--sm", className)}>
      {speaker ? <span className="uw-sub-speaker">{speaker}</span> : null}
      <span className="uw-sub-line" lang={storyLang(lang)} data-heard-as={heardAs}>
        {line}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage states. Each is drawn inside a Stage.
// ---------------------------------------------------------------------------

/** Loading: skeletons where the progress, title and subtitles go, a spinner and one line. */
export function StageLoading({ label = "Loading" }: { label?: ReactNode }) {
  return (
    <>
      <div className="uw-stage-top">
        <span className="uw-skeleton" style={{ width: "100%", height: 3 }} />
        <span className="uw-skeleton" style={{ width: "55%" }} />
      </div>
      <div className="uw-stage-state" role="status">
        <span className="uw-spinner" aria-hidden="true" />
        <p className="uw-stage-state-text">{label}</p>
      </div>
      <div className="uw-stage-bottom">
        <span className="uw-skeleton" style={{ width: "80%", height: 18 }} />
        <span className="uw-skeleton" style={{ width: "60%", height: 18 }} />
      </div>
    </>
  );
}

/** Tap to play: the first frame under the veil, the play control, a note that sound is on. */
export function StageTapToPlay({
  onPlay,
  title = "Tap to play",
  text = "Sound on. Subtitles are on too.",
}: {
  onPlay?: () => void;
  title?: ReactNode;
  text?: ReactNode;
}) {
  return (
    <div className="uw-stage-state uw-stage-state--veil">
      <StagePlayButton inline label="Play with sound" onClick={onPlay} />
      <p className="uw-stage-state-title">{title}</p>
      <p className="uw-stage-state-text">{text}</p>
    </div>
  );
}

/** Failed: a plain message and a way on (retry, and a link past it). */
export function StageFailed({
  title = "This episode did not load",
  text = "Check your connection and try again.",
  onRetry,
  children,
}: {
  title?: ReactNode;
  text?: ReactNode;
  onRetry?: () => void;
  /** Extra actions, e.g. a link to the next step. */
  children?: ReactNode;
}) {
  return (
    <div className="uw-stage-state" role="alert">
      <p className="uw-stage-state-title">{title}</p>
      <p className="uw-stage-state-text">{text}</p>
      {onRetry ? (
        <button type="button" className="uw-btn uw-btn--glass uw-btn--sm" onClick={onRetry}>
          <Icon name="replay" />
          Try again
        </button>
      ) : null}
      {children}
    </div>
  );
}

/** Expired (or locked): a lock, why it is gone, and the next step. Put it in a `dim` stage. */
export function StageExpired({
  title = "This ending has expired",
  text = "It was open on day 1 only. The official ending is still here.",
  action,
}: {
  title?: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="uw-stage-state uw-stage-state--veil">
      <Icon name="lock" size={28} />
      <p className="uw-stage-state-title">{title}</p>
      <p className="uw-stage-state-text">{text}</p>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestionCard
// ---------------------------------------------------------------------------

export interface QuestionCardProps {
  label?: ReactNode;
  /** The question in the character's own words. */
  question: ReactNode;
  /** One line of context. */
  context?: ReactNode;
  lang?: Lang;
  /** One primary button ("See both glimpses"), or on day 2 the audience result. */
  action?: ReactNode;
  headingLevel?: "h1" | "h2";
  className?: string;
}

/**
 * Rises from the bottom of a dimmed stage holding the cliffhanger frame.
 * Never shows the two choices: the glimpses introduce them.
 */
export function QuestionCard({ label = "Your call", question, context, lang, action, headingLevel = "h2", className }: QuestionCardProps) {
  const H = headingLevel;
  const l = storyLang(lang);
  return (
    <div className={clsx("uw-question", className)}>
      <div className="uw-label">{label}</div>
      <H className="uw-question-title" lang={l}>
        {question}
      </H>
      {context ? (
        <p className="uw-question-context" lang={l}>
          {context}
        </p>
      ) : null}
      {action}
    </div>
  );
}
