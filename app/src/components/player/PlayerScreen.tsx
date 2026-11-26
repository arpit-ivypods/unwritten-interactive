"use client";

/**
 * The player screen. OWNER: player. Route: /watch/[seriesId]/[playableId].
 *
 * Plays an episode or a glimpse in the vertical 9:16 stage, with the room
 * behind it lit by the current shot. It decides nothing about the story: it
 * asks `useSeriesRules` whether this may be played and where to go when it
 * ends (docs/contracts.md, section 8).
 *
 * It is mounted by the layout of /watch, not by the page, so it stays mounted
 * while the viewer moves from one episode to the next. That keeps the one
 * <video> element alive, which is what lets auto-advance play with sound on
 * iOS Safari (see PlaybackSession).
 *
 * Hooks for motion and tests, on the stage element:
 *   data-player-stage, data-playable="<id>", data-lang="hi|en",
 *   data-state="loading | locked | expired | starting | needs-tap | playing | paused | ended | failed"
 * and on the two side panels: data-player-panel="info" | "controls".
 */
/* eslint-disable @next/next/no-img-element -- stills are served as they are from /media */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ButtonLink,
  GlassPanel,
  Label,
  Segmented,
  Stage,
  StageExpired,
  StageLoading,
  StatusChip,
  Title,
  Body,
  Caption,
  Wordmark,
} from "@/components/ds";
import { getEpisode, shotIndexAt } from "@/content/helpers";
import type { Playable } from "@/content/helpers";
import type { Lang, PlayableMedia, Series } from "@/content/schema";
import { fetchSubtitleTrack } from "@/content/subtitles";
import { routes, stepHref } from "@/lib/routes";
import { useSeriesRules } from "@/state/hooks";
import { startPositionMs } from "@/state/rules";
import { useViewerStore } from "@/state/viewerStore";
import { afterLine, gateCopy, playableName, stepButtonLabel } from "./labels";
import { PlaybackSession } from "./PlaybackSession";
import type { PlaybackPhase } from "./PlaybackSession";
import { createPlaybackStore, useClock } from "./playbackStore";
import type { PlaybackStore } from "./playbackStore";
import { RoomBackdrop } from "./RoomBackdrop";
import "./player.css";

export interface PlayerScreenProps {
  series: Series;
  playable: Playable;
}

interface Session {
  key: string;
  store: PlaybackStore;
  /**
   * The viewer store's epoch when this session started. Every save passes it,
   * so after a presenter reset, preset or jump (which move the epoch) this
   * session can no longer write: not while playing, not on unmount, not at the
   * end. It is not part of the key on purpose: a new key would remount the
   * session and start playing (and saving) the old playable in the moment
   * before the presenter's navigation lands.
   */
  epoch: number;
}

