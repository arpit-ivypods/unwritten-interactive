#!/usr/bin/env node
// Turn an authored timeline.json into resolved Remotion input props.
//
//   node prepare-timeline.mjs <timeline.json> <stageDir> [--strict]
//
// Writes <stageDir>/props.json and <stageDir>/public/ (hard links to every
// referenced asset, so Remotion can load them with staticFile()). Asset paths
// in the timeline are absolute or relative to the timeline file's folder.
// - *Sec fields are converted to frames (30 fps).
// - Shots without `start` follow the previous shot.
// - Audio clips without `duration` get their probed length.
// - A shot whose image is missing becomes a slate (error with --strict).
// See production/remotion/TIMELINE.md.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FPS = 30;
const MIN_W = 1440;
const MIN_H = 2560;

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const [timelinePath, stageDir] = args.filter((a) => !a.startsWith('--'));
if (!timelinePath || !stageDir) {
	console.error('usage: prepare-timeline.mjs <timeline.json> <stageDir> [--strict]');
	process.exit(2);
}

const warnings = [];
const errors = [];
const warn = (m) => warnings.push(m);
const fail = (m) => errors.push(m);

const tl = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const baseDir = path.dirname(path.resolve(timelinePath));
const publicDir = path.join(path.resolve(stageDir), 'public');
fs.rmSync(publicDir, {recursive: true, force: true});
fs.mkdirSync(path.join(publicDir, 'assets'), {recursive: true});

if (tl.fps && tl.fps !== FPS) fail(`fps must be ${FPS} (got ${tl.fps})`);

// --- helpers -------------------------------------------------------------

/** Read key in frames, accepting `<key>` (frames) or `<key>Sec` (seconds). */
const frames = (obj, key) => {
	if (obj[key] !== undefined && obj[key] !== null) return Math.round(Number(obj[key]));
	const s = obj[`${key}Sec`];
	if (s !== undefined && s !== null) return Math.round(Number(s) * FPS);
	return undefined;
};

const staged = new Map();
/** Hard-link (or copy) an asset into the stage public dir; return its
 * public-relative path, or null if it does not exist. */
const stage = (p) => {
	if (/^(https?:|data:)/.test(p)) return p;
	const abs = path.isAbsolute(p) ? p : path.resolve(baseDir, p);
	if (staged.has(abs)) return staged.get(abs);
	if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
	const rel = `assets/${String(staged.size).padStart(3, '0')}-${path.basename(abs).replace(/[^\w.-]/g, '_')}`;
	const dest = path.join(publicDir, rel);
	try {
		fs.linkSync(abs, dest);
	} catch {
		fs.copyFileSync(abs, dest);
	}
	staged.set(abs, rel);
	return rel;
};

const probe = (rel) => {
	const out = execFileSync(
		'ffprobe',
		['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', path.join(publicDir, rel)],
		{encoding: 'utf8'},
	);
	return JSON.parse(out);
};

const checkImage = (rel, label) => {
	try {
		const info = probe(rel);
		const v = info.streams.find((s) => s.codec_type === 'video');
		if (!v) return warn(`${label}: not an image`);
		if (v.width < MIN_W || v.height < MIN_H)
			warn(`${label}: ${v.width}x${v.height} is smaller than ${MIN_W}x${MIN_H}; run upscale.sh`);
		else if (Math.abs(v.width / v.height - 9 / 16) > 0.01)
			warn(`${label}: ${v.width}x${v.height} is not 9:16, it will be centre-cropped`);
	} catch (e) {
		warn(`${label}: could not probe (${e.message.split('\n')[0]})`);
	}
};

const audioFrames = (rel) => {
	const d = Number(probe(rel).format?.duration);
	return Number.isFinite(d) ? Math.round(d * FPS) : undefined;
};

