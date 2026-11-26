"use client";

/**
 * Share card (plan section 4): a 9:16 image with the question and the
 * viewer's choice, over the cliffhanger frame. Never a frame from either
 * ending, never the result. Made in the browser and saved as a PNG.
 * OWNER: flow engineer.
 */
import { useRef, useState } from "react";
import { Button, ButtonLink, Caption, GlassPanel, Heading, Label, ShareCard } from "@/components/ds";
import { cliffhangerStill } from "@/content";
import { stepHref } from "@/lib/routes";
import { useFlowUi } from "../chrome/ui";
import { useRedirect, useSeriesFlow } from "../hooks";
import { shareCta, shareFileName, shareSeriesLine, stepLabel } from "../logic/view";
import { NextSeriesLink } from "./EndingScreen";
import { ScreenLoading, StageScreen } from "./shared";

/** The card is laid out at a quarter of its export size (design system, ShareCard). */
export const SHARE_PREVIEW_WIDTH = 270;
export const SHARE_EXPORT_WIDTH = 1080;

export function ShareScreen({ seriesId }: { seriesId: string }) {
  const { series, rules, lang } = useSeriesFlow(seriesId);
  const toast = useFlowUi((state) => state.toast);
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const ballot = rules.progress.ballot;
  const misplaced = rules.hydrated && !ballot;
  useRedirect(misplaced, stepHref(series.id, rules.next));

  if (!rules.hydrated || misplaced || !ballot) return <ScreenLoading screen="share" room={series.backdrop} />;

  const frame = cliffhangerStill(series);

  const save = async () => {
    const node = cardRef.current;
    if (!node || status === "saving") return;
    setStatus("saving");
    try {
      await document.fonts.ready;
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: SHARE_EXPORT_WIDTH / SHARE_PREVIEW_WIDTH,
        // The file is a plain rectangle: the rounded corners and shadow belong to the preview.
        style: { borderRadius: "0", boxShadow: "none", outline: "none" },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = shareFileName(series.id, ballot.choice);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setStatus("saved");
      toast("Share card saved as a PNG.", "check");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <StageScreen
      screen="share"
      room={frame}
      stageMode="full"
      stage={
        <div className="flow-share-frame">
          <ShareCard
            ref={cardRef}
            width={SHARE_PREVIEW_WIDTH}
            still={frame}
            seriesLine={shareSeriesLine(series, lang)}
            question={series.question[lang]}
            lang={lang}
            choice={ballot.choice}
            choiceLabel={series.choices[ballot.choice].label[lang]}
            cta={shareCta(rules)}
          />
        </div>
      }
      right={
        <GlassPanel variant="compact" data-part="share">
          <Label>Share card</Label>
          <Heading as="h1">Your choice, without spoilers.</Heading>
          <Caption>The card shows the question and what you chose. It never shows either ending or the result.</Caption>
          <Button variant="primary" block icon="share" onClick={save} disabled={status === "saving"} data-status={status}>
            {status === "saving" ? "Making the image" : status === "saved" ? "Save the PNG again" : "Save the card as a PNG"}
          </Button>
          {status === "failed" ? <Caption role="alert">The image could not be made. Try again.</Caption> : <Caption>1080 × 1920, made on this device.</Caption>}
          <div className="flow-actions">
            <ButtonLink variant="glass" size="sm" href={stepHref(series.id, rules.next)}>
              {stepLabel(series, rules.next, rules.progress)}
            </ButtonLink>
            <NextSeriesLink currentId={series.id} />
          </div>
        </GlassPanel>
      }
    />
  );
}
