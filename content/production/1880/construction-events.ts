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
]);
