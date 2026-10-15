/**
 * National construction economics and component-access policy (docs/ships-nation-orientation.md §1-2). Pure,
 * platform-independent, integer/basic-point arithmetic. The composition here is the *only* place a nation's
 * industrial and component-access fields become authoritative numbers; the caller passes the result into the
 * existing construction projection exactly once, so a modifier can never be applied twice.
 *
 * Global rules stay authoritative: this module never classifies a ship and never widens the component catalogue —
 * it only scales cost/duration/reliability and reports access consequences.
 */
import {
  type ComponentAccessStatus,
  type NationNavalProfile,
  resolveConstructionModifiers,
} from "./nationProfile.js";

const BP = 10_000;
const mulBp = (v: number, bp: number): number => Math.ceil((v * bp) / BP);

/** Narrow, explicit scenario inputs for foreign procurement — deliberately not a diplomacy system. */
export interface ComponentAccessPolicy {
  /** At war, an overseas supply line may be cut. */
  readonly wartime: boolean;
  /** The supplying nation's alignment to the buyer; only affects non-domestic access. */
  readonly alignment: "SELF" | "FRIENDLY" | "NEUTRAL" | "HOSTILE";
}

export const DEFAULT_ACCESS_POLICY: ComponentAccessPolicy = {
  wartime: false,
  alignment: "NEUTRAL",
};

/** The consequences of an access state: cost/delivery multipliers (bp), a reliability delta (bp) and availability. */
export interface AccessEffect {
  readonly available: boolean;
  readonly costMultiplierBp: number;
  readonly deliveryMultiplierBp: number;
  /** Negative when the source is less reliable than domestic supply. */
  readonly reliabilityDeltaBp: number;
  /** True when the state is at risk of being cut in war (an overseas supply line). */
  readonly wartimeSensitive: boolean;
  /** Whether a ship built with this component may be refitted to it again (imports may lapse). */
  readonly refitEligible: boolean;
}

/** The rule's own effect table (usage is BALANCE TARGET; the *shape* — domestic best, imports riskier — is design). */
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

/**
 * Resolve an access state under a scenario policy. In wartime an overseas supply line to a non-friendly supplier is
 * cut (unavailable); otherwise the peacetime premium stands. Deterministic and side-effect free.
 */
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
  // Friendly or self at war: supply continues but at a higher cost and longer delivery.
  return {
    ...base,
    costMultiplierBp: base.costMultiplierBp + 1500,
    deliveryMultiplierBp: base.deliveryMultiplierBp + 2000,
  };
}

/** The industrial + access modifiers an order applies, resolved for a month and scenario policy. */
export interface NationalConstructionModifiers {
  readonly nationId: string;
  /** Combined industrial × access cost multiplier (10000 = standard). */
  readonly costMultiplierBp: number;
  readonly buildTimeMultiplierBp: number;
  readonly machineryReliabilityBp: number;
  readonly constructionQualityVarianceBp: number;
  readonly maxPracticalDisplacementKg: number;
  /** Access premiums that fed the combined cost multiplier, for the breakdown and observability. */
  readonly access: {
    readonly heavyGun: ComponentAccessStatus;
    readonly armourPlate: ComponentAccessStatus;
  };
  /** The factors whose product is `costMultiplierBp`, for an explainable breakdown. */
  readonly costBreakdown: readonly { readonly label: string; readonly costMultiplierBp: number }[];
}

export const MODIFIER_SAFE_MIN_BP = 5_000;
export const MODIFIER_SAFE_MAX_BP = 20_000;

/**
 * Compose the nation's construction modifiers for a month. The combined cost multiplier applies the industrial
 * multiplier and the heavy-gun/armour-plate access premiums together (each exactly once). Invalid multipliers are
 * rejected rather than silently clamped.
 */
export function resolveNationalConstruction(
  profile: NationNavalProfile,
  month: string,
  policy: ComponentAccessPolicy = DEFAULT_ACCESS_POLICY,
): NationalConstructionModifiers {
  const industrial = resolveConstructionModifiers(profile, month);
  const gun = accessEffect(profile.industrialProfile.heavyGunProduction, policy);
  const armour = accessEffect(profile.industrialProfile.armourPlateProduction, policy);
  if (!gun.available || !armour.available)
    throw new Error(
      `national construction: ${profile.nationId} cannot obtain its main armament or armour plate under this policy`,
    );
  const accessCostBp = Math.ceil((gun.costMultiplierBp * armour.costMultiplierBp) / BP);
  const costMultiplierBp = Math.ceil((industrial.costMultiplierBp * accessCostBp) / BP);
  for (const [k, v] of [
    ["costMultiplierBp", costMultiplierBp],
    ["buildTimeMultiplierBp", industrial.buildTimeMultiplierBp],
  ] as const) {
    if (!Number.isSafeInteger(v) || v < MODIFIER_SAFE_MIN_BP || v > MODIFIER_SAFE_MAX_BP)
      throw new Error(
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

/** A structured, explainable cost/duration derivation a screen or a decision record can render. */
export interface ConstructionEconomics {
  readonly baseCostUnits: number;
  readonly costMultiplierBp: number;
  readonly costUnits: number;
  readonly baseBuildMonths: number;
  readonly buildTimeMultiplierBp: number;
  readonly buildMonths: number;
  readonly breakdown: readonly { readonly label: string; readonly costMultiplierBp: number }[];
}

/**
 * Apply the resolved modifiers to a base order cost and build time (both integers). Cost and duration are each
 * scaled exactly once (round up, so a ship is never under-costed); the base is preserved in the output so the
 * caller can persist both the resolved value and its derivation.
 */
export function applyNationalConstructionEconomics(
  baseCostUnits: number,
  baseBuildMonths: number,
  modifiers: NationalConstructionModifiers,
): ConstructionEconomics {
  if (!Number.isSafeInteger(baseCostUnits) || baseCostUnits < 0)
    throw new Error("national construction: base cost must be a non-negative safe integer");
  if (!Number.isSafeInteger(baseBuildMonths) || baseBuildMonths < 0)
    throw new Error("national construction: base build months must be a non-negative safe integer");
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
