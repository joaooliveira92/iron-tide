// Ship-building component catalogue: British muzzle-loading (RML) ordnance.
// Source of record: docs/research/ship-building-1880-pre-era-armament.md. Confidence labels
// (VERIFIED / SINGLE-SOURCE / ESTIMATE / UNVERIFIED) are kept beside each record; an
// unsourced figure is marked as such on its own line.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// --- Pre-1880 ordnance (guns in service by January 1880) -------------------------------------------------------------------
// Source of record: docs/research/ship-building-1880-pre-era-armament.md. Masses, charges, projectiles and muzzle velocity of
// the British RMLs are VERIFIED from Mackinlay, Text Book of Gunnery 1887, Table XVI (primary); penetration is Brassey's Naval
// Annual 1886 French Commission table (point-blank, wrought iron). Mount masses and rates of fire are ESTIMATE (no source).
// `requires: []` because these muzzle-loaders predate the breech-loading technology; the introduction month gates them to 1880+.
// The `barrels` parameter doubles as "guns grouped in one battery mount" for broadside/central-battery ships (a game abstraction).
// 16in/80-ton: gun 81,284 kg, shell 764 kg, charge 204 kg prismatic brown, 1,590 fps, ~0.33 rds/min ESTIMATE. [TB87] VERIFIED.
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_rml_16in_80ton",
    displayName: "RML 16-inch 80-ton gun in turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 81284,
      mount_per_barrel_kg: 40000,
      mount_fixed_kg: 25000,
      cost_per_kg_micro: 123000,
      mount_cost_micro: 10000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      // gun GBP 10,000 (Brassey 1882 p.95, VERIFIED)
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(14).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(406000),
      shellMassG: number(764000),
      // charge 204 / shell 764 x 10000
      chargeBp: number(2670),
      roundVolumeMl: number(382000),
      rofBaseX100: number(30),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "3 L per kg of gun+mount" },
      deckFootprintMm2: { status: "placeholder", rationale: "470 mm2 per kg" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "0.5 mL per gram of round" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 12.5in/38-ton: gun 38,610 kg, shell 367 kg, charge 95 kg Prism2, 1,575 fps, ~0.25 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_125in_38ton",
    displayName: "RML 12.5-inch 38-ton gun in turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 38610,
      mount_per_barrel_kg: 30000,
      mount_fixed_kg: 20000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 8000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(13).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(318000),
      shellMassG: number(367100),
      chargeBp: number(2596),
      roundVolumeMl: number(183550),
      rofBaseX100: number(25),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 12in/35-ton: gun 35,562 kg, shell 321 kg, charge 63.5 kg P2, 1,390 fps, ~0.25 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_12in_35ton",
    displayName: "RML 12-inch 35-ton gun in turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 35562,
      mount_per_barrel_kg: 25000,
      mount_fixed_kg: 15000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 6000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(13).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(305000),
      shellMassG: number(320600),
      chargeBp: number(1981),
      roundVolumeMl: number(160300),
      rofBaseX100: number(25),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 12in/25-ton: gun 25,401 kg, shell 276 kg Palliser, charge 38.6 kg battering P2, 1,292 fps, ~0.3 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_12in_25ton",
    displayName: "RML 12-inch 25-ton gun in turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 25401,
      mount_per_barrel_kg: 22000,
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
      caliberUm: number(305000),
      shellMassG: number(276000),
      chargeBp: number(1399),
      roundVolumeMl: number(138000),
      rofBaseX100: number(30),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 11in/25-ton: gun 25,401 kg, shell 246 kg Palliser, charge 38.6 kg P, 1,360 fps, ~0.3 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_11in_25ton",
    displayName: "RML 11-inch 25-ton gun in mount",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 25401,
      mount_per_barrel_kg: 20000,
      mount_fixed_kg: 12000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 4000000000,
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
      caliberUm: number(279000),
      shellMassG: number(246300),
      chargeBp: number(1567),
      roundVolumeMl: number(123150),
      rofBaseX100: number(30),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 10in/18-ton: gun 18,289 kg, shell 181 kg Palliser, charge 31.8 kg P, 1,379 fps, ~0.4 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_10in_18ton",
    displayName: "RML 10-inch 18-ton gun in mount",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 18289,
      mount_per_barrel_kg: 15000,
      mount_fixed_kg: 9000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 3000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(10).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(254000),
      shellMassG: number(181400),
      chargeBp: number(1753),
      roundVolumeMl: number(90700),
      rofBaseX100: number(40),
      beamArcDeg: number(130),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // 10in/18-ton in a battery (secondary role): same gun as gun_rml_10in_18ton, tagged SECONDARY_GUN so it does not count as a
  // main-battery turret on central-battery ironclads (Alexandra, Principe Amedeo) where the largest gun is the true main battery.
  defineShipComponent({
    id: "gun_rml_10in_18ton_broadside",
    displayName: "RML 10-inch 18-ton gun in broadside battery",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 18289,
      mount_per_barrel_kg: 15000,
      mount_fixed_kg: 9000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 3000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 20, max: 120, step: 5 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(10).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(254000),
      shellMassG: number(181400),
      chargeBp: number(1753),
      roundVolumeMl: number(90700),
      rofBaseX100: number(40),
      beamArcDeg: number(130),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // 8in/9-ton: gun 9,144 kg, shell 79 kg (UNVERIFIED 73-86), charge 15.9 kg P, 1,384 fps, ~0.8 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_8in_9ton",
    displayName: "RML 8-inch 9-ton gun in mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 9144,
      mount_per_barrel_kg: 8000,
      mount_fixed_kg: 5000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 2000000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
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
      caliberUm: number(203000),
      shellMassG: number(79400),
      chargeBp: number(2002),
      roundVolumeMl: number(39700),
      rofBaseX100: number(80),
      beamArcDeg: number(140),
      maxFeedPermille: number(300),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // 7in/7-ton: gun 7,112 kg, shell 52 kg (UNVERIFIED 50-54), charge 13.6 kg P, 1,561 fps, ~0.8 rds/min ESTIMATE. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_7in_7ton",
    displayName: "RML 7-inch 7-ton gun in mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 7112,
      mount_per_barrel_kg: 6000,
      mount_fixed_kg: 4000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 1500000000,
    },
    parameters: { barrels: { min: 1, max: 6, step: 1 }, rounds: { min: 40, max: 200, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(6).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(178000),
      shellMassG: number(52200),
      chargeBp: number(2605),
      roundVolumeMl: number(26100),
      rofBaseX100: number(80),
      beamArcDeg: number(140),
      maxFeedPermille: number(300),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // 64-pdr 71-cwt (6.29in): gun 3,582 kg, shell 29 kg, charge 3.6 kg black (RLG), 1,230 fps, ~0.33 rds/min. [TB87] VERIFIED.
  defineShipComponent({
    id: "gun_rml_64pdr_71cwt",
    displayName: "RML 64-pounder 71-cwt gun",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 3582,
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
      caliberUm: number(160000),
      shellMassG: number(29000),
      chargeBp: number(1241),
      roundVolumeMl: number(14500),
      rofBaseX100: number(33),
      beamArcDeg: number(140),
      maxFeedPermille: number(350),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "unsourced" },
      costMicro: { status: "estimate", rationale: "~GBP 150/t" },
      deckFootprintMm2: { status: "placeholder", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "light"],
    fcClass: "light",
    maintenanceMonthlyBp: 20,
  }),
  // Brazilian 9-inch (229 mm) Whitworth 300-pdr RML (central-casemate ironclad *Sete de Setembro*). Bore, gun mass 18 t and
  // 300 lb shot from Conway's 1860-1905 via navypedia; charge/MV ESTIMATE. A muzzle-loading rifle, never a BL.
  defineShipComponent({
    id: "gun_rml_229mm_whitworth",
    displayName: "9-inch Whitworth 300-pdr RML in casemate",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 18289,
      mount_per_barrel_kg: 15000,
      mount_fixed_kg: 9000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 3000000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 20, max: 100, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(10).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(229000),
      // SINGLE-SOURCE: 300 lb solid shot (Conway's via navypedia)
      shellMassG: number(136100),
      chargeBp: number(1333),
      roundVolumeMl: number(70000),
      rofBaseX100: number(33),
      beamArcDeg: number(130),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      "attributes.chargeBp": {
        status: "estimate",
        rationale: "~40 lb black powder over a 300 lb shot",
      },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": {
        status: "estimate",
        rationale: "low, hand-worked casemate pivot",
      },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // Spanish Armstrong 10-inch 12-ton 300-pdr RML (*Numancia*, *Vitoria*). A DISTINCT gun from gun_rml_10in_18ton: 12 tons and
  // a 300 lb shell, not 18 tons and 400 lb (docs/...-followups.md §1). Charge/MV ESTIMATE.
  defineShipComponent({
    id: "gun_rml_10in_12ton_300pdr",
    displayName: "RML 10-inch 12-ton 300-pdr (Armstrong) in broadside",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 12190,
      mount_per_barrel_kg: 15000,
      mount_fixed_kg: 9000,
      cost_per_kg_micro: 150000,
      mount_cost_micro: 3000000000,
    },
    parameters: { barrels: { min: 1, max: 2, step: 1 }, rounds: { min: 20, max: 100, step: 10 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(3).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(10).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(254000),
      // SINGLE-SOURCE: 300 lb rifled shot (Conway's / Brassey 1886)
      shellMassG: number(136100),
      chargeBp: number(2337),
      roundVolumeMl: number(68000),
      rofBaseX100: number(40),
      beamArcDeg: number(130),
      maxFeedPermille: number(280),
    }),
    fieldProvenance: {
      "attributes.chargeBp": { status: "estimate", rationale: "~31.8 kg P over a 300 lb shell" },
      "attributes.roundVolumeMl": { status: "estimate", rationale: "unsourced" },
      "attributes.rofBaseX100": { status: "estimate", rationale: "unsourced" },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
]);
