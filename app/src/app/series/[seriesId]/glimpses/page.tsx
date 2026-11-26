/** Glimpses. OWNER: flows. The screen is src/components/flow/screens/GlimpsesScreen.tsx. */
import type { Metadata } from "next";
import { GlimpsesScreen } from "@/components/flow/screens/GlimpsesScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "Glimpses · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/glimpses">) {
  const { seriesId } = await props.params;
  return <GlimpsesScreen seriesId={seriesId} />;
}
