// D-4 M4 Aviation: Air Defense — AC-14 simplified system-level damage/power per DESIGN-45 §21.
// The full independent damage model (weapon/director/radar/power/feed/stabilization, §21
// lines 350-359) is deferred (spec §1.3). This slice ships the simplified system-level
// model (spec §1.1 item 16): one damage status per system (OPERATIONAL/DAMAGED/DESTROYED)
// derived from cumulative `damageBp`, one power multiplier from `powerBp`, and the single
// "damage" formula term = floor(damageMultiplier × powerMultiplier / 10_000). Local control
// (§21 line 361-363) is a shipped 5_000 bp multiplier applied only when the system
// definition supports it; wiring the director-unavailable fallback into the engagement path
// is the caller's choice (INC-6) — this module provides the multiplier. Pure/deterministic;
// no state mutation.

import { SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import {
  DAMAGED_MULTIPLIER_BP,
  DESTROYED_MULTIPLIER_BP,
  LOCAL_CONTROL_MULTIPLIER_BP,
  OPERATIONAL_MULTIPLIER_BP,
} from "./constants.js";

/** Simplified §21 system-level damage status. */
export type SystemDamageStatus = "OPERATIONAL" | "DAMAGED" | "DESTROYED";

/**
 * Classifies cumulative damage basis points into the simplified §21 status:
 * DESTROYED when damageBp >= 10_000, DAMAGED when damageBp > 0, else OPERATIONAL
 * (documented simplified thresholds; a system at full 10_000 bp of damage is destroyed).
 */
export function classifySystemDamage(damageBp: SafeInt): SystemDamageStatus {
  if (damageBp >= 10_000) return "DESTROYED";
  if (damageBp > 0) return "DAMAGED";
  return "OPERATIONAL";
}

/** §21 simplified multiplier for a system damage status. */
export function damageMultiplierBp(status: SystemDamageStatus): SafeInt {
  if (status === "DESTROYED") return SafeInt(DESTROYED_MULTIPLIER_BP);
  if (status === "DAMAGED") return SafeInt(DAMAGED_MULTIPLIER_BP);
  return SafeInt(OPERATIONAL_MULTIPLIER_BP);
}

/**
 * §21 simplified power multiplier: 0 when powerBp <= 0 (unpowered system contributes
 * zero, §15 line 266), else 10_000. Power is folded into the formula's single "damage"
 * term (see effectiveDamageMultiplierBp).
 */
export function powerMultiplierBp(powerBp: SafeInt): SafeInt {
  return powerBp <= 0 ? SafeInt.ZERO : SafeInt(OPERATIONAL_MULTIPLIER_BP);
}

/**
 * The single "damage" factor for the §19 engagement formula:
 * floor(damageMultiplier × powerMultiplier / 10_000), one floor.
 * All operand values are in {0, 5_000, 10_000}, so the product is a safe integer
 * (<= 10^8) and the floor is exact.
 */
export function effectiveDamageMultiplierBp(damageBp: SafeInt, powerBp: SafeInt): SafeInt {
  const damage = damageMultiplierBp(classifySystemDamage(damageBp));
  const power = powerMultiplierBp(powerBp);
  return SafeInt.div(SafeInt.mul(damage, power), SafeInt(10_000), "floor");
}

/**
 * §21 local-control multiplier: 5_000 when the system definition supports local control,
 * else the neutral 10_000 (no local control → no change to the formula). The shipped
 * value is LOCAL_CONTROL_MULTIPLIER_BP = 5_000 (§21 line 363).
 */
export function localControlMultiplierBp(system: AirDefenseSystemDefinition): SafeInt {
  return system.localControlSupported
    ? SafeInt(LOCAL_CONTROL_MULTIPLIER_BP)
    : SafeInt(OPERATIONAL_MULTIPLIER_BP);
}
