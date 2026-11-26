/**
 * /ds: every design-system component in both themes, for review.
 * OWNER: design-system engineer (added at the orchestrator's request; not a
 * viewer screen, so the welcome gate should let it through like /studio).
 */
import type { Metadata } from "next";
import { allSeries, teasers } from "@/content";
import { DsGallery, type GallerySample } from "@/components/ds/gallery/DsGallery";

export const metadata: Metadata = { title: "Unwritten · design system" };

export default function DesignSystemPage() {
  const s1 = allSeries[0];
  const s2 = allSeries[1] ?? allSeries[0];
  const shared = s1.episodes.filter((e) => e.kind === "shared");
  const cliff = shared[shared.length - 1];
  const sample: GallerySample = {
    backdrop: s1.backdrop,
    poster1: s1.poster,
    poster2: s2.poster,
    title1: s1.title,
    title2: s2.title,
    question: s1.question,
    questionContext: s1.questionContext ?? null,
    choices: {
      A: { label: s1.choices.A.label, meaning: s1.choices.A.meaning ?? null },
      B: { label: s1.choices.B.label, meaning: s1.choices.B.meaning ?? null },
    },
    glimpseA: s1.glimpses.A.poster,
    glimpseB: s1.glimpses.B.poster,
    cliffhanger: cliff.poster,
    shot: cliff.shots[0]?.still ?? cliff.poster,
    teasers: teasers.slice(0, 3).map((t) => ({ id: t.id, title: t.title, hook: t.hook, visualStyle: t.visualStyle })),
  };
  return <DsGallery sample={sample} />;
}
