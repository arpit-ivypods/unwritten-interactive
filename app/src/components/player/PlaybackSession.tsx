"use client";

/**
 * One episode or glimpse playing in the stage. OWNER: player.
 *
 * `PlayerScreen` owns the <video> element and keeps it mounted from one
 * episode to the next; this component is mounted fresh (keyed) for each
 * playable and drives that element: it loads the file, seeks, plays, pauses,
 * steps through shots, swaps the file when the audio language changes, saves
 * resume points and reports the end. It renders what is drawn over the film.
 *
 * Why the element is shared: iOS Safari only lets a video play with sound
 * from a tap. An element that has been started by a tap may be given a new
 * file and played again without one, which is what makes auto-advance with
 * sound work. A new element per episode would stop at "Tap to play" each time.
 *
 * Starting: on arrival we try to play with sound. If the browser refuses (no
 * tap yet on this element), the stage shows "Tap to play" and the tap starts
 * it. The video is never started muted.
 */
/* eslint-disable @next/next/no-img-element -- stills are served as they are from /media */
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, RefObject } from "react";
import { Button, ButtonLink, Icon, StageBottom, StageFailed, StageTapToPlay, StageTop, Subtitles } from "@/components/ds";
import { positionAfterLanguageSwitch, shotAt, shotIndexAt, shotsFor, speakerName } from "@/content/helpers";
import type { Playable } from "@/content/helpers";
import type { Lang, Series, SubtitleTrack } from "@/content/schema";
import { fetchSubtitleTrack } from "@/content/subtitles";
import type { Step } from "@/state/rules";
import { useViewerStore } from "@/state/viewerStore";
import { afterLine, playableName, playableShortName, stepButtonLabel } from "./labels";
import { useClock } from "./playbackStore";
import type { PlaybackStore } from "./playbackStore";
import { formatClock, nextShotMs, previousShotMs, quantizedShotFraction, segmentStates, shotIndexIn, swipeDirection } from "./shotNav";
import { plateWords, subtitleFrameFromKey, subtitleFrameKey } from "./subtitleTiming";

/**
 * starting: loading, or asked to play and waiting for the first frame.
 * needs-tap: the browser wants a tap before it plays with sound.
 * playing / paused: as they say. ended: finished, the next step is on its way.
 * failed: the file could not be loaded or decoded.
 */
export type PlaybackPhase = "starting" | "needs-tap" | "playing" | "paused" | "ended" | "failed";

/** Save the resume point this often while playing (contracts, section 8.4). */
const SAVE_EVERY_MS = 1000;
/** A seek that lands further than this from where it was asked to go is asked again. */
const SEEK_TOLERANCE_MS = 300;

export interface PlaybackSessionProps {
  series: Series;
  playable: Playable;
  /** The clock for this playable, created with the start position. */
  store: PlaybackStore;
  /** The viewer store's epoch when the session started: passed with every save, so a save after a presenter reset, preset or jump is dropped. */
  epoch: number;
  /** The shared video element. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The viewer's audio language. Changing it swaps the file at the same shot. */
  lang: Lang;
  subtitlesOn: boolean;
  /** Where the rules send the viewer when this ends: only for the words and the link on the stage. */
  afterStep: Step;
  afterHref: string;
  /** Played to the end (or skipped past the last shot, or skipped because it would not load). */
  onFinish: () => void;
  /** Reports the phase, for `data-state` on the stage. */
  onPhase?: (phase: PlaybackPhase) => void;
}

