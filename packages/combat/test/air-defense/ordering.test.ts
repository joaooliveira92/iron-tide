// packages/combat/test/air-defense/ordering.test.ts
// AC-15 (INC-5): canonical ordering per DESIGN-45 §27 — insertion/UI/rendering order never
// affects results; only codepoint string comparisons (never localeCompare).
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  AttackType,
  createAirDefenseEngagementRecord,
  compareAirDefenseEngagementRecords,
  canonicallySortedAirDefenseRecords,
  compareStrings,
  AIR_DEFENSE_FORMULA_VERSION,
  AIR_DEFENSE_MODEL_VERSION,
} from "../../src/air-defense/index.js";
import type {
  AirDefenseEngagementRecord,
  AirDefenseRecordLayer,
} from "../../src/air-defense/index.js";

function makeRecord(overrides: Record<string, unknown> = {}): AirDefenseEngagementRecord {
  return createAirDefenseEngagementRecord({
    recordId: "rec-ord-001",
    minute: SafeInt(5),
    substep: SafeInt(1),
    defenderId: "ship_001",
    attackerId: "frm_001",
    attackId: "atk_001",
    targetId: "ship_002",
    attackType: AttackType.AIRCRAFT_LEVEL_BOMBING,
    attackProfile: "LEVEL",
    layer: "HEAVY_AA",
    defenseSystemId: "sys_001",
    directorChannelId: "dir_01",
    radarChannelId: null,
    directorFactorBp: SafeInt(10_000),
    radarFactorBp: SafeInt(10_000),
    saturationFactorBp: SafeInt(10_000),
    crewQuality: SafeInt(10_000),
    damageBp: SafeInt.ZERO,
    powerBp: SafeInt(10_000),
    roundsRemaining: SafeInt(1_000),
    roundsConsumed: SafeInt(1),
    ammunitionMultiplierBp: SafeInt(10_000),
    timeToImpactMs: SafeInt(120_000),
    windowMilliseconds: SafeInt(0),
    effectiveKillBp: SafeInt(50),
    effectiveDamageBp: SafeInt(25),
    effectiveAbortBp: SafeInt(15),
    effectiveDisruptionBp: SafeInt(8),
    draw: SafeInt(0),
    outcome: "NO_EFFECT",
    disruptionSeverity: null,
    threatReleased: false,
    threatFormationSize: SafeInt(1),
    reasonCode: "AIR_DEFENSE_CHANNEL_UNAVAILABLE",
    outcomeOrdinal: SafeInt(0),
    recordKind: "ENGAGEMENT",
    modelVersion: AIR_DEFENSE_MODEL_VERSION,
    formulaVersion: AIR_DEFENSE_FORMULA_VERSION,
    ...overrides,
  }) as AirDefenseEngagementRecord;
}

// A layer outside FULL_DEFENSE_LAYER_ORDER — a record that failed layer validation upstream
// would never carry it, but the comparator's defensive "unknown layer sorts LAST" branch is
// exercised with a cast.
const UNKNOWN_LAYER = "UNKNOWN_LAYER" as AirDefenseRecordLayer;

