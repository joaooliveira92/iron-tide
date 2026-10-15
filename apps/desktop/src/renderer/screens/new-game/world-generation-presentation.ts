/**
 * Content and pacing for the "Establishing the Naval Order" cosmetic
 * presentation (spec §7). Purely cosmetic — none of this maps to real
 * `compileCampaign` progress; the checklist is a fixed, hand-authored
 * sequence played out on a client-side timer.
 */

export const CHECKLIST_LINES: readonly string[] = [
  "Appointing foreign governments",
  "Calculating national naval budgets",
  "Establishing diplomatic relations",
  "Generating naval technologies",
  "Laying down existing ship classes",
  "Assigning ships to overseas stations",
  "Constructing naval bases and fortifications",
  "Compiling foreign intelligence estimates",
  "Preparing the January naval estimates",
];

export const FLAVOR_MESSAGES: readonly string[] = [
  "Foreign ship characteristics are based on intelligence estimates.",
  "Technological discoveries will not always follow history.",
  "A large fleet may become unsustainable during an economic downturn.",
  "A navy built for the last war may be unsuited to the next one.",
];

/** Bounded minimum the presentation plays for before it may hand off (spec §7: ~2.5–3s). */
export const COSMETIC_MINIMUM_DURATION_MS = 2700;

/** Paces the 9-line checklist reveal across the minimum duration. */
export const CHECKLIST_REVEAL_INTERVAL_MS = Math.round(
  COSMETIC_MINIMUM_DURATION_MS / CHECKLIST_LINES.length,
);

/** Independent of the checklist reveal pace — spec §7: rotate flavor text on a fixed ~2s interval. */
export const FLAVOR_ROTATION_INTERVAL_MS = 2000;
