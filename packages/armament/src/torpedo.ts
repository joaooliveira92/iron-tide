export const COMPILED_TORPEDO_VERSION = "compiled_torpedo_v1" as const;

export interface CompiledTorpedoSpeedSetting {
  readonly settingId: string;
  readonly speedMilliKnots: number;
  readonly rangeM: number;
}

export interface CompiledTorpedo {
  readonly partId: string;
  readonly revision: string;
  readonly diameterUm: number;
  readonly massKg: number;
  readonly warheadType: string;
  readonly warheadExplosiveMassKg: number;
  readonly warheadExplosiveEquivalentMassKg: number;
  readonly propulsionType: string;
  readonly speedSettings: readonly CompiledTorpedoSpeedSetting[];
  readonly minimumArmingDistanceM: number;
  readonly reliabilityBp: number;
  readonly guidanceCapability: string;
  readonly launchTypes: readonly string[];
  readonly technologyPrerequisiteIds: readonly string[];
  readonly tubeHitHazardPolicy: string;
  readonly oxygenWakeVisibilityModifierBp?: number;
}
