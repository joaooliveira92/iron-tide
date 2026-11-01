import type { ExplanationTree } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { hasAuthoredMessage } from "../../lib/strings.js";
import { battleExplanationModel } from "./battle-explanation-model.js";

const child = (
  formulaId: string,
  result: number,
  unit: string | undefined = "bp",
): ExplanationTree => ({
  formulaId,
  formulaVersion: "v1",
  inputs: {},
  intermediate: {},
  result,
  ...(unit === undefined ? {} : { unit }),
});

const tree = (formulaId: string, result: number, unit: string, children: ExplanationTree[]) => ({
  formulaId,
  formulaVersion: "v1",
  inputs: {},
  intermediate: {},
  result,
  unit,
  children,
});

describe("battle explanation model", () => {
  it("formats a basis-point tree as percentages", () => {
    const model = battleExplanationModel(
      tree("torpedo_solution", 8_800, "bp", [child("torpedo_solution.training", 11_000)]),
      "battle.torpedo_solution.summary",
      "en-US",
    );
    expect(model.summary).toBe("Torpedo solution 88%");
    expect(model.rows).toEqual([
      { key: "torpedo_solution.training", label: "Torpedo tactics training", valueText: "110%" },
    ]);
  });

  it("formats hit points and pumping capacities as numbers", () => {
    const loss = battleExplanationModel(
      tree("battle_loss", 50, "hp", [child("battle_loss.currentHitPoints", 50, "hp")]),
      "battle.battle_loss.summary",
      "en-US",
    );
    expect(loss.summary).toBe("Battle damage 50");
    expect(loss.rows[0]?.valueText).toBe("50");

    const damageControl = battleExplanationModel(
      tree("damage_control", 800, "kg/min", [
        child("damage_control.firefighting", 500),
        child("damage_control.pumping", 800, "kg/min"),
      ]),
      "battle.damage_control.summary",
      "en-US",
    );
    expect(damageControl.summary).toBe("Damage control pumping 800");
    expect(damageControl.rows.map((row) => row.valueText)).toEqual(["5%", "800"]);
  });

  it("has a catalogue label for every battle explanation node the engine can emit", () => {
    for (const key of [
      "battle.torpedo_solution.summary",
      "battle.torpedo_solution.training",
      "battle.damage_control.summary",
      "battle.damage_control.pumping",
      "battle.damage_control.firefighting",
      "battle.battle_loss.summary",
      "battle.battle_loss.battleStartHitPoints",
      "battle.battle_loss.currentHitPoints",
      "battle.explanation.none",
    ]) {
      expect(hasAuthoredMessage(key), key).toBe(true);
    }
  });
});

describe("ship motion explanation", () => {
  const motion = tree("ship_motion", 12_500, "mkn", [
    child("ship_motion.orderedSpeed", 14_000, "mkn"),
  ]);

  it("formats milli-knots as knots, never as a percentage", () => {
    const model = battleExplanationModel(motion, "battle.ship_motion.summary", "en-US");
    expect(model.summary).toBe("Speed 12.5 kn");
    expect(model.rows).toEqual([
      { key: "ship_motion.orderedSpeed", label: "Ordered speed", valueText: "14 kn" },
    ]);
  });

  it("has an authored message for every key it uses", () => {
    expect(hasAuthoredMessage("battle.ship_motion.summary")).toBe(true);
    expect(hasAuthoredMessage("battle.ship_motion.orderedSpeed")).toBe(true);
  });
});
