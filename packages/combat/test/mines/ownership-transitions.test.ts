// AC-17 (INC-7): DESIGN-35 §23 ownership/control changes. Legal/military control
// change never auto-deletes/neutralizes pressure; every transition declares
// exactly one of six CLOSED dispositions; uncontrolled mines remain active until
// decay/clearance; missing disposition for controlled-defensive ->
// CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING. The §23 hard invariant: pressure
// field UNCHANGED in every disposition.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt, BluewaveError } from "@bluewave/contracts";
import {
  applyOwnershipTransition,
  applyOwnershipTransitionToRecords,
  CLOSE_MINE_CONTROL_DISPOSITIONS,
  CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING,
  isClosedMineControlDisposition,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  MINE_WARFARE_INVARIANT_FAILED,
  type AreaMinePressureRecord,
  verifyAreaMinePressureRecordHash,
  withAreaMinePressureRecordHash,
} from "../../src/mines/index.js";

function validRecord(overrides: Partial<AreaMinePressureRecord> = {}): AreaMinePressureRecord {
  const base = {
    minePressureId: "mp_white_sea_south.us_2",
    areaId: "white_sea_south",
    layingParticipantId: "USSR",
    targetBelligerents: ["u002"],
    mineTypeId: "CONTACT" as const,
    pressure: SafeInt(400_000),
    freshnessBp: SafeInt(5_000),
    sourceComposition: [{ layingSourceId: "port_soroka", contributingValue: 400_000, count: 1 }],
    mineCountOrAbstractedEquivalent: SafeInt(2_000),
    detectionConfidenceRecords: [],
    creationMonth: SafeInt(31),
    lastReinforcedMonth: SafeInt(31),
    lastDecayedMonth: SafeInt(35),
    lastSweptMonth: SafeInt(38),
    legalOwnerOfSourceFacilities: "USSR",
    militaryControllerOfSourceFacilities: "USSR",
    rulesetVersion: MINE_RULESET_VERSION,
    formulaVersion: MINE_FORMULA_VERSION,
  };
  return withAreaMinePressureRecordHash({ ...base, ...overrides });
}

function controlledRecord(): AreaMinePressureRecord {
  return validRecord({ mineTypeId: "CONTROLLED_DEFENSIVE" as const });
}

const CONTEXT = { controlInfrastructureOperational: true };

describe("AC-17: §23 CLOSED disposition union (never an open string)", () => {
  it("exposes exactly the six §23 dispositions", () => {
    expect([...CLOSE_MINE_CONTROL_DISPOSITIONS]).toEqual([
      "PRESERVE_ACTIVE",
      "TRANSFER_CONTROLLED_MINE_AUTHORITY",
      "DEACTIVATE_CONTROLLED_MINES",
      "DISCLOSE_SAFE_LANES",
      "ASSIGN_CLEARANCE_OBLIGATION",
      "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT",
    ]);
  });

  it("isClosedMineControlDisposition narrows the closed set at runtime", () => {
    expect(isClosedMineControlDisposition("PRESERVE_ACTIVE")).toBe(true);
    expect(isClosedMineControlDisposition("DEACTIVATE_CONTROLLED_MINES")).toBe(true);
    expect(isClosedMineControlDisposition("SELF_DESTRUCT_ON_AUTHORITY_TRANSFER")).toBe(false);
    expect(isClosedMineControlDisposition(undefined)).toBe(false);
  });
});

describe("AC-17: pressure is UNCHANGED in every disposition (§23 hard invariant)", () => {
  const dispositions = [
    "PRESERVE_ACTIVE",
    "TRANSFER_CONTROLLED_MINE_AUTHORITY",
    "DEACTIVATE_CONTROLLED_MINES",
    "DISCLOSE_SAFE_LANES",
    "ASSIGN_CLEARANCE_OBLIGATION",
    "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT",
  ] as const;

  for (const disposition of dispositions) {
    it(`${disposition} keeps pressure unchanged`, () => {
      const r = controlledRecord();
      const context =
        disposition === "ASSIGN_CLEARANCE_OBLIGATION"
          ? { ...CONTEXT, clearanceObligationParticipantId: "u003" }
          : disposition === "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT"
            ? { ...CONTEXT, declaredDestroyEffect: "control-infrastructure-physically-destroyed" }
            : CONTEXT;
      const result = applyOwnershipTransition(r, disposition, context);
      expect(result.record.pressure).toBe(r.pressure);
      expect(result.record.pressure).toBe(SafeInt(400_000));
    });
  }
});

