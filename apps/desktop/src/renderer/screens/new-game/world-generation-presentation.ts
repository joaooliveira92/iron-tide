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

export const COSMETIC_MINIMUM_DURATION_MS = 2700;

export const CHECKLIST_REVEAL_INTERVAL_MS = Math.round(
  COSMETIC_MINIMUM_DURATION_MS / CHECKLIST_LINES.length,
);

export const FLAVOR_ROTATION_INTERVAL_MS = 2000;
