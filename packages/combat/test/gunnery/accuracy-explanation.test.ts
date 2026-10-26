import { describe, expect, it } from "vite-plus/test";
import {
  GUNNERY_ACCURACY_FACTOR_KEYS,
  neutralAccuracyFactors,
  resolveAccuracy,
} from "@bluewave/combat/gunnery";
import { explainGunneryAccuracy } from "../../src/gunnery/accuracy-explanation.js";

const factors = (patch: Record<string, number>) => ({
  ...neutralAccuracyFactors(6_000),
  ...patch,
});

describe("gunnery accuracy explanation", () => {
  it("reports the resolved accuracy as the result, in basis points", () => {
    const input = factors({ training: 11_000, crew: 9_000 });
    const tree = explainGunneryAccuracy(input);
    expect(tree.result).toBe(resolveAccuracy(input).finalAccuracyBp);
    expect(tree.unit).toBe("bp");
    expect(tree.formulaId).toBe("gunnery_accuracy");
    expect(tree.formulaVersion).toBe("gunnery_accuracy_v1");
    expect(tree.inputs).toEqual({ baseAccuracyBp: 6_000 });
  });

  it("lists only the factors that change the result, in the canonical factor order", () => {
    const tree = explainGunneryAccuracy(
      factors({ visibility: 8_000, officer: 12_000, crew: 9_000 }),
    );
    expect((tree.children ?? []).map((child) => child.formulaId)).toEqual([
      "gunnery_accuracy.crew",
      "gunnery_accuracy.officer",
      "gunnery_accuracy.visibility",
    ]);
    for (const child of tree.children ?? []) {
      expect(child.unit).toBe("bp");
      expect(child.result).toBe(child.inputs["multiplierBp"]);
      expect(child.children).toBeUndefined();
    }
  });

  it("has no children when every factor is neutral", () => {
    expect(explainGunneryAccuracy(factors({})).children).toBeUndefined();
  });

  it("names the operation and source on every node", () => {
    const tree = explainGunneryAccuracy(factors({ training: 11_000, crew: 9_000 }));
    expect(tree.operation).toBe("multiply");
    expect(tree.source).toEqual({ kind: "ruleset", ref: "gunnery_accuracy_v1" });
    for (const child of tree.children ?? []) {
      expect(child.operation).toBe("multiply");
      expect(child.source).toEqual({ kind: "ruleset", ref: "gunnery_accuracy_v1" });
    }
  });

  it("records the rounded-down raw result so the chain can be checked by hand", () => {
    const input = factors({ training: 11_000 });
    const tree = explainGunneryAccuracy(input);
    expect(tree.intermediate["rawFlooredBp"]).toBe(6_600);
    expect(tree.result).toBe(6_600);
  });

  it("is deterministic and lists every canonical key as a possible child id", () => {
    const input = factors(
      Object.fromEntries(GUNNERY_ACCURACY_FACTOR_KEYS.map((key) => [key, 9_500])),
    );
    const a = explainGunneryAccuracy(input);
    expect(JSON.stringify(explainGunneryAccuracy(input))).toBe(JSON.stringify(a));
    expect((a.children ?? []).map((c) => c.formulaId)).toEqual(
      GUNNERY_ACCURACY_FACTOR_KEYS.map((key) => `gunnery_accuracy.${key}`),
    );
  });
});
