/**
 * Button (design system, Actions). Pill-shaped actions in three weights.
 *
 * - `primary`: one per screen, for the step that moves the story forward.
 * - `ink`: confirmations inside glass panels.
 * - `glass`: everything secondary.
 * Sizes: default 54px, `sm` 44px; `iconOnly` is a 44px circle and needs an
 * aria-label. `block` fills its container. A disabled button turns to quiet
 * glass, and its label says why ("Voting closed").
 *
 * For navigation use `ButtonLink` (a Next.js Link with the same classes).
 */
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { renderIcon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "ink" | "glass";

interface CommonProps {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  /** An 18px stroke icon before the label: an icon name or a node. */
  icon?: IconName | ReactNode;
  /** A 44px circle with only the icon. Requires aria-label. */
  iconOnly?: boolean;
  className?: string;
  children?: ReactNode;
}

export function buttonClass({
  variant = "glass",
  size = "md",
  block = false,
  iconOnly = false,
  className,
}: Pick<CommonProps, "variant" | "size" | "block" | "iconOnly" | "className">) {
  return clsx(
    "uw-btn",
    `uw-btn--${variant}`,
    size === "sm" && "uw-btn--sm",
    iconOnly && "uw-btn--icon",
    block && "uw-btn--block",
    className,
  );
}

export type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

export function Button({ variant, size, block, icon, iconOnly, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, block, iconOnly, className })} {...rest}>
      {renderIcon(icon)}
      {children}
    </button>
  );
}

export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className" | "href"> & { href: string };

export function ButtonLink({ variant, size, block, icon, iconOnly, className, children, href, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block, iconOnly, className })} {...rest}>
      {renderIcon(icon)}
      {children}
    </Link>
  );
}
