import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  ORDER_NOT_PERMITTED_AT_REALISM,
  REALISM_MODES,
  assertOrderPermitted,
  divisionOrderPermitted,
  forceOrderPermitted,
  holdFirePermitted,
  manualTorpedoesPermitted,
  orderPermitted,
  otherDivisionControlPermitted,
  realismPermissions,
  targetOrderPermitted,
  victoryPointMultiplierBp,
  type RealismMode,
} from "@bluewave/combat/orders";

function capture(run: () => unknown): BluewaveError {
  try {
    run();
  } catch (error) {
    if (isBluewaveError(error)) return error;
    throw error;
  }
  throw new Error("expected the call to throw");
}

describe("realism permission matrix", () => {
  it("lists the three manual modes", () => {
    expect(REALISM_MODES).toEqual(["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"]);
  });

  it("lets an admiral order only the lead division of each force", () => {
    expect(divisionOrderPermitted("ADMIRAL", { isLeadDivision: true })).toBe(true);
    expect(divisionOrderPermitted("ADMIRAL", { isLeadDivision: false })).toBe(false);
    expect(otherDivisionControlPermitted("ADMIRAL", { withinSightOfFlagship: true })).toBe(false);
    expect(targetOrderPermitted("ADMIRAL", "DIVISION")).toBe(false);
    expect(targetOrderPermitted("ADMIRAL", "SHIP")).toBe(false);
    expect(holdFirePermitted("ADMIRAL")).toBe(false);
    expect(manualTorpedoesPermitted("ADMIRAL")).toBe(false);
    expect(forceOrderPermitted("ADMIRAL")).toBe(true);
    expect(victoryPointMultiplierBp("ADMIRAL")).toBe(10_000);
  });

  it("lets a rear admiral control any division but only target divisions and only in sight", () => {
    expect(divisionOrderPermitted("REAR_ADMIRAL", { isLeadDivision: false })).toBe(true);
    expect(otherDivisionControlPermitted("REAR_ADMIRAL", { withinSightOfFlagship: true })).toBe(
      true,
    );
    expect(otherDivisionControlPermitted("REAR_ADMIRAL", { withinSightOfFlagship: false })).toBe(
      false,
    );
    expect(targetOrderPermitted("REAR_ADMIRAL", "DIVISION")).toBe(true);
    expect(targetOrderPermitted("REAR_ADMIRAL", "SHIP")).toBe(false);
    expect(holdFirePermitted("REAR_ADMIRAL")).toBe(true);
    expect(manualTorpedoesPermitted("REAR_ADMIRAL")).toBe(false);
    expect(victoryPointMultiplierBp("REAR_ADMIRAL")).toBe(9_000);
  });

  it("lets a captain order any division, target a ship and run torpedoes and smoke", () => {
    const permissions = realismPermissions(
      "CAPTAIN",
      { isLeadDivision: false },
      { withinSightOfFlagship: false },
      "SHIP",
    );
    expect(permissions).toEqual({
      divisionOrders: true,
      otherDivisionControl: true,
      targetOrders: true,
      holdFire: true,
      manualTorpedoes: true,
      smokeFloats: true,
      forceOrders: true,
      victoryPointMultiplierBp: 8_000,
    });
  });

  it("answers every capability through the same matrix", () => {
    const modes: readonly RealismMode[] = ["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"];
    for (const mode of modes) {
      const permissions = realismPermissions(mode, { isLeadDivision: true });
      expect(orderPermitted(mode, "DIVISION_ORDERS", { isLeadDivision: true })).toBe(
        permissions.divisionOrders,
      );
      expect(orderPermitted(mode, "HOLD_FIRE")).toBe(permissions.holdFire);
      expect(orderPermitted(mode, "MANUAL_TORPEDOES")).toBe(permissions.manualTorpedoes);
      expect(orderPermitted(mode, "SMOKE_FLOATS")).toBe(permissions.smokeFloats);
      expect(orderPermitted(mode, "FORCE_ORDERS")).toBe(permissions.forceOrders);
    }
  });

  it("refuses a forbidden order with the stable reason code", () => {
    const failure = capture(() =>
      assertOrderPermitted("ADMIRAL", "TARGET_ORDERS", { isLeadDivision: true }, undefined, "SHIP"),
    );
    expect(failure.context.code).toBe(ORDER_NOT_PERMITTED_AT_REALISM);
    expect(failure.context.mode).toBe("ADMIRAL");
    expect(failure.context.capability).toBe("TARGET_ORDERS");
    expect(() =>
      assertOrderPermitted("CAPTAIN", "TARGET_ORDERS", { isLeadDivision: true }, undefined, "SHIP"),
    ).not.toThrow();
  });
});
