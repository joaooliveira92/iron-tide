import { SafeInt } from "@bluewave/contracts";
import type { AirDefenseSystemDefinition } from "./air-defense-system-definition.js";
import {
  DAMAGED_MULTIPLIER_BP,
  DESTROYED_MULTIPLIER_BP,
  LOCAL_CONTROL_MULTIPLIER_BP,
  OPERATIONAL_MULTIPLIER_BP,
} from "./constants.js";

export type SystemDamageStatus = "OPERATIONAL" | "DAMAGED" | "DESTROYED";

export function classifySystemDamage(damageBp: SafeInt): SystemDamageStatus {
  if (damageBp >= 10_000) return "DESTROYED";
  if (damageBp > 0) return "DAMAGED";
  return "OPERATIONAL";
}

export function damageMultiplierBp(status: SystemDamageStatus): SafeInt {
  if (status === "DESTROYED") return SafeInt(DESTROYED_MULTIPLIER_BP);
  if (status === "DAMAGED") return SafeInt(DAMAGED_MULTIPLIER_BP);
  return SafeInt(OPERATIONAL_MULTIPLIER_BP);
}

export function powerMultiplierBp(powerBp: SafeInt): SafeInt {
  return powerBp <= 0 ? SafeInt.ZERO : SafeInt(OPERATIONAL_MULTIPLIER_BP);
}

export function effectiveDamageMultiplierBp(damageBp: SafeInt, powerBp: SafeInt): SafeInt {
  const damage = damageMultiplierBp(classifySystemDamage(damageBp));
  const power = powerMultiplierBp(powerBp);
  return SafeInt.div(SafeInt.mul(damage, power), SafeInt(10_000), "floor");
}

export function localControlMultiplierBp(system: AirDefenseSystemDefinition): SafeInt {
  return system.localControlSupported
    ? SafeInt(LOCAL_CONTROL_MULTIPLIER_BP)
    : SafeInt(OPERATIONAL_MULTIPLIER_BP);
}
