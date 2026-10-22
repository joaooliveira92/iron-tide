import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  LAND_TARGET_DAMAGE_STATES,
  DAMAGE_EVENT_TYPES,
  createDamageEvent,
  validateDamageState,
  applyLandTargetDamage,
  canDamage,
  INVALID_DAMAGE_STATE_TRANSITION,
} from "@bluewave/combat/coastal-defense";

describe("DamageState (INC-1)", () => {
  it("validates all 5 damage states", () => {
    for (const s of LAND_TARGET_DAMAGE_STATES) {
      expect(validateDamageState(s)).toBe(s);
    }
  });

  it("rejects unknown damage state", () => {
    expect(() => validateDamageState("MELTED")).toThrowError(BluewaveError);
  });
});

describe("DamageEvent (INC-1)", () => {
  it("creates valid damage events", () => {
    for (const et of DAMAGE_EVENT_TYPES) {
      const e = createDamageEvent(et);
      expect(e.eventType).toBe(et);
    }
  });

  it("rejects unknown damage event type", () => {
    expect(() => createDamageEvent("NUKE")).toThrowError(BluewaveError);
  });
});

describe("applyLandTargetDamage (INC-3)", () => {
  it("progresses INTACT → SUPPRESSED", () => {
    expect(applyLandTargetDamage("INTACT", "BOMBARDMENT")).toBe("SUPPRESSED");
  });

  it("progresses SUPPRESSED → DAMAGED", () => {
    expect(applyLandTargetDamage("SUPPRESSED", "BOMBARDMENT")).toBe("DAMAGED");
  });

  it("progresses DAMAGED → DISABLED", () => {
    expect(applyLandTargetDamage("DAMAGED", "BOMBARDMENT")).toBe("DISABLED");
  });

  it("progresses DISABLED → DESTROYED", () => {
    expect(applyLandTargetDamage("DISABLED", "BOMBARDMENT")).toBe("DESTROYED");
  });

  it("throws on terminal state DESTROYED for any event type", () => {
    for (const event of ["BOMBARDMENT", "SHELLING", "ASSAULT"] as const) {
      expect(() => applyLandTargetDamage("DESTROYED", event)).toThrowError(BluewaveError);
    }
  });

  it("error has the correct reason code", () => {
    try {
      applyLandTargetDamage("DESTROYED", "BOMBARDMENT");
    } catch (e) {
      if (isBluewaveError(e)) {
        expect(e.message).toContain(INVALID_DAMAGE_STATE_TRANSITION);
      }
    }
  });
});

describe("canDamage", () => {
  it("returns true for non-terminal states", () => {
    expect(canDamage("INTACT")).toBe(true);
    expect(canDamage("SUPPRESSED")).toBe(true);
    expect(canDamage("DAMAGED")).toBe(true);
    expect(canDamage("DISABLED")).toBe(true);
  });

  it("returns false for DESTROYED", () => {
    expect(canDamage("DESTROYED")).toBe(false);
  });
});
