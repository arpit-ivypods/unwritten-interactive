/**
 * Player: plays an episode or a glimpse. OWNER: player.
 *
 * The screen itself is mounted by the layout of /watch (../../layout.tsx), so
 * that one player survives the move from episode to episode. This page keeps
 * the route: it is prerendered for every episode and glimpse id in the content
 * manifests and is a 404 for anything else.
 */
import { watchParams } from "@/lib/staticParams";

export const dynamicParams = false;
export const generateStaticParams = watchParams;

export default async function WatchPage(props: PageProps<"/watch/[seriesId]/[playableId]">) {
  await props.params;
  return null;
}
