/**
 * The player. OWNER: player engineer.
 *
 * - `PlayerHost`: what the layout of /watch mounts. It reads the route params
 *   and keeps one player alive from episode to episode.
 * - `PlayerScreen`: the whole screen for one series and one playable (the
 *   stage, the room behind it, the audio and subtitle controls). Flows may
 *   mount it elsewhere; it brings its own `uw-ambient` root.
 * - Pure logic, safe anywhere: subtitle timing, shot navigation, labels.
 *
 * The handshake with the flows is docs/contracts.md, section 8.
 */
export { PlayerHost } from "./PlayerHost";
export { PlayerScreen } from "./PlayerScreen";
export type { PlayerScreenProps } from "./PlayerScreen";
export type { PlaybackPhase } from "./PlaybackSession";
export { RoomBackdrop } from "./RoomBackdrop";
export * from "./subtitleTiming";
export * from "./shotNav";
export * from "./labels";
