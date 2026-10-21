import type { CorpusScenario } from "./coverage.js";

/**
 * The scenarios checked in under `golden/replays/`, one file per id. All are command-free runs of
 * the committed 1880 production pack (replay format v1 records no commands), so they differ in
 * seed and length. Each `purpose` states what that replay adds; `pnpm replay:coverage` shows which
 * subsystems each one actually exercises and which none do.
 */
export const REPLAY_SCENARIOS: readonly CorpusScenario[] = [
  {
    id: "production-1880-1m",
    seed: "replay-corpus-1m",
    months: 1,
    purpose: "Smallest replay: the opening month alone, so a first-month break localises at once.",
  },
  {
    id: "production-1880-2m",
    seed: "replay-corpus-2m",
    months: 2,
    purpose: "Two months: state carried across one month boundary under an independent seed.",
  },
  {
    id: "production-1880-3m",
    seed: "replay-corpus-3m",
    months: 3,
    purpose: "First quarter: early construction and research progress under its own weather draws.",
  },
  {
    id: "production-1880-4m",
    seed: "replay-corpus-4m",
    months: 4,
    purpose: "Four months: research draws recur across several months before any technology lands.",
  },
  {
    id: "production-1880-6m",
    seed: "replay-corpus-6m",
    months: 6,
    purpose: "Half year, first seed: mid-length drift in treasuries and appropriations.",
  },
  {
    id: "production-1880-6m-seed-b",
    seed: "replay-corpus-6m-b",
    months: 6,
    purpose: "Half year, second seed: shows the random ledger is seed-dependent, not constant.",
  },
  {
    id: "production-1880-10m",
    seed: "replay-corpus-10m",
    months: 10,
    purpose: "Ends on the first technology discovery (month 10), the research completion path.",
  },
  {
    id: "production-1880-12m",
    seed: "replay-corpus-1880",
    months: 12,
    purpose: "Baseline first year, including the fleet readiness change at month 12.",
  },
  {
    id: "production-1880-13m",
    seed: "replay-corpus-13m",
    months: 13,
    purpose: "First month of 1881: the year rollover after a full year of accumulated state.",
  },
  {
    id: "production-1880-15m",
    seed: "replay-corpus-15m",
    months: 15,
    purpose: "Longest replay: settling into the second year, past rollover and readiness changes.",
  },
];
