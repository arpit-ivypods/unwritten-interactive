/** The question. OWNER: flows. The screen is src/components/flow/screens/QuestionScreen.tsx. */
import type { Metadata } from "next";
import { QuestionScreen } from "@/components/flow/screens/QuestionScreen";
import { seriesParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = seriesParams;
export const metadata: Metadata = { title: "The question · Unwritten" };

export default async function Page(props: PageProps<"/series/[seriesId]/question">) {
  const { seriesId } = await props.params;
  return <QuestionScreen seriesId={seriesId} />;
}
