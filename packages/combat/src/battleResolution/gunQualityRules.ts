import {
  gunQualityReloadMultiplierBp,
  neutralRateFactors,
  type GunneryRateFactors,
} from "../gunnery/rateOfFire.js";

export const NEUTRAL_GUN_QUALITY = 0 as const;

export interface GunQualityBand {
  readonly minCaliberUm: number;
  readonly maxCaliberUm: number;
  readonly quality: number;
}

export interface GunQualityRules {
  readonly bandsByNation: Readonly<Record<string, readonly GunQualityBand[]>>;
}

export interface GunQualityProfileSource {
  readonly gunQuality?: { readonly bands: readonly GunQualityBand[] };
}

export function gunQualityRulesFor(
  nationIds: readonly string[],
  profileFor: (nationId: string, month: string) => GunQualityProfileSource | null,
  month: string,
): GunQualityRules {
  const bandsByNation: Record<string, readonly GunQualityBand[]> = {};
  for (const nationId of [...new Set(nationIds)].sort()) {
    const bands = profileFor(nationId, month)?.gunQuality?.bands;
    if (bands === undefined) continue;
    bandsByNation[nationId] = bands.map((band) => ({
      minCaliberUm: band.minCaliberUm,
      maxCaliberUm: band.maxCaliberUm,
      quality: band.quality,
    }));
  }
  return { bandsByNation };
}

export function gunQualityLevelFor(
  rules: GunQualityRules | undefined,
  nationId: string,
  caliberUm: number,
): number {
  const bands = rules?.bandsByNation[nationId];
  if (bands === undefined) return NEUTRAL_GUN_QUALITY;
  for (const band of bands) {
    if (caliberUm >= band.minCaliberUm && caliberUm < band.maxCaliberUm) return band.quality;
  }
  return NEUTRAL_GUN_QUALITY;
}

export function gunQualityRateFactors(
  rules: GunQualityRules | undefined,
  nationId: string,
  caliberUm: number,
): GunneryRateFactors {
  const level = gunQualityLevelFor(rules, nationId, caliberUm);
  return { ...neutralRateFactors(), gunQuality: gunQualityReloadMultiplierBp(level) };
}
