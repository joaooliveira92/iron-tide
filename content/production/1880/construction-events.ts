import { ConstructionEventSchema, list } from "@bluewave/content-authoring";

const provenance = (note: string) =>
  ({
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note,
  }) as const;

const DELAY_NOTE =
  "PROVISIONAL: flat chance per project-month, doubled while the yard pool is over capacity, holding the build for 1 to 3 months. Tuning placeholders, set from the generated balance report docs/research/p6-construction-events.md (#584).";

const OVERRUN_NOTE =
  "PROVISIONAL: flat chance per project-month, adding 2 to 10 percent of remaining work, capped at 30 percent of the original total work. Tuning placeholders, set from the generated balance report docs/research/p6-construction-events.md (#584).";

export default list(ConstructionEventSchema, [
  {
    id: "steel_plate_shortage",
    kind: "DELAY",
    probabilityBp: 80,
    minMonths: 1,
    maxMonths: 3,
    pressureMultiplierBp: 20_000,
    reasonCode: "STEEL_PLATE_SHORTAGE",
    causeKey: "construction.event.steel_plate_shortage",
    provenance: provenance(DELAY_NOTE),
  },
  {
    id: "skilled_labour_shortage",
    kind: "DELAY",
    probabilityBp: 55,
    minMonths: 1,
    maxMonths: 3,
    pressureMultiplierBp: 20_000,
    reasonCode: "SKILLED_LABOUR_SHORTAGE",
    causeKey: "construction.event.skilled_labour_shortage",
    provenance: provenance(DELAY_NOTE),
  },
  {
    id: "yard_weather_damage",
    kind: "DELAY",
    probabilityBp: 40,
    minMonths: 1,
    maxMonths: 3,
    pressureMultiplierBp: 20_000,
    reasonCode: "YARD_WEATHER_DAMAGE",
    causeKey: "construction.event.yard_weather_damage",
    provenance: provenance(DELAY_NOTE),
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
    provenance: provenance(OVERRUN_NOTE),
  },
  {
    id: "materials_price_rise",
    kind: "OVERRUN",
    probabilityBp: 100,
    minBp: 200,
    maxBp: 1_000,
    capBp: 3_000,
    reasonCode: "MATERIALS_PRICE_RISE",
    causeKey: "construction.event.materials_price_rise",
    provenance: provenance(OVERRUN_NOTE),
  },
  {
    id: "workmanship_rework",
    kind: "OVERRUN",
    probabilityBp: 80,
    minBp: 200,
    maxBp: 1_000,
    capBp: 3_000,
    reasonCode: "WORKMANSHIP_REWORK",
    causeKey: "construction.event.workmanship_rework",
    provenance: provenance(OVERRUN_NOTE),
  },
]);
