//packages/combat/src/mines/sweeping-eligibility.ts
// DESIGN-35 §6 minesweeping eligibility (INC-3). A ship generates sweeping
// value ONLY when all predicates pass:
//   - ship type is DD, KE, CL, AMC, TR converted as a minesweeper, or another
//     explicitly eligible type (the §7 shipped key vocabulary + the
//     OTHER_EXPLICITLY_ELIGIBLE category);
//   - mine-sweeping equipment is installed, operational, and compatible with
//     the swept mine type ("unknown" compatibility counts as ineligible);
//   - mission is MINE_WARFARE, or TRADE_PROTECTION with sweeping authorization;
//   - readiness is ACTIVE;
//   - damage is OPERATIONAL or DEGRADED;
//   - ship is located in the swept area or an explicitly connected approach;
//   - fuel, supply, crew, and ammunition-or-sweep-inventory pass;
//   - the ship is not working up, mobilizing, unavailable, interned, captured,
//     or in a major dockyard project; and
//   - a validated sweeping command or operational plan is active.
//
// minesweepingShipEligible NEVER throws on ineligibility: it returns a
// structured verdict (every predicate, first failing predicate, and a stable
// reason string) so the caller (INC-4 aggregation) can emit
// MINESWEEPING_SHIP_INELIGIBLE and MUST contribute zero. The reason is NOT
// itself a BluewaveError — it is an aggregate-level code the caller raises.
// The shipped type vocabulary reuses the §7 base-value keys as the ship-type
// currency (a ship NAME or class description never grants eligibility or base
// value — see sweeping-base-values.ts).
// Pure/deterministic: no I/O/clock/random.
import { type MineLayingDamageState } from "./laying.js";
import { SWEEPING_BASE_VALUE_KEYS } from "./sweeping-base-values.js";

// Closed §6 ship-type vocabulary: the seven §7 base-value keys (each is a
// shipped equipment-bearing combat type) + the explicit "another explicitly
// eligible type" bracket. Anything outside this vocabulary is ineligible.
export const MINESWEEPING_ELIGIBLE_SHIP_TYPES = [
  ...SWEEPING_BASE_VALUE_KEYS,
  "OTHER_EXPLICITLY_ELIGIBLE",
] as const;
export type MinesweepingShipType = (typeof MINESWEEPING_ELIGIBLE_SHIP_TYPES)[number];

// §6 readiness states: only ACTIVE passes. Any other state (working up,
// mobilizing, reserve, etc.) makes the ship ineligible — working up and
// mobilizing ARE these readiness states, not a separate predicate.
export const MINESWEEPING_READINESS_STATES = [
  "ACTIVE",
  "MOBILIZING",
  "WORKING_UP",
  "IN_RESERVE",
] as const;
export type MinesweepingShipReadiness = (typeof MINESWEEPING_READINESS_STATES)[number];

// §6 unavailable manifestations: interned, captured, or in a major dockyard
// project. (Working up / mobilizing are readiness states above.) An empty array
// is the "none" case.
export const MINESWEEPING_UNAVAILABLE_FLAGS = ["INTERNED", "CAPTURED", "MAJOR_DOCKYARD"] as const;
export type MinesweepingUnavailableFlag = (typeof MINESWEEPING_UNAVAILABLE_FLAGS)[number];

// §6 mission vocabulary: mine warfare, or trade protection WITH sweeping
// authorization. A trade-protection ship without sweeping authorization is
// ineligible.
export const MINESWEEPING_MISSIONS = ["MINE_WARFARE", "TRADE_PROTECTION"] as const;
export type MinesweepingMission = (typeof MINESWEEPING_MISSIONS)[number];

