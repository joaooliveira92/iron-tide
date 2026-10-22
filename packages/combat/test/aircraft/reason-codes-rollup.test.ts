import { describe, expect, it } from "vite-plus/test";
import {
  AIRCRAFT_REASON_CODES,
  AIRCRAFT_MISSION_ROLE_DEFERRED,
  RESOLVED_AIRCRAFT_DEVELOPMENT,
} from "@bluewave/combat/aircraft";

const SHIPPED_SECTION_40_CODES = [
  "INVALID_AIRCRAFT_MODEL_DEFINITION",
  "INVALID_AIRCRAFT_STATE",
  "AIRCRAFT_DEVELOPMENT_ROLE_INVALID",
  "AIRCRAFT_DEVELOPMENT_TRAITS_NOT_DISTINCT",
  "AIRCRAFT_PROPOSAL_ALREADY_ACTIVE",
  "AIRCRAFT_DEVELOPMENT_PAYMENT_INSUFFICIENT",
  "AIRCRAFT_PRIVATE_VENTURE_INELIGIBLE",
  "AIRCRAFT_PRIVATE_PROPOSAL_EXPIRED",
  "AIRCRAFT_INVENTORY_INSUFFICIENT",
  "SQUADRON_AUTO_EQUIP_UNAVAILABLE",
  "SQUADRON_REEQUIPMENT_INELIGIBLE",
  "SQUADRON_EXPANSION_INELIGIBLE",
  "AIRCRAFT_BASING_CAPACITY_INSUFFICIENT",
  "DAMAGED_AIRCRAFT_DISPOSITION_REQUIRED",
  "AIRCRAFT_STATE_INVARIANT_FAILED",
] as const;

const DEFERRED_SECTION_40_CODES = [
  "AIRCRAFT_MISSION_ROLE_INELIGIBLE",
  "AIRCRAFT_MISSION_TECHNOLOGY_UNAVAILABLE",
  "FLOATPLANE_LAUNCH_REQUIRES_STOPPED_SHIP",
  "AIRSHIP_WEATHER_PROHIBITS_OPERATION",
  "JET_CARRIER_INCOMPATIBLE",
  "HELICOPTER_BASING_INCOMPATIBLE",
] as const;

describe("AC-24: §40 reason-code set-equality", () => {
  it("ships exactly the 15 DESIGN-43 §40 codes listed in the D-1 spec", () => {
    const catalog = { ...AIRCRAFT_REASON_CODES };
    delete (catalog as Record<string, string>)[AIRCRAFT_MISSION_ROLE_DEFERRED];
    delete (catalog as Record<string, string>)[RESOLVED_AIRCRAFT_DEVELOPMENT];
    const shippedCodes = Object.values(catalog) as string[];
    for (const code of SHIPPED_SECTION_40_CODES) {
      expect(shippedCodes).toContain(code);
    }
    expect(shippedCodes.length).toBe(SHIPPED_SECTION_40_CODES.length);
  });

  it("AIRCRAFT_MISSION_ROLE_DEFERRED is an in-slice marker, not a §40 code", () => {
    expect(SHIPPED_SECTION_40_CODES).not.toContain(AIRCRAFT_MISSION_ROLE_DEFERRED);
    expect(DEFERRED_SECTION_40_CODES).not.toContain(AIRCRAFT_MISSION_ROLE_DEFERRED);
    expect(AIRCRAFT_REASON_CODES).toHaveProperty("AIRCRAFT_MISSION_ROLE_DEFERRED");
  });

  it("no deferred §40 code appears in the shipped catalog (behind marker)", () => {
    const catalog = { ...AIRCRAFT_REASON_CODES };
    delete (catalog as Record<string, string>)[AIRCRAFT_MISSION_ROLE_DEFERRED];
    delete (catalog as Record<string, string>)[RESOLVED_AIRCRAFT_DEVELOPMENT];
    const shippedCodes = Object.values(catalog) as string[];
    for (const deferred of DEFERRED_SECTION_40_CODES) {
      expect(shippedCodes).not.toContain(deferred);
    }
  });

  it("no code in the shipped catalog is a duplicate", () => {
    const catalog = { ...AIRCRAFT_REASON_CODES };
    delete (catalog as Record<string, string>)[AIRCRAFT_MISSION_ROLE_DEFERRED];
    delete (catalog as Record<string, string>)[RESOLVED_AIRCRAFT_DEVELOPMENT];
    const values = Object.values(catalog) as string[];
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("RESOLVED_AIRCRAFT_DEVELOPMENT is a phase-level code, not in §40", () => {
    expect(AIRCRAFT_REASON_CODES).toHaveProperty("RESOLVED_AIRCRAFT_DEVELOPMENT");
    expect(SHIPPED_SECTION_40_CODES).not.toContain(RESOLVED_AIRCRAFT_DEVELOPMENT);
    expect(DEFERRED_SECTION_40_CODES).not.toContain(RESOLVED_AIRCRAFT_DEVELOPMENT);
  });
});
