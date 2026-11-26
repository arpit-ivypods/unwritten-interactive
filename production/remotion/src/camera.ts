import {Easing} from 'remotion';
import type {CameraKey, EasingName, Move} from './types';

const EASINGS: Record<EasingName, (t: number) => number> = {
	linear: Easing.linear,
	'ease-in': Easing.bezier(0.42, 0, 1, 1),
	'ease-out': Easing.bezier(0, 0, 0.58, 1),
	'ease-in-out': Easing.bezier(0.45, 0, 0.55, 1),
};

type Keys = {from: Required<CameraKey>; to: Required<CameraKey>};

const full = (k: CameraKey | undefined, fallback: Required<CameraKey>) => ({
	scale: Math.max(1, k?.scale ?? fallback.scale),
	x: k?.x ?? fallback.x,
	y: k?.y ?? fallback.y,
});

/** Start and end camera keys for a preset. Scale is relative to "cover the
 * frame"; x/y are fractions (-1..1) of the travel the scale allows.
 * Positive x moves the image right (camera looks further left). */
export const presetKeys = (move: Move | undefined): Keys => {
	const preset = move?.preset ?? 'hold';
	const i = Math.min(1, Math.max(0, move?.intensity ?? 0.5));
	const zoom = 0.24 * i; // push/pull: up to 24% over the shot
	const panScale = 1 + 0.3 * i; // pans/tilts zoom in just enough to travel
	switch (preset) {
		case 'push-in':
			return {from: {scale: 1, x: 0, y: 0}, to: {scale: 1 + zoom, x: 0, y: 0}};
		case 'pull-out':
			return {from: {scale: 1 + zoom, x: 0, y: 0}, to: {scale: 1, x: 0, y: 0}};
		case 'pan-left':
			return {from: {scale: panScale, x: -1, y: 0}, to: {scale: panScale, x: 1, y: 0}};
		case 'pan-right':
			return {from: {scale: panScale, x: 1, y: 0}, to: {scale: panScale, x: -1, y: 0}};
		case 'tilt-up':
			return {from: {scale: panScale, x: 0, y: -1}, to: {scale: panScale, x: 0, y: 1}};
		case 'tilt-down':
			return {from: {scale: panScale, x: 0, y: 1}, to: {scale: panScale, x: 0, y: -1}};
		case 'drift': {
			const s0 = 1.04 + 0.04 * i;
			return {
				from: {scale: s0, x: -0.5, y: 0.35},
				to: {scale: s0 + 0.06 * i, x: 0.5, y: -0.35},
			};
		}
		case 'custom':
			return {
				from: full(move?.from, {scale: 1, x: 0, y: 0}),
				to: full(move?.to, full(move?.from, {scale: 1, x: 0, y: 0})),
			};
		case 'hold':
		default:
			return {from: {scale: 1, x: 0, y: 0}, to: {scale: 1, x: 0, y: 0}};
	}
};

export type CameraState = {scale: number; tx: number; ty: number};

/** Camera state at progress t (0..1) for a layer with the given depth.
 * Depth multiplies zoom delta and travel, for parallax layers. */
export const cameraAt = (
	move: Move | undefined,
	t: number,
	width: number,
	height: number,
	depth = 1,
): CameraState => {
	const {from, to} = presetKeys(move);
	const e = EASINGS[move?.easing ?? 'ease-in-out'](Math.min(1, Math.max(0, t)));
	// Interpolate scale geometrically so zoom speed looks constant.
	const baseScale = from.scale * Math.pow(to.scale / from.scale, e);
	const scale = 1 + (baseScale - 1) * depth;
	const x = from.x + (to.x - from.x) * e;
	const y = from.y + (to.y - from.y) * e;
	// Max travel without revealing an edge (origin = frame centre). Travel is
	// computed from the base scale and multiplied by depth, which keeps it
	// inside the layer's own (depth-scaled) margin.
	const maxX = ((baseScale - 1) * width) / 2;
	const maxY = ((baseScale - 1) * height) / 2;
	const clampX = ((scale - 1) * width) / 2;
	const clampY = ((scale - 1) * height) / 2;
	// Zooming about a focus point F == zooming about the centre plus a shift of
	// (1 - scale) * (F - centre). Everything is expressed about the centre so a
	// single clamp guarantees the frame edge is never revealed.
	const fx = ((move?.focus?.x ?? 0.5) - 0.5) * width;
	const fy = ((move?.focus?.y ?? 0.5) - 0.5) * height;
	const tx = Math.max(-clampX, Math.min(clampX, x * maxX * depth + (1 - scale) * fx));
	const ty = Math.max(-clampY, Math.min(clampY, y * maxY * depth + (1 - scale) * fy));
	return {scale, tx, ty};
};