describe("AC-15: §27 canonical ordering", () => {
  describe("compareStrings (codepoint, never localeCompare)", () => {
    it("orders by codepoint, not locale — 'A' (65) before 'a' (97)", () => {
      expect(compareStrings("A", "a")).toBeLessThan(0);
    });

    it("orders alphabetically and handles prefix ties by length", () => {
      expect(compareStrings("a", "b")).toBeLessThan(0);
      expect(compareStrings("b", "a")).toBeGreaterThan(0);
      expect(compareStrings("a", "a")).toBe(0);
      expect(compareStrings("ab", "a")).toBeGreaterThan(0); // prefix is shorter
      expect(compareStrings("a", "ab")).toBeLessThan(0);
    });

    it("differs from localeCompare for 'Z' vs 'a' (codepoint 90 < 97)", () => {
      // localeCompare would sort 'a' before 'Z' in many locales; codepoint must not.
      expect(compareStrings("Z", "a")).toBeLessThan(0);
    });
  });

  describe("§27.1 incoming attack arrival time", () => {
    it("earlier minute sorts first; same minute, lower substep first", () => {
      expect(
        compareAirDefenseEngagementRecords(
          makeRecord({ minute: SafeInt(3) }),
          makeRecord({ minute: SafeInt(5) }),
        ),
      ).toBeLessThan(0);
      expect(
        compareAirDefenseEngagementRecords(
          makeRecord({ minute: SafeInt(5), substep: SafeInt(1) }),
          makeRecord({ minute: SafeInt(5), substep: SafeInt(3) }),
        ),
      ).toBeLessThan(0);
    });
  });

  describe("§27.2 defense-layer order from §1", () => {
    it("sorts the full 8-layer §1 order, CAP first, CIWS last", () => {
      const order: AirDefenseRecordLayer[] = [
        "CAP",
        "HEAVY_SAM",
        "MEDIUM_SAM",
        "LIGHT_SAM",
        "HEAVY_AA",
        "MEDIUM_AA",
        "LIGHT_AA",
        "CIWS_TERMINAL_DEFENSE",
      ];
      for (let i = 0; i + 1 < order.length; i++) {
        const a = makeRecord({ layer: order[i] });
        const b = makeRecord({ layer: order[i + 1] });
        expect(compareAirDefenseEngagementRecords(a, b)).toBeLessThan(0);
        expect(compareAirDefenseEngagementRecords(b, a)).toBeGreaterThan(0);
      }
    });

    it("a record with an unknown layer sorts AFTER every known layer (defensive)", () => {
      const known = makeRecord({ layer: "CIWS_TERMINAL_DEFENSE" });
      const unknown = makeRecord({ layer: UNKNOWN_LAYER });
      expect(compareAirDefenseEngagementRecords(known, unknown)).toBeLessThan(0);
      expect(compareAirDefenseEngagementRecords(unknown, known)).toBeGreaterThan(0);
    });
  });

  describe("§27.3 defended ship identifier", () => {
    it("sorts by defenderId string", () => {
      const a = makeRecord({ defenderId: "ship_alpha" });
      const b = makeRecord({ defenderId: "ship_beta" });
      expect(compareAirDefenseEngagementRecords(a, b)).toBeLessThan(0);
    });
  });

  describe("§27.4 threat priority from §17", () => {
    it("released threats before pre-release", () => {
      const released = makeRecord({ threatReleased: true });
      const preRelease = makeRecord({ threatReleased: false });
      expect(compareAirDefenseEngagementRecords(released, preRelease)).toBeLessThan(0);
    });

    it("closer to impact first (smaller timeToImpactMs)", () => {
      const close = makeRecord({ timeToImpactMs: SafeInt(30_000) });
      const far = makeRecord({ timeToImpactMs: SafeInt(120_000) });
      expect(compareAirDefenseEngagementRecords(close, far)).toBeLessThan(0);
    });

    it("threats against the defended ship before protected nearby ships", () => {
      const ownShip = makeRecord({ targetId: "ship_001", defenderId: "ship_001" });
      const nearby = makeRecord({ targetId: "ship_002", defenderId: "ship_001" });
      expect(compareAirDefenseEngagementRecords(ownShip, nearby)).toBeLessThan(0);
    });

    it("larger formationSize first (expected-damage proxy, descending)", () => {
      const big = makeRecord({ threatFormationSize: SafeInt(8) });
      const small = makeRecord({ threatFormationSize: SafeInt(2) });
      expect(compareAirDefenseEngagementRecords(big, small)).toBeLessThan(0);
    });

    it("target identifier ascending as the final §17 tiebreak", () => {
      const a = makeRecord({ targetId: "target_a" });
      const b = makeRecord({ targetId: "target_b" });
      expect(compareAirDefenseEngagementRecords(a, b)).toBeLessThan(0);
    });
  });

  describe("§27.5-7 identifiers", () => {
    it("defense-system identifier", () => {
      const a = makeRecord({ defenseSystemId: "sys_alpha" });
      const b = makeRecord({ defenseSystemId: "sys_beta" });
      expect(compareAirDefenseEngagementRecords(a, b)).toBeLessThan(0);
    });

    it("director channel, then radar channel, as empty strings for null", () => {
      const a = makeRecord({ directorChannelId: null, radarChannelId: "radar_x" });
      const b = makeRecord({ directorChannelId: null, radarChannelId: "radar_y" });
      expect(compareAirDefenseEngagementRecords(a, b)).toBeLessThan(0);
      const c = makeRecord({ directorChannelId: "dir_a" });
      const d = makeRecord({ directorChannelId: "dir_b" });
      expect(compareAirDefenseEngagementRecords(c, d)).toBeLessThan(0);
      expect(
        compareAirDefenseEngagementRecords(
          makeRecord({ directorChannelId: null }),
          makeRecord({ directorChannelId: "dir_a" }),
        ),
      ).toBeLessThan(0);
    });

    it("engagement identifier (recordId)", () => {
      const a = makeRecord({ recordId: "rec_a" });
      const b = makeRecord({ recordId: "rec_b" });
      expect(compareAirDefenseEngagementRecords(a, b)).toBeLessThan(0);
    });
  });

  describe("§27.8 outcome effect ordinal", () => {
    it("INELIGIBLE (0) before OPPORTUNITY_CREATED (3) before KILL (8)", () => {
      const ineligible = makeRecord({ outcome: "INELIGIBLE", outcomeOrdinal: SafeInt(0) });
      const opportunity = makeRecord({
        outcome: "OPPORTUNITY_CREATED",
        outcomeOrdinal: SafeInt(3),
      });
      const kill = makeRecord({ outcome: "KILL", outcomeOrdinal: SafeInt(8) });
      expect(compareAirDefenseEngagementRecords(ineligible, opportunity)).toBeLessThan(0);
      expect(compareAirDefenseEngagementRecords(opportunity, kill)).toBeLessThan(0);
    });
  });

  describe("canonicallySortedAirDefenseRecords", () => {
    it("returns a full §27-ordered copy across multiple keys", () => {
      const records = [
        makeRecord({ minute: SafeInt(5), substep: SafeInt(2), recordId: "r3" }),
        makeRecord({ minute: SafeInt(3), substep: SafeInt(1), recordId: "r1" }),
        makeRecord({
          minute: SafeInt(5),
          substep: SafeInt(1),
          layer: "MEDIUM_AA",
          recordId: "r2a",
        }),
        makeRecord({ minute: SafeInt(5), substep: SafeInt(1), layer: "HEAVY_AA", recordId: "r2" }),
      ];
      const sorted = canonicallySortedAirDefenseRecords(records);
      expect(sorted[0]?.recordId).toBe("r1"); // minute 3
      expect(sorted[1]?.recordId).toBe("r2"); // minute 5, substep 1, HEAVY_AA before MEDIUM_AA
      expect(sorted[2]?.recordId).toBe("r2a");
      expect(sorted[3]?.recordId).toBe("r3");
    });

    it("does NOT mutate the input array", () => {
      const records = [
        makeRecord({ minute: SafeInt(10), recordId: "r3" }),
        makeRecord({ minute: SafeInt(1), recordId: "r1" }),
        makeRecord({ minute: SafeInt(5), recordId: "r2" }),
      ];
      const originalIds = records.map((r) => r.recordId);
      canonicallySortedAirDefenseRecords(records);
      expect(records.map((r) => r.recordId)).toEqual(originalIds);
    });
  });
});
