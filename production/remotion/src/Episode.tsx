import {Audio} from '@remotion/media';
import React from 'react';
import {
	AbsoluteFill,
	Easing,
	Img,
	interpolate,
	Sequence,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {duckAmount, duckSpans, fadeEnvelope, resolveDucking} from './audio';
import {cameraAt} from './camera';
import type {Layer, Move, PlotText, Shot, SubtitleCue, Super, Timeline} from './types';

// Layout images at this multiple of the frame, then scale down, so Chrome
// rasterises them at (at least) source resolution: 1080x1920 * 4/3 = 1440x2560.
const OVERSCAN = 4 / 3;

export const src = (p: string) => (/^(https?:|data:|blob:)/.test(p) ? p : staticFile(p));

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const ImageLayer: React.FC<{
	layer: Layer;
	move: Move | undefined;
	progress: number;
}> = ({layer, move, progress}) => {
	const {width, height} = useVideoConfig();
	const cam = cameraAt(move, progress, width, height, layer.depth ?? 1);
	const boxW = width * OVERSCAN;
	const boxH = height * OVERSCAN;
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<Img
				src={src(layer.src)}
				style={{
					position: 'absolute',
					width: boxW,
					height: boxH,
					left: (width - boxW) / 2,
					top: (height - boxH) / 2,
					objectFit: 'cover',
					transformOrigin: '50% 50%',
					transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale / OVERSCAN})`,
				}}
			/>
		</AbsoluteFill>
	);
};

const PlotTextLayer: React.FC<{
	item: PlotText;
	move: Move | undefined;
	progress: number;
	depth: number;
}> = ({item, move, progress, depth}) => {
	const {width, height} = useVideoConfig();
	const cam = item.space === 'screen' ? null : cameraAt(move, progress, width, height, depth);
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<AbsoluteFill style={{
				transformOrigin: '50% 50%',
				transform: cam ? `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.scale})` : undefined,
			}}>
				<div
					lang={item.lang}
					style={{
						position: 'absolute',
						left: `${item.x * 100}%`,
						top: `${item.y * 100}%`,
						transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg)`,
						width: 'max-content',
						textAlign: 'center',
						whiteSpace: 'pre',
						fontFamily: fontFor(item.text),
						fontSize: item.fontSize,
						fontWeight: 600,
						fontVariantNumeric: 'tabular-nums',
						lineHeight: 1.25,
						color: item.color ?? '#fff',
						background: item.plate ? 'rgba(10,8,18,0.75)' : undefined,
						padding: item.plate ? '0.15em 0.4em' : undefined,
						borderRadius: item.plate ? '0.2em' : undefined,
					}}
				>
					{item.text}
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const luminance = (color: string) => {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
	if (!m) return 0;
	const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const Slate: React.FC<{shot: Shot}> = ({shot}) => {
	const color = shot.color ?? '#2b2b2b';
	const fg = luminance(color) > 0.55 ? '#111' : '#f5f5f5';
	return (
		<AbsoluteFill
			style={{
				backgroundColor: color,
				color: fg,
				justifyContent: 'center',
				alignItems: 'center',
				padding: 90,
				textAlign: 'center',
				fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
			}}
		>
			<div style={{fontSize: 72, fontWeight: 700, lineHeight: 1.2}}>
				{shot.text ?? `Shot ${shot.id} — in production`}
			</div>
			{shot.note ? (
				<div style={{fontSize: 40, marginTop: 40, opacity: 0.75, lineHeight: 1.3}}>{shot.note}</div>
			) : null}
		</AbsoluteFill>
	);
};

const ShotView: React.FC<{shot: Shot; span: number}> = ({shot, span}) => {
	const frame = useCurrentFrame();
	const progress = span > 1 ? frame / (span - 1) : 0;
	const tin = shot.transitionIn ?? {type: 'cut'};
	const tout = shot.transitionOut ?? {type: 'cut'};
	const inFrames = Math.max(1, tin.frames ?? 12);
	const outFrames = Math.max(1, tout.frames ?? 12);

	const containerOpacity =
		tin.type === 'crossfade' ? interpolate(frame, [0, inFrames], [0, 1], clamp) : 1;
	let contentOpacity = 1;
	if (tin.type === 'fade') contentOpacity *= interpolate(frame, [0, inFrames], [0, 1], clamp);
	if (tout.type === 'fade')
		contentOpacity *= interpolate(frame, [span - outFrames, span], [1, 0], clamp);
	const black = tin.type === 'fade' || tout.type === 'fade';

	const layers: Layer[] = shot.layers?.length ? shot.layers : shot.image ? [{src: shot.image}] : [];
	const isSlate = shot.type === 'slate' || layers.length === 0;

	return (
		<AbsoluteFill style={{opacity: containerOpacity, backgroundColor: black ? '#000' : undefined}}>
			<AbsoluteFill style={{opacity: contentOpacity}}>
				{isSlate ? (
					<Slate shot={shot} />
				) : (
					<>
						{layers.map((layer, i) => (
							<ImageLayer key={i} layer={layer} move={shot.move} progress={progress} />
						))}
						{shot.plotText?.map((item, i) => (
							<PlotTextLayer
								key={i}
								item={item}
								move={shot.move}
								progress={progress}
								depth={layers[0].depth ?? 1}
							/>
						))}
					</>
				)}
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

/** Frames each shot stays mounted: its own duration, extended so it remains
 * underneath a following shot that cross-fades in. */
const shotSpans = (shots: Shot[]) => {
	const sorted = [...shots].sort((a, b) => a.start - b.start);
	return sorted.map((shot, i) => {
		const next = sorted[i + 1];
		let end = shot.start + shot.duration;
		if (next?.transitionIn?.type === 'crossfade') {
			end = Math.max(end, next.start + Math.max(1, next.transitionIn.frames ?? 12));
		}
		return {shot, span: Math.max(1, end - shot.start)};
	});
};

const Subtitles: React.FC<{cues: SubtitleCue[]}> = ({cues}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const ms = (frame / fps) * 1000;
	const cue = cues.find((c) => ms >= c.startMs && ms < c.endMs);
	if (!cue) return null;
	return (
		<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 360}}>
			<div
				style={{
					maxWidth: 940,
					fontSize: 52,
					lineHeight: 1.3,
					color: '#fff',
					textAlign: 'center',
					background: 'rgba(0,0,0,0.6)',
					padding: '14px 28px',
					borderRadius: 12,
					// Keep authored line breaks ("\n" in subs.<lang>.json) in the burn-in (D-012).
					whiteSpace: 'pre-line',
					fontFamily: 'Helvetica Neue, Helvetica, Arial, "Kohinoor Devanagari", sans-serif',
				}}
			>
				{cue.text}
			</div>
		</AbsoluteFill>
	);
};

// Orientation supers (D-024 ruling 3). One style for both series: a lower-third
// card, left-aligned inside the 9:16 safe area. The card's bottom edge sits at
// SUPER_BOTTOM px from the frame bottom, clear of the burned review subtitles
// (their box ends 360 px from the bottom and is about 160-230 px tall) and of
// the app's own subtitles and controls at the foot of the stage. Saffron is the
// app's brand accent (--saffron), the plate its subtitle plate (--subtitle-plate).
const SUPER_BOTTOM = 630;
const SUPER_TOP = 240; // position 'upper': below the app's top bar and progress line
const SUPER_LEFT = 72; // the outer 6 % the frames keep clear (style.json)
const SUPER_MAX_W = 860; // leaves the right-hand ~150 px to phone UI
const DEVANAGARI = /[\u0900-\u097F]/;
const fontFor = (t: string) =>
	DEVANAGARI.test(t)
		? '"Kohinoor Devanagari", "Helvetica Neue", Helvetica, Arial, sans-serif'
		: '"Helvetica Neue", Helvetica, Arial, "Kohinoor Devanagari", sans-serif';

const SuperCard: React.FC<{sup: Super; frame: number}> = ({sup, frame}) => {
	const local = frame - sup.start;
	const fin = Math.max(1, sup.fadeIn ?? 6);
	const fout = Math.max(1, sup.fadeOut ?? 6);
	const opacity = Math.min(
		interpolate(local, [0, fin], [0, 1], clamp),
		interpolate(local, [sup.duration - fout, sup.duration], [1, 0], clamp),
	);
	const slide = interpolate(local, [0, fin * 2], [-14, 0], {...clamp, easing: Easing.out(Easing.cubic)});
	const [main, ...rest] = sup.text.split(/\s+·\s+/);
	const second = rest.join(' · ');
	const line = (t: string, size: number, weight: number, color: string, top = 0) => (
		<div
			lang={DEVANAGARI.test(t) ? 'hi' : 'en'}
			style={{
				fontFamily: fontFor(t),
				fontSize: size,
				fontWeight: weight,
				lineHeight: DEVANAGARI.test(t) ? 1.36 : 1.2,
				color,
				marginTop: top,
				overflowWrap: 'break-word',
			}}
		>
			{t}
		</div>
	);
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'stretch',
				maxWidth: SUPER_MAX_W,
				opacity,
				transform: `translateX(${slide}px)`,
				textShadow: '0 1px 3px rgba(0,0,0,0.5)',
			}}
		>
			<div style={{width: 8, flex: 'none', background: '#f6a21e'}} />
			<div style={{background: 'rgba(10,8,18,0.66)', padding: '16px 30px 18px 24px'}}>
				{line(main, 56, 700, '#ffffff')}
				{second ? line(second, 40, 500, 'rgba(255,255,255,0.86)', 4) : null}
			</div>
		</div>
	);
};

