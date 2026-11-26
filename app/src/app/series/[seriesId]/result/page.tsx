/** The result. OWNER: flows. The screen is src/components/flow/screens/ResultScreen.tsx. */
import type { Metadata } from "next";
import { ResultScreen } from "@/components/flow/screens/ResultScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "The result · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/result">) {
  const { seriesId } = await props.params;
  return <ResultScreen seriesId={seriesId} />;
}
