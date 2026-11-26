/**
 * Fonts. OWNER: design-system engineer.
 *
 * Plus Jakarta Sans (Latin, 400-800) and Anek Devanagari (Devanagari, 500-800),
 * both variable fonts from Google, downloaded by next/font at build time and
 * served from this app. Each sets a CSS variable; globals.css combines them in
 * one stack, `--font-sans`, so a Hinglish line ("यह file किसने खोली?") sets its
 * Latin words in Jakarta and its Devanagari in Anek. Jakarta has no Devanagari
 * glyphs, so the browser falls through to Anek for them.
 *
 * `adjustFontFallback: false` is set for Jakarta because its metric-matched
 * fallback is a local Arial, which would sit before Anek in the stack. In the
 * dev build of 26 Nov a "Plus Jakarta Sans Fallback" face (local Arial) still
 * appeared in the stack; macOS Arial has no Devanagari, so Devanagari still
 * rendered in Anek (checked on /ds), but a system whose Arial carries
 * Devanagari could pick it up during font swap.
 *
 * `fontClassName` is put on <html> by src/app/layout.tsx.
 */
import { Anek_Devanagari, Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
  adjustFontFallback: false,
});

const anek = Anek_Devanagari({
  subsets: ["devanagari"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-anek",
});

export const fontClassName = `${jakarta.variable} ${anek.variable}`;
