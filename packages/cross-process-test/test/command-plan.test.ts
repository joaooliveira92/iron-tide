import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { decodeCommandPlan } from "../src/replay-corpus/commandPlan.js";
import { formatCommandPlanFailure, type CommandPlan } from "../src/replay-corpus/fuzz.js";

const PLAN: CommandPlan = [
  [
    { kind: "SetBudgetAllocation", draws: [0, 250, 1000] },
    { kind: "OrderConstruction", draws: [3] },
  ],
  [],
  [{ kind: "SetResearchPriority", draws: [] }],
];

describe("decodeCommandPlan", () => {
  it("round-trips a plan through its JSON text", () => {
    const decoded = decodeCommandPlan(JSON.stringify(PLAN));
    expect(Result.isSuccess(decoded) ? decoded.success : undefined).toEqual(PLAN);
  });

  it("decodes the plan printed in a reproduce line", () => {
    const failure = formatCommandPlanFailure("seed-1", PLAN, {
      property: "repeatability",
      divergence: { month: 1, turnNumber: 1, where: "snapshot", expected: "a", actual: "b" },
    });
    const text = /plan seed-1 '(.*)'/.exec(failure)?.[1] ?? "";
    const decoded = decodeCommandPlan(text);
    expect(Result.isSuccess(decoded) ? decoded.success : undefined).toEqual(PLAN);
  });

  it("rejects text that is not JSON", () => {
    expect(Result.isFailure(decodeCommandPlan("{not json"))).toBe(true);
  });

  it("rejects an unknown command kind", () => {
    const decoded = decodeCommandPlan(JSON.stringify([[{ kind: "ScuttleFleet", draws: [1] }]]));
    expect(Result.isFailure(decoded)).toBe(true);
  });

  it("rejects an unexpected key on a pick", () => {
    const decoded = decodeCommandPlan(
      JSON.stringify([[{ kind: "OrderConstruction", draws: [1], extra: true }]]),
    );
    expect(Result.isFailure(decoded)).toBe(true);
  });

  it("rejects a plan that is not an array of arrays", () => {
    expect(Result.isFailure(decodeCommandPlan(JSON.stringify({ kind: "OrderConstruction" })))).toBe(
      true,
    );
    expect(
      Result.isFailure(decodeCommandPlan(JSON.stringify([{ kind: "OrderConstruction" }]))),
    ).toBe(true);
  });

  it("rejects a non-numeric draw", () => {
    const decoded = decodeCommandPlan(
      JSON.stringify([[{ kind: "OrderConstruction", draws: ["a"] }]]),
    );
    expect(Result.isFailure(decoded)).toBe(true);
  });
});
