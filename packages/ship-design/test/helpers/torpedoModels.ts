import type { Provenance } from "@bluewave/content-schema";
import { type TorpedoModelSource } from "../../src/index.js";

const TORPEDO_AVAILABLE_FROM: Readonly<Record<string, string>> = {
  whitehead_14in_1886: "1880-01",
  whitehead_18in_1894: "1894-01",
  rn_21in_mk_iv_1916: "1916-01",
  rn_21in_mk_viii_1927: "1927-01",
  usn_21in_mk14_1931: "1931-01",
  ger_533mm_g7a_1934: "1934-01",
  jpn_61cm_type93_1935: "1935-01",
  ger_533mm_g7e_1936: "1936-01",
};

export const TORPEDO_PROVENANCE: Provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "MEDIUM",
  kind: "game_conversion",
  sources: [
    {
      title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
      section: "§2 14-inch Whitehead torpedo and its launching gear",
      archiveOrUrl: "docs/research/ship-building-early-band-2.md",
    },
    {
      title: "Torpedo model research (c1-m3)",
      section: "§3.1 Torpedo model table (1880–1945)",
      archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
    },
  ],
  note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
};

export const WHITEHEAD_1884_RE_RATING: Provenance = {
  sourceStatus: "VERIFIED",
  confidence: "MEDIUM",
  kind: "historical_fact",
  sources: [
    {
      title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
      section: "§2 (1877 14-in 26 lb → 1884 Mk IV 58–70 lb)",
      archiveOrUrl: "docs/research/ship-building-early-band-2.md",
    },
  ],
  note: "The 1877 14-inch Whitehead carried a 26 lb (12 kg) wet-guncotton charge; the 1884 Mk IV re-rated it to the 58–70 lb (26–27 kg) charge the shipped model carries.",
};

const TORPEDO_MODELS: readonly Omit<
  TorpedoModelSource,
  "availableFrom" | "provenance" | "sourceFile" | "warheadFirstPattern"
