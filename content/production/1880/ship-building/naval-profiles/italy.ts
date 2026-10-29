// National naval profiles (NationNavalProfile) for the EARLY band, one file per nation.
// Every historical value carries a provenance block (sourceStatus / confidence / kind / sources); every balance
// target is labelled `balance_adjustment`. Grounding: docs/research/<nation>-naval-profile.md.
// Hard capability only ever restricts (UNAVAILABLE families, calibre ceilings); it never grants. Soft doctrine
// steers templates, AI scoring and procurement, and never blocks a legal design (docs/ships-nation-orientation.md).
// Italy (canonical id "italy"). A young Mediterranean power whose Regia Marina exists for the Mare Nostrum: a
// coastal-defence and regional posture, a small but ambitious battle line built on imported Armstrong/Elswick guns
// and Creusot armour, speed-and-gun over armour, and a strong torpedo emphasis. Grounding: docs/research/italy-naval-profile.md.
import { NationNavalProfileSchema, collection } from "@bluewave/content-authoring";

export default collection("navalProfiles", NationNavalProfileSchema, [
  {
    nationId: "italy",
    activeFrom: "1880-01",
    activeUntil: null,
    strategicSituation:
      "Young Mediterranean power: a two-sea (Tyrrhenian/Adriatic) navy built for the Mare Nostrum, with a small but ambitious battle line on imported Armstrong guns and foreign armour, speed and heavy guns prized over protection, a strong torpedo arm, and colonial ambition not yet matched by territory.",
    hardCapabilities: {
      maxGunCaliberUm: 343000,
      maxArmourThicknessUm: 457000,
      domesticTorpedoDiameterUm: 356000,
      hullForms: [
        "torpedo_boat_form",
        "protected_cruiser_form",
        "coast_defence_form",
        "pre_dreadnought_form",
        "merchant_liner_form",
      ],
      domesticPlants: ["compound_cylindrical", "triple_expansion_cylindrical"],
      restrictedShipTypes: [],
      grants: [],
    },
    softPreferences: {
      speedOverArmourBp: 6000,
      secondaryBatteryWeightBp: 11000,
      enduranceWeightBp: 9000,
      riskToleranceBp: 7000,
      colonialServiceWeightBp: 9000,
      torpedoOnCruisersBp: 12500,
      accommodationStandard: "SPARTAN",
    },
    industrialProfile: {
      buildTimeMultiplierBp: 10800,
      costMultiplierBp: 10900,
      machineryReliabilityBp: 8000,
      constructionQualityVarianceBp: 3500,
      maxPracticalDisplacementKg: [
        {
          fromMonth: "1880-01",
          value: 11000000,
        },
        {
          fromMonth: "1885-01",
          value: 13700000,
        },
        {
          fromMonth: "1890-01",
          value: 14000000,
        },
      ],
      heavyGunProduction: "IMPORTED",
      armourPlateProduction: "LICENSE_BUILT",
      provenance: {
        sourceStatus: "ESTIMATE",
        confidence: "MEDIUM",
        kind: "balance_adjustment",
        note: "Long builds and programme overruns; Armstrong guns and Creusot/Terni armour. BALANCE TARGET within ±15%.",
        sources: [
          {
            sourceId: "italy-note",
            title: "National naval profile research note — Italy",
            page: "B",
          },
          {
            sourceId: "bras86",
            title: "The Naval Annual 1886",
            page: "Italian estimates",
          },
        ],
        derivation: {
          sourceValue: "1877-87 programme overran estimate ~34%; small state yards",
          sourceUnit: "estimate",
          conversion: "within the ±15% band",
          gameValue: "buildTimeMultiplierBp 10800, costMultiplierBp 10900",
          roundingRule: "±15%",
        },
      },
    },
    dock: {
      maximumNewConstructionMassKg: 14000000,
      maximumMajorRepairMassKg: 14000000,
      maximumRebuildMassKg: 14000000,
      maximumConversionMassKg: 14000000,
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
          sourceValue: "Italia 13,900 t (largest 1880 hull)",
          sourceUnit: "t",
          conversion:
            "largest 1880 hull the nation fields, rounded up to the next 1,000 t dock step",
          gameValue: "maximumNewConstructionMassKg 14000000",
          roundingRule: "ceiling to next 1,000 t",
        },
        note: "historical flagship rounded up to the next 1,000 t",
      },
    },
    doctrineProfile: {
      engagementRangeM: 1500,
      hePreferenceBp: 4000,
      postures: [
        "coastal_defence",
        "regional_warfare",
        "battle_fleet_concentration",
        "torpedo_warfare",
      ],
      provenance: {
        sourceStatus: "ESTIMATE",
        confidence: "MEDIUM",
        kind: "historical_fact",
        sources: [
          {
            sourceId: "italy-note",
            title: "National naval profile research note — Italy",
            page: "A, C",
          },
          {
            sourceId: "navypedia-it",
            title: "navypedia.org Italian class pages",
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
        field: "TORPEDOES",
        priority: 4,
      },
      {
        field: "HULL_CONSTRUCTION",
        priority: 3,
      },
      {
        field: "MACHINERY",
        priority: 3,
      },
      {
        field: "SHIP_DESIGN",
        priority: 3,
      },
      {
        field: "INFRASTRUCTURE",
        priority: 2,
      },
      {
        field: "DAMAGE_CONTROL",
        priority: 2,
      },
      {
        field: "MINES_AND_ASW",
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
      gun_bl_274mm_m1875: {
        status: "UNAVAILABLE",
      },
      gun_bl_263mm_rkl20: {
        status: "UNAVAILABLE",
      },
      gun_bl_135in_30: {
        status: "UNAVAILABLE",
      },
      gun_bl_12in_35: {
        status: "UNAVAILABLE",
      },
      gun_bl_12in_25: {
        status: "UNAVAILABLE",
      },
      gun_bl_6in_26: {
        status: "UNAVAILABLE",
      },
      gun_rml_16in_80ton: {
        status: "UNAVAILABLE",
      },
      gun_rml_125in_38ton: {
        status: "UNAVAILABLE",
      },
      gun_rml_12in_35ton: {
        status: "UNAVAILABLE",
      },
      gun_rml_12in_25ton: {
        status: "UNAVAILABLE",
      },
      gun_rml_7in_7ton: {
        status: "UNAVAILABLE",
      },
      gun_rml_11in_25ton: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_10in_18ton: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_10in_18ton_broadside: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_64pdr_71cwt: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_bl_10in_32: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_qf_6in_40: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_qf_47in: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_qf_12pdr: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      tube_14in_above_water: {
        status: "IMPORTED",
        producer: "Whitehead",
      },
    },
    gunModels: [
      {
        id: "it_armstrong_279",
        familyId: "gun_rml_11in_25ton",
        designation: "Armstrong 25-ton RML (279 mm)",
        overrides: {
          displayName: "Armstrong 279 mm 25-ton RML in casemate",
        },
        mounts: ["CASEMATE", "TURRET", "BARBETTE"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "italy-note",
              title: "National naval profile research note — Italy",
              page: "F",
            },
          ],
        },
      },
      {
        id: "it_armstrong_254",
        familyId: "gun_rml_10in_18ton",
        designation: "Armstrong 18-ton RML No.1 (254 mm)",
        overrides: {
          displayName: "Armstrong 254 mm 18-ton RML No.1 in casemate",
        },
        mounts: ["CASEMATE", "TURRET"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "italy-note",
              title: "National naval profile research note — Italy",
              page: "F",
            },
          ],
        },
      },
      {
        id: "it_armstrong_6in",
        familyId: "gun_qf_6in_40",
        designation: "Armstrong 152/40 QF",
        overrides: {
          displayName: "Armstrong 152 mm 40-calibre QF in shielded mount",
        },
        mounts: ["DECK_SHIELDED", "CASEMATE"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "italy-note",
              title: "National naval profile research note — Italy",
              page: "F",
            },
          ],
        },
      },
      {
        id: "it_armstrong_120",
        familyId: "gun_qf_47in",
        designation: "Armstrong 120/40 QF",
        overrides: {
          displayName: "Armstrong 120 mm 40-calibre QF in shielded mount",
        },
        mounts: ["DECK_SHIELDED", "DECK_OPEN"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "italy-note",
              title: "National naval profile research note — Italy",
              page: "F",
            },
          ],
        },
      },
    ],
    ammunitionPatterns: [
      {
        id: "it_palliser",
        pattern: "AP",
        penetrationBiasBp: 6000,
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "LOW",
          kind: "balance_adjustment",
          sources: [
            {
              sourceId: "italy-note",
              title: "National naval profile research note — Italy",
              page: "C",
            },
          ],
        },
      },
    ],
    componentVariants: [
      {
        id: "it_tube_350_aw",
        familyId: "tube_14in_above_water",
        designation: "Whitehead 350 mm, above-water (imported)",
        overrides: {
          displayName: "Whitehead 350 mm torpedo tube, above-water",
        },
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "italy-note",
              title: "National naval profile research note — Italy",
              page: "F",
            },
          ],
        },
      },
    ],
    designWeights: {
      B: {
        firepowerBp: 12500,
        protectionBp: 10500,
        speedBp: 10000,
        enduranceBp: 9000,
        torpedoBp: 10500,
        reliabilityBp: 9500,
        colonialBp: 8500,
        costBp: 11000,
      },
      CA: {
        firepowerBp: 11500,
        protectionBp: 9500,
        speedBp: 11500,
        enduranceBp: 9500,
        torpedoBp: 11500,
        reliabilityBp: 9500,
        colonialBp: 9000,
        costBp: 11000,
      },
      CL: {
        firepowerBp: 10500,
        protectionBp: 9000,
        speedBp: 12000,
        enduranceBp: 10000,
        torpedoBp: 12000,
        reliabilityBp: 9500,
        colonialBp: 9500,
        costBp: 11500,
      },
      DD: {
        firepowerBp: 8500,
        protectionBp: 8000,
        speedBp: 13500,
        enduranceBp: 8500,
        torpedoBp: 14000,
        reliabilityBp: 9500,
        colonialBp: 8500,
        costBp: 12000,
      },
      KE: {
        firepowerBp: 9000,
        protectionBp: 8500,
        speedBp: 10000,
        enduranceBp: 10500,
        torpedoBp: 10500,
        reliabilityBp: 10000,
        colonialBp: 10500,
        costBp: 12000,
      },
      AMC: {
        firepowerBp: 10000,
        protectionBp: 8500,
        speedBp: 10000,
        enduranceBp: 12000,
        torpedoBp: 11000,
        reliabilityBp: 9500,
        colonialBp: 10500,
        costBp: 11500,
      },
    },
    procurementPolicy: {
      battleLineShareBp: 3200,
      cruiserShareBp: 2800,
      torpedoCraftShareBp: 2800,
      colonialShareBp: 1200,
      foreignProcurementAppetiteBp: 6000,
      unprovenTechAppetiteBp: 6000,
      buildOrder: ["B", "CL", "DD", "CA", "KE", "AMC"],
    },
    namingPolicy: {
      stems: {
        B: [
          "Duilio",
          "Dandolo",
          "Italia",
          "Lepanto",
          "Ruggiero di Lauria",
          "Andrea Doria",
          "Re Umberto",
          "Sicilia",
        ],
        CA: [
          "Marco Polo",
          "Vettor Pisani",
          "Giuseppe Garibaldi",
          "Carlo Alberto",
          "Varese",
          "Pisa",
        ],
        CL: [
          "Giovanni Bausan",
          "Etna",
          "Vesuvio",
          "Stromboli",
          "Dogali",
          "Piemonte",
          "Umbria",
          "Lombardia",
        ],
        DD: ["Nibbio", "Avvoltoio", "Sparviero", "Aquila", "Clio", "Aldebaran", "Vega"],
        KE: ["Guardiano", "Sentinella", "Scilla", "Cariddi", "Vedetta", "Governolo"],
        AMC: ["Duca di Galliera", "Citta di Torino", "Sirio", "Liguria"],
      },
      convention: {
        B: "Royal, heroic and designer battleship names (Duilio, Italia).",
        CA: "Explorers, admirals and cities (Marco Polo, Vettor Pisani).",
        CL: "Geographic and battle-honour names (Etna, Piemonte).",
        DD: "Birds of prey, then constellations (Nibbio, Vega).",
        KE: "Mythological and geographic sentinels (Scilla, Vedetta).",
        AMC: "Liner names taken up from trade.",
      },
    },
    sourceReferences: [
      {
        sourceId: "italy-note",
        title: "National naval profile research note — Italy",
      },
      {
        sourceId: "navypedia-it",
        title: "navypedia.org Italian class pages",
        archiveOrUrl: "http://www.navypedia.org",
      },
      {
        sourceId: "ship-1880-ships",
        title: "Ship-building 1880 ships by nation note",
        page: "Italy",
      },
    ],
    provenance: {
      sourceStatus: "ESTIMATE",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      note: "Grounded shape (Mediterranean, imported Armstrong guns, torpedo emphasis); weights and multipliers are BALANCE TARGET.",
      sources: [
        {
          sourceId: "italy-note",
          title: "National naval profile research note — Italy",
          page: "A, B, C, F",
        },
        {
          sourceId: "ship-1880-ships",
          title: "Ship-building 1880 ships by nation note",
          page: "Italy",
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