describe("AC-17: disposition semantics on records", () => {
  it("PRESERVE_ACTIVE persists pressure and updates owner/controller", () => {
    const r = controlledRecord();
    const result = applyOwnershipTransition(r, "PRESERVE_ACTIVE", {
      controlInfrastructureOperational: true,
      newLegalOwner: "FederalRepublic",
      newMilitaryController: "FederalRepublicNavy",
    });
    expect(result.record.pressure).toBe(SafeInt(400_000));
    expect(result.record.legalOwnerOfSourceFacilities).toBe("FederalRepublic");
    expect(result.record.militaryControllerOfSourceFacilities).toBe("FederalRepublicNavy");
  });

  it("TRANSFER_CONTROLLED_MINE_AUTHORITY changes the controller; pressure persists", () => {
    const r = controlledRecord();
    const result = applyOwnershipTransition(r, "TRANSFER_CONTROLLED_MINE_AUTHORITY", {
      controlInfrastructureOperational: true,
      newMilitaryController: "UnitedKingdom",
    });
    expect(result.record.militaryControllerOfSourceFacilities).toBe("UnitedKingdom");
    expect(result.record.pressure).toBe(SafeInt(400_000));
    expect(verifyAreaMinePressureRecordHash(result.record)).toBe(true);
  });

  it("DEACTIVATE_CONTROLLED_MINES marks control infrastructure inactive; pressure PRESERVED", () => {
    const r = controlledRecord();
    const result = applyOwnershipTransition(r, "DEACTIVATE_CONTROLLED_MINES", CONTEXT);
    expect(result.controlInfrastructureOperational).toBe(false);
    expect(result.record.pressure).toBe(SafeInt(400_000));
    // NONE of the ownership/controller fields are deleted by deactivation.
    expect(result.record.legalOwnerOfSourceFacilities).toBe("USSR");
    expect(result.record.militaryControllerOfSourceFacilities).toBe("USSR");
  });

  it("DISCLOSE_SAFE_LANES marks lanes disclosed (knowledge/meta), pressure persists", () => {
    const r = controlledRecord();
    const result = applyOwnershipTransition(r, "DISCLOSE_SAFE_LANES", CONTEXT);
    expect(result.safeLanesDisclosed).toBe(true);
    expect(result.record.pressure).toBe(SafeInt(400_000));
  });

  it("ASSIGN_CLEARANCE_OBLIGATION records the obligation; pressure persists", () => {
    const r = controlledRecord();
    const result = applyOwnershipTransition(r, "ASSIGN_CLEARANCE_OBLIGATION", {
      ...CONTEXT,
      clearanceObligationParticipantId: "u003",
    });
    expect(result.clearanceObligationParticipantId).toBe("u003");
    expect(result.record.pressure).toBe(SafeInt(400_000));
  });

  it("DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT requires a declared effect and flips control-infra off", () => {
    const r = controlledRecord();
    const result = applyOwnershipTransition(
      r,
      "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT",
      {
        controlInfrastructureOperational: true,
        declaredDestroyEffect: "control-infrastructure-physically-destroyed",
      },
    );
    expect(result.declaredDestroyEffect).toBe("control-infrastructure-physically-destroyed");
    expect(result.controlInfrastructureOperational).toBe(false);
    // §23: pressure persists; it simply flips to uncontrolled (no auto-delete).
    expect(result.record.pressure).toBe(SafeInt(400_000));
  });

  it("DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT without a declared effect throws", () => {
    let err: BluewaveError | undefined;
    try {
      applyOwnershipTransition(
        controlledRecord(),
        "DESTROY_CONTROL_INFRASTRUCTURE_WITH_DECLARED_EFFECT",
        CONTEXT,
      );
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_WARFARE_INVARIANT_FAILED);
  });

  it("ASSIGN_CLEARANCE_OBLIGATION without a participant throws", () => {
    let err: BluewaveError | undefined;
    try {
      applyOwnershipTransition(controlledRecord(), "ASSIGN_CLEARANCE_OBLIGATION", CONTEXT);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINE_WARFARE_INVARIANT_FAILED);
  });
});

describe("AC-17: missing disposition for controlled-defensive throws CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING", () => {
  it("a CONTROLLED_DEFENSIVE record with no disposition throws", () => {
    let err: BluewaveError | undefined;
    try {
      applyOwnershipTransition(controlledRecord(), undefined, CONTEXT);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING);
  });

  it("uncontrolled mines (CONTACT) with NO disposition default to PRESERVE_ACTIVE (persist unchanged)", () => {
    const r = validRecord(); // CONTACT
    const result = applyOwnershipTransition(r, undefined, CONTEXT);
    expect(result.disposition).toBe("PRESERVE_ACTIVE");
    expect(result.record.pressure).toBe(SafeInt(400_000));
    // Uncontrolled mines remain active until decay/clearance — ownership fields untouched.
    expect(result.record.legalOwnerOfSourceFacilities).toBe("USSR");
    expect(result.record.militaryControllerOfSourceFacilities).toBe("USSR");
  });

  it("the missing-disposition guard applies across a record set", () => {
    let err: BluewaveError | undefined;
    try {
      applyOwnershipTransitionToRecords([validRecord(), controlledRecord()], {}, CONTEXT);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(CONTROLLED_MINE_TRANSFER_DISPOSITION_MISSING);
  });

  it("a non-controlled record never deletes/neutralizes pressure even on PRESERVE_ACTIVE", () => {
    const r = validRecord();
    const result = applyOwnershipTransition(r, "PRESERVE_ACTIVE", {
      controlInfrastructureOperational: true,
      newLegalOwner: "Germany",
    });
    expect(result.record.pressure).toBe(SafeInt(400_000));
    expect(result.record.legalOwnerOfSourceFacilities).toBe("Germany");
  });
});