// AC-6 input surface: every §6 predicate input as an explicit typed field
// (never a giant primitive bag). Numeric/bp fields used downstream by §9 are
// not part of eligibility (that is the effective-value layer).
export interface MinesweepingShip {
  shipId: string;
  shipType: MinesweepingShipType;
  sweepEquipmentInstalled: boolean;
  sweepEquipmentOperational: boolean;
  /** true = compatible as declared; "unknown" = compatibility cannot be proven (§6 requires compatibility, so unknown is ineligible). */
  sweepEquipmentCompatibleWithMineType: boolean | "unknown";
  mission: MinesweepingMission;
  /** Required when mission is TRADE_PROTECTION; ignored otherwise. */
  sweepingAuthorization: boolean;
  readiness: MinesweepingShipReadiness;
  damage: MineLayingDamageState; // §6 requires OPERATIONAL or DEGRADED
  locatedInSweptAreaOrConnectedApproach: boolean;
  fuelSufficient: boolean;
  supplySufficient: boolean;
  crewSufficient: boolean;
  /** Ammunition OR sweep inventory must pass (§6 "ammunition or sweep inventory"). */
  ammunitionOrSweepInventorySufficient: boolean;
  /** Empty = none; any listed flag makes the ship unavailable (§6). */
  unavailableFlags: readonly MinesweepingUnavailableFlag[];
  validatedSweepingCommandOrPlanActive: boolean;
}

export type MinesweepingEligibilityPredicate =
  | "shipTypeEligible"
  | "equipmentInstalled"
  | "equipmentOperational"
  | "equipmentCompatible"
  | "missionAndSweepingAuthorization"
  | "readinessActive"
  | "damageOperationalOrDegraded"
  | "locatedInSweptAreaOrConnectedApproach"
  | "fuelSupplyCrewAmmunitionSufficient"
  | "notUnavailable"
  | "validatedSweepingCommandOrPlanActive";

// Stable reason string per failing predicate. Mine the exact text used by the
// tests and by INC-4's structured diagnostic (reason is NOT a thrown error).
export const MINESWEEPING_INELIGIBILITY_REASONS: Readonly<
  Record<MinesweepingEligibilityPredicate, string>
> = {
  shipTypeEligible:
    "ship type is not in the eligible minesweeping ship-type set (§6) — the type must be a §7 shipped key or an explicitly eligible type, never a name/class description",
  equipmentInstalled: "mine-sweeping equipment is not installed (§6)",
  equipmentOperational: "mine-sweeping equipment is not operational (§6)",
  equipmentCompatible:
    "mine-sweeping equipment is not compatible with the mined water (unknown compatibility is ineligible) (§6)",
  missionAndSweepingAuthorization:
    "mission is not MINE_WARFARE, or TRADE_PROTECTION without sweeping authorization (§6)",
  readinessActive: "ship readiness is not ACTIVE (§6)",
  damageOperationalOrDegraded: "damage state is below OPERATIONAL/DEGRADED (§6)",
  locatedInSweptAreaOrConnectedApproach:
    "ship is not located in the swept area or an explicitly connected approach (§6)",
  fuelSupplyCrewAmmunitionSufficient:
    "fuel, supply, crew, or ammunition/sweep-inventory is insufficient (§6)",
  notUnavailable: "ship is unavailable, interned, captured, or in a major dockyard project (§6)",
  validatedSweepingCommandOrPlanActive:
    "no validated sweeping command or operational plan is active (§6)",
};

// Structured six-result verdict: per-predicate booleans in §6 order + the
// first failing predicate. Mirrors the launch-eligibility verdict shape of the
// torpedo module (shape reference only — no import from torpedoes).
export interface MinesweepingEligibilityVerdict {
  predicateResults: Record<MinesweepingEligibilityPredicate, boolean>;
  failingPredicate: MinesweepingEligibilityPredicate | null;
}

export type MinesweepingEligibilityResult =
  | { eligible: true; ship: MinesweepingShip; verdict: MinesweepingEligibilityVerdict }
  | { eligible: false; reason: string; verdict: MinesweepingEligibilityVerdict };

function inEligibleShipTypes(t: unknown): t is MinesweepingShipType {
  return (MINESWEEPING_ELIGIBLE_SHIP_TYPES as readonly string[]).includes(t as string);
}

