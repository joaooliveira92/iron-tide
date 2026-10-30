import { PartSchema, collection } from "@bluewave/content-authoring";

export default collection("parts", PartSchema, [
  {
    engineering: {
      cooling: {
        demand: [
          {
            basis: "PER_PART_UNIT",
            id: "cooling",
            kind: "powerKw",
            value: 6,
          },
        ],
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 1500,
        },
        envelopeHeightMm: 1800,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
        generation: [
          {
            basis: "PER_PART_UNIT",
            id: "generation",
            kind: "powerKw",
            value: 60,
          },
        ],
      },
    },
    family: "fitting",
    id: "dynamo_small",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    metadata: {
      tags: ["electrical"],
    },
    name: "Dynamo set, 60 kW",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'dynamo_small', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "electrical_plant",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 1200,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 200000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 2,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 2500,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 2000000,
      },
    ],
    revisions: [],
    spec: {},
  },
  {
    capabilities: [
      {
        blockedDeg: 20,
        kind: "arc_obstruction",
        reachPermille: 60,
      },
    ],
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 6500,
        },
        envelopeHeightMm: 6000,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
      },
    },
    family: "fitting",
    id: "funnel_single",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    metadata: {
      tags: ["funnel"],
    },
    name: "Funnel",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'funnel_single', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "funnel",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 5000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 60000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 1000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 4000000,
      },
    ],
    revisions: [],
    spec: {},
  },
  {
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 2400,
        },
        envelopeHeightMm: 2600,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
      },
    },
    family: "fitting",
    id: "magazine_heavy",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      supersedes: ["magazine_medium"],
    },
    metadata: {
      tags: ["magazine"],
    },
    name: "Magazine, heavy (main battery)",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'magazine_heavy', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "magazine",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 3000000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 8,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 130000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 30000000,
      },
    ],
    revisions: [],
    spec: {
      critical: true,
      flashProtectionBp: 0,
      magazineLitre: 120000,
    },
  },
  {
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 2200,
        },
        envelopeHeightMm: 2400,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
      },
    },
    family: "fitting",
    id: "magazine_medium",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      supersedes: ["magazine_small"],
    },
    metadata: {
      tags: ["magazine"],
    },
    name: "Magazine, medium (secondary guns)",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'magazine_medium', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "magazine",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 900000000,
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
        value: 33000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 9000000,
      },
    ],
    revisions: [],
    spec: {
      critical: true,
      flashProtectionBp: 0,
      magazineLitre: 30000,
    },
  },
  {
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 2200,
        },
        envelopeHeightMm: 2200,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
      },
    },
    family: "fitting",
    id: "magazine_small",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    metadata: {
      tags: ["magazine"],
    },
    name: "Magazine, small (light guns and shell rooms)",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'magazine_small', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "magazine",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 300000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 2,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 9000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 4000000,
      },
    ],
    revisions: [],
    spec: {
      critical: true,
      flashProtectionBp: 0,
      magazineLitre: 8000,
    },
  },
  {
    capabilities: [
      {
        effectBp: 500,
        kind: "damage_control",
      },
    ],
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 1800,
        },
        envelopeHeightMm: 1800,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
      },
    },
    family: "fitting",
    id: "pumps_damage_control",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["dc_watertight_bulkheads"],
    },
    metadata: {
      tags: ["damage_control"],
    },
    name: "Pumps and damage-control gear",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'pumps_damage_control', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "damage_control",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 30000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 2,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 3000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 2000000,
      },
    ],
    revisions: [],
    spec: {},
  },
  {
    engineering: {
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 3800,
        },
        envelopeHeightMm: 2000,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 0,
          },
        ],
      },
    },
    entryUnits: {
      max: 120,
      min: 1,
      step: 1,
    },
    family: "fitting",
    id: "quarters_crew",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    metadata: {
      tags: ["accommodation"],
    },
    name: "Crew quarters block (volume only)",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    parameters: {
      blocks: {
        max: 120,
        min: 1,
        step: 1,
      },
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'quarters_crew', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "accommodation",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 15000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 10000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 1250000,
      },
    ],
    revisions: [],
    spec: {},
  },
  {
    engineering: {
      cooling: {
        supply: [
          {
            basis: "PER_PART_UNIT",
            id: "cooling_supply",
            kind: "powerKw",
            value: 40,
          },
        ],
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 3500,
        },
        envelopeHeightMm: 1800,
      },
      power: {
        consumption: [
          {
            basis: "PER_PART_UNIT",
            id: "power",
            kind: "powerKw",
            value: 6,
          },
        ],
      },
    },
    family: "fitting",
    id: "ventilation_plant",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    metadata: {
      tags: ["ventilation"],
    },
    name: "Ventilation and cooling plant",
    origin: {
      sourceFile: "ship-building/components/equipment.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'ventilation_plant', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "ventilation",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "mass",
        kind: "massKg",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "cost",
        kind: "costMicro",
        value: 25000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "crew",
        kind: "crew",
        value: 0,
      },
      {
        basis: "PER_PART_UNIT",
        id: "volume",
        kind: "volumeLitre",
        value: 4000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "deck_footprint",
        kind: "deckFootprintMm2",
        value: 2000000,
      },
    ],
    revisions: [],
    spec: {},
  },
]);
