import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {Episode} from './Episode';
import type {Timeline} from './types';

// Placeholder shown when no --props are passed (renders without any assets).
const defaultTimeline: Timeline = {
	id: 'placeholder',
	durationFrames: 90,
	shots: [
		{id: '000', type: 'slate', start: 0, duration: 90, color: '#3a3a5c', note: 'Pass --props=<resolved timeline>'},
	],
};

const calculateMetadata: CalculateMetadataFunction<Timeline> = ({props}) => {
	const shotsEnd = Math.max(0, ...props.shots.map((s) => s.start + s.duration));
	return {durationInFrames: Math.max(1, Math.round(props.durationFrames || shotsEnd))};
};

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="Episode"
			component={Episode}
			width={1080}
			height={1920}
			fps={30}
			durationInFrames={90}
			defaultProps={defaultTimeline}
			calculateMetadata={calculateMetadata}
		/>
	);
};
