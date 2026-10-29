// Ship-building component catalogue: French ordnance.
// Source of record: docs/research/ship-building-1880-pre-era-armament.md.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// French 27cm mle 1875: calibre and penetration [B86] French Commission table (SINGLE-SOURCE); shell/charge/MV from [TB87] Table XVII
// (SINGLE-SOURCE, OCR); gun mass and mount are ESTIMATE (no source). Main gun of Redoutable and the Tempête monitors.
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_bl_274mm_m1875",
    displayName: "Canon de 27 cm modèle 1875",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 27000,
      mount_per_barrel_kg: 20000,
      mount_fixed_kg: 12000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 5000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(12).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(274000),
      shellMassG: number(216000),
      // charge 75 / shell 216 x 10000
      chargeBp: number(3472),
      roundVolumeMl: number(108000),
      rofBaseX100: number(100),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "1 rds/min, breech-loading" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
]);
