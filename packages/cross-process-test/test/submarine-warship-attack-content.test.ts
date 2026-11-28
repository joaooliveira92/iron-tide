import {
  SUBMARINE_POLICIES,
  SUBMARINE_POLICY_TARGET_WEIGHTS_BP,
} from "@bluewave/combat/submarines";
import { HULL_TYPE_FOR_SHIP_TYPE } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";
import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";

const rules = fleetManagementOptions("germany").tradeProtection?.submarineThreat?.warshipAttack;
const { state } = compileProductionCampaign();

describe("1880 submarine warship-attack content (#1159)", () => {
  it("authors the block with the Discussion #1156 magnitudes", () => {
    expect(rules).toEqual({
      attackBp: 250,
      policyMultiplierBp: { FLEET_SUPPORT: 16_000, PRIZE_RULES: 10_000, UNRESTRICTED: 5000 },
      screenReductionBp: 7000,
      sunkBp: 1000,
      maxDamageBp: 4000,
      heavyHullTypes: ["dreadnought", "pre_dreadnought", "armoured_cruiser", "heavy_cruiser"],
      screenHullTypes: ["destroyer"],
    });
  });

  it("keeps the policy multiplier ratios equal to the combat warship target weight ratios", () => {
    const multipliers = rules!.policyMultiplierBp;
    const weights = SUBMARINE_POLICY_TARGET_WEIGHTS_BP;
    const prizeMultiplier = multipliers.PRIZE_RULES;
    const prizeWeight = weights.PRIZE_RULES.warshipAttackBp;
    for (const policy of SUBMARINE_POLICIES) {
      expect(multipliers[policy] * prizeWeight).toBe(
        weights[policy].warshipAttackBp * prizeMultiplier,
      );
    }
  });

  it("names only hull types the production content or ship types can produce", () => {
    const known = new Set<string>([
      ...Object.values(HULL_TYPE_FOR_SHIP_TYPE),
      ...Array.from(state.snapshot.designs.values(), (design) => design.hullType),
    ]);
    for (const hull of [...rules!.heavyHullTypes, ...rules!.screenHullTypes]) {
      expect(known.has(hull), hull).toBe(true);
    }
  });
});
