import type { PrestigeLastChange } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { explainPrestigeChange } from "../src/prestige-explanations.js";

function lastChange(overrides: Partial<PrestigeLastChange> = {}): PrestigeLastChange {
  return {
    reasonCode: "BATTLE_LOST",
    before: SafeInt(20),
    after: SafeInt(18),
    delta: SafeInt(-2),
    month: "1880-02",
    appliedRule: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(1_000) },
    unclampedAfter: SafeInt(18),
    bounds: { lower: SafeInt(0), upper: SafeInt(100) },
    ...overrides,
  };
}

describe("prestige change explanation", () => {
  it("adds the before value, the rule change and the clamp to the displayed after value", () => {
    const tree = explainPrestigeChange(lastChange());
    expect(tree).toBeDefined();
    if (tree === undefined) return;
    expect(tree.formulaId).toBe("prestige_change");
    expect(tree.unit).toBe("prestige");
    expect(tree.operation).toBe("add");
    expect(Number(tree.result)).toBe(18);
    expect(tree.intermediate).toMatchObject({ unclampedAfter: 18, clampDelta: 0 });
    expect(tree.inputs).toMatchObject({
      reasonCode: "BATTLE_LOST",
      ruleKind: "PROPORTIONAL_LOSS",
      ruleRate: 1_000,
    });
    const children = tree.children ?? [];
    expect(children.map((child) => child.formulaId)).toEqual([
      "prestige_change.before",
      "prestige_change.rule",
    ]);
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(18);
    expect(Number(children[1]?.result)).toBe(-2);
  });

  it("records a fixed gain as a positive rule line", () => {
    const tree = explainPrestigeChange(
      lastChange({
        reasonCode: "BATTLE_WON",
        before: SafeInt(20),
        after: SafeInt(22),
        delta: SafeInt(2),
        appliedRule: { kind: "FIXED_GAIN", amount: SafeInt(2) },
        unclampedAfter: SafeInt(22),
      }),
    );
    expect(tree?.children?.map((child) => child.formulaId)).toEqual([
      "prestige_change.before",
      "prestige_change.rule",
    ]);
    expect(Number(tree?.children?.[1]?.result)).toBe(2);
    expect(tree?.children?.[1]?.operation).toBe("add");
    expect(Number(tree?.result)).toBe(22);
  });

  it("records the bound clamp when the rule would leave the bounds", () => {
    const tree = explainPrestigeChange(
      lastChange({
        before: SafeInt(9),
        after: SafeInt(4),
        delta: SafeInt(-5),
        appliedRule: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(10_000) },
        unclampedAfter: SafeInt(0),
        bounds: { lower: SafeInt(4), upper: SafeInt(100) },
      }),
    );
    const children = tree?.children ?? [];
    expect(children.map((child) => child.formulaId)).toEqual([
      "prestige_change.before",
      "prestige_change.rule",
      "prestige_change.clamp",
    ]);
    expect(Number(children[2]?.result)).toBe(4);
    expect(children[2]?.operation).toBe("clamp");
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(4);
    expect(Number(tree?.result)).toBe(4);
  });

  it("has no tree for a last change recorded before the applied rule existed", () => {
    expect(
      explainPrestigeChange({
        reasonCode: "BATTLE_LOST",
        before: SafeInt(20),
        after: SafeInt(19),
        delta: SafeInt(-1),
        month: "1880-02",
      }),
    ).toBeUndefined();
  });
});
