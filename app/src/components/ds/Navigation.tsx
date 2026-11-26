"use client";

/**
 * NavBar, Dock, Segmented control, LanguageSwitch and LanguagePicker
 * (design system: Navigation, Onboarding).
 *
 * Nav destinations (contracts section 4): Tonight (routes.home()), Series
 * (routes.series(id) for the series on the stage), My choices, Studio.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";
import type { Lang } from "@/content/schema";
import { Icon, type IconName } from "./Icon";
import { Wordmark } from "./Logo";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
}

export interface NavBarProps {
  items: NavItem[];
  /** id of the current destination (aria-current="page", brand-text). */
  current?: string;
  /** Desktop: the one ink button on the right (the audio language). */
  action?: ReactNode;
  /** Phone: the one status chip on the right. */
  status?: ReactNode;
  /** `phone` keeps only the wordmark and the status chip; the links go to the Dock. */
  phone?: boolean;
  /** Replace the default wordmark (e.g. to attach the presenter long press). */
  wordmark?: ReactNode;
  homeHref?: string;
  className?: string;
}

/**
 * Desktop: one floating pill, 60px, wordmark + up to four links + one ink
 * button. Below 640px the links hide by themselves. `phone`: the 52px pill
 * with the wordmark and one status chip. Never a full-width strip.
 */
export function NavBar({ items, current, action, status, phone = false, wordmark, homeHref = "/", className }: NavBarProps) {
  return (
    <nav className={clsx("uw-nav", phone && "uw-nav--phone", className)} aria-label={phone ? "Main, phone" : "Main"}>
      {wordmark ?? <Wordmark href={homeHref} markSize={phone ? 26 : 28} />}
      {phone ? null : (
        <div className="uw-nav-links">
          {items.map((item) => (
            <Link key={item.id} href={item.href} aria-current={item.id === current ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
      {phone ? status : action}
    </nav>
  );
}

export interface DockProps {
  items: NavItem[];
  current?: string;
  /** Fix it above the bottom edge (phones). */
  fixed?: boolean;
  className?: string;
}

/** The phone dock: the destinations the nav pill drops, icon + label, current filled ink. */
export function Dock({ items, current, fixed = false, className }: DockProps) {
  return (
    <nav className={clsx("uw-dock", fixed && "uw-dock--fixed", className)} aria-label="Sections">
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={item.id === current ? "page" : undefined}>
          <Icon name={item.icon} size={20} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** "hi" when the label is written in Devanagari. */
  lang?: "hi";
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T | null;
  onChange?: (value: T) => void;
  /** Accessible name of the group, or use labelledBy. */
  label?: string;
  labelledBy?: string;
  /** Full width, equal segments (drawer). */
  full?: boolean;
  className?: string;
}

/** uw-seg: the selected segment is an ink fill with aria-pressed="true". */
export function Segmented<T extends string>({ options, value, onChange, label, labelledBy, full = false, className }: SegmentedProps<T>) {
  return (
    <div
      className={clsx("uw-seg", full && "uw-seg--full", className)}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.lang}
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Audio language, each language in its own script. Switching keeps the viewer
 * at the same shot, not the same second (the player handles that).
 */
export function LanguageSwitch({ value, onChange, className }: { value: Lang; onChange?: (lang: Lang) => void; className?: string }) {
  return (
    <Segmented<Lang>
      label="Audio language"
      value={value}
      onChange={onChange}
      className={className}
      options={[
        { value: "hi", label: "हिंदी", lang: "hi" },
        { value: "en", label: "English" },
      ]}
    />
  );
}

/** Subtitles on or off. Subtitles always follow the audio language. */
export function SubtitlesSwitch({ on, onChange, className }: { on: boolean; onChange?: (on: boolean) => void; className?: string }) {
  return (
    <Segmented<"on" | "off">
      label="Subtitles"
      value={on ? "on" : "off"}
      onChange={(v) => onChange?.(v === "on")}
      className={className}
      options={[
        { value: "on", label: "Subtitles on" },
        { value: "off", label: "Off" },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Language picker (welcome)
// ---------------------------------------------------------------------------

export interface ChoiceTileProps {
  name: ReactNode;
  note: ReactNode;
  selected: boolean;
  onSelect?: () => void;
  /** "hi" when the name is in Devanagari. */
  nameLang?: "hi";
}

/** A large selectable tile (uw-choice). */
export function ChoiceTile({ name, note, selected, onSelect, nameLang }: ChoiceTileProps) {
  return (
    <button type="button" className="uw-choice" aria-pressed={selected} onClick={onSelect}>
      <span className="uw-choice-name" lang={nameLang}>
        {name}
      </span>
      <span className="uw-choice-note">{note}</span>
    </button>
  );
}

/** The two language tiles. हिंदी comes first and is the default. Reused in settings. */
export function LanguageTiles({ value, onChange }: { value: Lang; onChange?: (lang: Lang) => void }) {
  return (
    <div className="uw-stack" style={{ gap: 12 }} role="group" aria-label="Audio language">
      <ChoiceTile
        name="हिंदी"
        nameLang="hi"
        selected={value === "hi"}
        onSelect={() => onChange?.("hi")}
        note={
          <>
            Hinglish audio, the way the characters speak. Subtitles in <span lang="hi">हिंदी</span> + English.
          </>
        }
      />
      <ChoiceTile
        name="English"
        selected={value === "en"}
        onSelect={() => onChange?.("en")}
        note="English audio by the same cast. English subtitles."
      />
    </div>
  );
}

export interface LanguagePickerProps {
  value: Lang;
  onChange?: (lang: Lang) => void;
  onContinue?: () => void;
  /** Extra line under the title, e.g. the day-one rule. */
  intro?: ReactNode;
  title?: ReactNode;
  continueLabel?: string;
  className?: string;
}

/** The welcome panel: wordmark, title, two tiles, one primary button, one caption. */
export function LanguagePicker({
  value,
  onChange,
  onContinue,
  intro,
  title = "How do you want to listen?",
  continueLabel = "Continue",
  className,
}: LanguagePickerProps) {
  return (
    <div className={clsx("uw-glass uw-stack", className)}>
      <Wordmark />
      <h1 className="uw-title">{title}</h1>
      {intro ? <p className="uw-caption">{intro}</p> : null}
      <LanguageTiles value={value} onChange={onChange} />
      <button type="button" className="uw-btn uw-btn--primary uw-btn--block" onClick={onContinue}>
        {continueLabel}
      </button>
      <p className="uw-caption" style={{ textAlign: "center" }}>
        You can switch at any time in the player.
      </p>
    </div>
  );
}
