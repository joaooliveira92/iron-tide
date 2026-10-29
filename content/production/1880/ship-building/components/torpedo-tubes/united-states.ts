// Ship-building component catalogue: United States torpedo tubes.
// Source of record: docs/research/e-1-1940s-hull-and-part-values.md.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// 21-inch tubes for the Mark 14 torpedo (usn_21in_mk14_1931), E-1 1940-1949 (ADR-0284). The torpedo mass 1,361 kg is the sourced Mark 14
// part value. The tube mass, stowage, volume, cost and crew scale tube_14in_above_water by the bore ratio squared (533/356 = 2.24, rounded to
// 2.2): BALANCE TARGET, no source gives a 21-inch tube. One torpedo per tube: the destroyers of the era carried no reloads in the mount.
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "tube_21in_above_water",
    displayName: "21-inch torpedo tube, above-water trainable quintuple-capable carriage",
    category: "TORPEDO_TUBE",
    introduction: { fromMonth: "1931-01", obsoleteMonth: null },
    constants: {
      tube_kg: 3080,
      torpedo_kg: 1361,
      torpedoes_per_tube: 1,
      cost_per_tube_micro: 1540000000,
    },
    parameters: { tubes: { min: 1, max: 10, step: 1 } },
    formulas: (v) => ({
      weightKg: v.tube_kg.plus(v.torpedo_kg.times(v.torpedoes_per_tube)).times(v.tubes),
      volumeLitre: number(5500).plus(number(1300).times(v.torpedoes_per_tube)).times(v.tubes),
      costMicro: v.cost_per_tube_micro.times(v.tubes),
      crew: number(3).times(v.tubes),
      powerKw: number(0),
      deckFootprintMm2: number(5500000).times(v.tubes),
      heightMm: number(1800),
      zCgMm: number(4800),
    }),
    requires: ["torp_21in_ww1"],
    upgradePath: [],
    tags: ["torpedo"],
    torpedoMount: { mountType: "ABOVE_WATER_TRAINABLE", torpedoModelId: "usn_21in_mk14_1931" },
    maintenanceMonthlyBp: 15,
  }),
]);
