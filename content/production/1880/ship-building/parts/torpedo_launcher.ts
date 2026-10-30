import { PartSchema, collection } from "@bluewave/content-authoring";

export default collection("parts", PartSchema, [
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "ah_tube_350_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "35 cm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "35 cm Whitehead, above-water (Fiume)",
    nation: "austria_hungary",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/austria_hungary.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "ah-note",
          title: "National naval profile research note — Austria-Hungary",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "br_tube_356_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "356 mm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "356 mm Whitehead, above-water (imported)",
    nation: "brazil",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/brazil.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "brazil-note",
          title: "National naval profile research note — Brazil",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "de_tube_450_aw",
    legacyExceptions: [
      {
        code: "DQ-TORPEDO-001",
        forPart: "whitehead_14in_1886",
        note: "Structured national diameter 450000 um differs from the 356000 um 'whitehead_14in_1886' it loads; preserved from legacy content.",
        waives: "diameterUmEqualsBore",
      },
    ],
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "45 cm Schwarzkopf torpedo tube, above-water beam",
      tags: ["torpedo"],
    },
    name: "Schwarzkopf 45 cm torpedo tube, above water",
    nation: "germany",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/germany.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          sourceId: "navypedia-de",
          title: "navypedia.org German class pages",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 450000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "de_tube_450_sub",
    legacyExceptions: [
      {
        code: "DQ-TORPEDO-001",
        forPart: "whitehead_14in_1886",
        note: "Structured national diameter 450000 um differs from the 356000 um 'whitehead_14in_1886' it loads; preserved from legacy content.",
        waives: "diameterUmEqualsBore",
      },
    ],
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "45 cm Schwarzkopf torpedo tube, submerged bow",
      tags: ["torpedo"],
    },
    name: "Schwarzkopf 45 cm torpedo tube, submerged bow",
    nation: "germany",
    origin: {
      prototype: {
        id: "tube_14in_submerged",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/germany.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          sourceId: "navypedia-de",
          title: "navypedia.org German class pages",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 2500,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 450000,
      launchType: "UNDERWATER_FIXED",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "es_tube_356_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "356 mm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "356 mm Whitehead, above-water",
    nation: "spain",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/spain.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "spain-note",
          title: "National naval profile research note — Spain",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "fr_tube_350mm_sub",
    legacyExceptions: [
      {
        code: "DQ-TORPEDO-001",
        forPart: "whitehead_14in_1886",
        note: "Structured national diameter 380000 um differs from the 356000 um 'whitehead_14in_1886' it loads; preserved from legacy content.",
        waives: "diameterUmEqualsBore",
      },
    ],
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "Tube lance-torpilles de 350 mm, submerged bow",
      tags: ["torpedo"],
    },
    name: "Tube de 350 mm, submerged bow",
    nation: "france",
    origin: {
      prototype: {
        id: "tube_14in_submerged",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/france.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "DERIVED",
      sources: [
        {
          page: "B.2, C.2",
          title: "National naval profiles research note",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 2500,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 380000,
      launchType: "UNDERWATER_FIXED",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "fr_tube_380mm_aw",
    legacyExceptions: [
      {
        code: "DQ-TORPEDO-001",
        forPart: "whitehead_14in_1886",
        note: "Structured national diameter 380000 um differs from the 356000 um 'whitehead_14in_1886' it loads; preserved from legacy content.",
        waives: "diameterUmEqualsBore",
      },
    ],
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "Tube lance-torpilles de 380 mm, above-water beam",
      tags: ["torpedo"],
    },
    name: "Tube de 380 mm, above-water beam",
    nation: "france",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/france.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "DERIVED",
      sources: [
        {
          page: "B.2, C.2",
          title: "National naval profiles research note",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 380000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "it_tube_350_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "Whitehead 350 mm torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "Whitehead 350 mm, above-water (imported)",
    nation: "italy",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/italy.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "italy-note",
          title: "National naval profile research note — Italy",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "jp_tube_350_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "35 cm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "35 cm Whitehead, above-water (imported)",
    nation: "japan",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/japan.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "japan-note",
          title: "National naval profile research note — Japan",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "nl_tube_356_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "356 mm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "356 mm Whitehead, above-water (imported)",
    nation: "netherlands",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/netherlands.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "netherlands-note",
          title: "National naval profile research note — Netherlands",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "ot_tube_356_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "356 mm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "356 mm Whitehead, above-water (imported)",
    nation: "ottoman_empire",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/ottoman_empire.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "ottoman-note",
          title: "National naval profile research note — Ottoman Empire",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "pt_tube_356_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "356 mm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "356 mm Whitehead, above-water (imported)",
    nation: "portugal",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/portugal.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "portugal-note",
          title: "National naval profile research note — Portugal",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "qing_tube_356_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "356 mm Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "356 mm Whitehead, above-water (imported)",
    nation: "qing",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/qing.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "qing-note",
          title: "National naval profile research note — Qing China",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "ru_tube_381_aw",
    legacyExceptions: [
      {
        code: "DQ-TORPEDO-001",
        forPart: "whitehead_14in_1886",
        note: "Structured national diameter 381000 um differs from the 356000 um 'whitehead_14in_1886' it loads; preserved from legacy content.",
        waives: "diameterUmEqualsBore",
      },
    ],
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "381 mm torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "381 mm Whitehead, above-water",
    nation: "russia",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/russia.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "russia-note",
          title: "National naval profile research note — Russia",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 381000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "tube_14in_above_water",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      tags: ["torpedo"],
    },
    name: "14-inch Whitehead torpedo tube, above-water trainable carriage",
    origin: {
      sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'tube_14in_above_water', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "tube_14in_submerged",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      tags: ["torpedo"],
    },
    name: "14-inch Whitehead torpedo tube, submerged bow tube",
    origin: {
      sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'tube_14in_submerged', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 2500,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "UNDERWATER_FIXED",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
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
    entryUnits: {
      max: 10,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "tube_21in_above_water",
    lifecycle: {
      availableFrom: "1931-01",
      availableUntil: null,
      requires: ["torp_21in_ww1"],
    },
    metadata: {
      tags: ["torpedo"],
    },
    name: "21-inch torpedo tube, above-water trainable quintuple-capable carriage",
    origin: {
      sourceFile: "ship-building/components/torpedo-tubes/united-states.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from legacy component 'tube_21in_above_water', which has no structured provenance.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 3080,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 1361,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 1540000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 6800,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 5500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 533000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "usn_21in_mk14_1931",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "uk_tube_14in_aw_mk4",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "14-inch Whitehead Mk IV torpedo tube, above-water trainable carriage",
      tags: ["torpedo"],
    },
    name: "14-in Whitehead Mk IV, above-water carriage",
    nation: "uk",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/uk.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "DERIVED",
      sources: [
        {
          page: "B.1",
          title: "National naval profiles research note",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "uk_tube_14in_sub_mk4",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "14-inch Whitehead Mk IV torpedo tube, submerged bow tube",
      tags: ["torpedo"],
    },
    name: "14-in Whitehead Mk IV, submerged bow tube",
    nation: "uk",
    origin: {
      prototype: {
        id: "tube_14in_submerged",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/uk.yaml",
    },
    provenance: {
      confidence: "MEDIUM",
      kind: "historical_fact",
      sourceStatus: "DERIVED",
      sources: [
        {
          page: "B.1",
          title: "National naval profiles research note",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 2500,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "UNDERWATER_FIXED",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
  {
    engineering: {
      maintenance: {
        monthlyBpOfCost: 15,
      },
      physical: {
        centreOfGravity: {
          datum: "PART_BASE",
          zMm: 4800,
        },
        envelopeHeightMm: 1500,
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
      max: 4,
      min: 1,
      step: 1,
    },
    family: "torpedo_launcher",
    id: "us_tube_14in_aw",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
      requires: ["torp_whitehead_torpedo"],
    },
    metadata: {
      displayName: "14-inch Whitehead torpedo tube, above-water",
      tags: ["torpedo"],
    },
    name: "14-in Whitehead, above-water (imported)",
    nation: "usa",
    origin: {
      prototype: {
        id: "tube_14in_above_water",
        inheritedQuantities: [
          "tube_mass",
          "stowed_torpedo_mass",
          "tube_cost",
          "tube_crew",
          "tube_volume",
          "tube_deck_footprint",
        ],
        inheritedSpec: ["launchType"],
        sourceFile: "ship-building/components/torpedo-tubes/british.yaml",
      },
      sourceFile: "ship-building/naval-profiles/usa.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "historical_fact",
      sourceStatus: "ESTIMATE",
      sources: [
        {
          page: "F",
          sourceId: "usa-note",
          title: "National naval profile research note — United States",
        },
      ],
    },
    provides: "torpedo_launcher",
    quantities: [
      {
        basis: "PER_PART_UNIT",
        id: "tube_mass",
        kind: "massKg",
        value: 1400,
      },
      {
        basis: "PER_PART_UNIT",
        id: "stowed_torpedo_mass",
        kind: "massKg",
        value: 900,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_cost",
        kind: "costMicro",
        value: 700000000,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_crew",
        kind: "crew",
        value: 3,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_volume",
        kind: "volumeLitre",
        value: 4300,
      },
      {
        basis: "PER_PART_UNIT",
        id: "tube_deck_footprint",
        kind: "deckFootprintMm2",
        value: 2500000,
      },
    ],
    revisions: [],
    slots: [
      {
        accepts: ["torpedo"],
        constraints: {
          diameterUmEqualsBore: true,
        },
        id: "torpedo",
      },
    ],
    spec: {
      boreDiameterUm: 356000,
      launchType: "ABOVE_WATER_TRAINABLE",
      loadsTorpedo: "whitehead_14in_1886",
    },
  },
]);
