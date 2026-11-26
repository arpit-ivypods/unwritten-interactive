/** My choices. OWNER: flows. The screen is src/components/flow/screens/MyChoicesScreen.tsx. */
import type { Metadata } from "next";
import { MyChoicesScreen } from "@/components/flow/screens/MyChoicesScreen";

export const metadata: Metadata = { title: "My choices · Unwritten" };

export default function MyChoicesPage() {
  return <MyChoicesScreen />;
}
