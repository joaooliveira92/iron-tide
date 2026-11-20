import type { UnrestLastChange } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { explainUnrestChange } from "../src/unrest-explanations.js";

function lastChange(overrides: Partial<UnrestLastChange> = {}): UnrestLastChange {
  return {
    before: 4,
    after: 5,
    contributions: [
      { reasonCode: "MILITARY_SPENDING", delta: 2 },
      { reasonCode: "SPENDING_CUT", delta: -1 },
    ],
    month: "1880-02",
    ...overrides,
  };
}

describe("unrest change explanation", () => {
  it("adds the before value and each driver to the displayed after value", () => {
    const tree = explainUnrestChange(lastChange());
    expect(tree.formulaId).toBe("unrest_change");
    expect(tree.unit).toBe("unrest");
    expect(Number(tree.result)).toBe(5);
    const children = tree.children ?? [];
    expect(children.map((child) => child.formulaId)).toEqual([
      "unrest_change.before",
      "unrest_change.military_spending",
      "unrest_change.spending_cut",
    ]);
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(5);
  });

  it("adds a clamp line when the bounds cut the change", () => {
    const tree = explainUnrestChange(
      lastChange({
        before: 9,
        after: 10,
        contributions: [{ reasonCode: "BLOCKADE", delta: 3 }],
      }),
    );
    const children = tree.children ?? [];
    expect(children.map((child) => child.formulaId)).toEqual([
      "unrest_change.before",
      "unrest_change.blockade",
      "unrest_change.clamp",
    ]);
    expect(children.at(-1)?.operation).toBe("clamp");
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(10);
  });

  it("keeps the sum exact for a revolution aftermath", () => {
    const tree = explainUnrestChange(
      lastChange({
        before: 10,
        after: 6,
        contributions: [{ reasonCode: "REVOLUTION_AFTERMATH", delta: -4 }],
      }),
    );
    const children = tree.children ?? [];
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(6);
  });

  it("names every reason code with its own formula id", () => {
    const codes = [
      "MILITARY_SPENDING",
      "SPENDING_CUT",
      "WAR_OUTBREAK",
      "WAR_DURATION",
      "BLOCKADE",
      "DEFEAT",
      "VICTORY",
      "CRAMPED_ACCOMMODATION",
      "PRESENCE_SHORTFALL",
      "EVENT",
      "SOCIAL_PROGRAMME",
      "REVOLUTION_AFTERMATH",
    ] as const;
    const tree = explainUnrestChange(
      lastChange({
        before: 5,
        after: 5,
        contributions: codes.map((reasonCode) => ({ reasonCode, delta: 0 })),
      }),
    );
    expect((tree.children ?? []).slice(1).map((child) => child.formulaId)).toEqual(
      codes.map((code) => `unrest_change.${code.toLowerCase()}`),
    );
  });
});
