import { PartSchema, collection } from "@bluewave/content-authoring";

export default collection("parts", PartSchema, [
  {
    id: "rad_type_286_search",
    family: "radar",
    provides: "radar",
    name: "Type 286 surface-search radar",
    lifecycle: {
      availableFrom: "1940-01",
      availableUntil: null,
      requires: ["rad_search_radar"],
    },
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 9000,
        },
        envelopeHeightMm: 2200,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 20,
          },
        ],
      },
    },
    capabilities: [
      {
        kind: "search_radar",
        level: 2,
      },
    ],
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 350000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 4,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 1200,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 900000,
      },
    ],
    spec: {
      rangeNm: 30,
      reliabilityBp: 7000,
    },
    revisions: [],
    origin: {
      sourceFile: "ship-building/parts/radar.yaml",
    },
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Naval Radar",
          author: "N. Friedman, 1981",
        },
        {
          title: "Rule the Waves 3 manual",
          author: "Naval War Simulations / Matrix Games",
          year: 2023,
          page: "121",
        },
      ],
      note: "ADR-0311. The manual grounds search radar and gives no range, weight or cost. The 30 nm range, mass, cost and crew are Bluewave balance targets derived from the optical rangefinder part, scaled for a wartime set.",
    },
  },
  {
    id: "rad_type_284_fire_control",
    family: "radar",
    provides: "radar",
    name: "Type 284 gunnery fire-control radar",
    lifecycle: {
      availableFrom: "1941-01",
      availableUntil: null,
      requires: ["rad_gunnery_fire_control_radar"],
    },
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 10000,
        },
        envelopeHeightMm: 2400,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 30,
          },
        ],
      },
    },
    capabilities: [
      {
        kind: "fire_control_radar",
        level: 2,
      },
    ],
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 1300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 500000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 5,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 1500,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 1000000,
      },
    ],
    spec: {
      rangeNm: 20,
      reliabilityBp: 7500,
    },
    revisions: [],
    origin: {
      sourceFile: "ship-building/parts/radar.yaml",
    },
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Naval Radar",
          author: "N. Friedman, 1981",
        },
        {
          title: "Rule the Waves 3 manual",
          author: "Naval War Simulations / Matrix Games",
          year: 2023,
          page: "121, 127",
        },
      ],
      note: "ADR-0311. The manual grounds fire-control radar and gives no accuracy figure. The level-2 accuracy multiplier is a balance target in the gunnery ruleset; mass, cost and crew are derived from the search set with the fire-control weight adder.",
    },
  },
  {
    id: "rad_type_284b_blind_fire",
    family: "radar",
    provides: "radar",
    name: "Type 284B blind-fire gunnery radar",
    lifecycle: {
      availableFrom: "1943-01",
      availableUntil: null,
      requires: ["rad_blind_fire_director"],
    },
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 10000,
        },
        envelopeHeightMm: 2400,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 35,
          },
        ],
      },
    },
    capabilities: [
      {
        kind: "fire_control_radar",
        level: 3,
      },
    ],
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 600000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 5,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 1600,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 1000000,
      },
    ],
    spec: {
      rangeNm: 24,
      reliabilityBp: 7500,
    },
    revisions: [],
    origin: {
      sourceFile: "ship-building/parts/radar.yaml",
    },
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [
        {
          title: "Naval Radar",
          author: "N. Friedman, 1981",
        },
        {
          title: "Rule the Waves 3 manual",
          author: "Naval War Simulations / Matrix Games",
          year: 2023,
          page: "121",
        },
      ],
      note: "ADR-0311. The manual says fire control from level 3 allows blind fire and gives no accuracy figure. The level-3 accuracy multiplier and blind-fire threshold are balance targets in the gunnery ruleset; mass and cost are the level-2 set plus the blind-fire director.",
    },
  },
]);
