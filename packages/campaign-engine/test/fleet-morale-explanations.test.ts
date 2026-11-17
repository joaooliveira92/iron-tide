import type { FleetMoraleLastChange } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import { explainFleetMoraleChange } from "../src/fleet-morale-explanations.js";

function lastChange(overrides: Partial<FleetMoraleLastChange> = {}): FleetMoraleLastChange {
  return {
    before: 80,
    after: 65,
    unclampedAfter: 65,
    contributions: [
      { reasonCode: "UNPAID_FUNDS", delta: -10 },
      { reasonCode: "BLOCKADE_CRAMPED", delta: -5 },
    ],
    month: "1880-02",
    ...overrides,
  };
}

describe("fleet morale change explanation", () => {
  it("adds the before value and each driver to the displayed after value", () => {
    const tree = explainFleetMoraleChange(lastChange());
    expect(tree.formulaId).toBe("fleet_morale_change");
    expect(tree.unit).toBe("morale");
    expect(Number(tree.result)).toBe(65);
    const children = tree.children ?? [];
    expect(children.map((child) => child.formulaId)).toEqual([
      "fleet_morale_change.before",
      "fleet_morale_change.unpaid_funds",
      "fleet_morale_change.blockade_cramped",
    ]);
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(65);
  });

  it("adds a clamp line when the floor cut the change", () => {
    const tree = explainFleetMoraleChange(
      lastChange({
        before: 3,
        after: 0,
        unclampedAfter: -7,
        contributions: [{ reasonCode: "UNPAID_FUNDS", delta: -10 }],
      }),
    );
    const children = tree.children ?? [];
    expect(children.map((child) => child.formulaId)).toEqual([
      "fleet_morale_change.before",
      "fleet_morale_change.unpaid_funds",
      "fleet_morale_change.clamp",
    ]);
    expect(children.reduce((sum, child) => sum + Number(child.result), 0)).toBe(0);
  });

  it("names a recovery month", () => {
    const tree = explainFleetMoraleChange(
      lastChange({
        before: 50,
        after: 52,
        unclampedAfter: 52,
        contributions: [{ reasonCode: "RECOVERY", delta: 2 }],
      }),
    );
    expect((tree.children ?? []).map((child) => child.formulaId)).toContain(
      "fleet_morale_change.recovery",
    );
  });
});
