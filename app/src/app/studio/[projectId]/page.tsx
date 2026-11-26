/** Studio walkthrough for one production. OWNER: studio. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadStudio, studioParams } from "@/components/studio/data";
import { StudioWalkthrough } from "@/components/studio/StudioWalkthrough";

export const dynamicParams = false;
export const generateStaticParams = studioParams;

export async function generateMetadata(props: PageProps<"/studio/[projectId]">): Promise<Metadata> {
  const { projectId } = await props.params;
  const p = loadStudio().projects.find((x) => x.id === projectId);
  return { title: `Unwritten · Studio · ${p?.label ?? projectId}` };
}

export default async function StudioProjectPage(props: PageProps<"/studio/[projectId]">) {
  const { projectId } = await props.params;
  const manifest = loadStudio();
  const project = manifest.projects.find((x) => x.id === projectId);
  if (!project) notFound();
  return <StudioWalkthrough manifest={manifest} project={project} />;
}
