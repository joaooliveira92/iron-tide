// D-4 M4 Aviation: Air Defense — INC-5 full reason-code rollup (DESIGN-45 §28).
// Shipped codes: EXACTLY 20 (sets, not supersets). Deferred markers: 6 (SAM). Boundary: 1.
//
// RESOLUTION (INC-5, reconciles ADR-0042 decision 3 "presence-of-20"): the shipped set is
// EXACTLY the twenty §28 codes — every code the document lists, no invented extras. The two
// INC-1 boundary codes (INVALID_AIR_DEFENSE_STATE, INVALID_AIR_DEFENSE_SYSTEM_DEFINITION)
// are §28 members defined in ./constants.js and imported here for the rollup (NOT re-exported
// — the barrel re-exports ./constants.js). INVALID_AIR_DEFENSE_ATTACK (§4 boundary) is a
// documented boundary/superset code used by attack.ts and is EXCLUDED from the shipped-20.
// AIR_DEFENSE_INVARIANT_FAILED is the canonical §28 record-integrity / invariant boundary
// (§26 records, §28 last code).

import { INVALID_AIR_DEFENSE_STATE, INVALID_AIR_DEFENSE_SYSTEM_DEFINITION } from "./constants.js";

// ---- §28 shipped reason codes (20) ----

export const AIR_DEFENSE_TARGET_INELIGIBLE = "AIR_DEFENSE_TARGET_INELIGIBLE" as const;
export const AIR_DEFENSE_CHANNEL_UNAVAILABLE = "AIR_DEFENSE_CHANNEL_UNAVAILABLE" as const;
export const AIR_DEFENSE_DIRECTOR_UNAVAILABLE = "AIR_DEFENSE_DIRECTOR_UNAVAILABLE" as const;
export const AIR_DEFENSE_RADAR_UNAVAILABLE = "AIR_DEFENSE_RADAR_UNAVAILABLE" as const;
export const AIR_DEFENSE_AMMUNITION_UNAVAILABLE = "AIR_DEFENSE_AMMUNITION_UNAVAILABLE" as const;
export const HEAVY_AA_PROTECTED_RADIUS_EXCEEDED = "HEAVY_AA_PROTECTED_RADIUS_EXCEEDED" as const;
export const MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED = "MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED" as const;

// ---- §9/§29.8-9 guaranteed light-AA disruption opportunity (INC-5, AC-7) ----
// Emitted when an eligible light-AA system receives its guaranteed one-authoritative-substep
// disruption check. The opportunity is guaranteed; ammunition, hit, damage, and abort are NOT
// (§29.9) — the disruption draw happens at attack resolution (INC-6).
export const LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED =
  "LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED" as const;

// ---- INC-3 invariant code ----
// DESIGN-45 §28 canonical code: an air-defense invariant violation fails with this code.
// Used by disruption.ts (§6 stacking guards) and records.ts (§26 record-integrity guard).
export const AIR_DEFENSE_INVARIANT_FAILED = "AIR_DEFENSE_INVARIANT_FAILED" as const;

// ---- INC-4 director/radar/CIWS scaling markers (DESIGN-45 §28) ----
// Emitted by director-scaling.ts (§12 cap), radar-saturation.ts (§14 diminishing returns /
// redundant groups), and ciws-redundancy.ts (§16 diminishing returns / strong redundancy).
export const AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED =
  "AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED" as const;
export const RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE =
  "RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE" as const;
export const RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE =
  "RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE" as const;
export const CIWS_DIMINISHING_RETURNS_ACTIVE = "CIWS_DIMINISHING_RETURNS_ACTIVE" as const;
export const CIWS_STRONG_REDUNDANCY_ACTIVE = "CIWS_STRONG_REDUNDANCY_ACTIVE" as const;

// ---- CAP/SAM-track §28 codes (CAP-track delivery; SAM deferred below) ----
// §28 requires CAP_INTERCEPTION_INELIGIBLE and CAP_EXHAUSTED (CAP eligibility boundaries)
// and AIR_ATTACK_DISRUPTED / AIR_ATTACK_ABORTED (final attack-resolution outcomes). They are
// shipped identifiers; the CAP engine and final attack resolution consume them in their
// owning tickets (INC-5 provides the canonical catalog + records that carry them).
export const CAP_INTERCEPTION_INELIGIBLE = "CAP_INTERCEPTION_INELIGIBLE" as const;
export const CAP_EXHAUSTED = "CAP_EXHAUSTED" as const;
export const AIR_ATTACK_DISRUPTED = "AIR_ATTACK_DISRUPTED" as const;
export const AIR_ATTACK_ABORTED = "AIR_ATTACK_ABORTED" as const;

// ---- Boundary code (outside the shipped 20) ----
// Strict AirDefenseAttack validation failures use this code (DESIGN-45 §4). Documented
// boundary/superset code: reported by attack.ts, never counted in the §28 shipped set.
export const INVALID_AIR_DEFENSE_ATTACK = "INVALID_AIR_DEFENSE_ATTACK" as const;

