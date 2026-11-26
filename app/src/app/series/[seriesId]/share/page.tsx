/** Share card. OWNER: flows. The screen is src/components/flow/screens/ShareScreen.tsx. */
import type { Metadata } from "next";
import { ShareScreen } from "@/components/flow/screens/ShareScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "Share card · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/share">) {
  const { seriesId } = await props.params;
  return <ShareScreen seriesId={seriesId} />;
}
