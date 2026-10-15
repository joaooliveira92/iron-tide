//packages/combat/test/smoke/source-precedence.test.ts
import { describe, expect, it } from "vite-plus/test";
import {
  validateSmokeSourcePrecedence,
  computeSourcePrecedenceInfo,
  SMOKE_EQUIPMENT_MODE_CONFLICT,
} from "../../src/smoke/index.js";

describe("validateSmokeSourcePrecedence", () => {
  it("funnel + smokescreen OK", () => {
    const result = validateSmokeSourcePrecedence("NONE", "SMOKESCREEN", true, false);
    expect(result.allowed).toBe(true);
  });

  it("funnel + float OK", () => {
    const result = validateSmokeSourcePrecedence("NONE", "FLOAT", true, false);
    expect(result.allowed).toBe(true);
  });

  it("funnel + generator OK", () => {
    const result = validateSmokeSourcePrecedence("NONE", "GENERATOR", true, false);
    expect(result.allowed).toBe(true);
  });

  it("floats + generator NOT OK (mode conflict)", () => {
    const result = validateSmokeSourcePrecedence("FLOATS", "GENERATOR", false, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(SMOKE_EQUIPMENT_MODE_CONFLICT);
  });

  it("generator + floats NOT OK (mode conflict)", () => {
    const result = validateSmokeSourcePrecedence("GENERATOR", "FLOAT", false, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(SMOKE_EQUIPMENT_MODE_CONFLICT);
  });

  it("no funnel, one deliberate OK", () => {
    const result = validateSmokeSourcePrecedence("NONE", "SMOKESCREEN", false, false);
    expect(result.allowed).toBe(true);
  });

  it("two deliberate sources OK (same type merge)", () => {
    const result = validateSmokeSourcePrecedence("NONE", "SMOKESCREEN", false, true);
    expect(result.allowed).toBe(true);
  });

  it("mode transition from NONE to FLOATS OK", () => {
    const result = validateSmokeSourcePrecedence("NONE", "FLOAT", false, false);
    expect(result.allowed).toBe(true);
  });

  it("mode transition from FLOATS to GENERATOR not OK (conflict)", () => {
    const result = validateSmokeSourcePrecedence("FLOATS", "GENERATOR", false, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(SMOKE_EQUIPMENT_MODE_CONFLICT);
  });

  it("no active deliberate source + funnel OK", () => {
    const result = validateSmokeSourcePrecedence("NONE", "FUNNEL", true, false);
    expect(result.allowed).toBe(true);
  });

  it("mode conflict returns SMOKE_EQUIPMENT_MODE_CONFLICT", () => {
    const result = validateSmokeSourcePrecedence("FLOATS", "GENERATOR", true, true);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(SMOKE_EQUIPMENT_MODE_CONFLICT);
  });

  it("fire source never conflicts (no mode)", () => {
    const result = validateSmokeSourcePrecedence("NONE", "FIRE", true, true);
    expect(result.allowed).toBe(true);
  });

  it("float allowed when current mode is FLOATS", () => {
    const result = validateSmokeSourcePrecedence("FLOATS", "FLOAT", true, true);
    expect(result.allowed).toBe(true);
  });

  it("generator allowed when current mode is GENERATOR", () => {
    const result = validateSmokeSourcePrecedence("GENERATOR", "GENERATOR", true, true);
    expect(result.allowed).toBe(true);
  });
});

describe("computeSourcePrecedenceInfo", () => {
  it("funnel is not deliberate", () => {
    const info = computeSourcePrecedenceInfo("FUNNEL", "NONE");
    expect(info.isDeliberate).toBe(false);
    expect(info.sourceType).toBe("FUNNEL");
    expect(info.equipmentMode).toBe("NONE");
  });

  it("float is deliberate", () => {
    const info = computeSourcePrecedenceInfo("FLOAT", "FLOATS");
    expect(info.isDeliberate).toBe(true);
    expect(info.equipmentMode).toBe("FLOATS");
  });

  it("generator is deliberate", () => {
    const info = computeSourcePrecedenceInfo("GENERATOR", "GENERATOR");
    expect(info.isDeliberate).toBe(true);
    expect(info.equipmentMode).toBe("GENERATOR");
  });

  it("smokescreen is deliberate", () => {
    const info = computeSourcePrecedenceInfo("SMOKESCREEN", "NONE");
    expect(info.isDeliberate).toBe(true);
  });
});