// ---- Deferred SAM markers (6, verbatim per ticket 05) ----
// E-track placeholders: the three SAM layers are deferred; these markers reserve the
// engagement/eligibility boundaries so later SAM tickets keep the shipped set exactly 20.
export const HEAVY_SAM_ENGAGEMENT_DEFERRED = "HEAVY_SAM_ENGAGEMENT_DEFERRED" as const;
export const HEAVY_SAM_ELIGIBILITY_DEFERRED = "HEAVY_SAM_ELIGIBILITY_DEFERRED" as const;
export const MEDIUM_SAM_ENGAGEMENT_DEFERRED = "MEDIUM_SAM_ENGAGEMENT_DEFERRED" as const;
export const MEDIUM_SAM_ELIGIBILITY_DEFERRED = "MEDIUM_SAM_ELIGIBILITY_DEFERRED" as const;
export const LIGHT_SAM_ENGAGEMENT_DEFERRED = "LIGHT_SAM_ENGAGEMENT_DEFERRED" as const;
export const LIGHT_SAM_ELIGIBILITY_DEFERRED = "LIGHT_SAM_ELIGIBILITY_DEFERRED" as const;

// ---- Versioned rollup (INC-5, AC-16) ----

/** Version of the canonical §28 reason-code catalog (contract id + content version). */
export const AIR_DEFENSE_REASON_CODES_VERSION = "air_defense_reason_codes_v1" as const;

/**
 * The 20 shipped §28 codes in exact §28 document order. This is the SINGLE authoritative
 * ordered catalog — the reason-code contract tuple and the set-equality guard derive from
 * it, so the shipped count can never drift from 20 without a compile-level change here.
 */
export const AIR_DEFENSE_SHIPPED_REASON_CODE_LIST = [
  INVALID_AIR_DEFENSE_STATE,
  INVALID_AIR_DEFENSE_SYSTEM_DEFINITION,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AIR_DEFENSE_RADAR_UNAVAILABLE,
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  HEAVY_AA_PROTECTED_RADIUS_EXCEEDED,
  MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
  AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED,
  RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE,
  RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE,
  CIWS_DIMINISHING_RETURNS_ACTIVE,
  CIWS_STRONG_REDUNDANCY_ACTIVE,
  CAP_INTERCEPTION_INELIGIBLE,
  CAP_EXHAUSTED,
  AIR_ATTACK_DISRUPTED,
  AIR_ATTACK_ABORTED,
  AIR_DEFENSE_INVARIANT_FAILED,
] as const;

/** Union of exactly the 20 shipped §28 reason codes. */
export type AirDefenseReasonCode = (typeof AIR_DEFENSE_SHIPPED_REASON_CODE_LIST)[number];

/** All 20 shipped §28 codes as keyed constants (Object.values order == §28 document order). */
export const AIR_DEFENSE_REASON_CODES_SHIPPED = {
  INVALID_AIR_DEFENSE_STATE,
  INVALID_AIR_DEFENSE_SYSTEM_DEFINITION,
  AIR_DEFENSE_TARGET_INELIGIBLE,
  AIR_DEFENSE_CHANNEL_UNAVAILABLE,
  AIR_DEFENSE_DIRECTOR_UNAVAILABLE,
  AIR_DEFENSE_RADAR_UNAVAILABLE,
  AIR_DEFENSE_AMMUNITION_UNAVAILABLE,
  HEAVY_AA_PROTECTED_RADIUS_EXCEEDED,
  MEDIUM_AA_PRE_RELEASE_WINDOW_MISSED,
  LIGHT_AA_DISRUPTION_OPPORTUNITY_CREATED,
  AA_DIRECTOR_NORMAL_SCALING_CAP_REACHED,
  RADAR_MEDIUM_AA_DIMINISHING_RETURNS_ACTIVE,
  RADAR_MEDIUM_AA_REDUNDANT_GROUP_ACTIVE,
  CIWS_DIMINISHING_RETURNS_ACTIVE,
  CIWS_STRONG_REDUNDANCY_ACTIVE,
  CAP_INTERCEPTION_INELIGIBLE,
  CAP_EXHAUSTED,
  AIR_ATTACK_DISRUPTED,
  AIR_ATTACK_ABORTED,
  AIR_DEFENSE_INVARIANT_FAILED,
} as const;

/** The 6 SAM deferred markers (verbatim), reserved for the E-track SAM tickets. */
export const AIR_DEFENSE_REASON_CODES_DEFERRED = {
  HEAVY_SAM_ENGAGEMENT_DEFERRED,
  HEAVY_SAM_ELIGIBILITY_DEFERRED,
  MEDIUM_SAM_ENGAGEMENT_DEFERRED,
  MEDIUM_SAM_ELIGIBILITY_DEFERRED,
  LIGHT_SAM_ENGAGEMENT_DEFERRED,
  LIGHT_SAM_ELIGIBILITY_DEFERRED,
} as const;

/** Boundary/superset codes — intentionally OUTSIDE the shipped-20 set. */
export const AIR_DEFENSE_REASON_CODES_BOUNDARY = {
  INVALID_AIR_DEFENSE_ATTACK,
} as const;

/** Set-equality guard: exactly the 20 shipped codes, derivable from the ordered list. */
export const AIR_DEFENSE_REASON_CODE_SET: ReadonlySet<string> = new Set<string>(
  AIR_DEFENSE_SHIPPED_REASON_CODE_LIST,
);
