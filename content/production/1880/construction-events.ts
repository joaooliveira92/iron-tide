import { ConstructionEventSchema, list } from "@bluewave/content-authoring";

export default list(ConstructionEventSchema, [
  {
    id: "steel_plate_shortage",
    kind: "DELAY",
    probabilityBp: 150,
    reasonCode: "STEEL_PLATE_SHORTAGE",
    causeKey: "construction.event.steel_plate_shortage",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [],
      note: "PROVISIONAL: 1.5 percent per project-month is a tuning placeholder, to be set from the generated balance report (#584).",
    },
  },
  {
    id: "design_change_rework",
    kind: "OVERRUN",
    probabilityBp: 100,
    minBp: 200,
    maxBp: 1_000,
    capBp: 3_000,
    reasonCode: "DESIGN_CHANGE_REWORK",
    causeKey: "construction.event.design_change_rework",
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [],
      note: "PROVISIONAL: 1 percent per project-month, adding 2 to 10 percent of remaining work, capped at 30 percent of the original total work. Tuning placeholders, to be set from the generated balance report (#584).",
    },
  },
]);
