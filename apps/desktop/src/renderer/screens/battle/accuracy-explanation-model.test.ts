import type { ExplanationTree } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { hasAuthoredMessage } from "../../lib/strings.js";
import { accuracyExplanationModel, explanationLabelKey } from "./accuracy-explanation-model.js";

const child = (key: string, multiplierBp: number): ExplanationTree => ({
  formulaId: `gunnery_accuracy.${key}`,
  formulaVersion: "gunnery_accuracy_v1",
  inputs: { multiplierBp },
  intermediate: {},
  result: multiplierBp,
  unit: "bp",
});

const tree = (children: ExplanationTree[], result = 6_600): ExplanationTree => ({
  formulaId: "gunnery_accuracy",
  formulaVersion: "gunnery_accuracy_v1",
  inputs: { baseAccuracyBp: 6_000 },
  intermediate: { rawFlooredBp: result },
  result,
  unit: "bp",
  ...(children.length === 0 ? {} : { children }),
});

describe("accuracy explanation model", () => {
  it("states the base, each non-neutral factor as a signed change, and the final accuracy", () => {
    const model = accuracyExplanationModel(
      tree([child("crew", 9_000), child("training", 11_000)]),
      "en-US",
    );
    expect(model.baseText).toBe("60%");
    expect(model.resultText).toBe("66%");
    expect(model.rows).toEqual([
      { key: "crew", label: "Crew quality", changeText: "-10%" },
      { key: "training", label: "Training", changeText: "+10%" },
    ]);
  });

  it("has no rows when nothing modifies the base", () => {
    expect(accuracyExplanationModel(tree([], 6_000), "en-US").rows).toEqual([]);
  });

  it("keeps the engine's order and shows fractions of a percent", () => {
    const model = accuracyExplanationModel(
      tree([child("officer", 10_250), child("visibility", 9_750)]),
      "en-US",
    );
    expect(model.rows.map((row) => row.changeText)).toEqual(["+2.5%", "-2.5%"]);
  });

  it("has a catalogue label for every factor the engine can list", () => {
    for (const key of [
      "fireControl",
      "crew",
      "officer",
      "training",
      "range",
      "visibility",
      "radar",
      "ownManeuver",
      "targetManeuver",
      "previousSalvo",
      "seaState",
      "smoke",
      "damage",
      "multipleAttacker",
      "glare",
      "targetEvasion",
    ]) {
      const labelKey = explanationLabelKey("battle", `gunnery_accuracy.${key}`);
      expect(labelKey).toBe(`battle.gunnery_accuracy.${key}`);
      expect(labelKey.split(".")).toHaveLength(3);
      expect(hasAuthoredMessage(labelKey)).toBe(true);
    }
  });

  it("rejects a node id that does not follow the <formula>.<node> convention", () => {
    expect(() => explanationLabelKey("battle", "gunnery_accuracy")).toThrow();
    expect(() => explanationLabelKey("battle", "gunnery_accuracy.")).toThrow();
    expect(() => explanationLabelKey("battle", "a.b.c")).toThrow();
  });
});
