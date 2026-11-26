/** Ending (after the last episode of branch A or B). OWNER: flows. The screen is src/components/flow/screens/EndingScreen.tsx. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EndingScreen } from "@/components/flow/screens/EndingScreen";
import { endingParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = endingParams;
export const metadata: Metadata = { title: "Ending · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/ending/[branch]">) {
  const { seriesId, branch } = await props.params;
  if (branch !== "A" && branch !== "B") notFound();
  return <EndingScreen seriesId={seriesId} branch={branch} />;
}
