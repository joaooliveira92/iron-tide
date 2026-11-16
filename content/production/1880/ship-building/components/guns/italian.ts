import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_120mm_50_twin",
    displayName: "120 mm/50 Ansaldo 1926 gun in 1937 twin mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1937-01", obsoleteMonth: null },
    constants: {
      gun_kg: 5552,
      mount_per_barrel_kg: 5248,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 1500000000,
    },
    parameters: { barrels: { min: 2, max: 2, step: 1 }, rounds: { min: 100, max: 800, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(30600).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(3).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(4794000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(120000),
      shellMassG: number(23245),
      chargeBp: number(4173),
      roundVolumeMl: number(14900),
      rofBaseX100: number(600),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  defineShipComponent({
    id: "gun_120mm_50_single",
    displayName: "120 mm/50 Ansaldo 1926 gun in 1940 single mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1940-01", obsoleteMonth: null },
    constants: {
      gun_kg: 5552,
      mount_per_barrel_kg: 6448,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 1500000000,
    },
    parameters: { barrels: { min: 1, max: 1, step: 1 }, rounds: { min: 100, max: 800, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(30600).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(3).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(4794000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(120000),
      shellMassG: number(23245),
      chargeBp: number(4173),
      roundVolumeMl: number(14900),
      rofBaseX100: number(600),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
]);