export function PlayerScreen({ series, playable }: PlayerScreenProps) {
  const router = useRouter();
  const rules = useSeriesRules(series);
  const language = useViewerStore((state) => state.language);
  const subtitlesOn = useViewerStore((state) => state.subtitlesOn);
  const setLanguage = useViewerStore((state) => state.setLanguage);
  const setSubtitlesOn = useViewerStore((state) => state.setSubtitlesOn);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const media = playable.media;
  const sessionKey = `${series.id}/${playable.id}`;
  const access = rules.access(playable.id);
  // Until the stores are loaded the rules describe a new viewer on day 1: show nothing as fact.
  const gate = rules.hydrated ? access.state : "loading";

  // One clock per playable, created at the resume point the moment it may be
  // played. Derived from props while rendering; the session below is keyed on it.
  const [current, setCurrent] = useState<Session | null>(null);
  if (gate === "open" && current?.key !== sessionKey) {
    const saved = playable.type === "episode" ? rules.progress.episodes[playable.id] : undefined;
    const startMs = playable.type === "episode" ? startPositionMs(media, saved, language) : 0;
    setCurrent({ key: sessionKey, store: createPlaybackStore(language, startMs), epoch: useViewerStore.getState().epoch });
  }
  const session = gate === "open" && current?.key === sessionKey ? current : null;

  const [phase, setPhase] = useState<{ key: string; phase: PlaybackPhase } | null>(null);
  const reportPhase = useCallback(
    (next: PlaybackPhase) => setPhase((was) => (was?.key === sessionKey && was.phase === next ? was : { key: sessionKey, phase: next })),
    [sessionKey],
  );
  const livePhase = session && phase?.key === sessionKey ? phase.phase : "starting";
  const stageState = session ? livePhase : gate === "open" ? "loading" : gate;

  // The room: the still of the shot on screen.
  const shotIndex = useClock(session?.store ?? null, (clock) => shotIndexAt(media, clock.lang, clock.positionMs), 0);
  const roomStill = session ? (media.shots[shotIndex]?.still ?? media.poster) : media.poster;

  // Where the rules send the viewer afterwards. The player never works it out.
  const afterStep = rules.after(playable.id);
  const afterHref = stepHref(series.id, afterStep);
  const nextEpisode = afterStep.type === "episode" ? getEpisode(series, afterStep.episodeId) : undefined;

  const handleFinish = () => {
    const viewer = useViewerStore.getState();
    // Ignored by the store if the presenter has reset, applied a preset or jumped since the session started.
    const epoch = session?.epoch;
    if (playable.type === "episode") viewer.completeEpisode(series.id, playable.id, epoch);
    else viewer.markGlimpseWatched(series.id, playable.choice, epoch);
    router.push(afterHref);
  };

  useEffect(() => {
    if (gate === "open") router.prefetch(afterHref);
  }, [afterHref, gate, router]);

  // Leaving /watch: stop the film and let go of the file.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, []);

  const hasPlayed = livePhase === "playing" || livePhase === "paused";
  const storyLang = rules.hydrated ? language : undefined;
  const lockedCopy = gate === "locked" || gate === "expired" ? gateCopy(access, playable) : null;

  return (
    <div className="uw-ambient uw-ambient--screen uwp-root" data-player-screen>
      <RoomBackdrop still={roomStill} />
      <main className="uwp-screen">
        <div className="uwp-stage-wrap">
          <Stage
            className="uwp-stage"
            dim={gate === "locked" || gate === "expired"}
            role="region"
            aria-label={`Player: ${playableName(playable)}`}
            data-player-stage
            data-playable={playable.id}
            data-state={stageState}
            data-lang={storyLang}
          >
            <video ref={videoRef} playsInline preload="auto" hidden={!session} tabIndex={-1} disablePictureInPicture disableRemotePlayback />

            {gate === "loading" ? <StageLoading label={`Loading ${playableName(playable).toLowerCase()}`} /> : null}

            {lockedCopy ? (
              <>
                <img src={media.poster} alt="" aria-hidden="true" />
                <StageExpired
                  title={lockedCopy.title}
                  text={lockedCopy.text}
                  action={
                    gate === "expired" ? (
                      <ButtonLink variant="primary" size="sm" href={stepHref(series.id, rules.result.enter)}>
                        Official ending
                      </ButtonLink>
                    ) : (
                      <ButtonLink variant="primary" size="sm" href={stepHref(series.id, rules.next)}>
                        {stepButtonLabel(series, rules.next)}
                      </ButtonLink>
                    )
                  }
                />
              </>
            ) : null}

            {session ? (
              <PlaybackSession
                key={session.key}
                series={series}
                playable={playable}
                store={session.store}
                epoch={session.epoch}
                videoRef={videoRef}
                lang={language}
                subtitlesOn={subtitlesOn}
                afterStep={afterStep}
                afterHref={afterHref}
                onFinish={handleFinish}
                onPhase={reportPhase}
              />
            ) : null}
          </Stage>
        </div>

        <section className="uwp-controls" aria-label="Sound and subtitles" data-player-panel="controls">
          <div className="uwp-controls-inner">
            <div className="uw-field">
              <span className="uw-field-label" id="uwp-audio">
                Audio
              </span>
              <Segmented<Lang>
                full
                labelledBy="uwp-audio"
                value={rules.hydrated ? language : null}
                onChange={setLanguage}
                options={[
                  { value: "hi", label: "हिंदी", lang: "hi" },
                  { value: "en", label: "English" },
                ]}
              />
            </div>
            <div className="uw-field">
              <span className="uw-field-label" id="uwp-subtitles">
                Subtitles
              </span>
              <Segmented<"on" | "off">
                full
                labelledBy="uwp-subtitles"
                value={rules.hydrated ? (subtitlesOn ? "on" : "off") : null}
                onChange={(value) => setSubtitlesOn(value === "on")}
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
            </div>
            <Caption className="uwp-hint">Tap the stage to pause. Tap its left or right edge, or swipe, to change shot.</Caption>
          </div>
        </section>

        <section className="uwp-info" aria-label="Now playing" data-player-panel="info">
          {/* Story text is in the viewer's audio language, which is not known until the stores are loaded. */}
          <GlassPanel variant="compact" style={rules.hydrated ? undefined : { visibility: "hidden" }}>
            {/* The way home. Holding it opens the presenter drawer (AppChrome draws no nav on /watch). */}
            <Wordmark href={routes.home()} />
            <Label>{playable.type === "episode" ? "Now playing" : "Glimpse"}</Label>
            <Title as="h1" lang={storyLang}>
              {series.title[storyLang ?? "en"]}
            </Title>
            <Body>
              {playableName(playable)}
              {" · "}
              <span lang={storyLang === "hi" ? "hi" : undefined}>
                {playable.type === "episode" ? playable.episode.title[storyLang ?? "en"] : series.choices[playable.choice].label[storyLang ?? "en"]}
              </span>
            </Body>
            {gate === "open" ? <Caption>{afterLine(series, afterStep)}</Caption> : null}
            {media.placeholder ? (
              <div>
                <StatusChip kind="plain">Stand-in video</StatusChip>
              </div>
            ) : null}
            <ButtonLink variant="glass" size="sm" href={routes.series(series.id)}>
              Back to the series
            </ButtonLink>
          </GlassPanel>
        </section>
      </main>

      {session && hasPlayed && nextEpisode ? <NextPreload key={nextEpisode.id} media={nextEpisode} lang={language} /> : null}
    </div>
  );
}

/**
 * Warm up the next episode on the viewer's path while this one plays: the
 * start of its video (a second, silent element that never plays), its poster,
 * its first still and its subtitles. iOS Safari does not buffer a video that
 * has not been played, so there it warms up everything but the video.
 */
function NextPreload({ media, lang }: { media: PlayableMedia; lang: Lang }) {
  useEffect(() => {
    for (const src of [media.poster, media.shots[0]?.still]) {
      if (!src) continue;
      const image = new Image();
      image.src = src;
    }
    fetchSubtitleTrack(media.subtitles[lang], media.durationMs[lang]).catch(() => {});
  }, [media, lang]);
  return <video className="uwp-preload" src={media.video[lang]} preload="auto" muted playsInline tabIndex={-1} aria-hidden="true" data-player-preload />;
}
