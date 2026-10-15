// B-6 INC-2 in-slice reason codes for the battle auto-resolution orchestrator
// (DESIGN-38 §33/§36/§37). Kept separate from the top-level combat catalog
// (src/reasonCodes.ts) so the shared catalog's set-equality guard is not grown
// without review; the set-equality guard lives in
// test/reason-codes-battle-resolution.test.ts (mirrors reason-codes-gunnery /
// reason-codes-damage / reason-codes-weather).
//
// - `BATTLE_AUTO_RESOLUTION_FAILED` — the auto-resolution run itself cannot
//   produce a result for a valid manifest + committed campaign assets (stable
//   diagnostic, never a partial result).
// - `BATTLE_VIABILITY_EVALUATION_FAILED` — the side-viability predicate /
//   battle-end evaluation could not be formed from the projected state.
// `AUTO_RESOLUTION_UNAVAILABLE` (DESIGN-38 §36) is a shared-catalog code and is
// defined once in src/reasonCodes.ts, NOT here (reuse policy).

export const BATTLE_AUTO_RESOLUTION_FAILED = "BATTLE_AUTO_RESOLUTION_FAILED" as const;
export const BATTLE_VIABILITY_EVALUATION_FAILED = "BATTLE_VIABILITY_EVALUATION_FAILED" as const;

// ---- Collected catalog (set-equality checked in reason-codes-battle-resolution.test.ts) ----
export const BATTLE_RESOLUTION_REASON_CODES = {
  BATTLE_AUTO_RESOLUTION_FAILED,
  BATTLE_VIABILITY_EVALUATION_FAILED,
} as const;
