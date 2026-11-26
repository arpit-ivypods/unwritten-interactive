/** Series. OWNER: flows. The screen is src/components/flow/screens/SeriesScreen.tsx. */
import type { Metadata } from "next";
import { SeriesScreen } from "@/components/flow/screens/SeriesScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "Series · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]">) {
  const { seriesId } = await props.params;
  return <SeriesScreen seriesId={seriesId} />;
}
