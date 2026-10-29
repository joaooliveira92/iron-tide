import { PartSchema, collection } from "@bluewave/content-authoring";

export default collection("parts", PartSchema, [
  {
    family: "armour_material",
    id: "compound",
    lifecycle: {
      availableFrom: "1886-01",
      availableUntil: "1889-01",
      requires: ["hc_compound_armor"],
    },
    name: "compound",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'compound' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 13000,
    },
  },
  {
    family: "armour_material",
    id: "harvey",
    lifecycle: {
      availableFrom: "1892-01",
      availableUntil: null,
      requires: ["hc_harvey_armor"],
    },
    name: "harvey",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'harvey' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 19500,
    },
  },
  {
    family: "armour_material",
    id: "iron",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    name: "iron",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'iron' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 10000,
    },
  },
  {
    family: "armour_material",
    id: "krupp",
    lifecycle: {
      availableFrom: "1900-01",
      availableUntil: null,
      requires: ["hc_krupp_cemented_armor"],
    },
    name: "krupp",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'krupp' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 23000,
    },
  },
  {
    family: "armour_material",
    id: "mild_steel",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    name: "mild_steel",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'mild_steel' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 13000,
    },
  },
  {
    family: "armour_material",
    id: "nickel_steel",
    lifecycle: {
      availableFrom: "1889-01",
      availableUntil: null,
      requires: ["hc_nickel_steel_armor"],
    },
    name: "nickel_steel",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'nickel_steel' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 13500,
    },
  },
  {
    family: "armour_material",
    id: "steel",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    name: "steel",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'steel' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 13000,
    },
  },
  {
    family: "armour_material",
    id: "wrought_iron",
    lifecycle: {
      availableFrom: "1880-01",
      availableUntil: null,
    },
    name: "wrought_iron",
    origin: {
      sourceFile: "ship-building/balance.yaml",
    },
    provenance: {
      confidence: "LOW",
      kind: "game_conversion",
      note: "Read from the balance tables' 'wrought_iron' entries, whose sources are YAML comments only.",
      sourceStatus: "PLACEHOLDER",
      sources: [],
    },
    provides: "armour_material",
    quantities: [],
    revisions: [],
    spec: {
      efficiencyBp: 10000,
    },
  },
]);
