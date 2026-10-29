// Ship-building component catalogue: German (Krupp) ordnance.
// Source of record: docs/research/ship-building-1880-pre-era-armament.md.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// German 26cm RK L/20 C/74: calibre [B86] (SINGLE-SOURCE); shell/charge/MV/mass are ESTIMATE (Table XVII German rows unreadable),
// taken as close to the Austrian 26cm row of Table XVII. Main gun of the Kaiser and Sachsen classes.
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_bl_263mm_rkl20",
    displayName: "26 cm Ringkanone L/20 C/74",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 26000,
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
      caliberUm: number(263000),
      shellMassG: number(250000),
      chargeBp: number(2400),
      roundVolumeMl: number(125000),
      rofBaseX100: number(100),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
      "attributes.shellMassG": { status: "estimate", rationale: "unsourced" },
      "attributes.chargeBp": { status: "estimate", rationale: "charge ~60 kg" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "1 rds/min, breech-loading" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // --- ADR-0119 coast-defence / casemate ordnance (1880 scenario) ------------------------------------------------------------
  // Bore + mount from navypedia (SINGLE-SOURCE); gun mass where a print source exists; every value not in a print source is
  // ESTIMATE (see docs/research/ship-building-1880-coast-defence-armament.md and -followups.md). Each family has its own
  // component with the same id and category (the release gate requires `lintArmamentContent` family/category parity).
  // Dutch 28 cm (283 mm) Krupp Ringkanone No.1 (*Matador*): gun mass approaches the Von Müller 28 cm RK L/22 (labelled analogy,
  // different mark); shell 253 kg and charge 56 kg borrow the sourced Austrian Krupp 28 cm row (docs/...-armament.md §2.1).
  defineShipComponent({
    id: "gun_bl_283mm_krupp",
    displayName: "28 cm Krupp Ringkanone No.1 in monitor turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 27500,
      mount_per_barrel_kg: 22000,
      mount_fixed_kg: 12000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 6000000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 20, max: 100, step: 10 } },
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
      caliberUm: number(283000),
      // SINGLE-SOURCE: Krupp 28 cm forged-steel AP/shot (Austrian row analogy)
      shellMassG: number(253000),
      // SINGLE-SOURCE analogy: 56 kg black powder over a 253 kg shell
      chargeBp: number(2213),
      roundVolumeMl: number(130000),
      rofBaseX100: number(100),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "hand-worked Krupp BL" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // Portuguese 15 cm (149 mm) Krupp RK L/22 C/75 (*Vasco da Gama* secondary). Gun 3,500 kg, projectile 33.67 kg and
  // charge 7.75 kg from Von Müller 1879 (15 cm RK L/22, SINGLE-SOURCE).
  defineShipComponent({
    id: "gun_bl_149mm_rkl22",
    displayName: "15 cm Krupp RK L/22 C/75 in casemate",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 3500,
      mount_per_barrel_kg: 8000,
      mount_fixed_kg: 1500,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 2000000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(8).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(149000),
      // SINGLE-SOURCE: chilled-iron grenade 33.67 kg (Von Müller 1879)
      shellMassG: number(33670),
      // SINGLE-SOURCE: 7.75 kg over a 33.67 kg projectile
      chargeBp: number(2302),
      roundVolumeMl: number(17000),
      rofBaseX100: number(100),
      beamArcDeg: number(150),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "hand-worked Krupp BL" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // Portuguese 6.7 cm (67 mm) Krupp anti-torpedo gun (*Vasco da Gama*). No print source found: all ballistics ESTIMATE.
  defineShipComponent({
    id: "gun_bl_67mm_krupp",
    displayName: "6.7 cm Krupp gun on deck",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 350,
      mount_per_barrel_kg: 200,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 100000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 100, max: 500, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(3).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(1200),
      zCgMm: number(4000),
    }),
    attributes: () => ({
      caliberUm: number(67000),
      shellMassG: number(4500),
      chargeBp: number(1556),
      roundVolumeMl: number(2000),
      rofBaseX100: number(500),
      beamArcDeg: number(140),
      maxFeedPermille: number(300),
    }),
    fieldProvenance: {
      "attributes.shellMassG": { status: "estimate", rationale: "unsourced" },
      "attributes.chargeBp": { status: "estimate", rationale: "unsourced" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // Japanese 24 cm (235 mm) Krupp RKL/22 C/72 (*Fusō* main). Gun 15,500 kg from Von Müller 1879; shell/charge/MV ESTIMATE.
  defineShipComponent({
    id: "gun_bl_235mm_rkl22",
    displayName: "24 cm Krupp RKL/22 C/72 in central battery",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 15500,
      mount_per_barrel_kg: 20000,
      mount_fixed_kg: 12000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 5000000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 20, max: 100, step: 10 } },
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
      caliberUm: number(235000),
      shellMassG: number(170000),
      chargeBp: number(1765),
      roundVolumeMl: number(95000),
      rofBaseX100: number(100),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      "attributes.shellMassG": { status: "estimate", rationale: "(source range ~150-190 kg)" },
      "attributes.chargeBp": { status: "estimate", rationale: "~30 kg black powder" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "hand-worked Krupp BL" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // Japanese 17 cm (173 mm) Krupp RKL/25 C/72 (*Fusō* secondary). Gun 5,600 kg from Von Müller 1879; shell/charge/MV ESTIMATE.
  defineShipComponent({
    id: "gun_bl_173mm_rkl25",
    displayName: "17 cm Krupp RKL/25 C/72 in battery",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 5600,
      mount_per_barrel_kg: 8000,
      mount_fixed_kg: 4000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 1500000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(8).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(173000),
      shellMassG: number(54000),
      chargeBp: number(1852),
      roundVolumeMl: number(28000),
      rofBaseX100: number(150),
      beamArcDeg: number(140),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      "attributes.shellMassG": { status: "estimate", rationale: "unsourced" },
      "attributes.chargeBp": { status: "estimate", rationale: "~10 kg black powder" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // Austro-Hungarian 21 cm (209 mm) G. L/20 C.68 (*Kaiser Max* central casemate). Gun 9,400 kg and charge 17 kg from a Pola
  // 1875 source; shell mass ESTIMATE.
  defineShipComponent({
    id: "gun_bl_209mm_gl20",
    displayName: "21 cm G. L/20 C.68 in central casemate",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 9400,
      mount_per_barrel_kg: 8000,
      mount_fixed_kg: 5000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 2000000000,
    },
    parameters: { barrels: { min: 1, max: 4, step: 1 }, rounds: { min: 20, max: 120, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(9).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(209000),
      shellMassG: number(100000),
      // SINGLE-SOURCE: 17 kg black powder over a 100 kg shell
      chargeBp: number(1700),
      roundVolumeMl: number(45000),
      rofBaseX100: number(100),
      beamArcDeg: number(150),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      "attributes.shellMassG": { status: "estimate", rationale: "unsourced" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "hand-worked Krupp-pattern BL" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
]);
