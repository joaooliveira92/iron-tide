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
