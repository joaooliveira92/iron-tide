// National naval profiles (NationNavalProfile) for the EARLY band, one file per nation.
// Every historical value carries a provenance block (sourceStatus / confidence / kind / sources); every balance
// target is labelled `balance_adjustment`. Grounding: docs/research/<nation>-naval-profile.md.
// Hard capability only ever restricts (UNAVAILABLE families, calibre ceilings); it never grants. Soft doctrine
// steers templates, AI scoring and procurement, and never blocks a legal design (docs/ships-nation-orientation.md).
// Spain (canonical id "spain"). A declining former first-rank empire with a tiny, ageing ironclad squadron, colonial
// station duties in Cuba and the Philippines, weak finances and heavy import dependence. Grounding:
// docs/research/spain-naval-profile.md.
import { NationNavalProfileSchema, collection } from "@bluewave/content-authoring";

export default collection("navalProfiles", NationNavalProfileSchema, [
  {
    nationId: "spain",
    activeFrom: "1880-01",
    activeUntil: null,
    strategicSituation:
      "Declining imperial power: a tiny, ageing ironclad squadron and a handful of unprotected cruisers and gunboats, tasked with colonial station duty in Cuba and the Philippines, coast defence at home, and keeping the sea lifeline open, on weak finances and with most ships built abroad.",
    hardCapabilities: {
      maxGunCaliberUm: 320000,
      maxArmourThicknessUm: 305000,
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
      speedOverArmourBp: 5000,
      secondaryBatteryWeightBp: 10000,
      enduranceWeightBp: 10000,
      riskToleranceBp: 5500,
      colonialServiceWeightBp: 11500,
      torpedoOnCruisersBp: 9000,
      accommodationStandard: "SPARTAN",
    },
    industrialProfile: {
      buildTimeMultiplierBp: 11000,
      costMultiplierBp: 10800,
      machineryReliabilityBp: 8300,
      constructionQualityVarianceBp: 3800,
      maxPracticalDisplacementKg: [
        {
          fromMonth: "1880-01",
          value: 7200000,
        },
        {
          fromMonth: "1885-01",
          value: 9700000,
        },
        {
          fromMonth: "1890-01",
          value: 9800000,
        },
      ],
      heavyGunProduction: "IMPORTED",
      armourPlateProduction: "IMPORTED",
      provenance: {
        sourceStatus: "ESTIMATE",
        confidence: "MEDIUM",
        kind: "balance_adjustment",
        note: "Slow, material-starved state yards; most ships bought abroad. Multipliers are BALANCE TARGET within ±15%.",
        sources: [
          {
            sourceId: "spain-note",
            title: "National naval profile research note — Spain",
            page: "B",
          },
          {
            sourceId: "navypedia-es",
            title: "navypedia.org Spanish class pages",
          },
        ],
        derivation: {
          sourceValue: "Alfonso XII 1881-1891; Lepanto 1886-1899; imports",
          sourceUnit: "estimate",
          conversion: "within the ±15% band",
          gameValue: "buildTimeMultiplierBp 11000, costMultiplierBp 10800",
          roundingRule: "±15%",
        },
      },
    },
    dock: {
      maximumNewConstructionMassKg: 8000000,
      maximumMajorRepairMassKg: 8000000,
      maximumRebuildMassKg: 8000000,
      maximumConversionMassKg: 8000000,
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
          sourceValue: "Numancia 7,189 t (largest 1880 hull)",
          sourceUnit: "t",
          conversion:
            "largest 1880 hull the nation fields, rounded up to the next 1,000 t dock step",
          gameValue: "maximumNewConstructionMassKg 8000000",
          roundingRule: "ceiling to next 1,000 t",
        },
        note: "historical flagship rounded up to the next 1,000 t",
      },
    },
    doctrineProfile: {
      engagementRangeM: 1500,
      hePreferenceBp: 4500,
      postures: [
        "coastal_defence",
        "colonial_presence",
        "distant_water_operations",
        "commerce_defence",
      ],
      provenance: {
        sourceStatus: "ESTIMATE",
        confidence: "MEDIUM",
        kind: "historical_fact",
        sources: [
          {
            sourceId: "spain-note",
            title: "National naval profile research note — Spain",
            page: "A, C",
          },
          {
            sourceId: "navypedia-es",
            title: "navypedia.org Spanish class pages",
          },
        ],
      },
    },
    researchPreferences: [
      {
        field: "INFRASTRUCTURE",
        priority: 3,
      },
      {
        field: "GUNNERY",
        priority: 3,
      },
      {
        field: "HULL_CONSTRUCTION",
        priority: 3,
      },
      {
        field: "DAMAGE_CONTROL",
        priority: 2,
      },
      {
        field: "TORPEDOES",
        priority: 2,
      },
      {
        field: "MACHINERY",
        priority: 2,
      },
      {
        field: "MINES_AND_ASW",
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
      gun_bl_10in_32: {
        status: "UNAVAILABLE",
      },
      gun_bl_92in_315: {
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
      gun_qf_6in_40: {
        status: "UNAVAILABLE",
      },
      gun_rml_10in_18ton: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_10in_18ton_broadside: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_10in_12ton_300pdr: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_8in_9ton: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_rml_64pdr_71cwt: {
        status: "IMPORTED",
        producer: "Armstrong",
      },
      gun_bl_6in_26: {
        status: "DOMESTIC",
        producer: "Hontoria",
      },
      gun_qf_47in: {
        status: "DOMESTIC",
        producer: "Hontoria",
      },
      gun_qf_12pdr: {
        status: "IMPORTED",
        producer: "Krupp",
      },
      tube_14in_above_water: {
        status: "IMPORTED",
        producer: "Whitehead",
      },
    },
    gunModels: [
      {
        id: "es_armstrong_254",
        familyId: "gun_rml_10in_12ton_300pdr",
        designation: "254 mm Armstrong 12-ton 300-pdr RML",
        overrides: {
          displayName: "254 mm Armstrong 12-ton 300-pdr RML in broadside",
        },
        mounts: ["BROADSIDE_BATTERY", "DECK_OPEN"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "spain-note",
              title: "National naval profile research note — Spain",
              page: "F",
            },
          ],
        },
      },
      {
        id: "es_armstrong_203",
        familyId: "gun_rml_8in_9ton",
        designation: "203 mm Armstrong 9-ton RML",
        overrides: {
          displayName: "203 mm Armstrong 9-ton RML in casemate",
        },
        mounts: ["BROADSIDE_BATTERY", "CASEMATE", "DECK_SHIELDED"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "spain-note",
              title: "National naval profile research note — Spain",
              page: "F",
            },
          ],
        },
      },
      {
        id: "es_palliser_160",
        familyId: "gun_rml_64pdr_71cwt",
        designation: "160 mm Palliser RML",
        overrides: {
          displayName: "160 mm Palliser RML",
        },
        mounts: ["BROADSIDE_BATTERY", "DECK_OPEN"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "spain-note",
              title: "National naval profile research note — Spain",
              page: "F",
            },
          ],
        },
      },
      {
        id: "es_hontoria_160",
        familyId: "gun_bl_6in_26",
        designation: "160 mm Hontoria M1879",
        overrides: {
          displayName: "160 mm Hontoria M1879 in shielded mount",
        },
        mounts: ["DECK_SHIELDED", "BROADSIDE_BATTERY"],
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "spain-note",
              title: "National naval profile research note — Spain",
              page: "F",
            },
          ],
        },
      },
    ],
    ammunitionPatterns: [
      {
        id: "es_palliser_ap",
        pattern: "AP",
        penetrationBiasBp: 6000,
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "LOW",
          kind: "balance_adjustment",
          sources: [
            {
              sourceId: "spain-note",
              title: "National naval profile research note — Spain",
              page: "C",
            },
          ],
        },
      },
    ],
    componentVariants: [
      {
        id: "es_tube_356_aw",
        familyId: "tube_14in_above_water",
        designation: "356 mm Whitehead, above-water",
        overrides: {
          displayName: "356 mm Whitehead torpedo tube, above-water",
        },
        provenance: {
          sourceStatus: "ESTIMATE",
          confidence: "MEDIUM",
          kind: "historical_fact",
          sources: [
            {
              sourceId: "spain-note",
              title: "National naval profile research note — Spain",
              page: "F",
            },
          ],
        },
      },
    ],
    designWeights: {
      B: {
        firepowerBp: 11000,
        protectionBp: 11000,
        speedBp: 9000,
        enduranceBp: 10000,
        torpedoBp: 9500,
        reliabilityBp: 9500,
        colonialBp: 9500,
        costBp: 11500,
      },
      CA: {
        firepowerBp: 10500,
        protectionBp: 10000,
        speedBp: 10500,
        enduranceBp: 11500,
        torpedoBp: 10000,
        reliabilityBp: 9500,
        colonialBp: 11000,
        costBp: 11000,
      },
      CL: {
        firepowerBp: 9500,
        protectionBp: 9000,
        speedBp: 11000,
        enduranceBp: 13000,
        torpedoBp: 10000,
        reliabilityBp: 9500,
        colonialBp: 12000,
        costBp: 11000,
      },
      DD: {
        firepowerBp: 8000,
        protectionBp: 8000,
        speedBp: 12500,
        enduranceBp: 9000,
        torpedoBp: 12500,
        reliabilityBp: 9500,
        colonialBp: 9500,
        costBp: 11500,
      },
      KE: {
        firepowerBp: 8500,
        protectionBp: 8500,
        speedBp: 9500,
        enduranceBp: 11500,
        torpedoBp: 9000,
        reliabilityBp: 10000,
        colonialBp: 13000,
        costBp: 11500,
      },
      AMC: {
        firepowerBp: 9000,
        protectionBp: 8500,
        speedBp: 9500,
        enduranceBp: 13000,
        torpedoBp: 9500,
        reliabilityBp: 9500,
        colonialBp: 12500,
        costBp: 11500,
      },
    },
    procurementPolicy: {
      battleLineShareBp: 2200,
      cruiserShareBp: 3600,
      torpedoCraftShareBp: 2000,
      colonialShareBp: 2200,
      foreignProcurementAppetiteBp: 5500,
      unprovenTechAppetiteBp: 3500,
      buildOrder: ["CL", "CA", "B", "KE", "DD", "AMC"],
    },
    namingPolicy: {
      stems: {
        B: ["Numancia", "Vitoria", "Sagunto", "Zaragoza", "Mendez Nunez", "Pelayo", "Carlos V"],
        CA: [
          "Infanta Maria Teresa",
          "Vizcaya",
          "Almirante Oquendo",
          "Cristobal Colon",
          "Princesa de Asturias",
        ],
        CL: [
          "Reina Regente",
          "Alfonso XIII",
          "Lepanto",
          "Velasco",
          "Gravina",
          "Infanta Isabel",
          "Aragon",
          "Navarra",
        ],
        DD: ["Castor", "Rigel", "Orion", "Azor", "Ariete", "Destructor", "Furor", "Terror"],
        KE: ["Somorrostro", "Ebro", "Bidasoa", "Nervion", "Tajo", "Turia", "Segura", "Pilar"],
        AMC: ["Ciudad de Cadiz", "Ciudad de Barcelona"],
      },
      convention: {
        B: "Historic battles, provinces and admirals (Numancia, Pelayo).",
        CA: "Royal, province and admiral names (Infanta Maria Teresa, Vizcaya).",
        CL: "Royal, colonial place and admiral names (Reina Regente, Gravina).",
        DD: "Mythological, astronomical and torpedo-boat names (Castor, Destructor).",
        KE: "Rivers and coastal places (Ebro, Somorrostro).",
        AMC: "Liner names taken up from trade.",
      },
    },
    sourceReferences: [
      {
        sourceId: "spain-note",
        title: "National naval profile research note — Spain",
      },
      {
        sourceId: "navypedia-es",
        title: "navypedia.org Spanish class pages",
        archiveOrUrl: "http://www.navypedia.org",
      },
      {
        sourceId: "ship-1880-ships",
        title: "Ship-building 1880 ships by nation note",
        page: "Spain",
      },
    ],
    provenance: {
      sourceStatus: "ESTIMATE",
      confidence: "MEDIUM",
      kind: "balance_adjustment",
      note: "Grounded shape (ageing ironclads, colonial station duty, import dependence); weights and multipliers are BALANCE TARGET.",
      sources: [
        {
          sourceId: "spain-note",
          title: "National naval profile research note — Spain",
          page: "A, B, C, F",
        },
        {
          sourceId: "ship-1880-ships",
          title: "Ship-building 1880 ships by nation note",
          page: "Spain",
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
