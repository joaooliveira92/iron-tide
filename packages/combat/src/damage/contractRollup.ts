//packages/combat/src/damage/contractRollup.ts
// INC-6: Full contract rollup for damage_v1 + armor_v1.
// Exports a single frozen object and a combined validation function
// that proves both shipped contracts pass their own validate guards.
import { SHIPPED_DAMAGE_CONTRACT, validateDamageContract } from "./constants.js";
import { SHIPPED_ARMOR_CONTRACT, validateArmorContract } from "./armorModel.js";

export const DAMAGE_V1_CONTRACTS = {
  damage: SHIPPED_DAMAGE_CONTRACT,
  armor: SHIPPED_ARMOR_CONTRACT,
} as const;

export function validateAllDamageContracts(): void {
  validateDamageContract(DAMAGE_V1_CONTRACTS.damage);
  validateArmorContract(DAMAGE_V1_CONTRACTS.armor);
}
