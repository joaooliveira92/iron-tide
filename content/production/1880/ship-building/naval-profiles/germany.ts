// National naval profiles (NationNavalProfile) for the EARLY band, one file per nation.
// Every historical value carries a provenance block (sourceStatus / confidence / kind / sources); every balance
// target is labelled `balance_adjustment`. Grounding: docs/research/<nation>-naval-profile.md.
// Hard capability only ever restricts (UNAVAILABLE families, calibre ceilings); it never grants. Soft doctrine
// steers templates, AI scoring and procurement, and never blocks a legal design (docs/ships-nation-orientation.md).
// Germany (canonical id "germany"). A continental two-sea (Baltic + North Sea) power in 1880: a small,
// coastal-defence-weighted battle line, world-leading Krupp steel and 26 cm guns, a growing torpedo-boat arm, and
// no overseas station empire. The Tirpitz-era battle-fleet doctrine is post-1898 and is NOT projected back to 1880.
import { NationNavalProfileSchema, collection } from "@bluewave/content-authoring";

export default collection("navalProfiles", NationNavalProfileSchema, [
  {
    nationId: "germany",
    activeFrom: "1880-01",
    activeUntil: null,
    strategicSituation:
      "Continental two-sea power: a modest, heavily-armoured coastal-defence battle line backed by the world's best steel and armament industry (Krupp), a fast-growing torpedo-boat arm and a small colonial wing; doctrine is defensive and technical rather than the offensive trade-war or global-station posture of Britain or France.",
    hardCapabilities: {
      maxGunCaliberUm: 263000,
      maxArmourThicknessUm: 400000,
      domesticTorpedoDiameterUm: 450000,
      hullForms: [
        "torpedo_boat_form",
        "protected_cruiser_form",
        "coast_defence_form",
        "pre_dreadnought_form",
        "merchant_liner_form",
      ],
      domesticPlants: [
        "compound_cylindrical",
        "triple_expansion_cylindrical",
        "locomotive_boiler_tb",
      ],
      restrictedShipTypes: [],
      grants: [],
    },
    softPreferences: {
      speedOverArmourBp: 4500,
      secondaryBatteryWeightBp: 10500,
      enduranceWeightBp: 9000,
      riskToleranceBp: 4000,
      colonialServiceWeightBp: 9000,
      torpedoOnCruisersBp: 10500,
      accommodationStandard: "SPARTAN",
    },
    industrialProfile: {
      buildTimeMultiplierBp: 10000,
      costMultiplierBp: 10100,
      machineryReliabilityBp: 8800,
      constructionQualityVarianceBp: 3000,
      maxPracticalDisplacementKg: [
        {
          fromMonth: "1880-01",
          value: 9000000,
        },
        {
          fromMonth: "1885-01",
          value: 11000000,
        },
        {
          fromMonth: "1890-01",
          value: 13000000,
        },
      ],
      heavyGunProduction: "DOMESTIC",
      armourPlateProduction: "DOMESTIC",
      provenance: {
        sourceStatus: "ESTIMATE",
        confidence: "MEDIUM",
        kind: "balance_adjustment",
        note: "German yards were efficient but smaller than the RN; Krupp arms/armour world-leading. Multipliers are BALANCE TARGET within ±15%.",
        sources: [
          {
            sourceId: "germany-note",
            title: "National naval profiles research note (UK/France)",
            page: "method/§A.2 contrast",
          },
          {
            sourceId: "eb-1911",
            title: "Encyclopaedia Britannica 11th ed., 'Armour Plates'",
          },
        ],
        derivation: {
          sourceValue: "German completion slips and Krupp production; no single sourced multiplier",
          sourceUnit: "estimate",
          conversion: "within the ±15% band",
          gameValue: "buildTimeMultiplierBp 10000, costMultiplierBp 10100",
          roundingRule: "±15%",
        },
      },
    },
    dock: {
      maximumNewConstructionMassKg: 9000000,
      maximumMajorRepairMassKg: 9000000,
      maximumRebuildMassKg: 9000000,
      maximumConversionMassKg: 9000000,
      provenance: {
        sourceStatus: "DERIVED",
        confidence: "MEDIUM",
        kind: "game_conversion",
        sources: [
          {
            title: "1880 national dock capacity research note",
            page: "findings table",
          },
        ],
        derivation: {
          sourceValue: "SMS Kaiser 8,799 t (largest 1880 hull)",
          sourceUnit: "t",
          conversion:
            "largest 1880 hull the nation fields, rounded up to the next 1,000 t dock step",
          gameValue: "maximumNewConstructionMassKg 9000000",
          roundingRule: "ceiling to next 1,000 t",
        },
        note: "historical flagship rounded up to the next 1,000 t",
      },
    },
    doctrineProfile: {
      engagementRangeM: 1500,
      hePreferenceBp: 5500,
      postures: ["coastal_defence", "battle_fleet_concentration", "torpedo_warfare"],
      provenance: {
        sourceStatus: "ESTIMATE",
        confidence: "MEDIUM",
        kind: "historical_fact",
        note: "1880 German navy was coast-defence and Baltic/North Sea oriented; a short battle range reflects the period, not the later Tirpitz doctrine.",
        sources: [
          {
            sourceId: "roksund-2007",
            title: "A. Roksund, The Jeune Ecole (Brill, 2007) - relayed",
          },
          {
            sourceId: "navypedia-de",
            title: "navypedia.org German class pages",
            archiveOrUrl: "http://www.navypedia.org",
          },
        ],
      },
    },
    researchPreferences: [
      {
        field: "GUNNERY",
        priority: 4,
      },
      {
        field: "MACHINERY",
        priority: 3,
      },
      {
        field: "HULL_CONSTRUCTION",
        priority: 3,
      },
      {
        field: "TORPEDOES",
        priority: 3,
      },
      {
        field: "MINES_AND_ASW",
        priority: 3,
      },
      {
        field: "DAMAGE_CONTROL",
        priority: 2,
      },
      {
        field: "INFRASTRUCTURE",
        priority: 2,
      },
      {
        field: "SHIP_DESIGN",
        priority: 2,
      },
      {
        field: "FIRE_CONTROL",
        priority: 1,
      },
      {
        field: "SUBMARINES",
        priority: 1,
      },
    ],
    componentAccess: {
      gun_bl_12in_25: {
        status: "UNAVAILABLE",
      },
      gun_bl_135in_30: {
        status: "UNAVAILABLE",
      },
      gun_bl_12in_35: {
        status: "UNAVAILABLE",
      },
      gun_bl_10in_32: {
        status: "UNAVAILABLE",
      },
      gun_bl_92in_315: {
        status: "UNAVAILABLE",
      },
      gun_bl_274mm_m1875: {
        status: "UNAVAILABLE",
      },
      gun_bl_263mm_rkl20: {
        status: "DOMESTIC",
        producer: "Krupp",
      },
      gun_bl_6in_26: {
        status: "DOMESTIC",
        producer: "Krupp",
      },
      gun_qf_47in: {
        status: "IMPORTED",
        producer: "Elswick / Krupp licence",
      },
      gun_qf_12pdr: {
        status: "IMPORTED",
        producer: "Hotchkiss / Krupp licence",
      },
      gun_nordenfelt_1in: {
        status: "IMPORTED",
        producer: "Nordenfelt licence",
      },
      tube_14in_above_water: {
        status: "DOMESTIC",
        producer: "Schwarzkopf",
      },
      tube_14in_submerged: {
        status: "DOMESTIC",
        producer: "Schwarzkopf",
      },
    },
    gunModels: [
      {
        id: "de_26cm_rk_l20",
        familyId: "gun_bl_263mm_rkl20",
        designation: "26 cm RK L/20 (Krupp)",
        overrides: {
          displayName: "26 cm Ringkanone L/20 in turret (Krupp)",
          "attributes.shellMassG": "250000",
        },
        mounts: ["TURRET", "BARBETTE"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          note: "German 26 cm RK main armament of the Kaiser/Sachsen classes; shell mass ESTIMATE pending a Print source.",
          sources: [
            {
              sourceId: "ship-1880-ships",
              title: "Ship-building 1880 ships by nation note",
              page: "Germany",
            },
          ],
        },
      },
      {
        id: "de_15cm_rk_l25",
        familyId: "gun_bl_6in_26",
        designation: "15 cm RK L/25 (Krupp)",
        overrides: {
          displayName: "15 cm Ringkanone L/25 in casemate (Krupp)",
          "attributes.shellMassG": "51000",
        },
        mounts: ["CASEMATE", "DECK_SHIELDED"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          note: "German 26 cm RK main armament of the Kaiser/Sachsen classes; shell mass ESTIMATE pending a Print source.",
          sources: [
            {
              sourceId: "ship-1880-ships",
              title: "Ship-building 1880 ships by nation note",
              page: "Germany",
            },
          ],
        },
      },
    ],
    ammunitionPatterns: [
      {
        id: "de_ap_krupp",
        pattern: "AP",
        penetrationBiasBp: 8500,
        provenance: {
          sourceStatus: "BALANCE_TARGET",
          confidence: "LOW",
          kind: "balance_adjustment",
          note: "Krupp steel shot; the exact AP/HE split is a balance choice, not a sourced figure.",
          sources: [
            {
              sourceId: "eb-1911",
              title: "Encyclopaedia Britannica 11th ed., 'Armour Plates'",
            },
          ],
        },
      },
      {
        id: "de_he_common",
        pattern: "HE",
        penetrationBiasBp: 2500,
        provenance: {
          sourceStatus: "BALANCE_TARGET",
          confidence: "LOW",
          kind: "balance_adjustment",
          sources: [
            {
              sourceId: "germany-note",
              title: "National naval profiles research note (UK/France)",
              page: "method",
            },
          ],
        },
      },
    ],
    componentVariants: [
      {
        id: "de_tube_450_aw",
        familyId: "tube_14in_above_water",
        designation: "Schwarzkopf 45 cm torpedo tube, above water",
        overrides: {
          displayName: "45 cm Schwarzkopf torpedo tube, above-water beam",
        },
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "navypedia-de",
              title: "navypedia.org German class pages",
            },
          ],
        },
      },
      {
        id: "de_tube_450_sub",
        familyId: "tube_14in_submerged",
        designation: "Schwarzkopf 45 cm torpedo tube, submerged bow",
        overrides: {
          displayName: "45 cm Schwarzkopf torpedo tube, submerged bow",
        },
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "navypedia-de",
              title: "navypedia.org German class pages",
            },
          ],
        },
      },
    ],
    designWeights: {
      B: {
        firepowerBp: 11500,
        protectionBp: 12500,
        speedBp: 9000,
        enduranceBp: 9000,
        torpedoBp: 9500,
        reliabilityBp: 11000,
        colonialBp: 8500,
        costBp: 10500,
      },
      CA: {
        firepowerBp: 10500,
        protectionBp: 11500,
        speedBp: 10000,
        enduranceBp: 9500,
        torpedoBp: 10500,
        reliabilityBp: 10500,
        colonialBp: 9000,
        costBp: 10500,
      },
      CL: {
        firepowerBp: 10000,
        protectionBp: 10000,
        speedBp: 10500,
        enduranceBp: 10000,
        torpedoBp: 10500,
        reliabilityBp: 10500,
        colonialBp: 9500,
        costBp: 10500,
      },
      DD: {
        firepowerBp: 8000,
        protectionBp: 8500,
        speedBp: 12500,
        enduranceBp: 9000,
        torpedoBp: 13000,
        reliabilityBp: 10500,
        colonialBp: 9000,
        costBp: 11500,
      },
      KE: {
        firepowerBp: 8500,
        protectionBp: 9000,
        speedBp: 9500,
        enduranceBp: 10500,
        torpedoBp: 9500,
        reliabilityBp: 10500,
        colonialBp: 11000,
        costBp: 11500,
      },
      AMC: {
        firepowerBp: 9000,
        protectionBp: 9000,
        speedBp: 9500,
        enduranceBp: 11500,
        torpedoBp: 10500,
        reliabilityBp: 10000,
        colonialBp: 10000,
        costBp: 11500,
      },
    },
    procurementPolicy: {
      battleLineShareBp: 3200,
      cruiserShareBp: 2800,
      torpedoCraftShareBp: 2800,
      colonialShareBp: 1200,
      foreignProcurementAppetiteBp: 2000,
      unprovenTechAppetiteBp: 3000,
      buildOrder: ["B", "DD", "CL", "CA", "KE", "AMC"],
    },
    namingPolicy: {
      stems: {
        B: [
          "Kaiser",
          "Sachsen",
          "Bayern",
          "Wurttemberg",
          "Baden",
          "Oldenburg",
          "Worth",
          "Brandenburg",
          "Kurfurst Friedrich Wilhelm",
          "Weissenburg",
        ],
        CA: ["Furst Bismarck", "Prinz Heinrich", "Prinz Adalbert", "Roon"],
        CL: ["Irene", "Prinzeß Wilhelm", "Victoria Louise", "Gazelle", "Bremen"],
        DD: ["S113", "S114", "G132", "V150"],
        KE: ["Iltis", "Wolf", "Mowe", "Habicht", "Jaguar"],
        AMC: ["Preussen", "Hessen", "Hamburg"],
      },
      convention: {
        B: "Dynastic, kingdom and battleship names (Kaiser, Sachsen, Brandenburg).",
        CA: "Princely and statesman names (Furst Bismarck, Prinz Heinrich).",
        CL: "Princely and mythological names (Irene, Victoria Louise, Gazelle).",
        DD: "Shipyard letter plus number (S113, G132).",
        KE: "Animals of prey (Iltis, Wolf, Jaguar).",
        AMC: "Provincial and Hanseatic names taken up from trade.",
      },
    },
    sourceReferences: [
      {
        sourceId: "ship-1880-ships",
        title: "Ship-building 1880 ships by nation note",
        page: "Germany",
      },
      {
        sourceId: "roksund-2007",
        title: "A. Roksund, The Jeune Ecole: The Strategy of the Weak",
        author: "A. Roksund",
        year: 2007,
      },
      {
        sourceId: "eb-1911",
        title: "Encyclopaedia Britannica 11th ed., 'Armour Plates'",
        year: 1911,
      },
      {
        sourceId: "navypedia-de",
        title: "navypedia.org German class pages",
        archiveOrUrl: "http://www.navypedia.org",
      },
    ],
    provenance: {
      sourceStatus: "ESTIMATE",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      note: "Grounded shape (coastal/battle-fleet, Krupp quality, torpedo growth); weights and multipliers are BALANCE TARGET.",
      sources: [
        {
          sourceId: "ship-1880-ships",
          title: "Ship-building 1880 ships by nation note",
          page: "Germany",
        },
        {
          sourceId: "roksund-2007",
          title: "A. Roksund, The Jeune Ecole (Brill, 2007) - relayed",
        },
      ],
      derivation: {
        sourceValue: "grounded shape; no single sourced multiplier",
        sourceUnit: "mixed",
        conversion: "weights and shares are gameplay abstractions",
        gameValue: "profile as authored",
        roundingRule: "multipliers within ±15%",
      },
    },
  },
]);
