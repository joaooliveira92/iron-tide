import type { Brand } from "@bluewave/contracts";

export type GunFamilyId = Brand<string, "ArmamentGunFamilyId">;
export type GunModelId = Brand<string, "ArmamentGunModelId">;
export type GunMountId = Brand<string, "ArmamentGunMountId">;
export type AmmunitionId = Brand<string, "ArmamentAmmunitionId">;
export type ArmamentTechnologyId = Brand<string, "ArmamentTechnologyId">;
export type ArmamentNationId = Brand<string, "ArmamentNationId">;

const ARMAMENT_ID_RE = /^[a-z][a-z0-9_]*$/;

export const isArmamentId = (value: string): boolean => ARMAMENT_ID_RE.test(value);

export const gunFamilyId = (value: string): GunFamilyId => value as GunFamilyId;
export const gunModelId = (value: string): GunModelId => value as GunModelId;
export const gunMountId = (value: string): GunMountId => value as GunMountId;
export const ammunitionId = (value: string): AmmunitionId => value as AmmunitionId;
export const armamentTechnologyId = (value: string): ArmamentTechnologyId =>
  value as ArmamentTechnologyId;
export const armamentNationId = (value: string): ArmamentNationId => value as ArmamentNationId;
