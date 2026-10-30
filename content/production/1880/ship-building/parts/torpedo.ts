import { PartSchema, collection } from "@bluewave/content-authoring";

export default collection("parts", PartSchema, [
  {
    family: "torpedo",
    id: "ger_533mm_g7a_1934",
    lifecycle: {
      availableFrom: "1934-01",
    },
    name: "ger_533mm_g7a_1934",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 1528,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 533000,
      guidanceCapability: "gyro",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_TRAINABLE", "SUBMARINE_INTERNAL"],
      massKg: 1528,
      minimumArmingDistanceM: 150,
      propulsionType: "WET_HEATER",
      reliabilityBp: 96000,
      speedSettings: [
        {
          rangeM: 6000,
          settingId: "44kn",
          speedMilliKnots: 44000,
        },
        {
          rangeM: 8000,
          settingId: "40kn",
          speedMilliKnots: 40000,
        },
        {
          rangeM: 14000,
          settingId: "30kn",
          speedMilliKnots: 30000,
        },
      ],
      technologyPrerequisiteIds: ["wet_heater_engine"],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 280,
      warheadExplosiveMassKg: 280,
      warheadType: "HEXANITE",
    },
  },
  {
    family: "torpedo",
    id: "ger_533mm_g7e_1936",
    lifecycle: {
      availableFrom: "1936-01",
    },
    name: "ger_533mm_g7e_1936",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 1603,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 533000,
      guidanceCapability: "gyro",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "SUBMARINE_INTERNAL"],
      massKg: 1603,
      minimumArmingDistanceM: 150,
      propulsionType: "ELECTRIC",
      reliabilityBp: 93000,
      speedSettings: [
        {
          rangeM: 5000,
          settingId: "t2_30kn",
          speedMilliKnots: 30000,
        },
        {
          rangeM: 7500,
          settingId: "t3_30kn",
          speedMilliKnots: 30000,
        },
      ],
      technologyPrerequisiteIds: ["electric_propulsion"],
      tubeHitHazardPolicy: "ELECTRIC",
      warheadExplosiveEquivalentMassKg: 280,
      warheadExplosiveMassKg: 280,
      warheadType: "HEXANITE",
    },
  },
  {
    family: "torpedo",
    id: "jpn_61cm_type93_1935",
    lifecycle: {
      availableFrom: "1935-01",
    },
    name: "jpn_61cm_type93_1935",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 2700,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 610000,
      guidanceCapability: "gyro",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_TRAINABLE", "SUBMARINE_INTERNAL"],
      massKg: 2700,
      minimumArmingDistanceM: 300,
      oxygenWakeVisibilityModifierBp: 2500,
      propulsionType: "OXYGEN",
      reliabilityBp: 92000,
      speedSettings: [
        {
          rangeM: 20000,
          settingId: "48kn",
          speedMilliKnots: 48000,
        },
        {
          rangeM: 32000,
          settingId: "40kn",
          speedMilliKnots: 40000,
        },
        {
          rangeM: 40000,
          settingId: "36kn",
          speedMilliKnots: 36000,
        },
      ],
      technologyPrerequisiteIds: ["oxygen_propulsion"],
      tubeHitHazardPolicy: "OXYGEN",
      warheadExplosiveEquivalentMassKg: 490,
      warheadExplosiveMassKg: 490,
      warheadType: "TYPE_97",
    },
  },
  {
    family: "torpedo",
    id: "rn_21in_mk_iv_1916",
    lifecycle: {
      availableFrom: "1916-01",
    },
    name: "rn_21in_mk_iv_1916",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 1454,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 533000,
      guidanceCapability: "gyro",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED", "UNDERWATER_TRAINABLE"],
      massKg: 1454,
      minimumArmingDistanceM: 50,
      propulsionType: "WET_HEATER",
      reliabilityBp: 93500,
      speedSettings: [
        {
          rangeM: 7315,
          settingId: "35kn",
          speedMilliKnots: 35000,
        },
        {
          rangeM: 9144,
          settingId: "29kn",
          speedMilliKnots: 29000,
        },
        {
          rangeM: 12344,
          settingId: "25kn",
          speedMilliKnots: 25000,
        },
      ],
      technologyPrerequisiteIds: ["wet_heater_engine"],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 234,
      warheadExplosiveMassKg: 234,
      warheadType: "TNT",
    },
  },
  {
    family: "torpedo",
    id: "rn_21in_mk_viii_1927",
    lifecycle: {
      availableFrom: "1927-01",
    },
    name: "rn_21in_mk_viii_1927",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 1566,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 533000,
      guidanceCapability: "gyro",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED", "UNDERWATER_TRAINABLE"],
      massKg: 1566,
      minimumArmingDistanceM: 100,
      propulsionType: "WET_HEATER",
      reliabilityBp: 95500,
      speedSettings: [
        {
          rangeM: 4572,
          settingId: "40kn",
          speedMilliKnots: 40000,
        },
      ],
      technologyPrerequisiteIds: ["wet_heater_engine"],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 340,
      warheadExplosiveMassKg: 340,
      warheadType: "TNT",
    },
  },
  {
    family: "torpedo",
    id: "usn_21in_mk14_1931",
    lifecycle: {
      availableFrom: "1931-01",
    },
    name: "usn_21in_mk14_1931",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 1361,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 533000,
      guidanceCapability: "gyro",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED", "UNDERWATER_TRAINABLE"],
      massKg: 1361,
      minimumArmingDistanceM: 410,
      propulsionType: "WET_HEATER",
      reliabilityBp: 94000,
      speedSettings: [
        {
          rangeM: 4115,
          settingId: "46kn",
          speedMilliKnots: 46000,
        },
        {
          rangeM: 8230,
          settingId: "31kn",
          speedMilliKnots: 31000,
        },
      ],
      technologyPrerequisiteIds: ["wet_heater_engine"],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 230,
      warheadExplosiveMassKg: 230,
      warheadType: "TNT",
    },
  },
  {
    family: "torpedo",
    id: "usn_21in_mk35_1949",
    lifecycle: {
      availableFrom: "1949-01",
    },
    name: "usn_21in_mk35_1949",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "The 21-inch acoustic homer is the US Mark 35 (1949), the only one for surface tubes per ADR-0284 D1/ADR-0350 Rule 6. Values: 10 sourced or derived from NW-TP (dossier §7); 4 unsourced fields (minimumArmingDistanceM, reliabilityBp, warheadExplosiveEquivalentMassKg, tubeHitHazardPolicy) are BALANCE_TARGET copied from usn_21in_mk14_1931, the nearest existing US 21-inch torpedo, per the standing ADR delegation. warheadExplosiveMassKg 122 rounded from the sourced 122.5 kg.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "https://www.navweaps.com/Weapons/WTUS_PostWWII.php",
          title: "NW-TP — US Post-WWII Torpedoes (dossier §7)",
        },
        {
          archiveOrUrl: "docs/research/e-1-1940s-hull-and-part-values.md",
          section: "§7 21-inch acoustic homing torpedo",
          title: "E-1 research: 1940-1949 hull forms and part values",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 803,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 533000,
      guidanceCapability: "acoustic",
      launchTypes: ["ABOVE_WATER_TRAINABLE", "SUBMARINE_INTERNAL"],
      massKg: 803,
      minimumArmingDistanceM: 410,
      propulsionType: "ELECTRIC",
      reliabilityBp: 94000,
      speedSettings: [
        {
          rangeM: 13710,
          settingId: "27kn",
          speedMilliKnots: 27000,
        },
      ],
      technologyPrerequisiteIds: ["torp_acoustic_homing"],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 122,
      warheadExplosiveMassKg: 122,
      warheadType: "HBX",
    },
  },
  {
    family: "torpedo",
    id: "whitehead_14in_1886",
    lifecycle: {
      availableFrom: "1880-01",
    },
    name: "whitehead_14in_1886",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Canonical repository model id carrying a retrospective vintage label (the 14-in Fiume Mark IV, in RN service ~1886), not a manufacturer or service designation; the simulated torpedo is the 1877 pattern available from the 1880 era start.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/n-2-whitehead-14in-identity.md",
          section:
            "§4–§5 (the id is a canonical repository identifier; historical object and marks)",
          title: "N-2 — The 14-inch Whitehead torpedo model identity",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 300,
      },
    ],
    revisions: [
      {
        from: "1884-01",
        provenance: {
          confidence: "MEDIUM",
          kind: "historical_fact",
          note: "The 1877 14-inch Whitehead carried a 26 lb (12 kg) wet-guncotton charge; the 1884 Mk IV re-rated it to the 58–70 lb (26–27 kg) charge the shipped model carries.",
          sourceStatus: "VERIFIED",
          sources: [
            {
              archiveOrUrl: "docs/research/n-2-whitehead-14in-identity.md",
              section: "§3.2 (1877 26 lb → 1884 Mark IV 58–70 lb)",
              title: "N-2 — The 14-inch Whitehead torpedo model identity",
            },
          ],
        },
        spec: {
          warheadExplosiveEquivalentMassKg: 27,
          warheadExplosiveMassKg: 27,
        },
      },
    ],
    spec: {
      diameterUm: 356000,
      guidanceCapability: "none",
      launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE", "UNDERWATER_FIXED"],
      massKg: 300,
      minimumArmingDistanceM: 25,
      propulsionType: "COMPRESSED_AIR",
      reliabilityBp: 88000,
      speedSettings: [
        {
          rangeM: 550,
          settingId: "25kn",
          speedMilliKnots: 25000,
        },
      ],
      technologyPrerequisiteIds: [],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 12,
      warheadExplosiveMassKg: 12,
      warheadType: "WET_GUNCOTTON",
    },
  },
  {
    family: "torpedo",
    id: "whitehead_18in_1894",
    lifecycle: {
      availableFrom: "1894-01",
    },
    name: "whitehead_18in_1894",
    origin: {
      sourceFile: "ship-building/parts/torpedo.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "game_conversion",
      note: "Mirrors the shipped combat torpedo_models_v1 constants; values grounded in the cited research.",
      sourceStatus: "BALANCE_TARGET",
      sources: [
        {
          archiveOrUrl: "docs/research/ship-building-early-band-2.md",
          section: "§2 14-inch Whitehead torpedo and its launching gear",
          title: "Ship-building catalogue — EARLY band (1880–1899), second pass",
        },
        {
          archiveOrUrl: "docs/research/c1-m3-torpedoes.md",
          section: "§3.1 Torpedo model table (1880–1945)",
          title: "Torpedo model research (c1-m3)",
        },
      ],
    },
    provides: "torpedo",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "torpedo_mass",
        kind: "massKg",
        value: 383,
      },
    ],
    revisions: [],
    spec: {
      diameterUm: 457000,
      guidanceCapability: "none",
      launchTypes: ["ABOVE_WATER_FIXED", "ABOVE_WATER_TRAINABLE"],
      massKg: 383,
      minimumArmingDistanceM: 25,
      propulsionType: "COMPRESSED_AIR",
      reliabilityBp: 90000,
      speedSettings: [
        {
          rangeM: 730,
          settingId: "26_5kn",
          speedMilliKnots: 26500,
        },
      ],
      technologyPrerequisiteIds: [],
      tubeHitHazardPolicy: "ORDINARY",
      warheadExplosiveEquivalentMassKg: 54,
      warheadExplosiveMassKg: 54,
      warheadType: "WET_GUNCOTTON",
    },
  },
]);
