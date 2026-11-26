/**
 * The design system's icon set: 24px grid, 1.75px stroke, round caps and
 * joins, drawn in currentColor. Shapes come from the component previews in
 * docs/design-system/project/components; the five the previews do not draw
 * (pause, arrow-right, sound, captions, language) are the matching Lucide
 * icons at the same stroke, as the README asks.
 *
 * Icons beside a text label are decorative (aria-hidden). Play, pause, close
 * and share may stand alone: give the button an aria-label, or pass `label`.
 */
import type { ReactNode, SVGProps } from "react";
import { ArrowRight, Captions, Languages, Pause, Volume2 } from "lucide-react";
import clsx from "clsx";

export const ICON_NAMES = [
  "play",
  "pause",
  "check",
  "arrow-right",
  "clock",
  "lock",
  "share",
  "sound",
  "captions",
  "language",
  "replay",
  "branch",
  "eye",
  "close",
  // Navigation destinations (NavBar preview).
  "home",
  "series",
  "studio",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** Path data from the design-system previews (viewBox 0 0 24 24). */
const DRAWN: Partial<Record<IconName, ReactNode>> = {
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  share: <path d="M12 15V3.5m-4 4 4-4 4 4M5 12.5V18a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18v-5.5" />,
  replay: <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5V9h4.5" />,
  branch: <path d="M3.5 12h5c3.5 0 3.5-6 7-6h5m-3.5-3 3.5 3-3.5 3M8.5 12c3.5 0 3.5 6 7 6h5m-3.5-3 3.5 3-3.5 3" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  series: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  studio: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M8 5v14M16 5v14M3.5 10H8M3.5 14H8M16 10h4.5M16 14h4.5" />
    </>
  ),
};

const LUCIDE = {
  pause: Pause,
  "arrow-right": ArrowRight,
  sound: Volume2,
  captions: Captions,
  language: Languages,
} as const;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  /** Rendered size in px. Inside uw-btn the bundle sets 18px, in the rail 16px. */
  size?: number;
  /** Accessible name. Without it the icon is decorative. */
  label?: string;
}

export function Icon({ name, size = 24, label, className, ...rest }: IconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  const lucide = LUCIDE[name as keyof typeof LUCIDE];
  if (lucide) {
    const Lucide = lucide;
    return (
      <Lucide
        size={size}
        strokeWidth={1.75}
        className={clsx("uw-icon", className)}
        focusable="false"
        {...a11y}
        {...(rest as object)}
      />
    );
  }
  const filled = name === "play";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={clsx("uw-icon", filled && "uw-icon--fill", className)}
      {...a11y}
      {...rest}
    >
      {filled ? (
        <path
          style={{ fill: "currentColor", stroke: "none" }}
          d="M7 4.8a1 1 0 0 1 1.5-.85l11.7 7.2a1 1 0 0 1 0 1.7L8.5 20.05A1 1 0 0 1 7 19.2z"
        />
      ) : (
        DRAWN[name]
      )}
    </svg>
  );
}

type NamedIconProps = Omit<IconProps, "name">;
export const PlayIcon = (p: NamedIconProps) => <Icon name="play" {...p} />;
export const PauseIcon = (p: NamedIconProps) => <Icon name="pause" {...p} />;
export const CheckIcon = (p: NamedIconProps) => <Icon name="check" {...p} />;
export const ArrowRightIcon = (p: NamedIconProps) => <Icon name="arrow-right" {...p} />;
export const ClockIcon = (p: NamedIconProps) => <Icon name="clock" {...p} />;
export const LockIcon = (p: NamedIconProps) => <Icon name="lock" {...p} />;
export const ShareIcon = (p: NamedIconProps) => <Icon name="share" {...p} />;
export const SoundIcon = (p: NamedIconProps) => <Icon name="sound" {...p} />;
export const CaptionsIcon = (p: NamedIconProps) => <Icon name="captions" {...p} />;
export const LanguageIcon = (p: NamedIconProps) => <Icon name="language" {...p} />;
export const ReplayIcon = (p: NamedIconProps) => <Icon name="replay" {...p} />;
export const BranchIcon = (p: NamedIconProps) => <Icon name="branch" {...p} />;
export const EyeIcon = (p: NamedIconProps) => <Icon name="eye" {...p} />;
export const CloseIcon = (p: NamedIconProps) => <Icon name="close" {...p} />;

/** Accepts an icon name or any node; used by components that take an `icon` prop. */
export function renderIcon(icon: IconName | ReactNode | undefined, size?: number): ReactNode {
  if (icon == null || icon === false) return null;
  if (typeof icon === "string" && (ICON_NAMES as readonly string[]).includes(icon)) {
    return <Icon name={icon as IconName} size={size} />;
  }
  return icon;
}
