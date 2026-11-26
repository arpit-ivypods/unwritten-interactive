/**
 * Surfaces and type (design system: GlassPanel, the ambient backdrop, type helpers).
 *
 * Every screen root is an `Ambient`: the ground, a blurred still from the
 * current episode, and the veil over it. Glass only works over it; never put
 * a GlassPanel on a flat colour, and never nest glass in glass (use
 * glass-strong rows inside a panel instead).
 *
 * `lang` on the type helpers: pass "hi" for Hindi/Hinglish story text. It
 * becomes lang="hi", which drives the Devanagari type rules (no tracking,
 * taller lines, weight 700 at display sizes) and screen-reader pronunciation.
 * English needs nothing: the page is lang="en".
 */
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import type { Lang } from "@/content/schema";

/** `lang` attribute for story text: "hi" for Hinglish, nothing for English. */
export function storyLang(lang: Lang | undefined): "hi" | undefined {
  return lang === "hi" ? "hi" : undefined;
}

// ---------------------------------------------------------------------------
// Ambient backdrop
// ---------------------------------------------------------------------------

export interface AmbientProps extends HTMLAttributes<HTMLElement> {
  /** A still from the current episode. It is blurred heavily, so any size works. */
  still?: string;
  /** object-position of the still. */
  stillPosition?: string;
  /** Fill the viewport and keep the still fixed while the page scrolls. */
  screen?: boolean;
  as?: ElementType;
  children?: ReactNode;
}

export function Ambient({ still, stillPosition, screen = false, as: Tag = "div", className, children, ...rest }: AmbientProps) {
  return (
    <Tag className={clsx("uw-ambient", screen && "uw-ambient--screen", className)} {...rest}>
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- blurred backdrop; next/image adds nothing here
        <img className="uw-ambient-img" src={still} alt="" style={stillPosition ? { objectPosition: stillPosition } : undefined} />
      ) : null}
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Glass
// ---------------------------------------------------------------------------

export interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  /** hero: radius-2xl, space-9 (space-6 on phones). compact: radius-xl, space-6. sheet: phone bottom sheet. */
  variant?: "hero" | "compact" | "sheet";
  /** Space the children with uw-stack. Default true, except for the sheet (which has its own gap). */
  stack?: boolean;
  /** Sheets only: the grabber at the top. Default true. */
  grabber?: boolean;
  as?: ElementType;
  children?: ReactNode;
}

export function GlassPanel({
  variant = "hero",
  stack,
  grabber = true,
  as: Tag = "div",
  className,
  children,
  ...rest
}: GlassPanelProps) {
  const isSheet = variant === "sheet";
  const useStack = stack ?? !isSheet;
  return (
    <Tag
      className={clsx(
        "uw-glass",
        variant === "compact" && "uw-glass--compact",
        isSheet && "uw-glass--sheet",
        useStack && "uw-stack",
        className,
      )}
      {...rest}
    >
      {isSheet && grabber ? <span className="uw-sheet-grabber" aria-hidden="true" /> : null}
      {children}
    </Tag>
  );
}

/** The head of a bottom sheet: a label row and a title. */
export function SheetHead({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("uw-sheet-head", className)} {...rest}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

interface TextProps extends Omit<HTMLAttributes<HTMLElement>, "lang"> {
  as?: ElementType;
  lang?: Lang;
  children?: ReactNode;
  style?: CSSProperties;
}

function makeText(cls: string, defaultTag: ElementType, displayName: string) {
  function Text({ as: Tag = defaultTag, lang, className, children, ...rest }: TextProps) {
    return (
      <Tag className={clsx(cls, className)} lang={storyLang(lang)} {...rest}>
        {children}
      </Tag>
    );
  }
  Text.displayName = displayName;
  return Text;
}

/** 12px uppercase eyebrow in brand-text. Latin only: Devanagari is never uppercased. */
export const Label = makeText("uw-label", "span", "Label");
/** display-hero 78px on desktop, display-title on phones. One per screen. */
export const Hero = makeText("uw-hero", "h1", "Hero");
/** display-title 34px: ballot question, result headline, phone titles. */
export const Title = makeText("uw-title", "h2", "Title");
/** display-heading 24px: series and panel headings. */
export const Heading = makeText("uw-heading", "h3", "Heading");
/** text-body 15px. */
export const Body = makeText("uw-body", "p", "Body");
/** text-caption 13px in ink-muted. */
export const Caption = makeText("uw-caption", "p", "Caption");

/** A row of items with the system gap (uw-row). */
export function Row({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("uw-row", className)} {...rest} />;
}

/** A column with the system gap (uw-stack). */
export function Stack({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("uw-stack", className)} {...rest} />;
}
