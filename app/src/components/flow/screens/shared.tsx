/**
 * Layout shared by the flow screens. OWNER: flow engineer.
 *
 * Every screen is an Ambient room with one stage and glass panels (design
 * system, "The idea in one picture"). `StageScreen` places them: on phones the
 * stage on top with one sheet over its lower part, on desktop the stage in the
 * centre with a panel on each side. The CSS is in ../flow.css.
 *
 * `data-screen` and `data-part` are stable hooks for motion and for tests.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { Lang } from "@/content/schema";
import { Ambient, Icon, Stage, StageLoading, storyLang } from "@/components/ds";
import type { SegmentState } from "@/components/ds";

export interface StageScreenProps {
  /** Screen id from plan section 4, e.g. "ballot". */
  screen: string;
  /** The still that lights the room. */
  room: string;
  /** A page heading for screen readers, for screens whose panels start at a lower heading level. */
  srHeading?: string;
  /** The stage (one `Stage`). */
  stage: ReactNode;
  /** Desktop: the panel(s) left of the stage. */
  left?: ReactNode;
  /** Desktop: the panel(s) right of the stage. */
  right?: ReactNode;
  /** Which side is the phone's bottom sheet; it comes straight after the stage. */
  sheet?: "left" | "right";
  /**
   * window: on phones the stage shows as a window and the sheet covers its
   * lower part. full: the whole 9:16 stage (the question card lives inside it).
   */
  stageMode?: "window" | "full";
  /** Home only: the series dock. Under the sheet on phones, centred under the stage row on desktop. */
  dock?: ReactNode;
  /** Full-width blocks under the stage row. */
  children?: ReactNode;
}

export function StageScreen({ screen, room, stage, left, right, sheet = "right", stageMode = "window", srHeading, dock, children }: StageScreenProps) {
  return (
    <Ambient as="main" screen still={room} className="flow-screen flow-bleed" data-screen={screen}>
      {srHeading ? <h1 className="sr-only">{srHeading}</h1> : null}
      <div className="flow-layout" data-sheet={sheet} data-stage={stageMode} data-dock={dock ? "" : undefined}>
        <div className="flow-stage" data-part="stage">
          {stage}
        </div>
        {left ? (
          <div className="flow-side flow-left" data-part="left">
            {left}
          </div>
        ) : null}
        {right ? (
          <div className="flow-side flow-right" data-part="right">
            {right}
          </div>
        ) : null}
        {dock ? (
          <div className="flow-series-dock" data-part="series-dock">
            {dock}
          </div>
        ) : null}
      </div>
      {children}
    </Ambient>
  );
}

/** What a screen shows until the stores are loaded, and while it sends the viewer elsewhere. */
export function ScreenLoading({ screen, room, label = "Loading" }: { screen: string; room: string; label?: string }) {
  return (
    <StageScreen
      screen={screen}
      room={room}
      stageMode="full"
      stage={
        <Stage data-state="loading">
          <StageLoading label={label} />
        </Stage>
      }
    />
  );
}

/** The play control of a stage that is not playing: a link into the player. */
export function StagePlayLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="uw-stage-play" aria-label={label}>
      <Icon name="play" />
    </Link>
  );
}

/** A label, a title and one line, drawn on the stage's scrim. */
export function StageCaption({ label, title, line, lang }: { label?: ReactNode; title?: ReactNode; line?: ReactNode; lang?: Lang }) {
  const l = storyLang(lang);
  return (
    <div className="flow-stage-caption">
      {label ? <small>{label}</small> : null}
      {title ? <strong lang={l}>{title}</strong> : null}
      {line ? <span lang={l}>{line}</span> : null}
    </div>
  );
}

/** All segments done: the stage is holding on a frame, not playing. */
export const HELD_SEGMENTS: SegmentState[] = ["done", "done", "done", "done", "done"];