const resolvePlotText = (items, label) => {
	if (items === undefined) return [];
	if (!Array.isArray(items)) {
		fail(`${label}: plotText must be a list`);
		return [];
	}
	const normalized = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
	return items.flatMap((item, i) => {
		const entry = `${label} plotText[${i}]`;
		if (!item || typeof item.text !== 'string' || !item.text.trim() ||
			!normalized(item.x) || !normalized(item.y) || !Number.isFinite(item.fontSize) || item.fontSize <= 0) {
			fail(`${entry}: needs nonempty text, x and y in 0..1, and positive fontSize`);
			return [];
		}
		if ((item.space !== undefined && !['image', 'screen'].includes(item.space)) ||
			(item.lang !== undefined && !['hi', 'en'].includes(item.lang)) ||
			(item.rotation !== undefined && !Number.isFinite(item.rotation)) ||
			(item.color !== undefined && (typeof item.color !== 'string' || !item.color.trim())) ||
			(item.plate !== undefined && typeof item.plate !== 'boolean')) {
			fail(`${entry}: invalid space, lang, rotation, color or plate`);
			return [];
		}
		return [item];
	});
};

// --- shots ---------------------------------------------------------------

let cursor = 0;
const shots = (tl.shots ?? []).map((raw, i) => {
	const id = String(raw.id ?? i + 1);
	const label = `shot ${id}`;
	const start = frames(raw, 'start') ?? cursor;
	const duration = frames(raw, 'duration');
	if (!duration || duration <= 0) fail(`${label}: duration (or durationSec) is required`);
	cursor = start + (duration ?? 0);

	const shot = {
		id,
		type: raw.type ?? 'image',
		start,
		duration: duration ?? 1,
		...(raw.move && {move: raw.move}),
		...(raw.transitionIn && {transitionIn: {...raw.transitionIn, frames: frames(raw.transitionIn, 'frames')}}),
		...(raw.transitionOut && {transitionOut: {...raw.transitionOut, frames: frames(raw.transitionOut, 'frames')}}),
		...(raw.color && {color: raw.color}),
		...(raw.text && {text: raw.text}),
		...(raw.note && {note: raw.note}),
	};

	if (shot.type !== 'slate') {
		const wanted = raw.layers?.length ? raw.layers : raw.image ? [{src: raw.image}] : [];
		const resolved = [];
		const missing = [];
		for (const [li, layer] of wanted.entries()) {
			const rel = stage(layer.src);
			if (!rel) missing.push(layer.src);
			else {
				checkImage(rel, `${label} layer ${li}`);
				resolved.push({src: rel, ...(layer.depth !== undefined && {depth: layer.depth})});
			}
		}
		if (wanted.length === 0) missing.push('(no image or layers given)');
		if (missing.length) {
			const msg = `${label}: missing ${missing.join(', ')} -> slate`;
			if (strict) fail(msg);
			else warn(msg);
			shot.type = 'slate';
			shot.color = raw.color ?? tl.slateColor ?? '#2b2b2b';
		} else if (raw.layers?.length) shot.layers = resolved;
		else shot.image = resolved[0].src;
	} else {
		shot.color = raw.color ?? tl.slateColor ?? '#2b2b2b';
	}
	if (shot.type !== 'slate') {
		const plotText = resolvePlotText(raw.plotText, label);
		if (plotText.length) shot.plotText = plotText;
	}
	return shot;
});

const sorted = [...shots].sort((a, b) => a.start - b.start);
for (let i = 1; i < sorted.length; i++) {
	const prevEnd = sorted[i - 1].start + sorted[i - 1].duration;
	if (sorted[i].start > prevEnd) warn(`gap of ${sorted[i].start - prevEnd} frames before shot ${sorted[i].id} (black)`);
	if (sorted[i].start < prevEnd) warn(`shot ${sorted[i].id} overlaps shot ${sorted[i - 1].id} by ${prevEnd - sorted[i].start} frames (later shot drawn on top)`);
}
const shotsEnd = Math.max(0, ...shots.map((s) => s.start + s.duration));
const durationFrames = frames(tl, 'durationFrames') ?? frames(tl, 'duration') ?? shotsEnd;

// --- audio ---------------------------------------------------------------

