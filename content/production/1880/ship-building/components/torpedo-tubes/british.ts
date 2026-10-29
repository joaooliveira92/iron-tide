// Ship-building component catalogue: British torpedo tubes.
// Source of record: docs/research/ship-building-early-band-2.md.
// Units: kg, mm, litres, kW, budget micro-units, bp. Formulas use the restricted grammar of
// @bluewave/ship-design. Every component id is unique across this directory; the compiler
// discovers nothing on its own: pack.json's `shipBuilding.shipComponents` lists every file.
// 14in Whitehead (research 2, section 2): mass 300 kg (660 lb, Mk IV c. 1884) and length 4.5 m SINGLE-SOURCE, 24 kn over 549 m VERIFIED, warhead 26 kg (Mk IV 1884; 12 kg in 1877) SINGLE-SOURCE; carriage mass ESTIMATE 0.8-2.0 t (UNVERIFIED); 3 torpedoes per tube (Royal Sovereign 18 for 7 tubes, Edgar 18 for 4; Brassey 1891) VERIFIED ratio 2.6-4.5; tube gear GBP 3,100 per ship (Trafalgar), about GBP 700 per tube.
import {
  defineShipComponent,
  defineShipComponentCatalogue,
  number,
} from "@bluewave/content-authoring";

export default defineShipComponentCatalogue([
  defineShipComponent({
    id: "tube_14in_above_water",
    displayName: "14-inch Whitehead torpedo tube, above-water trainable carriage",
    category: "TORPEDO_TUBE",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      tube_kg: 1400,
      torpedo_kg: 300,
      torpedoes_per_tube: 3,
      cost_per_tube_micro: 700000000,
    },
    parameters: { tubes: { min: 1, max: 4, step: 1 } },
    formulas: (v) => ({
      weightKg: v.tube_kg.plus(v.torpedo_kg.times(v.torpedoes_per_tube)).times(v.tubes),
      volumeLitre: number(2500).plus(number(600).times(v.torpedoes_per_tube)).times(v.tubes),
      costMicro: v.cost_per_tube_micro.times(v.tubes),
      crew: number(3).times(v.tubes),
      powerKw: number(0),
      deckFootprintMm2: number(2500000).times(v.tubes),
      heightMm: number(1500),
      zCgMm: number(4800),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "volume" },
      costMicro: { status: "placeholder", rationale: "unsourced" },
    },
    requires: ["torp_whitehead_torpedo"],
    upgradePath: [],
    tags: ["torpedo"],
    torpedoMount: { mountType: "ABOVE_WATER_TRAINABLE", torpedoModelId: "whitehead_14in_1886" },
    maintenanceMonthlyBp: 15,
  }),
  // 14in Whitehead (research 2, section 2): mass 300 kg (660 lb, Mk IV c. 1884) and length 4.5 m SINGLE-SOURCE, 24 kn over 549 m VERIFIED, warhead 26 kg (Mk IV 1884; 12 kg in 1877) SINGLE-SOURCE; tube mass ESTIMATE 1.5-3.5 t (UNVERIFIED); 3 torpedoes per tube (Royal Sovereign 18 for 7 tubes, Edgar 18 for 4; Brassey 1891) VERIFIED ratio 2.6-4.5; tube gear GBP 3,100 per ship (Trafalgar), about GBP 700 per tube.
  defineShipComponent({
    id: "tube_14in_submerged",
    displayName: "14-inch Whitehead torpedo tube, submerged bow tube",
    category: "TORPEDO_TUBE",
    introduction: { fromMonth: "1880-01", obsoleteMonth: null },
    constants: {
      tube_kg: 2500,
      torpedo_kg: 300,
      torpedoes_per_tube: 3,
      cost_per_tube_micro: 700000000,
    },
    parameters: { tubes: { min: 1, max: 4, step: 1 } },
    formulas: (v) => ({
      weightKg: v.tube_kg.plus(v.torpedo_kg.times(v.torpedoes_per_tube)).times(v.tubes),
      volumeLitre: number(2500).plus(number(600).times(v.torpedoes_per_tube)).times(v.tubes),
      costMicro: v.cost_per_tube_micro.times(v.tubes),
      crew: number(3).times(v.tubes),
      powerKw: number(0),
      deckFootprintMm2: number(2500000).times(v.tubes),
      heightMm: number(1500),
      zCgMm: number(4800),
    }),
    fieldProvenance: {
      volumeLitre: { status: "placeholder", rationale: "volume" },
      costMicro: { status: "placeholder", rationale: "unsourced" },
    },
    requires: ["torp_whitehead_torpedo"],
    upgradePath: [],
    tags: ["torpedo"],
    torpedoMount: { mountType: "UNDERWATER_FIXED", torpedoModelId: "whitehead_14in_1886" },
    maintenanceMonthlyBp: 15,
  }),
]);
