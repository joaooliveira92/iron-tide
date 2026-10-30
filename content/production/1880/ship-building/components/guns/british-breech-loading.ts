// Ship-building component catalogue: British breech-loading (BL) ordnance.
// Source of record: docs/research/ship-building-early-band.md and
// docs/research/ship-building-early-band-2.md. Confidence labels are kept beside each record.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// 12in/25: gun 43.8 long t, shell 714 lb, charge 295 lb, 1914 fps, ROF 0.3-0.5 [NW] SINGLE-SOURCE. Mount mass ESTIMATE (no source).
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_bl_12in_25",
    displayName: "BL 12-inch/25 gun in barbette mount",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1885-01", obsoleteMonth: null },
    constants: {
      gun_kg: 44500,
      mount_per_barrel_kg: 30000,
      mount_fixed_kg: 20000,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 14000000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(223500).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(13).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(35015000).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(305000),
      shellMassG: number(324000),
      chargeBp: number(4136),
      roundVolumeMl: number(229003),
      rofBaseX100: number(40),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: {
        status: "placeholder",
        rationale: "3 L per kg of gun+mount (a 12-inch barbette core is ~225 m3)",
      },
      deckFootprintMm2: {
        status: "placeholder",
        rationale: "470 mm2 per kg (a 12-inch barbette is ~35 m2)",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: ["gun_breech_rifled"],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 13.5in/30: gun 67 long t, shell 1250 lb, charge 630 lb SBC [NW] SINGLE-SOURCE. Mount mass ESTIMATE.
  defineShipComponent({
    id: "gun_bl_135in_30",
    displayName: "BL 13.5-inch/30 gun in barbette mount",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1885-01", obsoleteMonth: null },
    constants: {
      gun_kg: 68100,
      mount_per_barrel_kg: 45000,
      mount_fixed_kg: 25000,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 16000000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(332500).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(14).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      // SECONDARY: Royal Sovereign pear barbette 38 ft 2 in x 54 ft 1 in for two guns, Brassey 1892 p.91 (area derived)
      deckFootprintMm2: number(66490000).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(343000),
      shellMassG: number(567000),
      chargeBp: number(5044),
      roundVolumeMl: number(426497),
      rofBaseX100: number(40),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: {
        status: "estimate",
        rationale:
          "sourced barbette area x 5.0 m depth (depth backed out from Royal Sovereign 650 t of barbette armour, Brassey 1892 p.91)",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: ["gun_breech_rifled"],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 12in/35 Mk VIII: gun 46 long t, shell 850 lb [NW]+[B2] VERIFIED; charge 79 kg ESTIMATE (1908+ load); ROF 1 per 70-100 s. Mount mass ESTIMATE. [research 2: charge 167.5 lb = 76 kg VERIFIED; 0.8 rds/min VERIFIED]
  defineShipComponent({
    id: "gun_bl_12in_35",
    displayName: "BL 12-inch/35 Mk VIII gun in turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1895-01", obsoleteMonth: null },
    constants: {
      gun_kg: 46700,
      mount_per_barrel_kg: 32000,
      mount_fixed_kg: 20000,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 14000000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(256500).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(13).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      // SECONDARY: Majestic barbette 37.5 ft for two guns, Brassey 1903 p.356 (circle, area derived)
      deckFootprintMm2: number(51300000).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(305000),
      shellMassG: number(386000),
      chargeBp: number(1969),
      roundVolumeMl: number(232507),
      rofBaseX100: number(80),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: {
        status: "estimate",
        rationale:
          "sourced barbette area x 5.0 m depth (depth backed out from Royal Sovereign 650 t of barbette armour, Brassey 1892 p.91)",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: ["gun_breech_rifled", "gun_smokeless_powder"],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 10in/32: gun 29.5 long t, shell 500 lb, charge 252 lb [NW] SINGLE-SOURCE. Mount mass ESTIMATE.
  defineShipComponent({
    id: "gun_bl_10in_32",
    displayName: "BL 10-inch/32 gun in mount",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1885-01", obsoleteMonth: null },
    constants: {
      gun_kg: 30000,
      mount_per_barrel_kg: 20000,
      mount_fixed_kg: 12000,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 9000000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(92350).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(9).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      // SECONDARY: twin 10-in barbette 22.5 ft (Libertad), Brassey 1903 p.357 (area derived)
      deckFootprintMm2: number(18470000).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(254000),
      shellMassG: number(227000),
      chargeBp: number(5022),
      roundVolumeMl: number(170499),
      rofBaseX100: number(50),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: {
        status: "estimate",
        rationale:
          "sourced barbette area x 5.0 m depth (depth backed out from Royal Sovereign 650 t of barbette armour, Brassey 1892 p.91)",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: ["gun_breech_rifled"],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 9.2in/31.5: gun 22-24 long t, shell 380 lb, charge 163 lb [NW] SINGLE-SOURCE. Mount mass ESTIMATE.
  defineShipComponent({
    id: "gun_bl_92in_315",
    displayName: "BL 9.2-inch/31.5 gun in mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1881-01", obsoleteMonth: null },
    constants: {
      gun_kg: 23400,
      mount_per_barrel_kg: 14000,
      mount_fixed_kg: 9000,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 4000000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 20, max: 120, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(131700).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(7).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      // SECONDARY: Cressy 9.2-in barbette 19 ft, Brassey 1903 p.357 (area derived)
      deckFootprintMm2: number(26340000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(234000),
      shellMassG: number(172000),
      chargeBp: number(4286),
      roundVolumeMl: number(122859),
      rofBaseX100: number(100),
      beamArcDeg: number(120),
      maxFeedPermille: number(300),
    }),
    fieldProvenance: {
      volumeLitre: {
        status: "estimate",
        rationale:
          "sourced barbette area x 5.0 m depth (depth backed out from Royal Sovereign 650 t of barbette armour, Brassey 1892 p.91)",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: ["gun_breech_rifled"],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // 6in/26: shell 100 lb, charge 48 lb, 1960 fps [NW] SINGLE-SOURCE. Gun mass 4300 kg ESTIMATE (UNVERIFIED). In-service year UNVERIFIED (1881-1887); 1884 chosen. [research 2: gun 5.0 long t Mk II-VI VERIFIED; shielded mount 7.6 t SINGLE-SOURCE; in service by 1884, 1883 ESTIMATE]
  defineShipComponent({
    id: "gun_bl_6in_26",
    displayName: "BL 6-inch/26 gun in mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1883-01", obsoleteMonth: null },
    constants: {
      gun_kg: 5080,
      mount_per_barrel_kg: 7600,
      mount_fixed_kg: 1500,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 1500000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(21900).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(3).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(3431000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(152000),
      shellMassG: number(45000),
      chargeBp: number(4812),
      roundVolumeMl: number(33327),
      rofBaseX100: number(400),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    fieldProvenance: {
      volumeLitre: {
        status: "placeholder",
        rationale: "3 L per kg of gun+mount (a 12-inch barbette core is ~225 m3)",
      },
      deckFootprintMm2: {
        status: "placeholder",
        rationale: "470 mm2 per kg (a 12-inch barbette is ~35 m2)",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: ["gun_breech_rifled"],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
]);
