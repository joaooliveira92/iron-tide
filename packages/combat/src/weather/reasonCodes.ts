// DESIGN-42 §30 subset relevant to the B-5 weather/visibility modules, kept
// separate from the top-level combat catalog (src/reasonCodes.ts) so the shared
// catalog's set-equality guard is not grown without review. Per spec §1.4 the
// in-slice weather codes are the §30 weather-only codes; the §30 smoke codes are
// deferred to M3/C-5 and recorded below, never shipped here.

// ---- §30 weather-only codes (INC-1) ----
export const WEATHER_PROFILE_INCOMPLETE = "WEATHER_PROFILE_INCOMPLETE" as const;
export const INVALID_BATTLE_WEATHER_INITIALIZATION =
  "INVALID_BATTLE_WEATHER_INITIALIZATION" as const;
export const WEATHER_VISIBILITY_FORMULA_MISSING = "WEATHER_VISIBILITY_FORMULA_MISSING" as const;
export const WEATHER_SMOKE_STATE_INVARIANT_FAILED = "WEATHER_SMOKE_STATE_INVARIANT_FAILED" as const;

// ---- Non-§30 in-slice markers (INC-1/INC-2, recorded in ADR-0022) ----
// AC-1/AC-4 construction-boundary + invariant-guard codes. Analogous to B-3's
// GUNNERY_ELIGIBILITY_PREDICATE_DEFERRED: they are not DESIGN-42 §30 codes but
// are required entry points, so the INC-6 set-equality test enumerates them as
// explicit non-§30 in-slice markers (never silent additions).
export const INVALID_STRATEGIC_WEATHER_STATE = "INVALID_STRATEGIC_WEATHER_STATE" as const;
export const INVALID_TACTICAL_WEATHER_STATE = "INVALID_TACTICAL_WEATHER_STATE" as const;
export const WEATHER_STATE_INVARIANT_FAILED = "WEATHER_STATE_INVARIANT_FAILED" as const;

// ---- Collected catalog (set-equality checked in INC-6) ----
export const WEATHER_REASON_CODES = {
  WEATHER_PROFILE_INCOMPLETE,
  INVALID_BATTLE_WEATHER_INITIALIZATION,
  WEATHER_VISIBILITY_FORMULA_MISSING,
  WEATHER_SMOKE_STATE_INVARIANT_FAILED,
  INVALID_STRATEGIC_WEATHER_STATE,
  INVALID_TACTICAL_WEATHER_STATE,
  WEATHER_STATE_INVARIANT_FAILED,
} as const;

// ---- Deferred §30 codes (recorded, not shipped — owned by M3/C-5 smoke track) ----
// INVALID_SMOKE_CLOUD
// SMOKE_LINE_INTERSECTION_FAILED
// SMOKESCREEN_SHIP_INELIGIBLE
// SMOKESCREEN_EQUIPMENT_UNAVAILABLE
// SMOKESCREEN_CONSUMABLE_UNAVAILABLE
// SMOKESCREEN_COOLDOWN_ACTIVE
// SMOKESCREEN_GENERATION_INTERRUPTED
// SMOKE_FLOAT_TECHNOLOGY_UNAVAILABLE
// SMOKE_FLOAT_CAPACITY_MISSING
// SMOKE_FLOAT_INVENTORY_EMPTY
// SMOKE_FLOAT_DEPLOYMENT_SPEED_EXCEEDED
// SMOKE_GENERATOR_TECHNOLOGY_UNAVAILABLE
// SMOKE_GENERATOR_CHARGES_EMPTY
// SMOKE_EQUIPMENT_MODE_CONFLICT
