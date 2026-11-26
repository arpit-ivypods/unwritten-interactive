/**
 * ShareCard, PipelineStep and DemoDrawer (design system: Growth, Studio, Presenter).
 */
/* eslint-disable @next/next/no-img-element -- stills are served as they are from /media; html-to-image needs a plain img */
import type { ReactNode, Ref } from "react";
import clsx from "clsx";
import type { Choice, Lang } from "@/content/schema";
import { Icon } from "./Icon";
import { Wordmark } from "./Logo";
import { storyLang } from "./Surface";

// ---------------------------------------------------------------------------
// ShareCard
// ---------------------------------------------------------------------------

export interface ShareCardProps {
  /** The cliffhanger frame: never a branch frame, never the result. */
  still: string;
  stillPosition?: string;
  /** "Series title · Ep 2". */
  seriesLine: ReactNode;
  question: ReactNode;
  lang?: Lang;
  choice: Choice;
  choiceLabel: ReactNode;
  cta?: ReactNode;
  /** Width in px; the card is 9:16. Export at 1080 x 1920 (pixelRatio = 1080 / width). */
  width?: number;
  /** For html-to-image. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
}

export function ShareCard({
  still,
  stillPosition,
  seriesLine,
  question,
  lang,
  choice,
  choiceLabel,
  cta = "What would you do? Both endings are open today only.",
  width = 270,
  ref,
  className,
}: ShareCardProps) {
  const l = storyLang(lang);
  return (
    <div ref={ref} className={clsx("uw-share", className)} style={{ width }}>
      <img src={still} alt="" style={stillPosition ? { objectPosition: stillPosition } : undefined} crossOrigin="anonymous" />
      <div className="uw-share-body">
        <Wordmark onStage />
        <div className="uw-share-foot">
          <span className="uw-share-series" lang={l}>
            {seriesLine}
          </span>
          <p className="uw-share-q" lang={l}>
            {question}
          </p>
          <span className={clsx("uw-share-pick", choice === "B" && "uw-share-pick--b")}>
            <b>{choice}</b>
            <span>
              I chose <span lang={l}>{choiceLabel}</span>
            </span>
          </span>
          <span className="uw-share-cta">{cta}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PipelineStep
// ---------------------------------------------------------------------------

export type PipelineState = "waiting" | "running" | "done";

export interface PipelineStepProps {
  number: number;
  /** The agent's role: "Showrunner". */
  name: ReactNode;
  /** What it hands on. */
  output: ReactNode;
  state: PipelineState;
  /** Default: Waiting / Working… / Done. */
  stateLabel?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** One specialist in the Studio walkthrough. Stack in hand-off order; parallel steps in a two-column grid. */
export function PipelineStep({ number, name, output, state, stateLabel, className, children }: PipelineStepProps) {
  const label = stateLabel ?? (state === "done" ? "Done" : state === "running" ? "Working…" : "Waiting");
  return (
    <div className={clsx("uw-step", state === "done" && "is-done", state === "running" && "is-running", className)}>
      <span className="uw-step-num">{number}</span>
      <span className="uw-step-body">
        <span className="uw-step-name">{name}</span>
        <span className="uw-step-out">{output}</span>
        {children}
      </span>
      <span className="uw-step-state">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DemoDrawer (shell only; the flows engineer wires it to the state model)
// ---------------------------------------------------------------------------

export interface DemoDrawerProps {
  onClose?: () => void;
  title?: ReactNode;
  /** Fixed to the right edge over the page. Off for a static preview. */
  overlay?: boolean;
  footnote?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Presenter-only controls in a glass drawer. Put `DrawerField`s with full-width
 * `Segmented` controls inside: demo clock, winning ending, viewer, jump to a
 * screen, reset. Never shown to viewers.
 */
export function DemoDrawer({
  onClose,
  title = "Presenter controls",
  overlay = true,
  footnote = "Only visible in the demo. Changes apply to this device.",
  className,
  children,
}: DemoDrawerProps) {
  return (
    <aside className={clsx("uw-drawer", overlay && "uw-drawer--overlay", className)} aria-label="Presenter controls">
      <div className="uw-drawer-head">
        <span className="uw-label">{title}</span>
        {onClose ? (
          <button type="button" className="uw-btn uw-btn--glass uw-btn--icon" aria-label="Close controls" onClick={onClose}>
            <Icon name="close" />
          </button>
        ) : null}
      </div>
      {children}
      {footnote ? <p className="uw-caption">{footnote}</p> : null}
    </aside>
  );
}

/** A labelled group in the drawer. The label id is `${id}-label`; pass it to Segmented as labelledBy. */
export function DrawerField({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <div className="uw-field">
      <span className="uw-field-label" id={`${id}-label`}>
        {label}
      </span>
      {children}
    </div>
  );
}