>[] = [
  {
    torpedoModelId: "whitehead_18in_1894",
    diameterMm: 457,
    massKg: 383,
    warheadType: "WET_GUNCOTTON",
    warheadExplosiveMassKg: 54,
    warheadExplosiveEquivalentMassKg: 54,
    propulsionType: "COMPRESSED_AIR",
    orderedSettings: [{ settingId: "26_5kn", speedKnotsBp: 26_500, rangeM: 730 }],
    minimumArmingDistanceM: 25,
    reliabilityBp: 90_000,
    guidanceCapability: "none",
    technologyPrerequisiteIds: [],
    compatibleLauncherFamilyIds: ["18in_above_water_fixed", "18in_above_water_trainable"],
    tubeHitHazardPolicyId: "ORDINARY",
    oxygenState: null,
  },
  {
    torpedoModelId: "rn_21in_mk_iv_1916",
    diameterMm: 533,
    massKg: 1_454,
    warheadType: "TNT",
    warheadExplosiveMassKg: 234,
    warheadExplosiveEquivalentMassKg: 234,
    propulsionType: "WET_HEATER",
    orderedSettings: [
      { settingId: "35kn", speedKnotsBp: 35_000, rangeM: 7_315 },
      { settingId: "29kn", speedKnotsBp: 29_000, rangeM: 9_144 },
      { settingId: "25kn", speedKnotsBp: 25_000, rangeM: 12_344 },
    ],
    minimumArmingDistanceM: 50,
    reliabilityBp: 93_500,
    guidanceCapability: "gyro",
    technologyPrerequisiteIds: ["wet_heater_engine"],
    compatibleLauncherFamilyIds: [
      "21in_underwater_fixed",
      "21in_underwater_trainable",
      "21in_above_water_trainable",
    ],
    tubeHitHazardPolicyId: "ORDINARY",
    oxygenState: null,
  },
  {
    torpedoModelId: "ger_533mm_g7a_1934",
    diameterMm: 533,
    massKg: 1_528,
    warheadType: "HEXANITE",
    warheadExplosiveMassKg: 280,
    warheadExplosiveEquivalentMassKg: 280,
    propulsionType: "WET_HEATER",
    orderedSettings: [
      { settingId: "44kn", speedKnotsBp: 44_000, rangeM: 6_000 },
      { settingId: "40kn", speedKnotsBp: 40_000, rangeM: 8_000 },
      { settingId: "30kn", speedKnotsBp: 30_000, rangeM: 14_000 },
    ],
    minimumArmingDistanceM: 150,
    reliabilityBp: 96_000,
    guidanceCapability: "gyro",
    technologyPrerequisiteIds: ["wet_heater_engine"],
    compatibleLauncherFamilyIds: [
      "533mm_above_water_trainable",
      "533mm_underwater_trainable",
      "533mm_submarine_internal",
    ],
    tubeHitHazardPolicyId: "ORDINARY",
    oxygenState: null,
  },
  {
    torpedoModelId: "ger_533mm_g7e_1936",
    diameterMm: 533,
    massKg: 1_603,
    warheadType: "HEXANITE",
    warheadExplosiveMassKg: 280,
    warheadExplosiveEquivalentMassKg: 280,
    propulsionType: "ELECTRIC",
    orderedSettings: [
      { settingId: "t2_30kn", speedKnotsBp: 30_000, rangeM: 5_000 },
      { settingId: "t3_30kn", speedKnotsBp: 30_000, rangeM: 7_500 },
    ],
    minimumArmingDistanceM: 150,
    reliabilityBp: 93_000,
    guidanceCapability: "gyro",
    technologyPrerequisiteIds: ["electric_propulsion"],
    compatibleLauncherFamilyIds: ["533mm_above_water_trainable", "533mm_submarine_internal"],
    tubeHitHazardPolicyId: "ELECTRIC",
    oxygenState: null,
  },
  {
    torpedoModelId: "jpn_61cm_type93_1935",
    diameterMm: 610,
    massKg: 2_700,
    warheadType: "TYPE_97",
    warheadExplosiveMassKg: 490,
    warheadExplosiveEquivalentMassKg: 490,
    propulsionType: "OXYGEN",
    orderedSettings: [
      { settingId: "48kn", speedKnotsBp: 48_000, rangeM: 20_000 },
      { settingId: "40kn", speedKnotsBp: 40_000, rangeM: 32_000 },
      { settingId: "36kn", speedKnotsBp: 36_000, rangeM: 40_000 },
    ],
    minimumArmingDistanceM: 300,
    reliabilityBp: 92_000,
    guidanceCapability: "gyro",
    technologyPrerequisiteIds: ["oxygen_propulsion"],
    compatibleLauncherFamilyIds: [
      "61cm_above_water_trainable",
      "61cm_underwater_trainable",
      "61cm_submarine_internal",
    ],
    tubeHitHazardPolicyId: "OXYGEN",
    oxygenState: { wakeVisibilityModifierBp: 2_500 },
  },
  {
    torpedoModelId: "whitehead_14in_1886",
    diameterMm: 356,
    massKg: 300,
    warheadType: "WET_GUNCOTTON",
    warheadExplosiveMassKg: 27,
    warheadExplosiveEquivalentMassKg: 27,
    propulsionType: "COMPRESSED_AIR",
    orderedSettings: [{ settingId: "25kn", speedKnotsBp: 25_000, rangeM: 550 }],
    minimumArmingDistanceM: 25,
    reliabilityBp: 88_000,
    guidanceCapability: "none",
    technologyPrerequisiteIds: [],
    compatibleLauncherFamilyIds: [
      "14in_above_water_fixed",
      "14in_above_water_trainable",
      "14in_underwater_fixed",
    ],
    tubeHitHazardPolicyId: "ORDINARY",
    oxygenState: null,
  },
  {
    torpedoModelId: "rn_21in_mk_viii_1927",
    diameterMm: 533,
    massKg: 1_566,
    warheadType: "TNT",
    warheadExplosiveMassKg: 340,
    warheadExplosiveEquivalentMassKg: 340,
    propulsionType: "WET_HEATER",
    orderedSettings: [{ settingId: "40kn", speedKnotsBp: 40_000, rangeM: 4_572 }],
    minimumArmingDistanceM: 100,
    reliabilityBp: 95_500,
    guidanceCapability: "gyro",
    technologyPrerequisiteIds: ["wet_heater_engine"],
    compatibleLauncherFamilyIds: [
      "21in_above_water_trainable",
      "21in_underwater_fixed",
      "21in_underwater_trainable",
    ],
    tubeHitHazardPolicyId: "ORDINARY",
    oxygenState: null,
  },
  {
    torpedoModelId: "usn_21in_mk14_1931",
    diameterMm: 533,
    massKg: 1_361,
    warheadType: "TNT",
    warheadExplosiveMassKg: 230,
    warheadExplosiveEquivalentMassKg: 230,
    propulsionType: "WET_HEATER",
    orderedSettings: [
      { settingId: "46kn", speedKnotsBp: 46_000, rangeM: 4_115 },
      { settingId: "31kn", speedKnotsBp: 31_000, rangeM: 8_230 },
    ],
    minimumArmingDistanceM: 410,
    reliabilityBp: 94_000,
    guidanceCapability: "gyro",
    technologyPrerequisiteIds: ["wet_heater_engine"],
    compatibleLauncherFamilyIds: [
      "21in_underwater_fixed",
      "21in_underwater_trainable",
      "21in_above_water_trainable",
    ],
    tubeHitHazardPolicyId: "ORDINARY",
    oxygenState: null,
  },
];

const toTorpedoSource = (model: (typeof TORPEDO_MODELS)[number]): TorpedoModelSource => {
  const id = String(model.torpedoModelId);
  const availableFrom = TORPEDO_AVAILABLE_FROM[id];
  if (availableFrom === undefined) {
    throw new Error(`No authored availability for torpedo model '${id}'.`);
  }
  return {
    ...model,
    orderedSettings: model.orderedSettings.map((s) => ({ ...s })),
    technologyPrerequisiteIds: [...model.technologyPrerequisiteIds],
    compatibleLauncherFamilyIds: [...model.compatibleLauncherFamilyIds],
    availableFrom,
    provenance: TORPEDO_PROVENANCE,
    sourceFile: "ship-building/parts/torpedo.yaml",
    ...(id === "whitehead_14in_1886"
      ? {
          warheadFirstPattern: {
            explosiveMassKg: 12,
            explosiveEquivalentMassKg: 12,
            from: "1884-01",
            provenance: WHITEHEAD_1884_RE_RATING,
          },
        }
      : {}),
  };
};

export const torpedoModels: readonly TorpedoModelSource[] = TORPEDO_MODELS.map(
  toTorpedoSource,
).sort((a, b) =>
  a.torpedoModelId < b.torpedoModelId ? -1 : a.torpedoModelId > b.torpedoModelId ? 1 : 0,
);

export const torpedoDiameterUm = (id: string): number | undefined => {
  const model = TORPEDO_MODELS.find((m) => String(m.torpedoModelId) === id);
  return model === undefined ? undefined : model.diameterMm * 1000;
};
