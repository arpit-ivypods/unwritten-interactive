// Resolved timeline: what the Episode composition receives as input props.
// production/scripts/prepare-timeline.mjs turns an authored timeline.json into
// this shape (seconds -> frames, sequential starts, probed audio durations,
// asset paths staged into the render's public dir). See TIMELINE.md.

export type MovePreset =
	| 'push-in'
	| 'pull-out'
	| 'pan-left'
	| 'pan-right'
	| 'tilt-up'
	| 'tilt-down'
	| 'hold'
	| 'drift'
	| 'custom';

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** Camera keyframe for the `custom` preset. x/y are -1..1 of the travel the
 * current scale allows (so the frame edge is never revealed). */
export type CameraKey = {
	scale: number;
	x?: number;
	y?: number;
};

export type Move = {
	preset: MovePreset;
	/** 0..1, default 0.5. Scales zoom amount and travel. */
	intensity?: number;
	easing?: EasingName;
	/** Zoom origin for push-in / pull-out / drift, 0..1 of frame. Default centre. */
	focus?: {x: number; y: number};
	/** Only for preset 'custom'. */
	from?: CameraKey;
	to?: CameraKey;
};

export type Layer = {
	src: string;
	/** Move multiplier. Background < 1, foreground > 1. Default 1. */
	depth?: number;
};

export type TransitionIn = {type: 'cut' | 'crossfade' | 'fade'; frames?: number};
export type TransitionOut = {type: 'cut' | 'fade'; frames?: number};

export type Shot = {
	id: string;
	type?: 'image' | 'slate';
	/** Single-layer image (oversized, >= 1440x2560). */
	image?: string;
	/** Parallax layers, back to front. Used instead of `image`. */
	layers?: Layer[];
	start: number;
	duration: number;
	move?: Move;
	transitionIn?: TransitionIn;
	transitionOut?: TransitionOut;
	/** Slate: card colour (CSS colour). */
	color?: string;
	/** Slate: override text. Default "Shot <id> — in production". */
	text?: string;
	/** Free note, shown under slate text and in debug info. */
	note?: string;
};

export type DialogueClip = {
	id?: string;
	src: string;
	start: number;
	duration: number;
	volume?: number;
	trimBefore?: number;
};

export type MusicClip = {
	id?: string;
	src: string;
	start: number;
	duration: number;
	volume?: number;
	fadeIn?: number;
	fadeOut?: number;
	loop?: boolean;
	trimBefore?: number;
	/** Duck under dialogue. Default true. */
	duck?: boolean;
};

export type SfxClip = {
	id?: string;
	src: string;
	start: number;
	duration: number;
	volume?: number;
	trimBefore?: number;
	fadeIn?: number;
	fadeOut?: number;
};

export type Ducking = {
	enabled?: boolean;
	/** Music gain change while dialogue plays, in dB. Default -10. */
	amountDb?: number;
	/** Ramp down, ends when the dialogue starts. Default 8 frames. */
	attack?: number;
	/** Ramp up, starts when the dialogue ends. Default 15 frames. */
	release?: number;
	/** Gaps between dialogue clips shorter than this stay ducked. Default 20 frames. */
	holdGap?: number;
};

export type SubtitleCue = {startMs: number; endMs: number; text: string};

/** Orientation super (D-024 ruling 3): a name and role, a place or a time, burned
 * into the picture as a lower-third caption. Text before " · " is the main line,
 * the rest the second line. */
export type Super = {
	id?: string;
	kind?: string;
	start: number;
	duration: number;
	text: string;
	/** Opacity fade, frames. Default 6. */
	fadeIn?: number;
	fadeOut?: number;
	/** 'upper' draws it in the top third. Default the lower third. */
	position?: 'lower' | 'upper';
};

export type Timeline = {
	id?: string;
	durationFrames: number;
	background?: string;
	shots: Shot[];
	audio?: {
		dialogue?: DialogueClip[];
		music?: MusicClip[];
		sfx?: SfxClip[];
		ducking?: Ducking;
	};
	subtitles?: SubtitleCue[];
	/** Burned in, in the clean cut as well as the review cut. */
	supers?: Super[];
	debug?: {
		burnSubtitles?: boolean;
		showInfo?: boolean;
	};
};
