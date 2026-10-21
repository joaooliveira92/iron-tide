import type { ReplayScenario } from "./corpus.js";

/** The scenarios checked in under `golden/replays/`, one file per id. */
export const REPLAY_SCENARIOS: readonly ReplayScenario[] = [
  { id: "production-1880-12m", seed: "replay-corpus-1880", months: 12 },
];
