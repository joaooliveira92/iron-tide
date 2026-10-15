// AC-18 (INC-5): Squadron expansion — ratio formula, penalty bands, same-month aggregation.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  computeExpansionRatioBp,
  selectExpansionPenalty,
  checkExpansionEligibility,
  assertExpansionEligible,
  applyExpansionPenalty,
  EXPANSION_PENALTY_BAND_1,
  EXPANSION_PENALTY_BAND_2,
  EXPANSION_PENALTY_BAND_3,
} from "../../src/aircraft/expansion.js";
import { SQUADRON_EXPANSION_INELIGIBLE } from "../../src/aircraft/reasonCodes.js";
import type { SquadronState } from "../../src/aircraft/state.js";
import type { BluewaveError } from "@bluewave/contracts";

function makeSquadron(overrides: Partial<SquadronState> = {}): SquadronState {
  return {
    squadronId: "sq_1",
    ownerNationId: "nation_france",
    squadronRole: "FIGHTER",
    assignedModelId: "spad_s_xiii",
    authorizedStrength: SafeInt(18),
    operationalAircraftCount: SafeInt(18),
    damagedAircraftCount: SafeInt(0),
    replacementAircraftReserved: SafeInt(0),
    pilotCount: SafeInt(18),
    squadronExperience: SafeInt(50),
    fatigue: SafeInt(0),
    trainingState: "NORMAL",
    baseOrCarrierId: "base_brest",
    reequipmentState: "NONE",
    expansionState: "NONE",
    missionAvailability: [],
    rulesetVersion: "aircraft_ruleset_v1",
    stateHash: "",
    ...overrides,
  };
}

describe("expansion ratio formula", () => {
  it("computes ratio = floor(added * 10000 / max(1, prior))", () => {
    const ratio = computeExpansionRatioBp(SafeInt(6), SafeInt(18));
    // 6 * 10000 / 18 = 60000 / 18 = 3333.33... floor = 3333
    expect(Number(ratio)).toBe(3333);
  });

  it("handles prior strength of 0 (uses 1)", () => {
    const ratio = computeExpansionRatioBp(SafeInt(10), SafeInt(0));
    // 10 * 10000 / 1 = 100000
    expect(Number(ratio)).toBe(100000);
  });
});

describe("penalty band selection", () => {
  it("band 1: <= 2500 bp → -5 penalty", () => {
    expect(selectExpansionPenalty(SafeInt(2500))).toBe(EXPANSION_PENALTY_BAND_1);
    expect(selectExpansionPenalty(SafeInt(1000))).toBe(EXPANSION_PENALTY_BAND_1);
  });

  it("band 2: 2501..5000 bp → -10 penalty", () => {
    expect(selectExpansionPenalty(SafeInt(2501))).toBe(EXPANSION_PENALTY_BAND_2);
    expect(selectExpansionPenalty(SafeInt(5000))).toBe(EXPANSION_PENALTY_BAND_2);
  });

  it("band 3: > 5000 bp → -20 penalty", () => {
    expect(selectExpansionPenalty(SafeInt(5001))).toBe(EXPANSION_PENALTY_BAND_3);
    expect(selectExpansionPenalty(SafeInt(50000))).toBe(EXPANSION_PENALTY_BAND_3);
  });
});

describe("expansion eligibility", () => {
  it("returns eligible when all conditions met", () => {
    const r = checkExpansionEligibility({
      squadron: makeSquadron(),
      hasAircraftInventory: true,
      hasPilots: true,
      hasBasingCapacity: true,
      hasMaintenanceSupport: true,
      hasCommandAuthorization: true,
    });
    expect(r.eligible).toBe(true);
  });

  it("rejects when aircraft inventory insufficient", () => {
    const r = checkExpansionEligibility({
      squadron: makeSquadron(),
      hasAircraftInventory: false,
      hasPilots: true,
      hasBasingCapacity: true,
      hasMaintenanceSupport: true,
      hasCommandAuthorization: true,
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toBe("INSUFFICIENT_AIRCRAFT_INVENTORY");
  });
});

describe("assertExpansionEligible", () => {
  it("throws SQUADRON_EXPANSION_INELIGIBLE when ineligible", () => {
    let err: BluewaveError | undefined;
    try {
      assertExpansionEligible({ eligible: false, reason: "INSUFFICIENT_PILOTS" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SQUADRON_EXPANSION_INELIGIBLE);
  });
});

describe("applyExpansionPenalty", () => {
  it("applies band-1 penalty (-5)", () => {
    const result = applyExpansionPenalty(SafeInt(50), SafeInt(2000));
    expect(Number(result)).toBe(45);
  });

  it("applies band-2 penalty (-10)", () => {
    const result = applyExpansionPenalty(SafeInt(50), SafeInt(3000));
    expect(Number(result)).toBe(40);
  });

  it("applies band-3 penalty (-20)", () => {
    const result = applyExpansionPenalty(SafeInt(50), SafeInt(10000));
    expect(Number(result)).toBe(30);
  });

  it("clamps to 0..100", () => {
    expect(Number(applyExpansionPenalty(SafeInt(2), SafeInt(2000)))).toBe(0);
    expect(Number(applyExpansionPenalty(SafeInt(95), SafeInt(2000)))).toBe(90);
  });
});
