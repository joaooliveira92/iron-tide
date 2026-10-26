import { describe, expect, it } from "vite-plus/test";
import { createDefaultDamageControlResource } from "@bluewave/combat/damage";
import { battleLoss, initialDamageState } from "@bluewave/combat/battleResolution";
import { FLOAT_UNIT, STRUCTURE_UNIT } from "../../src/damage/minuteDamageConstants.js";
import { autoSolutionQualityBp } from "../../src/battleResolution/torpedoDoctrine.js";
import {
  explainBattleLoss,
  explainDamageControl,
  explainTorpedoSolution,
} from "../../src/battleResolution/battle-explanations.js";

const damagedState = () => ({
  ...initialDamageState("s1"),
  structuralIntegrity: STRUCTURE_UNIT / 2,
  flotationReserve: FLOAT_UNIT / 2,
});

describe("battle explanations", () => {
  it("explains the torpedo solution from the same calculation that sets it", () => {
    for (const torpedoTacticsBp of [0, 1_000, 2_500]) {
      const tree = explainTorpedoSolution(torpedoTacticsBp);
      expect(Number(tree.result)).toBe(autoSolutionQualityBp(torpedoTacticsBp));
      expect(tree.operation).toBe("multiply");
      expect(tree.unit).toBe("bp");
      expect(tree.source).toEqual({ kind: "ruleset", ref: "torpedo_formula_v1" });
    }
  });

  it("lists the training factor only when torpedo tactics training applies", () => {
    expect(explainTorpedoSolution(0).children).toBeUndefined();
    const training = explainTorpedoSolution(1_000).children?.find(
      (child) => child.formulaId === "torpedo_solution.training",
    );
    expect(training?.inputs["multiplierBp"]).toBe(11_000);
    expect(training?.result).toBe(11_000);
  });

  it("explains damage-control pumping and firefighting from the default resources", () => {
    const resources = createDefaultDamageControlResource();
    const tree = explainDamageControl();
    expect(tree.result).toBe(resources.pumpingCapacity);
    expect(tree.unit).toBe("kg/min");
    expect(tree.children?.map((child) => child.formulaId)).toEqual([
      "damage_control.pumping",
      "damage_control.firefighting",
    ]);
    expect(tree.children?.[0]?.result).toBe(resources.pumpingCapacity);
    expect(tree.children?.[1]?.result).toBe(resources.firefightingCapacity);
  });

  it("explains battle loss from the same hit-point calculation", () => {
    const state = damagedState();
    const tree = explainBattleLoss(100, state, 100);
    expect(tree.result).toBe(Number(battleLoss(100, state, 100)));
    expect(tree.result).toBe(50);
    expect(tree.operation).toBe("subtract");
    expect(tree.unit).toBe("hp");
    expect(tree.children?.map((child) => child.formulaId)).toEqual([
      "battle_loss.battleStartHitPoints",
      "battle_loss.currentHitPoints",
    ]);
    expect(tree.children?.[1]?.result).toBe(50);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(explainDamageControl())).toBe(JSON.stringify(explainDamageControl()));
    const state = damagedState();
    expect(JSON.stringify(explainBattleLoss(100, state, 100))).toBe(
      JSON.stringify(explainBattleLoss(100, state, 100)),
    );
  });
});
