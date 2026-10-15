/**
 * Branded identifiers for the armament domain (ADR-0002/ADR-0093). The brands are compile-time
 * only: every constructor is a pure cast, and the resolver re-validates the canonical lower
 * snake_case shape at runtime so malformed content produces a structured finding rather than a
 * throw (expected-error policy, ADR-0093).
 */
import type { Brand } from "@bluewave/contracts";

export type GunFamilyId = Brand<string, "ArmamentGunFamilyId">;
export type GunModelId = Brand<string, "ArmamentGunModelId">;
export type GunMountId = Brand<string, "ArmamentGunMountId">;
export type AmmunitionId = Brand<string, "ArmamentAmmunitionId">;
export type ArmamentTechnologyId = Brand<string, "ArmamentTechnologyId">;
export type ArmamentNationId = Brand<string, "ArmamentNationId">;

/** Canonical stable-id shape shared by every authored content id (components.yaml, naval-profiles/). */
const ARMAMENT_ID_RE = /^[a-z][a-z0-9_]*$/;

export const isArmamentId = (value: string): boolean => ARMAMENT_ID_RE.test(value);

export const gunFamilyId = (value: string): GunFamilyId => value as GunFamilyId;
export const gunModelId = (value: string): GunModelId => value as GunModelId;
export const gunMountId = (value: string): GunMountId => value as GunMountId;
export const ammunitionId = (value: string): AmmunitionId => value as AmmunitionId;
export const armamentTechnologyId = (value: string): ArmamentTechnologyId =>
  value as ArmamentTechnologyId;
export const armamentNationId = (value: string): ArmamentNationId => value as ArmamentNationId;
