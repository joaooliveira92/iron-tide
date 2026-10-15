import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  LAND_TARGET_TYPES,
  validateLandTargetType,
  createLandTarget,
  isTerminalDamageState,
} from "../../src/coastal-defense/index.js";

describe("LandTargetType", () => {
  it("validates all 7 types", () => {
    for (const t of LAND_TARGET_TYPES) {
      expect(validateLandTargetType(t)).toBe(t);
    }
  });

  it("rejects unknown type", () => {
    expect(() => validateLandTargetType("SPACE_STATION")).toThrowError(BluewaveError);
  });

  it("creates a land target with INTACT damage state", () => {
    const lt = createLandTarget("AIRFIELD");
    expect(lt.type).toBe("AIRFIELD");
    expect(lt.damageState).toBe("INTACT");
  });

  it("rejects unknown land target type on creation", () => {
    expect(() => createLandTarget("INVALID_TYPE")).toThrowError(BluewaveError);
  });

  it("isTerminalDamageState returns true for DESTROYED", () => {
    expect(isTerminalDamageState("DESTROYED")).toBe(true);
  });

  it("isTerminalDamageState returns false for non-terminal states", () => {
    expect(isTerminalDamageState("INTACT")).toBe(false);
    expect(isTerminalDamageState("SUPPRESSED")).toBe(false);
    expect(isTerminalDamageState("DAMAGED")).toBe(false);
    expect(isTerminalDamageState("DISABLED")).toBe(false);
  });
});
