/**
 * Design-system components for the Unwritten app. OWNER: design-system engineer.
 *
 * Thin React wrappers over the classes in src/styles/bundle.css (copied from
 * docs/design-system/project/components/bundle.css); each renders the markup of
 * its component's preview.html. They hold no product logic: pass in what
 * useSeriesRules(series) answers.
 *
 * Story text (titles, questions, choices, subtitles) takes `lang`: pass the
 * audio language and Hinglish gets lang="hi". The /ds route shows every
 * component in both themes.
 *
 * Server or client: Navigation and Theme are client modules. The rest render
 * anywhere, but any handler you pass (onClick, onSelect...) means the caller
 * must be a client component.
 */
export * from "./Icon";
export * from "./Logo";
export * from "./Button";
export * from "./Surface";
export * from "./Status";
export * from "./Navigation";
export * from "./Browse";
export * from "./Stage";
export * from "./Ballot";
export * from "./Extras";
export * from "./Theme";
