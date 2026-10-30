// Ship-building component catalogue: British quick-firing (QF) and machine guns.
// Source of record: docs/research/ship-building-early-band-2.md. Confidence labels are kept
// beside each record; an unsourced figure is marked as such on its own line.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// QF 6in/40: gun 6.6 long t, shell 100 lb, charge 29.75 lb EXE [NW] SINGLE-SOURCE. Mount mass ESTIMATE. [research 2: sustained 5 rds/min VERIFIED; shielded mount 7.6 t SINGLE-SOURCE]
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_qf_6in_40",
    displayName: "QF 6-inch/40 gun in shielded mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1892-01", obsoleteMonth: null },
    constants: {
      gun_kg: 6700,
      mount_per_barrel_kg: 7600,
      mount_fixed_kg: 1800,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 1500000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(30600).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
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
      caliberUm: number(152000),
      shellMassG: number(45000),
      chargeBp: number(2980),
      roundVolumeMl: number(29205),
      rofBaseX100: number(500),
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
    requires: ["gun_qf_medium"],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // QF 4.7in: gun 2.07-2.1 long t, shell 45 lb, charge 12 lb SP [NW] SINGLE-SOURCE. Mount mass ESTIMATE.
  defineShipComponent({
    id: "gun_qf_47in",
    displayName: "QF 4.7-inch gun in shielded mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1887-01", obsoleteMonth: null },
    constants: {
      gun_kg: 2130,
      mount_per_barrel_kg: 1200,
      mount_fixed_kg: 600,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 800000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(9990).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(2).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(1565100).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(120000),
      shellMassG: number(20400),
      chargeBp: number(2647),
      roundVolumeMl: number(12899),
      rofBaseX100: number(500),
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
    requires: ["gun_qf_light"],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // 12-pdr: gun 510 kg, shell 12.5 lb, 2235 fps, mount PI* 1253 kg [NW] SINGLE-SOURCE. Charge ~1 kg ESTIMATE. [research 2: charge 500 g and 10 rds/min VERIFIED]
  defineShipComponent({
    id: "gun_qf_12pdr",
    displayName: "QF 12-pounder 12-cwt gun on pedestal",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1894-01", obsoleteMonth: null },
    constants: {
      gun_kg: 510,
      mount_per_barrel_kg: 1253,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 300000000,
    },
    parameters: { barrels: { min: 1, max: 1, step: 1 }, rounds: { min: 50, max: 300, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(5289).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(2).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(1500000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(76000),
      shellMassG: number(5670),
      chargeBp: number(882),
      roundVolumeMl: number(3335),
      rofBaseX100: number(1000),
      beamArcDeg: number(140),
      maxFeedPermille: number(400),
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
    requires: ["gun_qf_light"],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // 6-pdr: gun 849 lb, shell 6 lb, 1765 fps [NW] SINGLE-SOURCE. Charge 0.4 kg ESTIMATE. Mount mass ESTIMATE. [research 2: charge 213 g VERIFIED; 12 rds/min interpolated between the 12-pdr and 3-pdr sustained rates (ESTIMATE)]
  defineShipComponent({
    id: "gun_qf_6pdr",
    displayName: "QF 6-pounder 8-cwt gun on pedestal",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1884-01", obsoleteMonth: null },
    constants: {
      gun_kg: 385,
      mount_per_barrel_kg: 300,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 200000000,
    },
    parameters: { barrels: { min: 1, max: 1, step: 1 }, rounds: { min: 50, max: 300, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(2055).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(2).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(1500000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(57000),
      shellMassG: number(2720),
      chargeBp: number(783),
      roundVolumeMl: number(1560),
      rofBaseX100: number(1200),
      beamArcDeg: number(140),
      maxFeedPermille: number(400),
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
    requires: ["gun_qf_light"],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // 3-pdr: gun 528 lb, shell 3.3 lb, 1884 fps, mount 0.7 long t [NW] SINGLE-SOURCE. Charge 0.3 kg ESTIMATE. [research 2: charge 188 g and 15 rds/min VERIFIED]
  defineShipComponent({
    id: "gun_hotchkiss_3pdr",
    displayName: "Hotchkiss 3-pounder 47 mm gun",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1886-01", obsoleteMonth: null },
    constants: {
      gun_kg: 240,
      mount_per_barrel_kg: 710,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 150000000,
    },
    parameters: { barrels: { min: 1, max: 1, step: 1 }, rounds: { min: 50, max: 400, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(2850).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(2).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(1500000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(47000),
      shellMassG: number(1500),
      chargeBp: number(1253),
      roundVolumeMl: number(900),
      rofBaseX100: number(1500),
      beamArcDeg: number(140),
      maxFeedPermille: number(400),
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
    requires: ["gun_qf_light"],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // 1in Nordenfelt: mass 447 lb, bullet 7.25 oz, 1464 fps [TG via secondary] SINGLE-SOURCE (relayed). ROF 200 rds/min ESTIMATE (UNVERIFIED). Mount mass ESTIMATE.
  defineShipComponent({
    id: "gun_nordenfelt_1in",
    displayName: "Nordenfelt 1-inch 4-barrel machine gun",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 203,
      mount_per_barrel_kg: 150,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 100000000,
    },
    parameters: {
      barrels: { min: 1, max: 1, step: 1 },
      rounds: { min: 500, max: 3000, step: 500 },
    },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(1059).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(2).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(1500000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(25000),
      shellMassG: number(206),
      chargeBp: number(0),
      roundVolumeMl: number(103),
      rofBaseX100: number(20000),
      beamArcDeg: number(140),
      maxFeedPermille: number(400),
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
    requires: [],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // Maxim .303: gun 58.4 lb + mount 160 lb, bullet 14 g, charge 3 g [NW] SINGLE-SOURCE. Sustained 250 rds/min ESTIMATE (cyclic 500). RN naval adoption 1890s; 1890-01 chosen.
  defineShipComponent({
    id: "gun_maxim_303",
    displayName: "Maxim .303 machine gun on mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1890-01", obsoleteMonth: null },
    constants: {
      gun_kg: 27,
      mount_per_barrel_kg: 73,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 50000000,
    },
    parameters: {
      barrels: { min: 1, max: 1, step: 1 },
      rounds: { min: 1000, max: 6000, step: 1000 },
    },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(300).times(v.barrels),
      // gun GBP 200/long ton (Commons 1888, VERIFIED); mount cost: heavy = Trafalgar/Collingwood hydraulic mountings, QF = ESTIMATE
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(2).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(1500000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(8000),
      shellMassG: number(14),
      chargeBp: number(2143),
      roundVolumeMl: number(20),
      rofBaseX100: number(25000),
      beamArcDeg: number(150),
      maxFeedPermille: number(400),
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
    requires: [],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // --- E-1 1950-1959 (ticket #256) ---------------------------------------------------------------------------------------------
  // UK 4.5-inch/45 (120 mm) QF Mark 6 gun in Mark 6 twin mount (docs/research/e-1-1950s-gun-ships.md section 1).
  // Sourced (navypedia.org, navweaps.com, SINGLE-SOURCE): 120 mm bore, 29.1 kg AP shell, gun mass ~2,800 kg,
  // twin mount ~15,000 kg, 14-16 rounds per minute, service 1952. The charge (1,706 bp) is DERIVED from 4.64 kg.
  // The mount splits as 6,100 kg per barrel and 2,800 kg fixed. BALANCE TARGET on volume, footprint, cost, crew.
  // Requires gun_dp_rapid_5in like the US 5-inch/54 mount.
  defineShipComponent({
    id: "gun_qf_45in_45_twin",
    displayName: "4.5-inch/45 QF Mark 6 gun in Mark 6 twin mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1952-01", obsoleteMonth: null },
    constants: {
      gun_kg: 2800,
      mount_per_barrel_kg: 6100,
      mount_fixed_kg: 2800,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 2960000000,
    },
    parameters: { barrels: { min: 2, max: 2, step: 1 }, rounds: { min: 200, max: 600, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(45600).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(4).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(7150000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(120000),
      shellMassG: number(29100),
      chargeBp: number(1706),
      roundVolumeMl: number(16900),
      rofBaseX100: number(1600),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: ["gun_dp_rapid_5in"],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
]);
