import {
  type ComponentAccessStatus,
  type NationNavalProfile,
  resolveConstructionModifiers,
} from "./nationProfile.js";
import { designInvariant } from "./errors.js";

const BP = 10_000;
const mulBp = (v: number, bp: number): number => Math.ceil((v * bp) / BP);

export interface ComponentAccessPolicy {
  readonly wartime: boolean;
  readonly alignment: "SELF" | "FRIENDLY" | "NEUTRAL" | "HOSTILE";
}

export const DEFAULT_ACCESS_POLICY: ComponentAccessPolicy = {
  wartime: false,
  alignment: "NEUTRAL",
};

export interface AccessEffect {
  readonly available: boolean;
  readonly costMultiplierBp: number;
  readonly deliveryMultiplierBp: number;
  readonly reliabilityDeltaBp: number;
  readonly wartimeSensitive: boolean;
  readonly refitEligible: boolean;
}

export const ACCESS_EFFECTS: Readonly<Record<ComponentAccessStatus, AccessEffect>> = {
  DOMESTIC: {
    available: true,
    costMultiplierBp: BP,
    deliveryMultiplierBp: BP,
    reliabilityDeltaBp: 0,
    wartimeSensitive: false,
    refitEligible: true,
  },
  LICENSE_BUILT: {
    available: true,
    costMultiplierBp: 10_600,
    deliveryMultiplierBp: 10_300,
    reliabilityDeltaBp: -200,
    wartimeSensitive: true,
    refitEligible: true,
  },
  IMPORTED: {
    available: true,
    costMultiplierBp: 11_500,
    deliveryMultiplierBp: 11_000,
    reliabilityDeltaBp: -300,
    wartimeSensitive: true,
    refitEligible: true,
  },
  CAPTURED_OR_STUDIED: {
    available: true,
    costMultiplierBp: 10_800,
    deliveryMultiplierBp: 10_500,
    reliabilityDeltaBp: -500,
    wartimeSensitive: false,
    refitEligible: false,
  },
  UNAVAILABLE: {
    available: false,
    costMultiplierBp: BP,
    deliveryMultiplierBp: BP,
    reliabilityDeltaBp: 0,
    wartimeSensitive: false,
    refitEligible: false,
  },
};

export function accessEffect(
  status: ComponentAccessStatus,
  policy: ComponentAccessPolicy = DEFAULT_ACCESS_POLICY,
): AccessEffect {
  const base = ACCESS_EFFECTS[status];
  if (!base.available) return base;
  if (!base.wartimeSensitive || !policy.wartime) return base;
  if (policy.alignment === "HOSTILE" || policy.alignment === "NEUTRAL") {
    return { ...base, available: false, refitEligible: false };
  }
  return {
    ...base,
    costMultiplierBp: base.costMultiplierBp + 1500,
    deliveryMultiplierBp: base.deliveryMultiplierBp + 2000,
  };
}

export interface NationalConstructionModifiers {
  readonly nationId: string;
  readonly costMultiplierBp: number;
  readonly buildTimeMultiplierBp: number;
  readonly machineryReliabilityBp: number;
  readonly constructionQualityVarianceBp: number;
  readonly maxPracticalDisplacementKg: number;
  readonly access: {
    readonly heavyGun: ComponentAccessStatus;
    readonly armourPlate: ComponentAccessStatus;
  };
  readonly costBreakdown: readonly { readonly label: string; readonly costMultiplierBp: number }[];
}

export const MODIFIER_SAFE_MIN_BP = 5_000;
export const MODIFIER_SAFE_MAX_BP = 20_000;

export function resolveNationalConstruction(
  profile: NationNavalProfile,
  month: string,
  policy: ComponentAccessPolicy = DEFAULT_ACCESS_POLICY,
): NationalConstructionModifiers {
  const industrial = resolveConstructionModifiers(profile, month);
  const gun = accessEffect(profile.industrialProfile.heavyGunProduction, policy);
  const armour = accessEffect(profile.industrialProfile.armourPlateProduction, policy);
  if (!gun.available || !armour.available)
    throw designInvariant(
      `national construction: ${profile.nationId} cannot obtain its main armament or armour plate under this policy`,
    );
  const accessCostBp = Math.ceil((gun.costMultiplierBp * armour.costMultiplierBp) / BP);
  const costMultiplierBp = Math.ceil((industrial.costMultiplierBp * accessCostBp) / BP);
  for (const [k, v] of [
    ["costMultiplierBp", costMultiplierBp],
    ["buildTimeMultiplierBp", industrial.buildTimeMultiplierBp],
  ] as const) {
    if (!Number.isSafeInteger(v) || v < MODIFIER_SAFE_MIN_BP || v > MODIFIER_SAFE_MAX_BP)
      throw designInvariant(
        `national construction: ${profile.nationId} ${k} ${String(v)} is out of safe range`,
      );
  }
  return {
    nationId: profile.nationId,
    costMultiplierBp,
    buildTimeMultiplierBp: industrial.buildTimeMultiplierBp,
    machineryReliabilityBp: industrial.machineryReliabilityBp,
    constructionQualityVarianceBp: industrial.constructionQualityVarianceBp,
    maxPracticalDisplacementKg: industrial.maxPracticalDisplacementKg,
    access: {
      heavyGun: profile.industrialProfile.heavyGunProduction,
      armourPlate: profile.industrialProfile.armourPlateProduction,
    },
    costBreakdown: [
      { label: "national industrial cost", costMultiplierBp: industrial.costMultiplierBp },
      { label: "heavy-gun access", costMultiplierBp: gun.costMultiplierBp },
      { label: "armour-plate access", costMultiplierBp: armour.costMultiplierBp },
    ],
  };
}

export interface ConstructionEconomics {
  readonly baseCostUnits: number;
  readonly costMultiplierBp: number;
  readonly costUnits: number;
  readonly baseBuildMonths: number;
  readonly buildTimeMultiplierBp: number;
  readonly buildMonths: number;
  readonly breakdown: readonly { readonly label: string; readonly costMultiplierBp: number }[];
}

export function applyNationalConstructionEconomics(
  baseCostUnits: number,
  baseBuildMonths: number,
  modifiers: NationalConstructionModifiers,
): ConstructionEconomics {
  if (!Number.isSafeInteger(baseCostUnits) || baseCostUnits < 0)
    throw designInvariant("national construction: base cost must be a non-negative safe integer");
  if (!Number.isSafeInteger(baseBuildMonths) || baseBuildMonths < 0)
    throw designInvariant(
      "national construction: base build months must be a non-negative safe integer",
    );
  const costUnits = mulBp(baseCostUnits, modifiers.costMultiplierBp);
  const buildMonths = mulBp(baseBuildMonths, modifiers.buildTimeMultiplierBp);
  return {
    baseCostUnits,
    costMultiplierBp: modifiers.costMultiplierBp,
    costUnits,
    baseBuildMonths,
    buildTimeMultiplierBp: modifiers.buildTimeMultiplierBp,
    buildMonths,
    breakdown: modifiers.costBreakdown,
  };
}
