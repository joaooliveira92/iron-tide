//packages/combat/src/submarines/reasonCodes.ts
// DESIGN-34 §27 subset relevant to the submarine module, kept separate from the
// top-level combat catalog (src/reasonCodes.ts) so the C-3 set-equality guard
// (reason-codes-submarines.test.ts, INC-8 deliverable, per ticket 05) is not
// grown without review. Per spec §1.4, DESIGN-34 §27 is authoritative: all 14
// §27 codes are in-slice for this sprint, plus the documented in-slice NON-§27
// marker SUBMARINE_RESOLUTION_DEFERRED (mirrors C-1's
// TORPEDO_ELIGIBILITY_PREDICATE_DEFERRED / C-2's MINE_STRIKE_RESOLUTION_DEFERRED
// precedent — a local marker a later increment fires if any caller reaches a
// would-be-deferred battle/ASW/friendly-fire boundary in this slice's functions).
//
// The FULL shipped catalog is therefore 15 codes: 14 DESIGN-34 §27 codes +
// SUBMARINE_RESOLUTION_DEFERRED (documented in-slice marker, NOT a §27 code).
//
// INC-1 ships the module plus INVALID_SUBMARINE_REPRESENTATION, the one code it
// exercises (§1: missing/mixed strategic representation fail-closes here).
// INC-2 ships SUBMARINE_MISSION_INELIGIBLE + SUBMARINE_RELIABILITY_INSUFFICIENT
// (its §6/§7 boundaries). INC-3 ships COASTAL_SUBMARINE_RANGE_RESTRICTED +
// LONG_RANGE_ASW_VULNERABILITY_MISSING (its §12/§10 boundaries). INC-4+
// exercise the remaining codes as their slices land. No code is fired before its
// owning increment is built; the module header documents the partition and
// INC-8's set-equality test locks the shipped set (AC-18).

// ---- In-slice code (INC-1): strategic representation, DESIGN-34 §1 ----
// §1: every strategic asset declares exactly one canonical representation
// (PERSISTENT_UNIT / TYPED_FLOTILLA_POOL); a missing or mixed representation
// (and, along the same §1 boundary, a persistent unit whose quantity is not
// exactly 1) fails closed with this code — never a silent default.
export const INVALID_SUBMARINE_REPRESENTATION = "INVALID_SUBMARINE_REPRESENTATION" as const;

// ---- In-slice codes (later increments own the fires; definitions ship now) ----
// §2: one asset MUST NOT appear in more than one unresolved battle (predicate
// surface ships; battle-manifest enforcement deferred per ticket 03).
export const SUBMARINE_ASSET_DOUBLE_ALLOCATED = "SUBMARINE_ASSET_DOUBLE_ALLOCATED" as const;
// §3: a tactical result without valid provenance (loss application deferred).
export const SUBMARINE_PROVENANCE_INVALID = "SUBMARINE_PROVENANCE_INVALID" as const;
// §6: mission-eligibility violation (INC-2 / AC-4 exercises it).
export const SUBMARINE_MISSION_INELIGIBLE = "SUBMARINE_MISSION_INELIGIBLE" as const;
// §12: unsupported coastal movement/raiding (INC-4 / AC-10).
export const COASTAL_SUBMARINE_RANGE_RESTRICTED = "COASTAL_SUBMARINE_RANGE_RESTRICTED" as const;
// §10: missing long-range ASW vulnerability (INC-3 / AC-8).
export const LONG_RANGE_ASW_VULNERABILITY_MISSING = "LONG_RANGE_ASW_VULNERABILITY_MISSING" as const;
// §7: reliability below 20 prohibits offensive deployment (INC-2 / AC-5).
export const SUBMARINE_RELIABILITY_INSUFFICIENT = "SUBMARINE_RELIABILITY_INSUFFICIENT" as const;
// §6: fuel insufficient for a mission. INC-2's eligibility predicate validates
// fuel (firing SUBMARINE_MISSION_INELIGIBLE); the dedicated fuel-code FIRE is
// deferred to the later mission/fuel slice (recorded, not dropped).
export const SUBMARINE_FUEL_INSUFFICIENT = "SUBMARINE_FUEL_INSUFFICIENT" as const;
// §19: a strategic attack-opportunity is CREATED (INC-6 / AC-14, value-only).
export const SUBMARINE_ATTACK_OPPORTUNITY_CREATED = "SUBMARINE_ATTACK_OPPORTUNITY_CREATED" as const;
// §20: submarine mine inventory insufficient for laying (INC-7 / AC-15).
export const SUBMARINE_MINE_INVENTORY_INSUFFICIENT =
  "SUBMARINE_MINE_INVENTORY_INSUFFICIENT" as const;
