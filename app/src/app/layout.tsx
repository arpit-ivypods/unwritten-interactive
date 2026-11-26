/**
 * Root layout. OWNER: tech lead. Do not edit: every team plugs in through its
 * own file, so nobody has to touch this one.
 *
 *   styles      -> src/styles/globals.css, src/styles/fonts.ts   (design system)
 *   state       -> src/state/hydration.tsx                        (tech lead)
 *   motion      -> src/motion/MotionRoot.tsx                      (motion)
 *   nav, drawer -> src/components/flow/AppChrome.tsx              (flows)
 *
 * The interface is in English, so <html lang="en">. Every element whose text
 * is Hindi carries lang="hi" (design system rule).
 */
import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { AppChrome } from "@/components/flow/AppChrome";
import { MotionRoot } from "@/motion/MotionRoot";
import { StoreHydration } from "@/state/hydration";
import { fontClassName } from "@/styles/fonts";

export const metadata: Metadata = {
  title: "Unwritten",
  description: "Two-minute dramas where the audience picks the ending.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" className={fontClassName} suppressHydrationWarning>
      <body className="uw">
        <StoreHydration />
        <MotionRoot>
          <AppChrome>{children}</AppChrome>
        </MotionRoot>
      </body>
    </html>
  );
}