const Supers: React.FC<{supers: Super[]}> = ({supers}) => {
	const frame = useCurrentFrame();
	const on = supers.filter((s) => frame >= s.start && frame < s.start + s.duration);
	if (!on.length) return null;
	const column = (items: Super[], upper: boolean) =>
		items.length ? (
			<AbsoluteFill
				style={{
					justifyContent: upper ? 'flex-start' : 'flex-end',
					alignItems: 'flex-start',
					paddingLeft: SUPER_LEFT,
					...(upper ? {paddingTop: SUPER_TOP} : {paddingBottom: SUPER_BOTTOM}),
					gap: 14,
				}}
			>
				{items.map((s, i) => (
					<SuperCard key={s.id ?? i} sup={s} frame={frame} />
				))}
			</AbsoluteFill>
		) : null;
	return (
		<>
			{column(on.filter((s) => s.position !== 'upper'), false)}
			{column(on.filter((s) => s.position === 'upper'), true)}
		</>
	);
};

const DebugInfo: React.FC<{timeline: Timeline}> = ({timeline}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const current = timeline.shots.filter((s) => frame >= s.start && frame < s.start + s.duration);
	const t = frame / fps;
	const tc = `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
	return (
		<div
			style={{
				position: 'absolute',
				top: 40,
				left: 40,
				padding: '10px 18px',
				background: 'rgba(0,0,0,0.65)',
				color: '#0f0',
				fontFamily: 'Menlo, monospace',
				fontSize: 30,
				borderRadius: 8,
			}}
		>
			{timeline.id ?? 'episode'} · f{frame} · {tc} · {current.map((s) => s.id).join(', ') || '—'}
		</div>
	);
};

export const Episode: React.FC<Timeline> = (timeline) => {
	const {durationInFrames} = useVideoConfig();
	const audio = timeline.audio ?? {};
	const dialogue = audio.dialogue ?? [];
	const duck = resolveDucking(audio.ducking);
	const spans = duckSpans(dialogue, duck.holdGap);

	return (
		<AbsoluteFill style={{backgroundColor: timeline.background ?? '#000'}}>
			{shotSpans(timeline.shots).map(({shot, span}) => (
				<Sequence
					key={shot.id}
					name={`Shot ${shot.id}`}
					from={shot.start}
					durationInFrames={span}
					premountFor={30}
				>
					<ShotView shot={shot} span={span} />
				</Sequence>
			))}

			{dialogue.map((d, i) => (
				<Audio
					key={`d${i}`}
					name={`Dialogue ${d.id ?? i}`}
					src={src(d.src)}
					from={d.start}
					durationInFrames={Math.max(1, d.duration)}
					trimBefore={d.trimBefore}
					volume={d.volume ?? 1}
				/>
			))}

			{(audio.music ?? []).map((m, i) => {
				const base = m.volume ?? 0.5;
				const ducked = duck.enabled && (m.duck ?? true);
				const dur = Math.max(1, Math.min(m.duration, durationInFrames - m.start));
				// The clip length is bounded by a wrapping Sequence, not by <Audio
				// durationInFrames>: on <Audio> that becomes a source trim, which with
				// `loop` would stretch the loop range past the end of the file.
				return (
					<Sequence key={`m${i}`} name={`Music ${m.id ?? i}`} from={m.start} durationInFrames={dur}>
						<Audio
							name={`Music ${m.id ?? i} audio`}
							src={src(m.src)}
							trimBefore={m.trimBefore}
							loop={m.loop}
							loopVolumeCurveBehavior="extend"
							volume={(f) => {
								const env = fadeEnvelope(f, dur, m.fadeIn, m.fadeOut);
								const d = ducked ? duckAmount(m.start + f, spans, duck.attack, duck.release) : 0;
								return base * env * (1 - (1 - duck.gain) * d);
							}}
						/>
					</Sequence>
				);
			})}

			{(audio.sfx ?? []).map((s, i) => {
				const dur = Math.max(1, s.duration);
				const vol = s.volume ?? 1;
				return (
					<Audio
						key={`s${i}`}
						name={`SFX ${s.id ?? i}`}
						src={src(s.src)}
						from={s.start}
						durationInFrames={dur}
						trimBefore={s.trimBefore}
						volume={s.fadeIn || s.fadeOut ? (f) => vol * fadeEnvelope(f, dur, s.fadeIn, s.fadeOut) : vol}
					/>
				);
			})}

			{timeline.supers?.length ? <Supers supers={timeline.supers} /> : null}
			{timeline.debug?.burnSubtitles && timeline.subtitles?.length ? (
				<Subtitles cues={timeline.subtitles} />
			) : null}
			{timeline.debug?.showInfo ? <DebugInfo timeline={timeline} /> : null}
		</AbsoluteFill>
	);
};
