import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_MINE_INVENTORY_INSUFFICIENT,
  submarineMineLayingPolicyId,
  SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT,
  validateSubmarineMineLayingContract,
  isMinelayingCapable,
  evaluateMineLayingEligibility,
} from "@bluewave/combat/submarines";

describe("AC-15: submarine mine laying (§20)", () => {
  it("isMinelayingCapable: MINELAYING and MISSILE are capable", () => {
    expect(isMinelayingCapable("MINELAYING")).toBe(true);
    expect(isMinelayingCapable("MISSILE")).toBe(true);
  });

  it("isMinelayingCapable: other types are not capable", () => {
    expect(isMinelayingCapable("COASTAL")).toBe(false);
    expect(isMinelayingCapable("MEDIUM_RANGE")).toBe(false);
    expect(isMinelayingCapable("LONG_RANGE")).toBe(false);
  });

  it("accepts valid mine laying request", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-north-sea",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.inventoryAfter).toBe(80);
    }
  });

  it("rejects non-minelaying type", () => {
    const verdict = evaluateMineLayingEligibility(
      "COASTAL",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.guard).toBe("type");
    }
  });

  it("rejects without legal route", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: false,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects below readiness floor", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(40),
      SafeInt(50),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects below reliability floor", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(30),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects below fuel floor", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(2_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects insufficient inventory with dedicated code", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(10),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.reasonCode).toBe(SUBMARINE_MINE_INVENTORY_INSUFFICIENT);
    }
  });

  it("rejects when not at war", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      false,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set(["minelaying_submarine_technology"]),
      },
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects missing technology prerequisite", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      true,
      {
        targetAreaId: "area-1",
        legalRouteAvailable: true,
        mineInventory: SafeInt(100),
        requiredInventory: SafeInt(20),
        targetBelligerents: ["nation-enemy"],
        availableTechnologyIds: new Set([]),
      },
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects missing request", () => {
    const verdict = evaluateMineLayingEligibility(
      "MINELAYING",
      SafeInt(60),
      SafeInt(50),
      SafeInt(5_000),
      true,
      null as unknown as never,
    );
    expect(verdict.accepted).toBe(false);
  });
});

describe("submarine_mine_laying_v1 contract (AC-21)", () => {
  it("shipped contract matches expected values", () => {
    expect(SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT.policyId).toBe(submarineMineLayingPolicyId);
    expect(SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT.reliabilityFloor).toBe(40);
    expect(SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT.readinessFloor).toBe(50);
    expect(SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT.fuelFloorBp).toBe(3_000);
  });

  it("validate passes for the shipped contract", () => {
    expect(() =>
      validateSubmarineMineLayingContract(SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT),
    ).not.toThrow();
  });

  it("validate fails on missing contract", () => {
    expect(() => validateSubmarineMineLayingContract(null)).toThrow(BluewaveError);
  });

  it("validate fails on tampered reliability floor", () => {
    expect(() =>
      validateSubmarineMineLayingContract({
        ...SHIPPED_SUBMARINE_MINE_LAYING_CONTRACT,
        reliabilityFloor: 35,
      }),
    ).toThrow(BluewaveError);
  });
});
