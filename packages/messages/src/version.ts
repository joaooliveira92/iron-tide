/**
 * Projection version. Bumped whenever the mapping from domain events to
 * `TurnMessage`s changes in a way that alters player-visible output; carried on
 * every message and on the summary sidecar so history can be invalidated.
 */
export const PROJECTION_VERSION = "1.0.0" as const;
