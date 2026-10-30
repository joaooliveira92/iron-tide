// Ship-building component catalogue: United States ordnance.
// Source of record: docs/research/ship-building-early-band.md and
// docs/research/e-1-1940s-hull-and-part-values.md. Provenance is carried per record.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// 15in Dahlgren SMOOTHBORE in monitor turret (US Canonicus class). Bore and gun mass 43,000 lb from the 1866 US
// Ordnance Instructions powder-proof table; shell 330 lb and charges 50/35/60 lb from the same table (VERIFIED).
// Muzzle velocity and the very low rate of fire are ESTIMATE. This is a SMOOTH BORE: it must never be mapped onto a
// rifled RML family (ADR-0117). Rate of fire is deliberately far below a rifle's.
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "gun_sb_15in_dahlgren",
    displayName: "XV-inch Dahlgren smoothbore in monitor turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      gun_kg: 19504,
      mount_per_barrel_kg: 22000,
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
      crew: number(14).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(470).times(v.gun_kg.plus(v.mount_per_barrel_kg)).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(381000),
      // 330 lb proof/service shell [OI66] VERIFIED
      shellMassG: number(149700),
      // 50 lb distant black-powder charge over a 330 lb shell [OI66] VERIFIED
      chargeBp: number(1515),
      roundVolumeMl: number(260000),
      rofBaseX100: number(12),
      beamArcDeg: number(120),
      maxFeedPermille: number(250),
    }),
    fieldProvenance: {
      costMicro: { status: "estimate", rationale: "unsourced" },
      "attributes.roundVolumeMl": {
        status: "estimate",
        rationale: "~2.5-calibre 15-in shell plus charge",
      },
      "attributes.rofBaseX100": {
        status: "estimate",
        rationale: "very slow monitor reload (~0.12 rds/min)",
      },
    },
    requires: [],
    upgradePath: [],
    tags: ["gun", "heavy", "smoothbore"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // --- E-1 1940-1949 (ADR-0284) ---------------------------------------------------------------------------------------------
  // US 5-inch/38 Mark 12 in the Mark 38 twin dual-purpose mount (docs/research/e-1-1940s-hull-and-part-values.md sections 1-2).
  // Sourced (navweaps.com WNUS_5-38_mk12, SINGLE-SOURCE): 127 mm bore, 25.0 kg shell, 1,810 kg gun without breech, Mk 38 Mod 0 mount
  // 43,409 kg with two guns, rate 15-22 rpm for base-ring mounts with hoists (the lower bound is used, BALANCE TARGET), arc about 300 deg
  // on a destroyer. The charge (2,800 bp) is DERIVED from 6.9-7.03 kg over the shell. The mount splits as 19,894 kg per barrel and no
  // fixed mass, so the twin returns 43,408 kg. Round volume follows the 0.5 mL per gram convention of the QF rows. Cost, crew, power,
  // volume, footprint, height and maintenance are BALANCE TARGET copied from gun_qf_6in_40, the nearest medium gun. The 1945 date is the
  // dossier's mount date (ADR-0283 D2); the gun itself entered service in 1934.
  defineShipComponent({
    id: "gun_dp_5in_38_twin",
    displayName: "5-inch/38 dual-purpose gun in Mark 38 twin mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1945-01", obsoleteMonth: null },
    constants: {
      gun_kg: 1810,
      mount_per_barrel_kg: 19894,
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
      caliberUm: number(127000),
      shellMassG: number(25000),
      chargeBp: number(2800),
      roundVolumeMl: number(16000),
      rofBaseX100: number(1500),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: ["gun_dp_rapid_5in"],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // US 6-inch/47 Mark 16 dual-purpose gun in the twin turret of the Worcester class, E-1 1940-1949 (ADR-0284, ADR-0290;
  // docs/research/e-1-1940s-hull-and-part-values.md sections 3-4). Sourced (navweaps.com WNUS_6-47DP_mk16, SINGLE-SOURCE): 152 mm bore, 59.0 kg AP shell,
  // 6,600 kg gun, 212,000 kg twin turret (208.5 tons), 12 rounds per minute, about 300 deg of train, 21 crew per mounting (modelled as 11 per barrel, 22, because the part model needs a whole crew per barrel), service 1948. The charge
  // (2,542 bp) is DERIVED from 15.0 kg over the AP shell. The turret splits as 99,400 kg per barrel and no fixed mass, so the twin returns 212,000 kg.
  // Round volume follows the 0.5 mL per gram convention. Mount cost scales gun_qf_6in_40 by mount mass (197,368 micro per kg), volume and footprint
  // use the 3 L and 470 mm2 per kg conventions of the legacy rows: all BALANCE TARGET. The projectiles are hand-loaded (navweaps.com), so the mount
  // requires gun_dp_rapid_5in rather than gun_auto_loading_turret (ADR-0284 decision 3).
  defineShipComponent({
    id: "gun_dp_6in_47_twin",
    displayName: "6-inch/47 Mark 16 dual-purpose gun in twin turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1948-01", obsoleteMonth: null },
    constants: {
      gun_kg: 6600,
      mount_per_barrel_kg: 99400,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 19620000000,
    },
    parameters: { barrels: { min: 2, max: 2, step: 1 }, rounds: { min: 200, max: 1000, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(318000).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(11).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(49800000).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(152000),
      shellMassG: number(59000),
      chargeBp: number(2542),
      roundVolumeMl: number(37000),
      rofBaseX100: number(1200),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: ["gun_dp_rapid_5in"],
    upgradePath: [],
    tags: ["gun", "medium"],
    fcClass: "medium",
    maintenanceMonthlyBp: 20,
  }),
  // US 8-inch/55 Mark 16 rapid-fire gun in the triple turret of the Des Moines class, E-1 1940-1949 (ADR-0284, ADR-0290; research note sections 5-6).
  // Sourced (navweaps.com WNUS_8-55_mk16, SINGLE-SOURCE): 203 mm bore, 152 kg AP shell, 17,400 kg gun, 458,000 kg triple turret (451 tons), 10 rounds
  // per minute, about 300 deg of train, about 44 crew (modelled as 15 per barrel, 45), service 1948. The charge (2,296 bp) is DERIVED from 34.9 kg over the AP shell. The turret splits
  // as 135,267 kg per barrel and no fixed mass (458,001 kg). Mount cost scales gun_bl_92in_315 by mount mass (285,714 micro per kg); round volume,
  // volume and footprint as the 6-inch row: all BALANCE TARGET. The mount requires gun_auto_loading_turret (ADR-0284 decision 3).
  defineShipComponent({
    id: "gun_ap_8in_55_triple",
    displayName: "8-inch/55 Mark 16 rapid-fire gun in triple turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1948-01", obsoleteMonth: null },
    constants: {
      gun_kg: 17400,
      mount_per_barrel_kg: 135267,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 38648000000,
    },
    parameters: { barrels: { min: 3, max: 3, step: 1 }, rounds: { min: 150, max: 750, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(457800).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(15).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(71700000).times(v.barrels),
      heightMm: number(3200),
      zCgMm: number(6500),
    }),
    attributes: () => ({
      caliberUm: number(203000),
      shellMassG: number(152000),
      chargeBp: number(2296),
      roundVolumeMl: number(93450),
      rofBaseX100: number(1000),
      beamArcDeg: number(150),
      maxFeedPermille: number(300),
    }),
    requires: ["gun_auto_loading_turret"],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 20,
  }),
  // US 16-inch/50 Mark 7 gun in the Iowa class triple turret, E-1 1940-1949 (ADR-0332; research note section 14). Sourced
  // (navweaps.com WNUS_16-50_mk7 and navypedia.org us_bb_iowa, SINGLE-SOURCE): 406 mm bore, 1,225 kg AP Mark 8 shell, 121,519 kg gun
  // with breech, 1,735 mt triple turret, 2 rounds per minute, about 300 deg of train, service 1943. The charge (2,444 bp) is DERIVED
  // from 299.4 kg over the AP shell. The turret splits as 578,467 kg per barrel and no fixed mass (1,735,401 kg). Mount cost, round
  // volume, crew, volume and footprint scale the 8-inch triple by mass and follow the same conventions: all BALANCE TARGET.
  defineShipComponent({
    id: "gun_ap_16in_50_triple",
    displayName: "16-inch/50 Mark 7 gun in triple turret",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1943-01", obsoleteMonth: null },
    constants: {
      gun_kg: 121519,
      mount_per_barrel_kg: 578467,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 165300000000,
    },
    parameters: { barrels: { min: 3, max: 3, step: 1 }, rounds: { min: 50, max: 1300, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(600000).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(64).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(30000000).times(v.barrels),
      heightMm: number(4000),
      zCgMm: number(7500),
    }),
    attributes: () => ({
      caliberUm: number(406000),
      shellMassG: number(1225000),
      chargeBp: number(2444),
      roundVolumeMl: number(600000),
      rofBaseX100: number(200),
      beamArcDeg: number(150),
      maxFeedPermille: number(250),
    }),
    requires: ["gun_16in_heavy_guns"],
    upgradePath: [],
    tags: ["gun", "heavy"],
    fcClass: "heavy",
    maintenanceMonthlyBp: 40,
  }),
  // US 5-inch/54 Mark 18 gun in the Mark 42 single mount, E-1 1950-1959 (ADR-0291; docs/research/e-1-1940s-hull-and-part-values.md section 13). Sourced
  // (navweaps.com WNUS_5-54_mk42, SINGLE-SOURCE): 127 mm bore, 31.45 kg HC projectile, 2,550 kg gun, 58,586 kg mount without ammunition and fluids, 40 rounds per
  // minute as designed, about 300 deg of train, 20 crew in the original Mod 0, service 1954. The charge (2,604 bp) is DERIVED from 8.19 kg over the projectile. The
  // mount splits as 56,036 kg per barrel and no fixed mass (58,586 kg). Round volume follows the 0.5 mL per gram convention; mount cost scales gun_qf_6in_40 by
  // mount mass (197,368 micro per kg); volume and footprint use the 3 L and 470 mm2 per kg conventions: all BALANCE TARGET. The gun predates nothing, so it requires
  // gun_dp_rapid_5in like the 5-inch/38 mount.
  defineShipComponent({
    id: "gun_dp_5in_54_single",
    displayName: "5-inch/54 Mark 18 dual-purpose gun in Mark 42 single mount",
    category: "SECONDARY_GUN",
    introduction: { fromMonth: "1954-01", obsoleteMonth: null },
    constants: {
      gun_kg: 2550,
      mount_per_barrel_kg: 56036,
      mount_fixed_kg: 0,
      cost_per_kg_micro: 197000,
      mount_cost_micro: 11060000000,
    },
    parameters: { barrels: { min: 1, max: 1, step: 1 }, rounds: { min: 200, max: 800, step: 50 } },
    formulas: (v) => ({
      weightKg: v.gun_kg.plus(v.mount_per_barrel_kg).times(v.barrels).plus(v.mount_fixed_kg),
      volumeLitre: number(175800).times(v.barrels),
      costMicro: v.gun_kg
        .times(v.barrels)
        .times(v.cost_per_kg_micro)
        .plus(v.mount_cost_micro.times(v.barrels)),
      crew: number(20).times(v.barrels),
      powerKw: number(1).times(v.barrels),
      deckFootprintMm2: number(27500000).times(v.barrels),
      heightMm: number(2200),
      zCgMm: number(6000),
    }),
    attributes: () => ({
      caliberUm: number(127000),
      shellMassG: number(31450),
      chargeBp: number(2604),
      roundVolumeMl: number(19820),
      rofBaseX100: number(4000),
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