const clips = (list, kind, extraKeys) =>
	(list ?? []).flatMap((raw, i) => {
		const label = `${kind} ${raw.id ?? i}`;
		const rel = stage(raw.src);
		if (!rel) {
			const msg = `${label}: missing ${raw.src}`;
			if (strict) fail(msg);
			else warn(`${msg} (dropped)`);
			return [];
		}
		const start = frames(raw, 'start') ?? 0;
		const trimBefore = frames(raw, 'trimBefore');
		let duration = frames(raw, 'duration');
		if (duration === undefined) {
			const natural = audioFrames(rel);
			if (natural === undefined) fail(`${label}: cannot probe duration, give duration`);
			duration = raw.loop ? durationFrames - start : Math.max(1, (natural ?? 1) - (trimBefore ?? 0));
		}
		if (start + duration > durationFrames) {
			if (!raw.loop && kind !== 'music') warn(`${label}: runs ${start + duration - durationFrames} frames past the end (cut)`);
			duration = Math.max(1, durationFrames - start);
		}
		const clip = {...(raw.id && {id: String(raw.id)}), src: rel, start, duration};
		if (trimBefore !== undefined) clip.trimBefore = trimBefore;
		if (raw.volume !== undefined) clip.volume = raw.volume;
		for (const k of extraKeys) {
			const f = frames(raw, k);
			if (f !== undefined) clip[k] = f;
		}
		if (raw.loop !== undefined) clip.loop = raw.loop;
		if (raw.duck !== undefined) clip.duck = raw.duck;
		return [clip];
	});

const audio = {
	dialogue: clips(tl.audio?.dialogue, 'dialogue', []),
	music: clips(tl.audio?.music, 'music', ['fadeIn', 'fadeOut']),
	sfx: clips(tl.audio?.sfx, 'sfx', ['fadeIn', 'fadeOut']),
	...(tl.audio?.ducking && {ducking: tl.audio.ducking}),
};

// --- subtitles (debug burn-in only) --------------------------------------

let subtitles = tl.subtitles;
if (!subtitles && tl.subtitlesFile) {
	const p = path.isAbsolute(tl.subtitlesFile) ? tl.subtitlesFile : path.resolve(baseDir, tl.subtitlesFile);
	if (fs.existsSync(p)) subtitles = JSON.parse(fs.readFileSync(p, 'utf8'));
	else warn(`subtitlesFile missing: ${p}`);
}

// --- supers (D-024 ruling 3: burned in, clean and review cuts alike) ---------

const supers = (tl.supers ?? []).flatMap((raw, i) => {
	const label = `super ${raw.id ?? i}`;
	const start = frames(raw, 'start');
	let duration = frames(raw, 'duration');
	if (!raw.text || !String(raw.text).trim() || start === undefined || !duration || duration <= 0) {
		warn(`${label}: needs text, start and duration (dropped)`);
		return [];
	}
	if (start >= durationFrames) {
		warn(`${label}: starts after the end (dropped)`);
		return [];
	}
	if (start + duration > durationFrames) {
		warn(`${label}: runs ${start + duration - durationFrames} frames past the end (cut)`);
		duration = durationFrames - start;
	}
	const s = {
		...(raw.id && {id: String(raw.id)}),
		...(raw.kind && {kind: String(raw.kind)}),
		start,
		duration,
		text: String(raw.text),
		...(raw.position === 'upper' && {position: 'upper'}),
	};
	for (const k of ['fadeIn', 'fadeOut']) {
		const f = frames(raw, k);
		if (f !== undefined) s[k] = f;
	}
	return [s];
});

const props = {
	id: tl.id ?? path.basename(timelinePath, '.json'),
	durationFrames,
	...(tl.background && {background: tl.background}),
	shots,
	audio,
	...(subtitles && {subtitles}),
	...(supers.length && {supers}),
	...(tl.debug && {debug: tl.debug}),
};

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
if (errors.length) process.exit(1);

fs.writeFileSync(path.join(stageDir, 'props.json'), JSON.stringify(props, null, 2));
const slates = shots.filter((s) => s.type === 'slate').length;
console.log(
	`prepared ${props.id}: ${durationFrames} frames (${(durationFrames / FPS).toFixed(2)} s), ` +
		`${shots.length} shots (${slates} slate), ${audio.dialogue.length} dialogue, ${audio.music.length} music, ` +
		`${audio.sfx.length} sfx, ${supers.length} supers, ${staged.size} assets staged, ${warnings.length} warnings`,
);