// AC-6: full §6 predicate evaluation. Order follows §6's list; the first
// failing predicate becomes `failingPredicate` and its stable reason is
// returned. NEVER throws on ineligibility — every failing shape report down to
// a structured reason, so a caller can gather multiple ineligible ships and
// emit MINESWEEPING_SHIP_INELIGIBLE for the aggregate. An ineligible ship
// contributes ZERO sweeping value (the INC-4 aggregation must not add it —
// `shipContributesZeroSweeping` below pins that contract).
export function minesweepingShipEligible(ship: MinesweepingShip): MinesweepingEligibilityResult {
  const predicateResults = {} as Record<MinesweepingEligibilityPredicate, boolean>;
  let failingPredicate: MinesweepingEligibilityPredicate | null = null;

  const check = (name: MinesweepingEligibilityPredicate, passes: boolean): void => {
    predicateResults[name] = passes;
    if (!passes && failingPredicate === null) failingPredicate = name;
  };

  // §6 item 1 — ship type in the eligible set.
  check("shipTypeEligible", inEligibleShipTypes(ship.shipType));
  // §6 item 1 — ... equipment installed.
  check("equipmentInstalled", ship.sweepEquipmentInstalled === true);
  // §6 item 3 — ... operational.
  check("equipmentOperational", ship.sweepEquipmentOperational === true);
  // §6 item 3 — ... compatible (unknown never passes).
  check("equipmentCompatible", ship.sweepEquipmentCompatibleWithMineType === true);
  // §6 item 3 — mission MINE_WARFARE or TRADE_PROTECTION with sweeping auth...
  check(
    "missionAndSweepingAuthorization",
    ship.mission === "MINE_WARFARE" ||
      (ship.mission === "TRADE_PROTECTION" && ship.sweepingAuthorization === true),
  );
  // §6 item 4 — readiness ACTIVE.
  check("readinessActive", ship.readiness === "ACTIVE");
  // §6 item 5 — damage OPERATIONAL or DEGRADED.
  check("damageOperationalOrDegraded", ship.damage === "OPERATIONAL" || ship.damage === "DEGRADED");
  // §6 item 6 — location in swept area or connected approach.
  check(
    "locatedInSweptAreaOrConnectedApproach",
    ship.locatedInSweptAreaOrConnectedApproach === true,
  );
  // §6 item 7 — fuel, supply, crew, ammunition/sweep inventory pass.
  check(
    "fuelSupplyCrewAmmunitionSufficient",
    ship.fuelSufficient === true &&
      ship.supplySufficient === true &&
      ship.crewSufficient === true &&
      ship.ammunitionOrSweepInventorySufficient === true,
  );
  // §6 item 8 — not unavailable (interned/captured/major dockyard; working up
  // and mobilizing are already failed by readiness). Array.isArray keeps the
  // never-throw contract even for a shape-tampered ship (a missing field must
  // yield an ineligibility verdict, not a raw TypeError).
  check(
    "notUnavailable",
    Array.isArray(ship.unavailableFlags) && ship.unavailableFlags.length === 0,
  );
  // §6 item 9 — validated sweeping command/plan active.
  check("validatedSweepingCommandOrPlanActive", ship.validatedSweepingCommandOrPlanActive === true);

  const verdict: MinesweepingEligibilityVerdict = { predicateResults, failingPredicate };
  if (failingPredicate === null) return { eligible: true, ship, verdict };
  return { eligible: false, reason: MINESWEEPING_INELIGIBILITY_REASONS[failingPredicate], verdict };
}

// §6/§7: an ineligible ship contributes ZERO sweeping value. This is the seam
// INC-4 checks before summing; it never fabricates a value for a failed
// predicate. (The §9 effective-value layer is only entered for eligible ships.)
export const INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION = 0 as const;

// Convenience: canonical §6-eligible ship-type vocabulary (closed set) for
// callers iterating eligibility across types.
export const CANONICAL_MINED_WATER_SHIP_TYPES: readonly MinesweepingShipType[] =
  MINESWEEPING_ELIGIBLE_SHIP_TYPES;
