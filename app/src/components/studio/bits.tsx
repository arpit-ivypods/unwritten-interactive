/**
 * Small building blocks for the Studio walkthrough. OWNER: studio engineer.
 */
import type { ReactNode } from "react";
import clsx from "clsx";

/** A row on a glass panel (glass-strong, never glass in glass). */
export function Box({ className, children, as: Tag = "div" }: { className?: string; children: ReactNode; as?: "div" | "li" | "article" | "figure" }) {
  return (
    <Tag className={clsx("rounded-lg border border-hairline bg-glass-strong p-4", className)}>
      {children}
    </Tag>
  );
}

/** Collapsed long text (prompts, notes). Native <details>, no JS. */
export function More({ summary, children, className }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={clsx("group", className)}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-caption font-bold text-brand-text select-none">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {summary}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

/** Script text with its [emotion cues] marked where they fall in the line. */
export function Cued({ text, lang }: { text: string | null; lang?: "hi" | "en" }) {
  if (!text) return null;
  const parts = text.split(/(\[[^\]]+\])/g).filter(Boolean);
  return (
    <span lang={lang === "hi" ? "hi" : undefined}>
      {parts.map((p, i) =>
        /^\[[^\]]+\]$/.test(p) ? (
          <span key={i} lang="en" className="mx-0.5 rounded-sm bg-brand-soft px-1.5 py-0.5 align-[1px] text-[12px] font-bold whitespace-nowrap text-ink">
            {p.slice(1, -1)}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

/** A small key-value line: "Camera  push-in". */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <p className="text-caption text-ink-muted">
      <span className="font-bold text-ink">{label}</span> {children}
    </p>
  );
}

/** A slate for an artefact that does not exist yet, in the place it will go. */
export function Missing({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-center rounded-lg border border-dashed border-hairline p-4 text-center text-caption text-ink-muted", className)}>
      {children}
    </div>
  );
}

export const secs = (n: number | null | undefined, digits = 1) => (n == null ? null : `${n.toFixed(digits)} s`);
