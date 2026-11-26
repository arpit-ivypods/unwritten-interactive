"use client";

/**
 * Welcome (plan section 4): pick the audio language once, and one line on the
 * day-one rule. OWNER: flow engineer. The only onboarding screen.
 */
import { useRouter } from "next/navigation";
import { Ambient, LanguagePicker } from "@/components/ds";
import { allSeries } from "@/content";
import { routes } from "@/lib/routes";
import { useHydrated, useViewerStore } from "@/state";

/** The day-one rule in one line. It is the product; it is never softened to "limited time". */
export const DAY_ONE_RULE =
  "Every story opens with two endings. On day 1 you vote once and can watch both. From day 2, only the ending the audience chose remains.";

export function WelcomeScreen() {
  const router = useRouter();
  const hydrated = useHydrated();
  const language = useViewerStore((state) => state.language);
  const setLanguage = useViewerStore((state) => state.setLanguage);
  const markWelcomeSeen = useViewerStore((state) => state.markWelcomeSeen);

  return (
    <Ambient as="main" screen still={allSeries[0]?.backdrop} className="flow-welcome" data-screen="welcome" aria-busy={!hydrated}>
      <LanguagePicker
        // Until the stores are loaded the default (हिंदी) shows and nothing can be chosen.
        value={hydrated ? language : "hi"}
        onChange={(lang) => {
          if (hydrated) setLanguage(lang);
        }}
        onContinue={() => {
          if (!hydrated) return;
          markWelcomeSeen();
          router.replace(routes.home());
        }}
        intro={DAY_ONE_RULE}
        continueLabel={hydrated ? `Continue in ${language === "hi" ? "Hindi" : "English"}` : "Loading"}
      />
    </Ambient>
  );
}
