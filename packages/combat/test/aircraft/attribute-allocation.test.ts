import { describe, expect, it } from "vite-plus/test";
import { allocateAttributes } from "../../src/aircraft/index.js";

describe("AC-10: attribute allocation", () => {
  it("returns baseline values for FIGHTER with no effective emphasized traits", () => {
    const [s, f, _m, _t] = allocateAttributes("FIGHTER", ["PAYLOAD", "RANGE"]);
    expect(Number(s)).toBe(35);
    expect(Number(f)).toBe(20);
    expect(Number(_m)).toBe(45);
    expect(Number(_t)).toBe(25);
  });

  it("applies +10 SPEED bonus when SPEED is emphasised", () => {
    const [s, f, _m, _t] = allocateAttributes("FIGHTER", ["SPEED", "RANGE"]);
    expect(Number(s)).toBe(50);
    expect(Number(f)).toBe(20);
  });

  it("applies +10 FIREPOWER bonus when FIREPOWER is emphasised", () => {
    const [_s, f, _m, _t] = allocateAttributes("FIGHTER", ["FIREPOWER", "RANGE"]);
    expect(Number(f)).toBe(35);
  });

  it("applies +10 MANEUVERABILITY bonus", () => {
    const [_s, _f, m, _t] = allocateAttributes("FIGHTER", ["MANEUVERABILITY", "RANGE"]);
    expect(Number(m)).toBe(60);
  });

  it("applies +10 TOUGHNESS bonus", () => {
    const [_s, _f, _m, t] = allocateAttributes("FIGHTER", ["TOUGHNESS", "RANGE"]);
    expect(Number(t)).toBe(40);
  });

  it("applies trade-off penalty to non-emphasised core attributes", () => {
    const [s, f, m, t] = allocateAttributes("FIGHTER", ["SPEED", "MANEUVERABILITY"]);
    expect(Number(s)).toBe(50);
    expect(Number(f)).toBe(20);
    expect(Number(m)).toBe(60);
    expect(Number(t)).toBe(25);
  });

  it("clamps values at SCORE_MAX (100)", () => {
    const [s, _f, m, _t] = allocateAttributes("HEAVY_JET_FIGHTER", ["SPEED", "MANEUVERABILITY"]);
    expect(Number(s)).toBeLessThanOrEqual(100);
    expect(Number(m)).toBeLessThanOrEqual(100);
  });

  it("ensures no attribute drops below role minimum", () => {
    const [s, f, m, t] = allocateAttributes("AIRSHIP", ["PAYLOAD", "RANGE"]);
    expect(Number(s)).toBeGreaterThanOrEqual(1);
    expect(Number(f)).toBeGreaterThanOrEqual(1);
    expect(Number(m)).toBeGreaterThanOrEqual(1);
    expect(Number(t)).toBeGreaterThanOrEqual(5);
  });

  it("throws AIRCRAFT_DEVELOPMENT_TRAITS_NOT_DISTINCT for duplicate traits", () => {
    expect(() => allocateAttributes("FIGHTER", ["SPEED", "SPEED"])).toThrow(
      "AIRCRAFT_DEVELOPMENT_TRAITS_NOT_DISTINCT",
    );
  });

  it("throws for invalid role", () => {
    expect(() => allocateAttributes("INVALID", ["SPEED", "RANGE"])).toThrow(
      "AIRCRAFT_DEVELOPMENT_ROLE_INVALID",
    );
  });
});

describe("attribute allocation per role baseline", () => {
  it("TORPEDO_BOMBER baseline is [20, 30, 20, 35]", () => {
    const [s, f, m, t] = allocateAttributes("TORPEDO_BOMBER", ["PAYLOAD", "RANGE"]);
    expect(Number(s)).toBe(15);
    expect(Number(f)).toBe(25);
    expect(Number(m)).toBe(15);
    expect(Number(t)).toBe(30);
  });

  it("DIVE_BOMBER baseline [25, 35, 25, 30] with SPEED emphasise", () => {
    const [s, f, m, t] = allocateAttributes("DIVE_BOMBER", ["SPEED", "RANGE"]);
    expect(Number(s)).toBe(35);
    expect(Number(f)).toBe(30);
    expect(Number(m)).toBe(20);
    expect(Number(t)).toBe(25);
  });
});
