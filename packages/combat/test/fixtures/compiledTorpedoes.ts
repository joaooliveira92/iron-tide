// Combat-test fixtures for the neutral CompiledTorpedo contract (ship-part-model ticket 13b).
//
// The eight records mirror the retired `SHIPPED_TORPEDO_MODELS` values verbatim (the Whitehead
// 14-inch carries its effective/post-1884 27 kg warhead, the value combat resolves at the model's
// latest revision). Tests key them by torpedo part id, exactly as combat's registry does.
import type { CompiledTorpedo } from "@bluewave/armament";

export const COMPILED_TORPEDOES: Readonly<Record<string, CompiledTorpedo>> = {
  whitehead_18in_1894: {
    partId: "whitehead_18in_1894",
    revision: "base",
    diameterUm: 457_000,
    massKg: 383,
    warheadType: "WET_GUNCOTTON",
    warheadExplosiveMassKg: 54,
    warheadExplosiveEquivalentMassKg: 54,
    propulsionType: "COMPRESSED_AIR",
    speedSettings: [{ settingId: "26_5kn", speedMilliKnots: 26_500, rangeM: 730 }],
    minimumArmingDistanceM: 25,
    reliabilityBp: 90_000,
    guidanceCapability: "none",
    launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE"],
    technologyPrerequisiteIds: [],
    tubeHitHazardPolicy: "ORDINARY",
  },
  rn_21in_mk_iv_1916: {
    partId: "rn_21in_mk_iv_1916",
    revision: "base",
    diameterUm: 533_000,
    massKg: 1_454,
    warheadType: "TNT",
    warheadExplosiveMassKg: 234,
    warheadExplosiveEquivalentMassKg: 234,
    propulsionType: "WET_HEATER",
    speedSettings: [
      { settingId: "35kn", speedMilliKnots: 35_000, rangeM: 7_315 },
      { settingId: "29kn", speedMilliKnots: 29_000, rangeM: 9_144 },
      { settingId: "25kn", speedMilliKnots: 25_000, rangeM: 12_344 },
    ],
    minimumArmingDistanceM: 50,
    reliabilityBp: 93_500,
    guidanceCapability: "gyro",
    launchTypes: ["UNDERWATER_FIXED", "UNDERWATER_TRAINABLE", "ABOVE_WATER_TRAINABLE"],
    technologyPrerequisiteIds: ["wet_heater_engine"],
    tubeHitHazardPolicy: "ORDINARY",
  },
  ger_533mm_g7a_1934: {
    partId: "ger_533mm_g7a_1934",
    revision: "base",
    diameterUm: 533_000,
    massKg: 1_528,
    warheadType: "HEXANITE",
    warheadExplosiveMassKg: 280,
    warheadExplosiveEquivalentMassKg: 280,
    propulsionType: "WET_HEATER",
    speedSettings: [
      { settingId: "44kn", speedMilliKnots: 44_000, rangeM: 6_000 },
      { settingId: "40kn", speedMilliKnots: 40_000, rangeM: 8_000 },
      { settingId: "30kn", speedMilliKnots: 30_000, rangeM: 14_000 },
    ],
    minimumArmingDistanceM: 150,
    reliabilityBp: 96_000,
    guidanceCapability: "gyro",
    launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_TRAINABLE", "SUBMARINE_INTERNAL"],
    technologyPrerequisiteIds: ["wet_heater_engine"],
    tubeHitHazardPolicy: "ORDINARY",
  },
  ger_533mm_g7e_1936: {
    partId: "ger_533mm_g7e_1936",
    revision: "base",
    diameterUm: 533_000,
    massKg: 1_603,
    warheadType: "HEXANITE",
    warheadExplosiveMassKg: 280,
    warheadExplosiveEquivalentMassKg: 280,
    propulsionType: "ELECTRIC",
    speedSettings: [
      { settingId: "t2_30kn", speedMilliKnots: 30_000, rangeM: 5_000 },
      { settingId: "t3_30kn", speedMilliKnots: 30_000, rangeM: 7_500 },
    ],
    minimumArmingDistanceM: 150,
    reliabilityBp: 93_000,
    guidanceCapability: "gyro",
    launchTypes: ["ABOVE_WATER_TRAINABLE", "SUBMARINE_INTERNAL"],
    technologyPrerequisiteIds: ["electric_propulsion"],
    tubeHitHazardPolicy: "ELECTRIC",
  },
  jpn_61cm_type93_1935: {
    partId: "jpn_61cm_type93_1935",
    revision: "base",
    diameterUm: 610_000,
    massKg: 2_700,
    warheadType: "TYPE_97",
    warheadExplosiveMassKg: 490,
    warheadExplosiveEquivalentMassKg: 490,
    propulsionType: "OXYGEN",
    speedSettings: [
      { settingId: "48kn", speedMilliKnots: 48_000, rangeM: 20_000 },
      { settingId: "40kn", speedMilliKnots: 40_000, rangeM: 32_000 },
      { settingId: "36kn", speedMilliKnots: 36_000, rangeM: 40_000 },
    ],
    minimumArmingDistanceM: 300,
    reliabilityBp: 92_000,
    guidanceCapability: "gyro",
    launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_TRAINABLE", "SUBMARINE_INTERNAL"],
    technologyPrerequisiteIds: ["oxygen_propulsion"],
    tubeHitHazardPolicy: "OXYGEN",
    oxygenWakeVisibilityModifierBp: 2_500,
  },
  whitehead_14in_1886: {
    partId: "whitehead_14in_1886",
    revision: "1884-01",
    diameterUm: 356_000,
    massKg: 300,
    warheadType: "WET_GUNCOTTON",
    warheadExplosiveMassKg: 27,
    warheadExplosiveEquivalentMassKg: 27,
    propulsionType: "COMPRESSED_AIR",
    speedSettings: [{ settingId: "25kn", speedMilliKnots: 25_000, rangeM: 550 }],
    minimumArmingDistanceM: 25,
    reliabilityBp: 88_000,
    guidanceCapability: "none",
    launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED"],
    technologyPrerequisiteIds: [],
    tubeHitHazardPolicy: "ORDINARY",
  },
  rn_21in_mk_viii_1927: {
    partId: "rn_21in_mk_viii_1927",
    revision: "base",
    diameterUm: 533_000,
    massKg: 1_566,
    warheadType: "TNT",
    warheadExplosiveMassKg: 340,
    warheadExplosiveEquivalentMassKg: 340,
    propulsionType: "WET_HEATER",
    speedSettings: [{ settingId: "40kn", speedMilliKnots: 40_000, rangeM: 4_572 }],
    minimumArmingDistanceM: 100,
    reliabilityBp: 95_500,
    guidanceCapability: "gyro",
    launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED", "UNDERWATER_TRAINABLE"],
    technologyPrerequisiteIds: ["wet_heater_engine"],
    tubeHitHazardPolicy: "ORDINARY",
  },
  usn_21in_mk14_1931: {
    partId: "usn_21in_mk14_1931",
    revision: "base",
    diameterUm: 533_000,
    massKg: 1_361,
    warheadType: "TNT",
    warheadExplosiveMassKg: 230,
    warheadExplosiveEquivalentMassKg: 230,
    propulsionType: "WET_HEATER",
    speedSettings: [
      { settingId: "46kn", speedMilliKnots: 46_000, rangeM: 4_115 },
      { settingId: "31kn", speedMilliKnots: 31_000, rangeM: 8_230 },
    ],
    minimumArmingDistanceM: 410,
    reliabilityBp: 94_000,
    guidanceCapability: "gyro",
    launchTypes: ["UNDERWATER_FIXED", "UNDERWATER_TRAINABLE", "ABOVE_WATER_TRAINABLE"],
    technologyPrerequisiteIds: ["wet_heater_engine"],
    tubeHitHazardPolicy: "ORDINARY",
  },
};

/** Fail-closed fixture lookup (mirrors combat's `compiledTorpedoOf`). */
export function compiledTorpedoOf(partId: string): CompiledTorpedo {
  const record = COMPILED_TORPEDOES[partId];
  if (record === undefined) throw new Error(`no compiled torpedo fixture for '${partId}'`);
  return record;
}

/** A copy of a fixture with overrides (for predicate tests that mutate one field). */
export function withCompiledTorpedo(
  base: CompiledTorpedo,
  overrides: Partial<CompiledTorpedo>,
): CompiledTorpedo {
  return { ...base, ...overrides };
}
