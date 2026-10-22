import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  reserveAndConsumeAmmunition,
  GUNNERY_AMMUNITION_UNAVAILABLE,
  type GunneryState,
  type AmmunitionType,
} from "@bluewave/combat/gunnery";

function ammo(
  overrides: Partial<Record<AmmunitionType, number>> = {},
): Record<AmmunitionType, number> {
  return {
    ARMOR_PIERCING: 120,
    COMMON: 80,
    HIGH_EXPLOSIVE: 40,
    ...overrides,
  };
}

function batteryState(ammunition: Record<AmmunitionType, number>): GunneryState {
  return {
    batteryId: "BAT-1",
    ownerShipId: "SHIP-ALPHA",
    gunDefinitionId: "GUN-305-45",
    mountDefinitionId: "MNT-305-TWIN",
    targetContactId: "battle:asset-omega",
    acquisitionProgressBp: 8_000,
    rangeEstimateUm: 12_000_000_000,
    rangeUncertaintyUm: 150_000_000,
    fireControlSolutionQualityBp: 7_500,
    ammunition,
    fireMode: "NORMAL",
    reloadProgressMs: 12_000,
    straddleState: null,
    damageState: null,
    aaEligibilityState: null,
    lastSalvoMinute: 1,
    lastSalvoSubstep: 0,
    rulesetVersion: "gunnery_ruleset_v1",
    formulaVersion: "gunnery_formula_v1",
    stateHash: "",
  };
}

describe("AC-7 atomic ammunition reserve + consume (DESIGN-39 §28)", () => {
  it("reserves and consumes exactly the requested count from the preferred type", () => {
    const state = batteryState(ammo());
    const { ammunition, account } = reserveAndConsumeAmmunition(
      state.ammunition,
      4,
      "ARMOR_PIERCING",
    );
    expect(account.type).toBe("ARMOR_PIERCING");
    expect(account.count).toBe(4);
    expect(account.before).toBe(120);
    expect(account.after).toBe(116);
    expect(ammunition).toEqual(ammo({ ARMOR_PIERCING: 116 }));
  });

  it("is atomic: never splits a salvo across types (fails if no single type holds it)", () => {
    const state = batteryState(ammo());
    let err: BluewaveError | undefined;
    try {
      reserveAndConsumeAmmunition(state.ammunition, 200, "ARMOR_PIERCING");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(GUNNERY_AMMUNITION_UNAVAILABLE);
    expect(state.ammunition).toEqual(ammo());
  });

  it("selects another permitted type when the preferred type is insufficient", () => {
    const state = batteryState(ammo({ ARMOR_PIERCING: 2, COMMON: 80 }));
    const { ammunition, account } = reserveAndConsumeAmmunition(
      state.ammunition,
      4,
      "ARMOR_PIERCING",
    );
    expect(account.type).toBe("COMMON");
    expect(account.before).toBe(80);
    expect(account.after).toBe(76);
    expect(ammunition).toEqual(ammo({ ARMOR_PIERCING: 2, COMMON: 76 }));
  });

  it("respects a restricted permitted-type policy when selecting a substitute", () => {
    const state = batteryState(ammo({ ARMOR_PIERCING: 2, COMMON: 80, HIGH_EXPLOSIVE: 40 }));
    const { account } = reserveAndConsumeAmmunition(state.ammunition, 4, "ARMOR_PIERCING", [
      "ARMOR_PIERCING",
      "HIGH_EXPLOSIVE",
    ]);
    expect(account.type).toBe("HIGH_EXPLOSIVE");
    expect(account.after).toBe(36);
  });

  it("fails with GUNNERY_AMMUNITION_UNAVAILABLE when no permitted type holds the count (no partial)", () => {
    const state = batteryState(ammo({ ARMOR_PIERCING: 3, COMMON: 2, HIGH_EXPLOSIVE: 1 }));
    let err: BluewaveError | undefined;
    try {
      reserveAndConsumeAmmunition(state.ammunition, 4, "ARMOR_PIERCING");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(GUNNERY_AMMUNITION_UNAVAILABLE);
    expect(state.ammunition).toEqual(ammo({ ARMOR_PIERCING: 3, COMMON: 2, HIGH_EXPLOSIVE: 1 }));
  });

  it("fails when no permitted type can satisfy the count, even with a large elsewhere", () => {
    const state = batteryState(ammo({ ARMOR_PIERCING: 1, COMMON: 1, HIGH_EXPLOSIVE: 1 }));
    expect(() =>
      reserveAndConsumeAmmunition(state.ammunition, 2, "ARMOR_PIERCING", ["ARMOR_PIERCING"]),
    ).toThrow(BluewaveError);
  });

  it("never creates ammunition: the system total never increases for any type", () => {
    const before = ammo({ ARMOR_PIERCING: 10, COMMON: 5, HIGH_EXPLOSIVE: 5 });
    const { ammunition, account } = reserveAndConsumeAmmunition(before, 6, "ARMOR_PIERCING", [
      "ARMOR_PIERCING",
      "COMMON",
    ]);
    let totalAfter = 0;
    let totalBefore = 0;
    for (const t of ["ARMOR_PIERCING", "COMMON", "HIGH_EXPLOSIVE"] as AmmunitionType[]) {
      totalAfter += ammunition[t];
      totalBefore += before[t];
    }
    expect(totalAfter).toBe(totalBefore - account.count);
    for (const t of ["ARMOR_PIERCING", "COMMON", "HIGH_EXPLOSIVE"] as AmmunitionType[]) {
      expect(ammunition[t]).toBeLessThanOrEqual(before[t]);
    }
  });

  it("rejects a non-positive salvo count (never consumes zero or negative)", () => {
    expect(() => reserveAndConsumeAmmunition(ammo(), 0, "ARMOR_PIERCING")).toThrow(BluewaveError);
    expect(() => reserveAndConsumeAmmunition(ammo(), -1, "ARMOR_PIERCING")).toThrow(BluewaveError);
  });
});
