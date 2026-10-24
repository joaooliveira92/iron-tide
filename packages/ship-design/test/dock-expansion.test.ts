import { BluewaveError } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  DOCK_EXPANSION_BASE_DURATION_MONTHS,
  DOCK_EXPANSION_CLAMP_MAX_DURATION_MONTHS,
  DOCK_EXPANSION_CLAMP_MIN_DURATION_MONTHS,
  DOCK_EXPANSION_ERA_STEPS,
  DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS,
  DOCK_EXPANSION_PERMITTED_MAX_STEP_KG,
  DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS,
  DOCK_EXPANSION_PERMITTED_MIN_STEP_KG,
  DOCK_EXPANSION_POLICY_ID,
  DOCK_EXPANSION_V1,
  assertPermittedDockExpansionDurationMonths,
  dockExpansionEraStepForMonth,
  dockExpansionEraStepKg,
  dockExpansionFinalDurationMonths,
  isPermittedDockExpansionDurationMonths,
  raiseDockLimitsByStep,
} from "../src/dockExpansion.js";
import type { DockMassLimits } from "../src/dockExpansion.js";

const limits = (base: number): DockMassLimits => ({
  maximumNewConstructionMassKg: base,
  maximumMajorRepairMassKg: base,
  maximumRebuildMassKg: base,
  maximumConversionMassKg: base,
});

describe("dock_expansion_v1 policy (SB3-R16)", () => {
  it("ships baseDurationMonths exactly 12 within the permitted 9..18 range", () => {
    expect(DOCK_EXPANSION_BASE_DURATION_MONTHS).toBe(12);
    expect(DOCK_EXPANSION_POLICY_ID).toBe("dock_expansion_v1");
    expect(DOCK_EXPANSION_V1.baseDurationMonths).toBe(12);
    expect(DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS).toBe(9);
    expect(DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS).toBe(18);
    expect(isPermittedDockExpansionDurationMonths(12)).toBe(true);
    expect(isPermittedDockExpansionDurationMonths(9)).toBe(true);
    expect(isPermittedDockExpansionDurationMonths(18)).toBe(true);
    expect(isPermittedDockExpansionDurationMonths(8)).toBe(false);
    expect(isPermittedDockExpansionDurationMonths(19)).toBe(false);
    expect(() => assertPermittedDockExpansionDurationMonths(18)).not.toThrow();
    expect(() => assertPermittedDockExpansionDurationMonths(19)).toThrow(BluewaveError);
  });

  it("raises every covered dock mass limit by the era's exact step", () => {
    const raised = raiseDockLimitsByStep(limits(5_000_000), 1_000_000);
    expect(raised).toEqual(limits(6_000_000));
    expect(Object.keys(raised).sort()).toEqual(
      [
        "maximumConversionMassKg",
        "maximumMajorRepairMassKg",
        "maximumNewConstructionMassKg",
        "maximumRebuildMassKg",
      ].sort(),
    );
  });

  it("clamps finalDurationMonths to 6..24 after the ceiling", () => {
    expect(
      dockExpansionFinalDurationMonths(12, DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP),
    ).toBe(12);
    expect(dockExpansionFinalDurationMonths(12, 20_000)).toBe(
      DOCK_EXPANSION_CLAMP_MAX_DURATION_MONTHS,
    );
    expect(dockExpansionFinalDurationMonths(12, 1_000)).toBe(
      DOCK_EXPANSION_CLAMP_MIN_DURATION_MONTHS,
    );
    expect(dockExpansionFinalDurationMonths(9, 12_001)).toBe(11);
  });
});

describe("dock_expansion era step schedule (SB3-R16)", () => {
  it("uses the declared step per era", () => {
    expect(dockExpansionEraStepKg(1880)).toBe(1_000_000);
    expect(dockExpansionEraStepKg(1899)).toBe(1_000_000);
    expect(dockExpansionEraStepKg(1900)).toBe(1_250_000);
    expect(dockExpansionEraStepKg(1919)).toBe(1_250_000);
    expect(dockExpansionEraStepKg(1920)).toBe(1_500_000);
    expect(dockExpansionEraStepKg(1939)).toBe(1_500_000);
    expect(dockExpansionEraStepKg(1940)).toBe(1_750_000);
    expect(dockExpansionEraStepKg(1959)).toBe(1_750_000);
    expect(dockExpansionEraStepKg(1960)).toBe(2_000_000);
    expect(dockExpansionEraStepKg(1970)).toBe(2_000_000);
  });

  it("every declared step stays inside the permitted 1_000_000..2_000_000 kg range", () => {
    for (const era of DOCK_EXPANSION_ERA_STEPS) {
      expect(era.stepKg).toBeGreaterThanOrEqual(DOCK_EXPANSION_PERMITTED_MIN_STEP_KG);
      expect(era.stepKg).toBeLessThanOrEqual(DOCK_EXPANSION_PERMITTED_MAX_STEP_KG);
    }
  });

  it("fails closed outside every authored era rather than guessing", () => {
    expect(dockExpansionEraStepKg(1879)).toBeNull();
    expect(dockExpansionEraStepKg(1971)).toBeNull();
    expect(dockExpansionEraStepKg(Number.NaN)).toBeNull();
  });

  it("resolves the step from the authorization month, so the caller can lock it", () => {
    expect(dockExpansionEraStepForMonth("1880-06")).toBe(1_000_000);
    expect(dockExpansionEraStepForMonth("1900-01")).toBe(1_250_000);
    expect(dockExpansionEraStepForMonth("1920-01")).toBe(1_500_000);
    expect(dockExpansionEraStepForMonth("not-a-month")).toBeNull();
  });
});
