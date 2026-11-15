import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_130mm_50_twin",
    displayName: "130 mm/50 M-1954 gun in SM-2-1 twin mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1954-01", obsoleteMonth: null },
    constants: {
      gun_kg: 4000,
      mount_per_barrel_kg: 13600,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 2684000000,
    },
    parameters: { barrels: { min: 2, max: 2, step: 1 }, rounds: { min: 200, max: 600, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(52800).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(6).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(8272000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(130000),
      shellMassG: number(53600),
      chargeBp: number(2870),
      roundVolumeMl: number(34500),
      rofBaseX100: number(1300),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: ["gun_dp_rapid_5in"],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
]);