// §22: an ASW contact is RESOLVED (value/predicate surface; application deferred).
export const SUBMARINE_ASW_CONTACT_RESOLVED = "SUBMARINE_ASW_CONTACT_RESOLVED" as const;
// §23–24: a friendly-fire incident (value-only surface; outcomes deferred).
export const SUBMARINE_FRIENDLY_FIRE_INCIDENT = "SUBMARINE_FRIENDLY_FIRE_INCIDENT" as const;
// §17: sea state 8–9 operation prohibited (INC-5 / AC-12).
export const SUBMARINE_SEA_STATE_OPERATION_PROHIBITED =
  "SUBMARINE_SEA_STATE_OPERATION_PROHIBITED" as const;
// §28/state: fail-closed invariant carrier (INC-8 formalizes ambient use).
export const SUBMARINE_STATE_INVARIANT_FAILED = "SUBMARINE_STATE_INVARIANT_FAILED" as const;

// ---- In-slice marker (NOT a §27 code) ----
// SUBMARINE_RESOLUTION_DEFERRED is a LOCAL marker (mirroring the B-3/C-1/C-2
// "eligibility predicate deferred" precedent) that a later increment fires if any
// caller reaches a would-be-deferred battle/ASW/friendly-fire boundary in a
// slice that ships no resolution machinery. INC-1 ships the marker into the
// catalog but does NOT fire it (no such boundary is reached this increment).
export const SUBMARINE_RESOLUTION_DEFERRED = "SUBMARINE_RESOLUTION_DEFERRED" as const;

// ---- Collected catalog (INC-1..INC-8 shipped set; set-equality checked in
// INC-8's reason-codes-submarines.test.ts, AC-18) ----
export const SUBMARINE_REASON_CODES = {
  INVALID_SUBMARINE_REPRESENTATION,
  SUBMARINE_ASSET_DOUBLE_ALLOCATED,
  SUBMARINE_PROVENANCE_INVALID,
  SUBMARINE_MISSION_INELIGIBLE,
  COASTAL_SUBMARINE_RANGE_RESTRICTED,
  LONG_RANGE_ASW_VULNERABILITY_MISSING,
  SUBMARINE_RELIABILITY_INSUFFICIENT,
  SUBMARINE_FUEL_INSUFFICIENT,
  SUBMARINE_ATTACK_OPPORTUNITY_CREATED,
  SUBMARINE_MINE_INVENTORY_INSUFFICIENT,
  SUBMARINE_ASW_CONTACT_RESOLVED,
  SUBMARINE_FRIENDLY_FIRE_INCIDENT,
  SUBMARINE_SEA_STATE_OPERATION_PROHIBITED,
  SUBMARINE_STATE_INVARIANT_FAILED,
  SUBMARINE_RESOLUTION_DEFERRED,
} as const;

export type SubmarineReasonCode =
  (typeof SUBMARINE_REASON_CODES)[keyof typeof SUBMARINE_REASON_CODES];

// ---- Reused existing combat-catalog codes (no new record needed) ----
// None referenced by this sprint; later increments may reuse existing damage/
// tactical catalog codes per their own scoping.