export function PlaybackSession({ series, playable, store, epoch, videoRef, lang, subtitlesOn, afterStep, afterHref, onFinish, onPhase }: PlaybackSessionProps) {
  const media = playable.media;
  const isEpisode = playable.type === "episode";

  const [phase, setPhase] = useState<PlaybackPhase>("starting");
  const [readySrc, setReadySrc] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);

  /** Does the viewer want it playing? Decides whether a language switch resumes. */
  const intentRef = useRef<"play" | "pause">("play");
  /** A position to go to as soon as the file allows it. While set, the video's own clock is not trusted. */
  const pendingSeekRef = useRef<number | null>(null);
  /** Between load() and the new file's metadata: pause events in here are ours, not the viewer's. */
  const reloadingRef = useRef(false);
  /** The language of the file that is in the element, null before the first load. */
  const loadedLangRef = useRef<Lang | null>(null);
  const hasPlayedRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    onPhase?.(phase);
  }, [phase, onPhase]);

  // The language that is actually loaded (follows `lang` after the load effect).
  const clockLang = useClock(store, (clock) => clock.lang, lang);
  const src = media.video[clockLang];
  const ready = readySrc === src;
  const shots = useMemo(() => shotsFor(media, clockLang), [media, clockLang]);
  const shotIndex = useClock(store, (clock) => shotIndexAt(media, clock.lang, clock.positionMs), 0);
  const atStart = useClock(store, (clock) => clock.positionMs === 0, true);
  const resumeSecond = useClock(store, (clock) => (phase === "needs-tap" ? Math.floor(clock.positionMs / 1000) : 0), 0);

  // -------------------------------------------------------------------------
  // Resume points
  // -------------------------------------------------------------------------

  const saveProgress = useCallback(() => {
    if (!isEpisode || !hasPlayedRef.current || finishedRef.current) return;
    const clock = store.getState();
    useViewerStore.getState().recordProgress(
      series.id,
      playable.id,
      {
        positionMs: clock.positionMs,
        lang: clock.lang,
        shotId: shotAt(media, clock.lang, clock.positionMs).id,
      },
      epoch,
    );
  }, [epoch, isEpisode, media, playable.id, series.id, store]);

  useEffect(() => {
    if (!isEpisode) return;
    let lastSavedAt = 0;
    let lastShot = -1;
    const unsubscribe = store.subscribe((clock) => {
      if (pendingSeekRef.current !== null) return;
      const shot = shotIndexAt(media, clock.lang, clock.positionMs);
      const now = performance.now();
      if (shot === lastShot && now - lastSavedAt < SAVE_EVERY_MS) return;
      lastShot = shot;
      lastSavedAt = now;
      saveProgress();
    });
    const onHidden = () => {
      if (document.visibilityState === "hidden") saveProgress();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", saveProgress);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", saveProgress);
      // Leaving the episode half way (back, a link, the presenter's jump).
      saveProgress();
    };
  }, [isEpisode, media, saveProgress, store]);

  // -------------------------------------------------------------------------
  // Play, pause, seek, finish
  // -------------------------------------------------------------------------

  const attemptPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    intentRef.current = "play";
    let started: Promise<void> | undefined;
    try {
      started = video.play();
    } catch {
      return;
    }
    started?.catch((error: unknown) => {
      const name = error instanceof Error ? error.name : "";
      // AbortError: a newer load replaced this one, which will play itself.
      // NotSupportedError: the error event puts up the Failed state.
      if (name !== "NotAllowedError") return;
      intentRef.current = "pause";
      setPhase("needs-tap");
    });
  }, [videoRef]);

  const seekTo = useCallback(
    (positionMs: number) => {
      const video = videoRef.current;
      if (!video) return;
      store.setState({ positionMs });
      if (video.readyState === 0) {
        pendingSeekRef.current = positionMs;
        return;
      }
      if (pendingSeekRef.current !== null) pendingSeekRef.current = positionMs;
      video.currentTime = positionMs / 1000;
    },
    [store, videoRef],
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    // The last resume point is written by completeEpisode: position 0, completed.
    finishedRef.current = true;
    videoRef.current?.pause();
    setPhase("ended");
    onFinish();
  }, [onFinish, videoRef]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video || finishedRef.current) return;
    if (intentRef.current === "play" && !video.paused) {
      intentRef.current = "pause";
      video.pause();
      setPhase("paused");
      saveProgress();
    } else {
      setPhase((current) => (current === "failed" || current === "ended" ? current : "starting"));
      attemptPlay();
    }
  }, [attemptPlay, saveProgress, videoRef]);

  const stepShot = useCallback(
    (direction: "previous" | "next") => {
      if (finishedRef.current) return;
      const clock = store.getState();
      const flat = shotsFor(media, clock.lang);
      if (direction === "previous") {
        seekTo(previousShotMs(flat, clock.positionMs));
        return;
      }
      const next = nextShotMs(flat, clock.positionMs);
      if (next === null) finish();
      else seekTo(next);
    },
    [finish, media, seekTo, store],
  );

  const retry = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    pendingSeekRef.current = store.getState().positionMs;
    reloadingRef.current = true;
    setPhase("starting");
    video.load();
    attemptPlay();
  }, [attemptPlay, store, videoRef]);

  // -------------------------------------------------------------------------
  // The video element: events
  // -------------------------------------------------------------------------

  const sample = useEffectEvent(() => {
    const video = videoRef.current;
    if (!video || pendingSeekRef.current !== null || finishedRef.current) return;
    const positionMs = Math.round(video.currentTime * 1000);
    if (positionMs !== store.getState().positionMs) store.setState({ positionMs });
  });

  const onLoadedMetadata = useEffectEvent(() => {
    const video = videoRef.current;
    if (!video) return;
    reloadingRef.current = false;
    // A file has arrived after one that failed (a retry, or the other language): leave the Failed state.
    setPhase((current) => (current !== "failed" ? current : intentRef.current === "play" ? "starting" : "needs-tap"));
    const target = pendingSeekRef.current;
    if (target !== null && target > 0) video.currentTime = target / 1000;
  });

  /** A frame is on screen and no seek is in flight: the cover still can go. */
  const onSettled = useEffectEvent(() => {
    const video = videoRef.current;
    if (!video || video.seeking || video.readyState < 2) return;
    const target = pendingSeekRef.current;
    if (target !== null) {
      // iOS can ignore a seek made at loadedmetadata: ask once more, then wait for the next "seeked".
      if (Math.abs(video.currentTime * 1000 - target) > SEEK_TOLERANCE_MS) {
        video.currentTime = target / 1000;
        return;
      }
      pendingSeekRef.current = null;
    }
    setReadySrc(media.video[store.getState().lang]);
    setBuffering(false);
    sample();
  });

  const onPlaying = useEffectEvent(() => {
    intentRef.current = "play";
    setBuffering(false);
    setPhase("playing");
    if (!hasPlayedRef.current) {
      hasPlayedRef.current = true;
      // Opening an episode makes it the resume point straight away.
      saveProgress();
    }
  });

  const onPause = useEffectEvent(() => {
    const video = videoRef.current;
    if (!video || reloadingRef.current || finishedRef.current || video.ended) return;
    // Paused by the viewer, or by the system (a call, headphones pulled out, the tab put away).
    intentRef.current = "pause";
    setPhase((current) => (current === "playing" ? "paused" : current));
    saveProgress();
  });

  const onWaiting = useEffectEvent(() => setBuffering(true));
  const onEnded = useEffectEvent(() => finish());
  const onError = useEffectEvent(() => {
    if (finishedRef.current) return;
    reloadingRef.current = false;
    // The intent stays "play": if the other language's file loads, it starts by itself.
    setBuffering(false);
    setPhase("failed");
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const listeners: Array<[string, () => void]> = [
      ["loadedmetadata", () => onLoadedMetadata()],
      ["loadeddata", () => onSettled()],
      ["canplay", () => onSettled()],
      ["seeked", () => onSettled()],
      ["playing", () => onPlaying()],
      ["pause", () => onPause()],
      ["waiting", () => onWaiting()],
      ["timeupdate", () => sample()],
      ["ended", () => onEnded()],
      ["error", () => onError()],
    ];
    for (const [type, listener] of listeners) video.addEventListener(type, listener);
    return () => {
      for (const [type, listener] of listeners) video.removeEventListener(type, listener);
      // The next playable loads its own file into the same element.
      loadedLangRef.current = null;
      video.pause();
    };
  }, [videoRef]);

  // Load the file: once when this playable opens, and again when the audio
  // language changes. The viewer stays at the same shot, not the same second,
  // because the two cuts differ in length (design system, LanguageSwitch).
  useEffect(() => {
    const video = videoRef.current;
    // Once finished the file stays as it is: a language switch must not reload (and replay) an ended episode.
    if (!video || finishedRef.current || loadedLangRef.current === lang) return;
    const first = loadedLangRef.current === null;
    const clock = store.getState();
    const positionMs = positionAfterLanguageSwitch(media, clock.lang, lang, clock.positionMs);
    const resume = first || intentRef.current === "play";
    loadedLangRef.current = lang;
    pendingSeekRef.current = positionMs;
    reloadingRef.current = true;
    store.setState({ lang, positionMs });
    // The resume point follows the language (a no-op until something has played).
    saveProgress();
    video.src = media.video[lang];
    video.load();
    if (resume) attemptPlay();
  }, [attemptPlay, lang, media, saveProgress, store, videoRef]);

  // The clock: every animation frame while playing. "timeupdate" (above) keeps
  // it moving when the tab is in the background and frames are not drawn.
  useEffect(() => {
    if (phase !== "playing") return;
    let frame = requestAnimationFrame(function tick() {
      sample();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // Keyboard: space or K to pause and play, arrows for the previous and next shot.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (typing) return;
    const started = phase === "playing" || phase === "paused";
    if (event.key === "ArrowLeft" && started) stepShot("previous");
    else if (event.key === "ArrowRight" && started) stepShot("next");
    else if ((event.key === "k" || event.key === "K") && phase !== "failed") toggle();
    else if (event.key === " " && target === document.body && phase !== "failed") toggle();
    else return;
    event.preventDefault();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // -------------------------------------------------------------------------
  // Taps and swipes on the stage
  // -------------------------------------------------------------------------

  const pointerRef = useRef<{ id: number; x: number; y: number; at: number } | null>(null);
  const swipedRef = useRef(false);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipedRef.current = false;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start || start.id !== event.pointerId) return;
    const direction = swipeDirection({ dx: event.clientX - start.x, dy: event.clientY - start.y, durationMs: event.timeStamp - start.at });
    if (!direction) return;
    // A mouse drag that ends on the zone it started on is followed by a click: that click is not a tap.
    swipedRef.current = true;
    window.setTimeout(() => {
      swipedRef.current = false;
    }, 350);
    stepShot(direction);
  };
  const onClickCapture = (event: ReactMouseEvent) => {
    if (!swipedRef.current) return;
    swipedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // -------------------------------------------------------------------------
  // What is drawn over the film
  // -------------------------------------------------------------------------

  const track = useSubtitleTrack(media.subtitles[clockLang], media.durationMs[clockLang]);
  const title = `${series.title[clockLang]} · ${playableShortName(playable)}`;
  const coverStill = atStart ? media.poster : (shots[shotIndex]?.still ?? media.poster);
  const showControls = phase === "starting" || phase === "playing" || phase === "paused";
  const showSpinner = buffering || (phase === "starting" && !ready);

  return (
    <>
      {/* Failed is a plain dark stage: words never sit on bare artwork (design system, StageStates). */}
      {ready || phase === "failed" ? null : <img className="uwp-cover" src={coverStill} alt="" aria-hidden="true" />}
      {phase === "failed" ? <div className="uwp-blank" /> : <div className="uw-stage-scrim" />}

      {showControls ? (
        <div
          className="uwp-zones"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pointerRef.current = null;
          }}
          onClickCapture={onClickCapture}
        >
          <button type="button" className="uwp-zone uwp-zone--edge" aria-label="Previous shot" onClick={() => stepShot("previous")} />
          <button type="button" className="uwp-zone uwp-zone--main" aria-label={phase === "paused" ? "Play" : "Pause"} onClick={toggle} />
          <button type="button" className="uwp-zone uwp-zone--edge" aria-label="Next shot" onClick={() => stepShot("next")} />
        </div>
      ) : null}

      {phase === "failed" ? null : <StageHud store={store} media={media} title={title} lang={clockLang} />}

      {phase === "paused" ? (
        <span className="uw-stage-play uwp-glyph" aria-hidden="true">
          <Icon name="play" />
        </span>
      ) : null}
      {showSpinner && phase !== "paused" ? <span className="uw-spinner uwp-spinner" role="status" aria-label="Loading" /> : null}

      {subtitlesOn && showControls ? (
        <StageBottom>
          <SubtitleLayer store={store} track={track} series={series} lang={clockLang} />
        </StageBottom>
      ) : null}

      {phase === "needs-tap" ? (
        <div className="uwp-tap" onClick={toggle}>
          <StageTapToPlay
            title={atStart ? "Tap to play" : "Tap to carry on"}
            text={`${atStart ? "Sound on." : `From ${formatClock(resumeSecond * 1000)}, with sound.`} ${subtitlesOn ? "Subtitles are on too." : "Subtitles are off."}`}
          />
        </div>
      ) : null}

      {phase === "failed" ? (
        <StageFailed title={`This ${isEpisode ? "episode" : "glimpse"} did not load`} text="Check your connection and try again, or carry on without it." onRetry={retry}>
          <Button variant="glass" size="sm" icon="arrow-right" onClick={finish}>
            {stepButtonLabel(series, afterStep)}
          </Button>
        </StageFailed>
      ) : null}

      {/* The next step is usually on screen before this is: it only appears if the move is slow,
          and then it offers the way on, so the viewer is never left on a finished episode. */}
      {phase === "ended" ? (
        <div className="uw-stage-state uw-stage-state--veil uwp-late" role="status">
          <span className="uw-spinner" aria-hidden="true" />
          <p className="uw-stage-state-title">{playableName(playable)} finished</p>
          <p className="uw-stage-state-text">{afterLine(series, afterStep)}</p>
          <ButtonLink variant="glass" size="sm" icon="arrow-right" href={afterHref}>
            {stepButtonLabel(series, afterStep)}
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// The top of the stage: one segment per shot, the title and the time
// ---------------------------------------------------------------------------

function StageHud({ store, media, title, lang }: { store: PlaybackStore; media: Playable["media"]; title: string; lang: Lang }) {
  const shots = useMemo(() => shotsFor(media, lang), [media, lang]);
  const index = useClock(store, (clock) => shotIndexIn(shots, clock.positionMs), 0);
  const fraction = useClock(store, (clock) => quantizedShotFraction(shots[shotIndexIn(shots, clock.positionMs)], clock.positionMs), 0);
  const second = useClock(store, (clock) => Math.floor(clock.positionMs / 1000), 0);
  return (
    <StageTop
      segments={segmentStates(shots.length, index)}
      nowFraction={fraction}
      title={title}
      meta={`${formatClock(second * 1000)} / ${formatClock(media.durationMs[lang])}`}
      lang={lang}
    />
  );
}

// ---------------------------------------------------------------------------
// Subtitles: a DOM overlay drawn from the timed JSON
// ---------------------------------------------------------------------------

/** The subtitle track for one file. null while it loads, and for good if it cannot be loaded: the film plays without. */
function useSubtitleTrack(url: string, durationMs: number): SubtitleTrack | null {
  const [loaded, setLoaded] = useState<{ url: string; track: SubtitleTrack } | null>(null);
  useEffect(() => {
    let current = true;
    fetchSubtitleTrack(url, durationMs).then(
      (track) => {
        if (current) setLoaded({ url, track });
      },
      (error: unknown) => {
        console.warn(`[player] playing without subtitles: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
    return () => {
      current = false;
    };
  }, [url, durationMs]);
  return loaded?.url === url ? loaded.track : null;
}

function SubtitleLayer({ store, track, series, lang }: { store: PlaybackStore; track: SubtitleTrack | null; series: Series; lang: Lang }) {
  // The key changes only when the line or the highlighted word does.
  const key = useClock(store, (clock) => (track && track.lang === clock.lang ? subtitleFrameKey(track, clock.positionMs) : ""), "");
  const frame = subtitleFrameFromKey(track, key);
  if (!frame) return null;
  const speaker = frame.showSpeaker ? (
    <span lang={lang === "hi" ? "hi" : undefined}>{speakerName(series, frame.cue.speaker, lang, frame.cue.speaker_label)}</span>
  ) : undefined;
  return <Subtitles speaker={speaker} words={plateWords(frame.cue)} activeWord={frame.activeWord} lang={lang} heardAs={frame.cue.heard_as} />;
}
