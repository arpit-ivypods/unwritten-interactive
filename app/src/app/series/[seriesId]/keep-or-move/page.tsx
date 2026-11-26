/** Keep or move. OWNER: flows. The screen is src/components/flow/screens/KeepOrMoveScreen.tsx. */
import type { Metadata } from "next";
import { KeepOrMoveScreen } from "@/components/flow/screens/KeepOrMoveScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "Keep or move · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/keep-or-move">) {
  const { seriesId } = await props.params;
  return <KeepOrMoveScreen seriesId={seriesId} />;
}
