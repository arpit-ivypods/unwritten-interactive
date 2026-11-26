/**
 * The body of each Studio stage, rendered from the studio manifest.
 * Server components; only AudioButton runs on the client. OWNER: studio engineer.
 */
/* eslint-disable @next/next/no-img-element -- generated webp stills served as they are from /media/studio */
import clsx from "clsx";
import { Body, Caption, Heading, Label, Stage, StatusChip } from "@/components/ds";
import { AudioButton } from "./AudioButton";
import { Box, Cued, Meta, Missing, More, secs } from "./bits";
import type { LookEntry, StudioProject, StudioTimeline, VoiceAb, VoiceLine, VoiceTake } from "./types";

const LANG_NAME: Record<string, string> = { hi: "Hinglish", en: "English" };
const langName = (l: string | null | undefined) => (l ? (LANG_NAME[l] ?? l) : "");

function Still({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) return <Missing className={clsx("aspect-[9/16]", className)}>Not drawn yet</Missing>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={clsx("aspect-[9/16] w-full rounded-md object-cover", className)} />;
}

// ---------------------------------------------------------------------------
// 1. Story
// ---------------------------------------------------------------------------

export function StoryStage({ p }: { p: StudioProject }) {
  const s = p.story;
  if (!s) return <Missing>No bible or script yet.</Missing>;
  return (
    <div className="flex flex-col gap-4">
      <Box className="flex flex-col gap-2">
        {s.title?.hi ? (
          <Heading as="p" lang="hi">
            {s.title.hi}
          </Heading>
        ) : null}
        {s.title?.en ? <p className="text-lead font-bold">{s.title.en}</p> : null}
        {s.logline?.hi ? <Body lang="hi">{s.logline.hi}</Body> : null}
        {s.logline?.en ? <Body>{s.logline.en}</Body> : null}
        {s.premise ? <Caption>{s.premise}</Caption> : null}
        <Meta label="Where">{s.location}</Meta>
        <Meta label="When">{s.timeOfDay}</Meta>
        {s.tone ? <Meta label="Tone">{s.tone}</Meta> : null}
      </Box>

      {s.characters.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {s.characters.map((c) => (
            <Box key={c.id} as="article" className="flex flex-col gap-1.5">
              <p className="text-body font-extrabold">
                {c.name?.en ?? c.id}
                {c.age ? <span className="font-semibold text-ink-muted">, {c.age}</span> : null}
              </p>
              {c.name?.hi && c.name.hi !== c.name.en ? (
                <p lang="hi" className="text-caption text-ink-muted">
                  {c.name.hi}
                </p>
              ) : null}
              {c.role ? <Caption className="text-ink">{c.role}</Caption> : null}
              {c.look ? (
                <More summary="Look">
                  <Caption>{c.look}</Caption>
                </More>
              ) : null}
              {c.note ? (
                <More summary={s.fromScript ? "Voice" : "Wants"}>
                  <Caption>{c.note}</Caption>
                </More>
              ) : null}
            </Box>
          ))}
        </div>
      ) : null}

      {s.beats.length ? (
        <Box>
          <Label as="h3">Beats</Label>
          <ol className="mt-2 flex flex-col gap-2">
            {s.beats.map((b) => (
              <li key={b.id} className="flex gap-3 text-caption">
                <span className="w-8 flex-none font-extrabold text-brand-text">{b.id}</span>
                <span className="text-ink-muted">{b.action}</span>
              </li>
            ))}
          </ol>
        </Box>
      ) : null}

      {s.endingQuestion?.hi || s.endingQuestion?.en ? (
        <Box className="flex flex-col gap-1">
          <Label as="h3">The question it ends on</Label>
          {s.endingQuestion.hi ? (
            <p lang="hi" className="text-lead font-bold">
              {s.endingQuestion.hi}
            </p>
          ) : null}
          {s.endingQuestion.en ? <p className="text-body text-ink-muted">{s.endingQuestion.en}</p> : null}
        </Box>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Script
// ---------------------------------------------------------------------------

export function ScriptStage({ p }: { p: StudioProject }) {
  const sc = p.script;
  if (!sc) return <Missing>No script yet.</Missing>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sc.totals.hi ? <StatusChip kind="plain">Hinglish · {sc.totals.hi.targetSeconds ?? "?"} s planned</StatusChip> : null}
        {sc.totals.en ? <StatusChip kind="plain">English · {sc.totals.en.targetSeconds ?? "?"} s planned</StatusChip> : null}
        <StatusChip kind="plain">{sc.lineCount} lines</StatusChip>
        {sc.critic ? (
          <StatusChip kind={sc.critic.pass ? "plain" : "alert"}>
            Critic: {sc.critic.pass ? "pass" : "fail"}
            {sc.critic.score != null ? ` · ${sc.critic.score} / 10` : ""}
          </StatusChip>
        ) : null}
      </div>
      <Caption>Emotion cues are shown where they fall in the line; the same text is sent to the voice model.</Caption>

      <div className="flex flex-col gap-3">
        {sc.beats.map((b) => (
          <Box key={b.id} as="article" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label as="h3">
                Beat {b.id}
                {b.silentSeconds ? ` · ${b.silentSeconds} s silence` : ""}
              </Label>
              {b.action ? <Caption>{b.action}</Caption> : null}
            </div>
            {b.lines.map((l) => (
              <div key={l.id} className="grid gap-2 border-t border-hairline pt-3 md:grid-cols-[88px_1fr_1fr] md:gap-4">
                <div className="flex items-baseline gap-2 md:flex-col md:gap-0.5">
                  <span className="text-[12px] font-extrabold tracking-[0.08em] text-saffron-text uppercase">{l.speakerName?.en?.split(" ")[0] ?? l.speaker}</span>
                  <span className="text-caption text-ink-muted">
                    {l.id}
                    {l.targetSeconds != null ? ` · ${l.targetSeconds} s` : ""}
                  </span>
                </div>
                <p className="text-body">
                  <span className="sr-only">Hinglish: </span>
                  <Cued text={l.hi?.text ?? null} lang="hi" />
                </p>
                <p className="text-body text-ink-muted">
                  <span className="sr-only">English: </span>
                  <Cued text={l.en?.text ?? null} lang="en" />
                </p>
              </div>
            ))}
          </Box>
        ))}
      </div>

      {sc.musicNote ? (
        <More summary="Music note from the writer">
          <Caption>{sc.musicNote}</Caption>
        </More>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {sc.critic ? (
          <Box className="flex flex-col gap-2">
            <Label as="h3">S3 Script critic</Label>
            <Caption className="text-ink">{sc.critic.problems[0]}</Caption>
            {sc.critic.problems.length > 1 ? (
              <More summary={`${sc.critic.problems.length - 1} more notes, ${sc.critic.fixCount} fixes asked for`}>
                <ul className="flex list-disc flex-col gap-1.5 pl-5">
                  {sc.critic.problems.slice(1).map((x, i) => (
                    <li key={i} className="text-caption text-ink-muted">
                      {x}
                    </li>
                  ))}
                </ul>
              </More>
            ) : null}
          </Box>
        ) : null}
        {sc.continuity?.checks.length ? (
          <Box className="flex flex-col gap-2">
            <Label as="h3">S4 Continuity checks</Label>
            <ul className="flex flex-col gap-1.5">
              {sc.continuity.checks.map((c, i) => (
                <li key={i} className="flex gap-2 text-caption">
                  <span className={clsx("flex-none font-extrabold", c.result === "pass" ? "text-live" : "text-alert")}>{c.result === "pass" ? "Pass" : (c.result ?? "?")}</span>
                  <span className="text-ink-muted">{c.check}</span>
                </li>
              ))}
            </ul>
          </Box>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Look
// ---------------------------------------------------------------------------

function RefCard({ e, kindLabel }: { e: LookEntry; kindLabel: string }) {
  return (
    <Box as="figure" className="flex flex-col gap-2 p-3">
      <Still src={e.image} alt={`${kindLabel}: ${e.name}`} />
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-caption font-extrabold text-ink">
          {e.name}
          {e.lead ? <span className="font-semibold text-ink-muted"> · lead</span> : null}
        </span>
        {e.note ? <span className="line-clamp-3 text-[12px] leading-snug text-ink-muted">{e.note}</span> : null}
        {e.attempts ? (
          <span className="text-[12px] text-ink-muted">
            {e.attempts} {e.attempts === 1 ? "attempt" : "attempts"}
            {e.genSeconds != null ? ` · ${Math.round(e.genSeconds)} s to draw` : ""}
          </span>
        ) : null}
      </figcaption>
    </Box>
  );
}

export function LookStage({ p }: { p: StudioProject }) {
  const lk = p.look;
  if (!lk) return <Missing>No visual bible yet.</Missing>;
  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";
  return (
    <div className="flex flex-col gap-5">
      {lk.summary ? <Body>{lk.summary}</Body> : null}
      {lk.palette.length ? (
        <div>
          <Label as="h3">Palette</Label>
          <ul className="mt-2 flex flex-wrap gap-2">
            {lk.palette.map((c) => (
              <li key={c.hex} className="flex items-center gap-2 rounded-pill border border-hairline bg-glass-strong py-1 pr-3 pl-1" title={c.role ?? undefined}>
                <span className="size-7 rounded-full border border-hairline" style={{ background: c.hex ?? undefined }} aria-hidden="true" />
                <span className="text-[12px] font-bold">{c.hex}</span>
                {c.role ? <span className="sr-only">{c.role}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <Label as="h3">Character sheets</Label>
        <div className={clsx(grid, "mt-2")}>
          {lk.characters.map((e) => (
            <RefCard key={e.id} e={e} kindLabel="Character sheet" />
          ))}
        </div>
      </div>
      <div>
        <Label as="h3">Location plates</Label>
        <div className={clsx(grid, "mt-2")}>
          {lk.locations.map((e) => (
            <RefCard key={e.id} e={e} kindLabel="Location plate" />
          ))}
        </div>
      </div>
      {lk.props.length ? (
        <div>
          <Label as="h3">Props</Label>
          <div className={clsx(grid, "mt-2")}>
            {lk.props.map((e) => (
              <RefCard key={e.id} e={e} kindLabel="Prop sheet" />
            ))}
          </div>
        </div>
      ) : null}
      {lk.styleBlock ? (
        <More summary="Style block sent with every frame">
          <Caption className="whitespace-pre-wrap">{lk.styleBlock}</Caption>
          {lk.negativeRules ? <Caption className="mt-2 whitespace-pre-wrap">{lk.negativeRules}</Caption> : null}
        </More>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Storyboard
// ---------------------------------------------------------------------------

export function StoryboardStage({ p }: { p: StudioProject }) {
  const sb = p.storyboard;
  if (!sb) return <Missing>No shot list yet.</Missing>;
  const refImg = new Map<string, LookEntry>();
  for (const e of [...(p.look?.characters ?? []), ...(p.look?.locations ?? []), ...(p.look?.props ?? []), ...(p.look?.other ?? [])]) refImg.set(e.id, e);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusChip kind="plain">{sb.shots.length} shots</StatusChip>
        {sb.totalSeconds != null ? <StatusChip kind="plain">{sb.totalSeconds} s planned</StatusChip> : null}
        <StatusChip kind={sb.framesDone === sb.shots.length ? "plain" : "alert"}>
          {sb.framesDone} of {sb.shots.length} frames drawn
        </StatusChip>
      </div>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sb.shots.map((s) => (
          <li key={s.id}>
            <Box as="article" className="flex h-full flex-col gap-3 p-3">
              <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3">
                <Still src={s.frame} alt={`Frame ${s.id}: ${s.action ?? ""}`.slice(0, 160)} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="text-body font-extrabold">
                    {s.id}
                    <span className="font-semibold text-ink-muted"> · {secs(s.durationS)}</span>
                  </p>
                  <Meta label="Camera">
                    {s.cameraMove}
                    {s.intensity != null ? ` (${s.intensity})` : ""}
                  </Meta>
                  <Meta label="Lines">{s.lineIds.length ? s.lineIds.join(", ") : "silent"}</Meta>
                  <Meta label="Beat">{s.beatId}</Meta>
                  {s.refs.length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1" aria-label="References attached">
                      {s.refs.map((r) =>
                        r ? (
                          <span key={r} className="flex items-center gap-1.5 rounded-pill border border-hairline py-0.5 pr-2 pl-0.5 text-[11px] font-bold whitespace-nowrap">
                            {refImg.get(r)?.image ? <img src={refImg.get(r)!.image!} alt="" className="size-6 rounded-full object-cover" /> : null}
                            {r.replace(/_/g, " ")}
                          </span>
                        ) : null,
                      )}
                    </div>
                  ) : null}
                  {s.attempts ? (
                    <span className="text-[12px] text-ink-muted">
                      {s.attempts} {s.attempts === 1 ? "attempt" : "attempts"}
                      {s.genSeconds != null ? ` · ${Math.round(s.genSeconds)} s` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
              {s.framing ? <Caption className="text-ink">{s.framing}</Caption> : null}
              {s.note ? <Caption className="line-clamp-4">{s.note}</Caption> : null}
              {s.note && s.note.length > 220 ? (
                <More summary="Full shot note">
                  <Caption>{s.note}</Caption>
                </More>
              ) : null}
              {s.action ? (
                <More summary="Action">
                  <Caption>{s.action}</Caption>
                </More>
              ) : null}
              {s.prompt ? (
                <More summary="Image prompt">
                  {/* Scrolls on its own, so it takes focus for keyboard scrolling (axe scrollable-region-focusable). */}
                  <div role="region" aria-label={`Image prompt for ${s.id}`} tabIndex={0} className="max-h-72 overflow-auto rounded-sm">
                    <Caption className="whitespace-pre-wrap">{s.prompt}</Caption>
                  </div>
                </More>
              ) : null}
            </Box>
          </li>
        ))}
      </ol>
      {sb.notes.length ? (
        <More summary="Storyboard notes">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {sb.notes.map((n, i) => (
              <li key={i} className="text-caption text-ink-muted">
                {n}
              </li>
            ))}
          </ul>
        </More>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Voice
// ---------------------------------------------------------------------------

const MODEL_NAME = (m: string | null | undefined) => (m ? m.replace(/^eleven_/, "") : null);

function Verdict({ verdict, take }: { verdict: string | null; take: number }) {
  if (!verdict) return null;
  const ok = verdict === "ok" || verdict === "pass";
  return (
    <StatusChip kind={ok ? "live" : "alert"}>
      Take {take} review: {verdict}
    </StatusChip>
  );
}

function VoiceTakeReview({ t }: { t: VoiceTake }) {
  const r = t.review;
  if (!r || (!r.reason && !r.transcript)) return null;
  return (
    <More summary={`Take ${t.take} review notes`}>
      <div className="flex flex-col gap-1">
        {r.transcript ? <Meta label="Heard (ASR)">{r.transcript}</Meta> : null}
        {r.speechS != null && r.targetS != null ? <Meta label="Length">{`${r.speechS.toFixed(2)} s of speech against ${r.targetS} s planned`}</Meta> : null}
        {r.reason ? <Caption>{r.reason}</Caption> : null}
        {r.verdict && r.verdict !== "ok" && r.retakeText ? (
          <p className="text-caption">
            <span className="font-bold">Retake text: </span>
            <Cued text={r.retakeText} />
          </p>
        ) : null}
      </div>
    </More>
  );
}

function VoiceLang({ id, lang, l, who }: { id: string; lang: "hi" | "en"; l: VoiceLine | undefined; who: string | null }) {
  if (!l) return <Missing>No {langName(lang)} direction</Missing>;
  const d = l.directions[0];
  const c = l.chosen;
  const earlier = l.takes.filter((t) => !t.inCut);
  const reviewedEarlier = earlier.filter((t) => t.review?.verdict).at(-1);
  const name = `${id} ${langName(lang)}`;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-caption">
        <span className="text-[12px] font-extrabold tracking-[0.08em] text-saffron-text uppercase">{who ?? l.speaker}</span>
        <span className="text-ink-muted">
          {" "}
          · {id} · {langName(lang)}
          {l.targetSeconds != null ? ` · ${l.targetSeconds} s planned` : ""}
          {MODEL_NAME(c?.model ?? d?.model) ? ` · ${MODEL_NAME(c?.model ?? d?.model)}` : ""}
        </span>
      </p>
      <p className="text-body">
        <Cued text={c?.text ?? d?.text ?? null} lang={lang} />
      </p>
      {c ? (
        <div className="flex flex-wrap items-center gap-2">
          {c.src ? <AudioButton src={c.src} label={`${name}, take ${c.take}, the take in the cut`} durationS={c.durationS} /> : null}
          <StatusChip kind="plain">Take {c.take} · in the cut</StatusChip>
          {c.review ? <Verdict verdict={c.review.verdict} take={c.take} /> : null}
        </div>
      ) : (
        <span className="text-caption text-ink-muted">No take recorded</span>
      )}
      {c && !c.review && reviewedEarlier ? (
        <Caption>
          The review of take {reviewedEarlier.take} said {reviewedEarlier.review?.verdict}, so take {c.take} was recorded. Take {c.take} has no review entry in voice/review.json.
        </Caption>
      ) : null}
      {c ? <VoiceTakeReview t={c} /> : null}
      {earlier.length ? (
        <More summary={earlier.length === 1 ? `Earlier take (take ${earlier[0].take})` : `${earlier.length} earlier takes`}>
          <ul className="flex flex-col gap-2">
            {earlier.map((t) => (
              <li key={t.take} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t.src ? <AudioButton src={t.src} label={`${name}, take ${t.take}, not used`} durationS={t.durationS} /> : null}
                  <Verdict verdict={t.review?.verdict ?? null} take={t.take} />
                </div>
                {t.text && t.text !== c?.text ? (
                  <p className="text-caption">
                    <Cued text={t.text} lang={lang} />
                  </p>
                ) : null}
                <VoiceTakeReview t={t} />
              </li>
            ))}
          </ul>
        </More>
      ) : null}
      {d?.note ? (
        <More summary="Direction">
          <Caption>{d.note}</Caption>
        </More>
      ) : null}
    </div>
  );
}

function VoiceAbBlock({ ab, nameOf }: { ab: VoiceAb; nameOf: Map<string, string> }) {
  return (
    <Box className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label as="h3">eleven_v4 against eleven_v3, same text</Label>
        {ab.decision ? <Caption>{ab.decision}</Caption> : null}
      </div>
      {ab.tally.length ? (
        <div className="flex flex-wrap gap-2">
          {ab.tally.map((t) => (
            <StatusChip key={t.model} kind="plain">
              {t.model === "tie" ? "Ties" : `${t.model} wins`}: {t.count}
            </StatusChip>
          ))}
        </div>
      ) : null}
      {ab.outcome ? <Caption className="text-ink">{ab.outcome}</Caption> : null}
      <ul className="flex flex-col gap-3">
        {ab.pairs.map((pr, i) => {
          const name = `${pr.lineId ?? ""} ${langName(pr.lang)}`;
          return (
            <li key={`${pr.lineId}-${i}`} className="flex flex-col gap-2 rounded-md border border-hairline p-3">
              <p className="text-caption">
                <span className="text-[12px] font-extrabold tracking-[0.08em] text-saffron-text uppercase">{nameOf.get(pr.speaker ?? "") ?? pr.speaker}</span>
                <span className="text-ink-muted">
                  {" "}
                  · {pr.lineId} · {langName(pr.lang)}
                </span>
              </p>
              {pr.text ? (
                <p className="text-body">
                  <Cued text={pr.text} lang={pr.lang === "hi" ? "hi" : "en"} />
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {pr.v4.src ? <AudioButton src={pr.v4.src} label={`${name}, eleven_v4, take 1`} durationS={pr.v4.durationS} /> : null}
                <span className="text-caption font-bold">v4 (take 1)</span>
                {pr.v3.src ? <AudioButton src={pr.v3.src} label={`${name}, eleven_v3`} durationS={pr.v3.durationS} /> : null}
                <span className="text-caption font-bold">v3</span>
              </div>
              {pr.winner ? (
                <p className="text-caption">
                  <span className="font-bold">Winner: </span>
                  {pr.winner}
                  {pr.score ? <span className="text-ink-muted"> ({pr.score})</span> : null}
                </p>
              ) : null}
              {pr.checks.length || pr.note ? (
                <More summary="Checks">
                  <ul className="flex flex-col gap-1.5">
                    {pr.checks.map((c) => (
                      <li key={c.name} className="text-caption text-ink-muted">
                        <span className="font-bold text-ink capitalize">{c.name}: </span>
                        v4 {c.v4 ?? "?"}; v3 {c.v3 ?? "?"}
                        {c.result ? ` → ${c.result}` : ""}
                      </li>
                    ))}
                    {pr.note ? <li className="text-caption">{pr.note}</li> : null}
                  </ul>
                </More>
              ) : null}
            </li>
          );
        })}
      </ul>
      {ab.evidence || ab.notChecked.length ? (
        <More summary="Limits of this test">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {ab.evidence ? <li className="text-caption text-ink-muted">{ab.evidence}</li> : null}
            {ab.notChecked.map((x, i) => (
              <li key={i} className="text-caption text-ink-muted">
                {x}
              </li>
            ))}
          </ul>
        </More>
      ) : null}
    </Box>
  );
}

export function VoiceStage({ p }: { p: StudioProject }) {
  const v = p.voice;
  if (!v) return <Missing>No casting or voice direction yet.</Missing>;
  const byLine = new Map<string, Partial<Record<string, VoiceLine>>>();
  for (const l of v.lines) byLine.set(l.lineId, { ...(byLine.get(l.lineId) ?? {}), [l.lang]: l });
  const nameOf = new Map((p.story?.characters ?? []).map((c) => [c.id, c.name?.en?.split(" ")[0] ?? c.id]));
  return (
    <div className="flex flex-col gap-4">
      {v.castStatus && v.castStatus !== "cast" ? (
        <Box className="flex flex-col gap-1.5 border-alert">
          <p className="text-body font-extrabold text-alert">Not cast yet · {v.castStatus.replace(/_/g, " ")}</p>
          {v.castNote ? (
            <More summary="Why">
              <Caption>{v.castNote}</Caption>
            </More>
          ) : null}
        </Box>
      ) : v.cast.length ? (
        <Box className="flex flex-col gap-1.5">
          <Label as="h3">Cast</Label>
          <ul className="flex flex-col gap-1">
            {v.cast.map((c) => (
              <li key={c.id ?? c.voiceId} className="text-caption">
                <span className="font-bold">{nameOf.get(c.id ?? "") ?? c.id}</span>
                <span className="text-ink-muted"> · {c.voiceName ?? c.voiceId}</span>
              </li>
            ))}
          </ul>
          {v.castNote ? (
            <More summary="How the voices were picked">
              <Caption>{v.castNote}</Caption>
            </More>
          ) : null}
        </Box>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <StatusChip kind="plain">{byLine.size} lines directed</StatusChip>
        <StatusChip kind={v.linesWithTake === v.lines.length ? "live" : "alert"}>
          {v.linesWithTake} of {v.lines.length} with a take in the cut
        </StatusChip>
        {v.retakesInCut ? <StatusChip kind="plain">{v.retakesInCut} retakes in the cut</StatusChip> : null}
        {v.flaggedInCut ? <StatusChip kind="alert">{v.flaggedInCut} in the cut still flagged</StatusChip> : null}
        <StatusChip kind="plain">{v.recordedTakes} takes recorded</StatusChip>
      </div>
      <ul className="flex flex-col gap-3">
        {[...byLine.entries()].map(([id, langs]) => (
          <li key={id}>
            <Box className="grid gap-3 md:grid-cols-2">
              {(["hi", "en"] as const).map((lang) => {
                const l = langs[lang];
                return <VoiceLang key={lang} id={id} lang={lang} l={l} who={l ? (nameOf.get(l.speaker ?? "") ?? null) : null} />;
              })}
            </Box>
          </li>
        ))}
      </ul>
      {v.ab ? <VoiceAbBlock ab={v.ab} nameOf={nameOf} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Sound
// ---------------------------------------------------------------------------

export function SoundStage({ p }: { p: StudioProject }) {
  const s = p.sound;
  if (!s) return <Missing>No cue sheet yet.</Missing>;
  return (
    <div className="flex flex-col gap-4">
      {s.placeholderCues ? (
        <Box className="flex flex-col gap-1.5 border-alert">
          <p className="text-body font-extrabold text-alert">
            {s.placeholderCues} of {s.cues.length} cues are silent placeholders
          </p>
          {s.statusNote ? (
            <More summary="Why">
              <Caption>{s.statusNote}</Caption>
            </More>
          ) : null}
        </Box>
      ) : null}
      {s.loudness || s.rules.length ? (
        <Box className="flex flex-col gap-1.5">
          <Label as="h3">Mix</Label>
          <Meta label="Loudness">{s.loudness}</Meta>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {s.rules.map((r, i) => (
              <li key={i} className="text-caption text-ink-muted">
                {r}
              </li>
            ))}
          </ul>
        </Box>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {s.cues.map((c) => (
          <li key={c.id}>
            <Box className="flex h-full flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-pill bg-brand-soft px-2.5 py-0.5 text-[11px] font-extrabold uppercase">{(c.type ?? "cue").replace(/_/g, " ")}</span>
                <span className="text-caption font-bold break-all">{c.id}</span>
              </div>
              <p className="text-caption text-ink-muted">
                {c.shot ? `Shot ${c.shot} · ` : ""}
                {c.startS != null && c.endS != null ? `${c.startS.toFixed(1)}–${c.endS.toFixed(1)} s` : ""}
                {c.gainDb != null ? ` · ${c.gainDb} dB` : ""}
                {c.loop ? " · loop" : ""}
                {c.model ? ` · ${c.model}` : ""}
              </p>
              {c.prompt ? <Caption className="text-ink">{c.prompt}</Caption> : null}
              {c.note ? (
                <More summary="Mix note">
                  <Caption>{c.note}</Caption>
                </More>
              ) : null}
              <div className="mt-auto pt-1">
                {c.audio ? (
                  <AudioButton src={c.audio} label={c.id} placeholder={c.placeholder} durationS={c.endS != null && c.startS != null ? c.endS - c.startS : null} />
                ) : (
                  <span className="text-caption text-ink-muted">Not generated</span>
                )}
              </div>
            </Box>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Edit
// ---------------------------------------------------------------------------

const LANE_NAME = { dialogue: "Dialogue", music: "Music", sfx: "Effects" } as const;

function Timeline({ t }: { t: StudioTimeline }) {
  const total = t.durationFrames ?? Math.max(1, ...t.shots.map((s) => s.start + s.duration));
  const pct = (f: number) => `${(f / total) * 100}%`;
  const ticks: number[] = [];
  for (let s = 0; s * t.fps <= total; s += 5) ticks.push(s);
  return (
    <div className="overflow-x-auto pb-2" role="group" aria-label={`${langName(t.lang)} timeline`} tabIndex={0}>
      <div className="relative min-w-[760px]">
        <div className="flex gap-2" aria-hidden="true">
          <span className="w-16 flex-none" />
          <div className="relative mb-1 h-5 flex-1 text-[11px] font-bold text-ink-muted">
            {ticks.map((s) => (
              <span key={s} className={clsx("absolute", s > 0 && "-translate-x-1/2")} style={{ left: pct(s * t.fps) }}>
                {s} s
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-stretch gap-2">
          <span className="flex w-16 flex-none items-center text-[11px] font-bold text-ink-muted">Picture</span>
          <div className="relative h-28 flex-1 overflow-hidden rounded-md bg-stage">
            {t.shots.map((s) => (
              <div key={s.id} className="absolute inset-y-0 overflow-hidden border-r-2 border-stage" style={{ left: pct(s.start), width: pct(s.duration) }} title={`${s.id} · ${(s.duration / t.fps).toFixed(2)} s · ${s.move ?? ""}`}>
                {s.image ? <img src={s.image} alt="" className="h-full w-full object-cover opacity-90" loading="lazy" /> : null}
                <span className="absolute bottom-1 left-1 rounded-sm bg-scrim px-1 text-[11px] font-bold text-on-stage">{s.id}</span>
              </div>
            ))}
          </div>
        </div>
        {t.lanes.map((lane) => (
          <div key={lane.kind} className="mt-1.5 flex items-center gap-2">
            <span className="w-16 flex-none text-[11px] font-bold text-ink-muted">{LANE_NAME[lane.kind]}</span>
            <div className="relative h-6 flex-1 rounded-sm bg-glass-strong">
              {lane.clips.map((c, i) => (
                <span
                  key={`${c.id}-${i}`}
                  className={clsx(
                    "absolute top-0.5 bottom-0.5 rounded-sm border",
                    lane.kind === "dialogue" ? "border-brand bg-brand-soft" : lane.kind === "music" ? "border-saffron bg-saffron/30" : "border-hairline bg-ink/15",
                    c.placeholder && "border-dashed",
                  )}
                  style={{ left: pct(c.start), width: pct(Math.max(c.duration, 2)) }}
                  title={`${c.id}${c.placeholder ? " (silent placeholder)" : ""}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditStage({ p }: { p: StudioProject }) {
  const e = p.edit;
  if (!e || !e.timelines.length) return <Missing>No timeline yet. The editor starts once frames, voice, subtitles and sound are approved.</Missing>;
  const anyPlaceholder = e.timelines.some((t) => t.lanes.some((l) => l.clips.some((c) => c.placeholder)));
  return (
    <div className="flex flex-col gap-4">
      {anyPlaceholder ? <Caption>Dashed clips are silent placeholders: the cut was built on planned line lengths, not recorded takes.</Caption> : null}
      {e.timelines.map((t) => (
        <Box key={t.lang} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label as="h3">{langName(t.lang)} cut</Label>
            <span className="text-caption text-ink-muted">
              {secs(t.seconds, 2)} · {t.shots.length} shots · {t.fps} fps{t.plannedSeconds != null ? ` · ${t.plannedSeconds} s planned` : ""}
            </span>
          </div>
          <Timeline t={t} />
          {t.notes.length ? (
            <More summary={`Editor's notes (${t.notes.length})`}>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {t.notes.map((n, i) => (
                  <li key={i} className="text-caption text-ink-muted">
                    {n}
                  </li>
                ))}
              </ul>
            </More>
          ) : null}
        </Box>
      ))}
      <div className="flex flex-wrap gap-2">
        {Object.entries(e.subs).map(([lang, s]) => (
          <StatusChip key={lang} kind="plain">
            S12 subtitles · {langName(lang)} · {s?.cues} cues
          </StatusChip>
        ))}
      </div>
      {e.reviewCuts.length ? (
        <div className="flex flex-wrap gap-4">
          {e.reviewCuts.map((v) => (
            <figure key={v.src} className="flex w-full max-w-[240px] flex-col gap-2">
              <Stage phone>
                <video src={v.src} controls playsInline preload="none" poster={p.still ?? undefined} aria-label={`Review cut, ${langName(v.lang)}`} />
              </Stage>
              <figcaption className="text-caption text-ink-muted">Review cut ({langName(v.lang)}) with subtitles burned in. Not a deliverable.</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Screening
// ---------------------------------------------------------------------------

export function ScreeningStage({ p }: { p: StudioProject }) {
  const s = p.screening;
  if (!s) return <Missing>Not screened yet. The screening reviewer watches each finished cut against the script.</Missing>;
  return (
    <div className="flex flex-col gap-4">
      <Box className={clsx("flex flex-col gap-1.5", s.pass === false && "border-alert")}>
        <p className={clsx("text-body font-extrabold", s.pass === false ? "text-alert" : "text-live")}>{s.pass === false ? "Failed" : s.pass ? "Passed" : "Screened"}</p>
        {s.verdict ? <Body>{s.verdict}</Body> : null}
        <Caption>
          {[s.round != null ? `Round ${s.round}` : null, s.overall != null ? `overall ${s.overall}/10` : null, s.reviewer, s.date, s.filesScreened.length ? `${s.filesScreened.length} files screened` : null].filter(Boolean).join(" · ")}
        </Caption>
      </Box>
      {s.scores.length ? (
        <Box>
          <Label as="h3">Scores out of 10</Label>
          <ul className="mt-2 grid gap-x-6 gap-y-2 md:grid-cols-2">
            {s.scores.map((sc) => (
              <li key={sc.name} className="flex flex-col gap-1">
                <div className="flex justify-between text-caption">
                  <span className="font-bold capitalize">{sc.name}</span>
                  <span className="font-extrabold">{sc.score ?? "?"}</span>
                </div>
                <div className="h-1.5 rounded-pill bg-hairline" aria-hidden="true">
                  <div className={clsx("h-full rounded-pill", (sc.score ?? 0) >= 7 ? "bg-live" : (sc.score ?? 0) >= 4 ? "bg-brand" : "bg-alert")} style={{ width: `${Math.max(0, Math.min(10, sc.score ?? 0)) * 10}%` }} />
                </div>
                {sc.basis ? (
                  <More summary="Why">
                    <Caption>{sc.basis}</Caption>
                  </More>
                ) : null}
              </li>
            ))}
          </ul>
        </Box>
      ) : null}
      {s.items.length ? (
        <div>
          <Label as="h3">Fixes filed to their owners</Label>
          <ul className="mt-2 flex flex-col gap-2">
            {s.items.map((it, i) => (
              <li key={i}>
                <Box className="flex flex-col gap-1.5 p-3">
                  <div className="flex flex-wrap gap-2">
                    {it.severity ? <StatusChip kind={it.severity === "blocker" ? "alert" : "plain"}>{it.severity}</StatusChip> : null}
                    {it.owner ? <StatusChip kind="plain">To: {it.owner}</StatusChip> : null}
                  </div>
                  <Caption className="text-ink">{it.text}</Caption>
                  {it.fix ? (
                    <More summary="Fix">
                      <Caption>{it.fix}</Caption>
                    </More>
                  ) : null}
                </Box>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {s.holdsUp.length ? (
          <Box>
            <Label as="h3">What holds up</Label>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {s.holdsUp.map((x, i) => (
                <li key={i} className="text-caption text-ink-muted">
                  {x}
                </li>
              ))}
            </ul>
          </Box>
        ) : null}
        {s.checksRun.length || s.checksNotRun.length ? (
          <Box>
            <Label as="h3">Checks</Label>
            <ul className="mt-2 flex flex-col gap-1">
              {s.checksRun.map((x, i) => (
                <li key={`r${i}`} className="text-caption text-ink-muted">
                  <span className="font-bold text-live">Run </span>
                  {x}
                </li>
              ))}
              {s.checksNotRun.map((x, i) => (
                <li key={`n${i}`} className="text-caption text-ink-muted">
                  <span className="font-bold text-alert">Not run </span>
                  {x}
                </li>
              ))}
            </ul>
          </Box>
        ) : null}
      </div>
      {s.shots.length ? (
        <More summary="Shot-by-shot notes">
          <ul className="flex flex-col gap-1.5">
            {s.shots.map((x, i) => (
              <li key={i} className="text-caption text-ink-muted">
                <span className="font-bold text-ink">
                  {x.shot} {x.t ? `(${x.t})` : ""}
                </span>{" "}
                {x.note}
              </li>
            ))}
          </ul>
        </More>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Final cut
// ---------------------------------------------------------------------------

export function FinalStage({ p }: { p: StudioProject }) {
  const f = p.final;
  if (!f) return <Missing>Not rendered yet.</Missing>;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 sm:max-w-[560px]">
        {f.renders.map((v) => (
          <figure key={v.file} className="flex flex-col gap-2">
            <Stage phone>
              <video src={v.src} controls playsInline preload="none" poster={p.still ?? undefined} aria-label={`Final cut, ${langName(v.lang)}`} />
            </Stage>
            <figcaption className="flex flex-col gap-0.5">
              <span className="text-caption font-extrabold">{langName(v.lang) || v.file}</span>
              <span className="text-[12px] text-ink-muted">
                {v.file}
                {v.durationS != null ? ` · ${v.durationS.toFixed(1)} s` : ""}
                {v.width && v.height ? ` · rendered ${v.width}×${v.height}` : ""}
              </span>
              {v.duplicateOf ? <span className="text-[12px] font-bold text-alert">Byte-identical to {v.duplicateOf}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
      {p.placeholders.length ? (
        <Caption>Plays as rendered. Anything marked as a placeholder above is in this cut as a stand-in.</Caption>
      ) : null}
    </div>
  );
}
