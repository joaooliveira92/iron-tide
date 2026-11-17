import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_bl_6in_obr1867",
    displayName: "6-inch obr.1867 Obukhov steel breech-loader",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 4259,
      mount_per_barrel_kg: 3000,
      mount_fixed_kg: 1500,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 500000000,
    },
    parameters: { barrels: { min: 1, max: 8, step: 1 }, rounds: { min: 50, max: 300, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(4).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(152400),
      shellMassG: number(33370),
      chargeBp: number(2457),
      roundVolumeMl: number(16685),
      rofBaseX100: number(33),
      beamArcDeg: number(140),
      maxFeedPermille: number(350),
    }),
    fieldProvenance: {
      volumeLitre: { status: "estimate", rationale: "copied from gun_rml_64pdr_71cwt" },
      costMicro: { status: "estimate", rationale: "copied from gun_rml_64pdr_71cwt" },
      deckFootprintMm2: { status: "estimate", rationale: "copied from gun_rml_64pdr_71cwt" },
      "attributes.roundVolumeMl": {
        status: "estimate",
        rationale: "0.5 mL per gram of shell like the 64-pdr rows",
      },
      "attributes.rofBaseX100": {
        status: "estimate",
        rationale: "copied from gun_rml_64pdr_71cwt",
      },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
]);
