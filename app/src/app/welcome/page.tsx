/** Welcome. OWNER: flows. The screen is src/components/flow/screens/WelcomeScreen.tsx. */
import type { Metadata } from "next";
import { WelcomeScreen } from "@/components/flow/screens/WelcomeScreen";

export const metadata: Metadata = { title: "Welcome · Unwritten" };

export default function WelcomePage() {
  return <WelcomeScreen />;
}
