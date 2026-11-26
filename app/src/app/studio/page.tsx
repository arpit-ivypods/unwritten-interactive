/**
 * Studio: how an episode is made. OWNER: studio.
 * Shows the first production in the studio manifest; /studio/[projectId] shows any.
 */
import type { Metadata } from "next";
import { loadStudio } from "@/components/studio/data";
import { StudioWalkthrough } from "@/components/studio/StudioWalkthrough";

export const metadata: Metadata = { title: "Unwritten · Studio" };

export default function StudioPage() {
  const manifest = loadStudio();
  return <StudioWalkthrough manifest={manifest} project={manifest.projects[0] ?? null} />;
}
