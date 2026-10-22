import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  checkReequipmentEligibility,
  assertReequipmentEligible,
  applyReequipmentExperiencePenalty,
  isFamilyChange,
  startReequipment,
  completeReequipment,
  REEQUIPMENT_DURATION_MONTHS,
} from "@bluewave/combat/aircraft";
import { SQUADRON_REEQUIPMENT_INELIGIBLE } from "@bluewave/combat/aircraft";
import type { SquadronState } from "@bluewave/combat/aircraft";
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

describe("AC-16: re-equipment eligibility", () => {
  it("returns eligible when all conditions met", () => {
    const r = checkReequipmentEligibility({
      squadron: makeSquadron(),
      hasSufficientInventory: true,
      hasBasingCapacity: true,
      hasPilotTrainingCapacity: true,
      hasConversionCost: true,
    });
    expect(r.eligible).toBe(true);
  });

  it("rejects when inventory insufficient", () => {
    const r = checkReequipmentEligibility({
      squadron: makeSquadron(),
      hasSufficientInventory: false,
      hasBasingCapacity: true,
      hasPilotTrainingCapacity: true,
      hasConversionCost: true,
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toBe("INSUFFICIENT_INVENTORY");
  });
});

describe("assertReequipmentEligible", () => {
  it("throws SQUADRON_REEQUIPMENT_INELIGIBLE when ineligible", () => {
    let err: BluewaveError | undefined;
    try {
      assertReequipmentEligible({ eligible: false, reason: "INSUFFICIENT_INVENTORY" });
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SQUADRON_REEQUIPMENT_INELIGIBLE);
  });

  it("does not throw when eligible", () => {
    expect(() => assertReequipmentEligible({ eligible: true })).not.toThrow();
  });
});

describe("AC-17: re-equipment experience penalty", () => {
  it("applies base -10 penalty", () => {
    const result = applyReequipmentExperiencePenalty(SafeInt(50), false);
    expect(Number(result)).toBe(40);
  });

  it("applies -15 penalty for family change (base + family)", () => {
    const result = applyReequipmentExperiencePenalty(SafeInt(50), true);
    expect(Number(result)).toBe(35);
  });

  it("clamps to 0..100", () => {
    expect(Number(applyReequipmentExperiencePenalty(SafeInt(5), false))).toBe(0);
    expect(Number(applyReequipmentExperiencePenalty(SafeInt(95), false))).toBe(85);
  });

  it("detects family changes correctly", () => {
    expect(isFamilyChange("PISTON", "JET")).toBe(true);
    expect(isFamilyChange("PISTON", "PISTON")).toBe(false);
    expect(isFamilyChange("HELICOPTER", "PISTON")).toBe(false);
  });
});

describe("AC-16: re-equipment duration and unavailability", () => {
  it("duration is exactly 2 completed paid months", () => {
    expect(REEQUIPMENT_DURATION_MONTHS).toBe(2);
  });

  it("startReequipment sets state to IN_PROGRESS and clears operational count", () => {
    const sq = startReequipment(makeSquadron(), "new_model", false, "1917-06");
    expect(sq.reequipmentState).toBe("IN_PROGRESS");
    expect(Number(sq.operationalAircraftCount)).toBe(0);
    expect(sq.assignedModelId).toBe("new_model");
  });

  it("completeReequipment applies penalty and sets COMPLETED", () => {
    const sq = completeReequipment(makeSquadron({ squadronExperience: SafeInt(50) }), false);
    expect(sq.reequipmentState).toBe("COMPLETED");
    expect(Number(sq.squadronExperience)).toBe(40);
  });
});
