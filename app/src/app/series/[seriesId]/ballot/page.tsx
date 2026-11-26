/** Ballot. OWNER: flows. The screen is src/components/flow/screens/BallotScreen.tsx. */
import type { Metadata } from "next";
import { BallotScreen } from "@/components/flow/screens/BallotScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "Ballot · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/ballot">) {
  const { seriesId } = await props.params;
  return <BallotScreen seriesId={seriesId} />;
}
