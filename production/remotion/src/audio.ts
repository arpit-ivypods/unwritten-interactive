import type {DialogueClip, Ducking} from './types';

const smooth = (t: number) => {
	const c = Math.min(1, Math.max(0, t));
	return c * c * (3 - 2 * c); // smoothstep: no clicks at ramp ends
};

export type DuckSpan = {start: number; end: number};

/** Merge dialogue clips into spans, bridging gaps shorter than holdGap so the
 * music does not pump between lines that are close together. */
export const duckSpans = (dialogue: DialogueClip[], holdGap: number): DuckSpan[] => {
	const spans = dialogue
		.map((d) => ({start: d.start, end: d.start + d.duration}))
		.sort((a, b) => a.start - b.start);
	const merged: DuckSpan[] = [];
	for (const s of spans) {
		const last = merged[merged.length - 1];
		if (last && s.start - last.end <= holdGap) {
			last.end = Math.max(last.end, s.end);
		} else {
			merged.push({...s});
		}
	}
	return merged;
};

/** 0 = not ducked, 1 = fully ducked, at absolute composition frame f. */
export const duckAmount = (f: number, spans: DuckSpan[], attack: number, release: number) => {
	let amount = 0;
	for (const s of spans) {
		let a = 0;
		if (f >= s.start && f <= s.end) a = 1;
		else if (f < s.start) a = attack > 0 ? smooth(1 - (s.start - f) / attack) : 0;
		else a = release > 0 ? smooth(1 - (f - s.end) / release) : 0;
		if (a > amount) amount = a;
		if (amount === 1) break;
	}
	return amount;
};

export const resolveDucking = (d: Ducking | undefined) => ({
	enabled: d?.enabled ?? true,
	gain: Math.pow(10, (d?.amountDb ?? -10) / 20),
	attack: d?.attack ?? 8,
	release: d?.release ?? 15,
	holdGap: d?.holdGap ?? 20,
});

/** Linear fade-in/fade-out envelope for a clip, f relative to clip start. */
export const fadeEnvelope = (f: number, duration: number, fadeIn = 0, fadeOut = 0) => {
	let g = 1;
	if (fadeIn > 0 && f < fadeIn) g *= Math.max(0, f / fadeIn);
	if (fadeOut > 0 && f > duration - fadeOut) g *= Math.max(0, (duration - f) / fadeOut);
	return g;
};
