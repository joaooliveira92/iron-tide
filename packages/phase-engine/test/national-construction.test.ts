import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { projectedConstructionOrderCosts } from "@bluewave/campaign-engine";
import { constructionProjectFor } from "../src/constructionOrder.js";
import { fundConstructionProject } from "../src/constructionFunding.js";

const design = {
  normalizedDisplacementKg: SafeInt(2_000_000),
  constructionCostUnits: 200,
} as unknown as Parameters<typeof projectedConstructionOrderCosts>[0];

const month = { month: 1, year: 1880 };

describe("national construction economics at order time", () => {
  it("scales the projected cost exactly once by the national multiplier", () => {
    expect(projectedConstructionOrderCosts(design).projectedCost).toBe(200); // nation-neutral
    expect(projectedConstructionOrderCosts(design, 9_300).projectedCost).toBe(
      Math.ceil((200 * 9_300) / 10_000),
    );
    expect(projectedConstructionOrderCosts(design, 10_700).projectedCost).toBeGreaterThan(
      projectedConstructionOrderCosts(design, 9_300).projectedCost,
    );
    // Physical capacity units are not scaled by cost.
    expect(projectedConstructionOrderCosts(design, 10_700).projectedCapacityUnits).toBe(2);
  });

  it("persists the resolved cost and build-time multipliers on the project", () => {
    const project = constructionProjectFor("cmd-1", "dv-1", 196, month, undefined, {
      profileId: "uk",
      costMultiplierBp: 9_800,
      buildTimeMultiplierBp: 9_300,
    });
    expect(project.nationalProfileId).toBe("uk");
    expect(project.totalWork).toBe(196);
    expect(project.costMultiplierBp).toBe(9_800);
    expect(project.buildTimeMultiplierBp).toBe(9_300);
  });

  it("a nation-neutral project omits the national fields", () => {
    const project = constructionProjectFor("cmd-2", "dv-1", 200, month);
    expect(project.nationalProfileId).toBeUndefined();
    expect(project.buildTimeMultiplierBp).toBeUndefined();
  });

  it("build-time multiplier does more work per month for a faster nation (persisted, not re-paced by content)", () => {
    const packages = [
      {
        id: "hull",
        kind: "HULL",
        line: "slipway",
        totalWork: SafeInt(1000),
        doneWork: SafeInt(0),
        dependsOn: [],
      },
    ] as never;
    const base = {
      id: "p",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "d",
      designVersionId: "d",
      totalWork: SafeInt(1000),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "PLANNED",
      startedAt: "1880-01",
      packages,
    };
    const capacity = { slipway: 100 } as never;
    const neutral = fundConstructionProject(base as never, capacity, 1000, "1880-01");
    const fast = fundConstructionProject(
      { ...base, buildTimeMultiplierBp: 8_000 } as never,
      capacity,
      1000,
      "1880-01",
    );
    expect(fast.applied).toBeGreaterThan(neutral.applied);
  });
});
