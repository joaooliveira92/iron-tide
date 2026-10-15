// AC-10 (INC-4): DESIGN-35 §10 regional sweeping aggregation + allocation.
// Aggregation: sum of effective eligible-ship values in ASCENDING ship-id order
// (order-independent — shuffled input yields the identical regional value and
// sorted contribution list); ineligible ships contribute ZERO
// (INELIGIBLE_SHIP_SWEEPING_CONTRIBUTION) and surface in `ineligible` for the
// aggregate MINESWEEPING_SHIP_INELIGIBLE emit.
// Allocation: typeAdjustedSweeping / sweptPressure / pressureAfter exact §10
// formulas (swept clamped to current pressure; never below zero); ONE allocation
// per record — a record never receives the full regional value alongside another
// (shared budget, unreduced portion passes on); exact five-key §10 order
// (controlled-defensive threat -> highest strike risk -> highest pressure ->
// mine-type id -> mine-pressure id); MINE_PRESSURE_REDUCED emitted per record with
// sweptPressure > 0; a record swept to 0 keeps pressureAfter = 0 and is NOT
// deleted (output preserves the full record array).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  allocateSweeping,
  applySweptPressure,
  computeRegionalSweepingValue,
  DEFAULT_STRIKE_RISK_PRIORITY,
  effectiveSweepingValueForShip,
  INVALID_MINE_PRESSURE_STATE,
  MINE_FORMULA_VERSION,
  MINE_PRESSURE_REDUCED,
  MINE_RULESET_VERSION,
  type AreaMinePressureRecord,
  type MinesweepingShip,
  type RegionalSweepingShip,
  type SweepingAllocationCandidate,
  sweepingAllocationOrder,
  sweepingContributionOrder,
  withAreaMinePressureRecordHash,
} from "../../src/mines/index.js";

// ---- helpers ----

function eligibleShip(overrides: Partial<MinesweepingShip> = {}): MinesweepingShip {
  return {
    shipId: "hms-victoria-001",
    shipType: "DEDICATED_FLEET_MINESWEEPER",
    sweepEquipmentInstalled: true,
    sweepEquipmentOperational: true,
    sweepEquipmentCompatibleWithMineType: true,
    mission: "MINE_WARFARE",
    sweepingAuthorization: true,
    readiness: "ACTIVE",
    damage: "OPERATIONAL",
    locatedInSweptAreaOrConnectedApproach: true,
    fuelSufficient: true,
    supplySufficient: true,
    crewSufficient: true,
    ammunitionOrSweepInventorySufficient: true,
    unavailableFlags: [],
    validatedSweepingCommandOrPlanActive: true,
    ...overrides,
  };
}

// Regional aggregation input: §7 base-key + §8 duel-equipment inputs + §9 five
// non-equipment multipliers, all at neutral 10_000 by default so the effective
// value collapses to the §7 base value unless overridden.
function regionalShip(overrides: Partial<RegionalSweepingShip> = {}): RegionalSweepingShip {
  return {
    shipId: "hms-victoria-001",
    eligibility: eligibleShip({ shipId: "hms-victoria-001" }),
    baseValueKey: "DEDICATED_FLEET_MINESWEEPER", // §7 base 150
    equipmentIsDualPurpose: false, // single-purpose raises equipmentMode to full 10_000
    lockedMissionOrEquipmentCommand: null,
    technologyMultiplierBp: 10_000,
    crewMultiplierBp: 10_000,
    readinessMultiplierBp: 10_000,
    damageMultiplierBp: 10_000,
    supportMultiplierBp: 10_000,
    ...overrides,
  };
}

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

function recordWithPressureAndType(
  minePressureId: string,
  pressure: number,
  mineTypeId: AreaMinePressureRecord["mineTypeId"],
  targetBelligerents: readonly string[] = ["u002"],
): AreaMinePressureRecord {
  return validRecord({
    minePressureId,
    pressure: SafeInt(pressure),
    mineTypeId,
    targetBelligerents,
  });
}

// ---- AC-10 aggregation ----

describe("AC-10: regional value = sum of effective eligible-ship values in ascending ship-id order", () => {
  it("sums only eligible ships and reports them sorted by shipId ascending", () => {
    const ships = [
      regionalShip({ shipId: "hms-zulu-003" }), // base 150
      regionalShip({
        shipId: "hms-alpha-001",
        baseValueKey: "DD_WITH_MINE_SWEEPING_EQUIPMENT", // base 80
        eligibility: eligibleShip({
          shipId: "hms-alpha-001",
          shipType: "DD_WITH_MINE_SWEEPING_EQUIPMENT",
        }),
      }),
    ];
    const result = computeRegionalSweepingValue(ships);
    expect(result.over.map((c) => c.shipId)).toEqual(["hms-alpha-001", "hms-zulu-003"]);
    expect(result.over[0]!.effectiveSweepingValue).toBe(SafeInt(80));
    expect(result.over[1]!.effectiveSweepingValue).toBe(SafeInt(150));
    expect(result.regionalSweepingValue).toBe(SafeInt(230));
  });

  it("is order-independent: shuffled input yields the identical regional value and sorted list", () => {
    const ships = [
      regionalShip({ shipId: "c-ship" }),
      regionalShip({
        shipId: "a-ship",
        baseValueKey: "CONVERTED_TR_MINESWEEPER", // base 120
        eligibility: eligibleShip({ shipId: "a-ship", shipType: "CONVERTED_TR_MINESWEEPER" }),
      }),
      regionalShip({
        shipId: "b-ship",
        baseValueKey: "CL_WITH_MINE_SWEEPING_EQUIPMENT", // base 60
        eligibility: eligibleShip({
          shipId: "b-ship",
          shipType: "CL_WITH_MINE_SWEEPING_EQUIPMENT",
        }),
      }),
    ];
    const forward = computeRegionalSweepingValue(ships);
    const shuffled = computeRegionalSweepingValue([ships[2]!, ships[0]!, ships[1]!]);
    expect(shuffled.regionalSweepingValue).toBe(forward.regionalSweepingValue);
    expect(shuffled.regionalSweepingValue).toBe(SafeInt(330)); // 120 + 150 + 60
    expect(shuffled.over.map((c) => c.shipId)).toEqual(["a-ship", "b-ship", "c-ship"]);
    expect(shuffled.over).toEqual(forward.over);
  });

  it("an ineligible ship contributes ZERO and surfaces in the ineligible list for MINESWEEPING_SHIP_INELIGIBLE", () => {
    const bad = regionalShip({
      shipId: "hms-broken-009",
      eligibility: eligibleShip({ shipId: "hms-broken-009", readiness: "MOBILIZING" }), // §6 fails
    });
    const good = regionalShip({ shipId: "hms-ok-001" });
    const result = computeRegionalSweepingValue([bad, good]);
    expect(result.regionalSweepingValue).toBe(SafeInt(150)); // bad contributed 0
    expect(result.over).toHaveLength(1);
    expect(result.over[0]!.shipId).toBe("hms-ok-001");
    expect(result.ineligible).toHaveLength(1);
    expect(result.ineligible[0]!.failingPredicate).toBe("readinessActive");
    expect(result.ineligible[0]!.ship.shipId).toBe("hms-broken-009");
    expect(result.ineligible[0]!.reason.length).toBeGreaterThan(0);
  });

  it("threads §8 dual-equipment + §9 multipliers through the effective value (one FLOOR only)", () => {
    // DD base 80 × SWEEPING_PRIORITY_DUAL sweep 9_000 × tech 10_000 × crew 12_000
    // × readiness 10_000 × degraded damage 5_000 × support 10_000 =
    // 4.32e25 / 10_000^6 = 43.2 -> 43 (exact rational, one end-FLOOR).
    const input = regionalShip({
      shipId: "hms-dual-001",
      baseValueKey: "DD_WITH_MINE_SWEEPING_EQUIPMENT",
      eligibility: eligibleShip({
        shipId: "hms-dual-001",
        shipType: "DD_WITH_MINE_SWEEPING_EQUIPMENT",
      }),
      equipmentIsDualPurpose: true,
      lockedMissionOrEquipmentCommand: "SWEEPING_PRIORITY_DUAL", // sweep multiplier 9_000
      crewMultiplierBp: 12_000,
      damageMultiplierBp: 5_000, // DEGRADED
    });
    expect(effectiveSweepingValueForShip(input)).toBe(SafeInt(43));
  });
});

// ---- AC-10 allocation order ----

describe("AC-10: sweepingAllocationOrder — exact five-key §10 order", () => {
  function candidate(
    record: AreaMinePressureRecord,
    overrides: Partial<Omit<SweepingAllocationCandidate, "record">> = {},
  ): SweepingAllocationCandidate {
    return {
      record,
      threatensSweepingSide: false,
      strikeRiskPriority: 0,
      resistanceMultiplierBp: 10_000,
      ...overrides,
    };
  }

  it("controlled-defensive mines threatening the sweeping side sort FIRST", () => {
    const threatening = candidate(
      recordWithPressureAndType("mp-threat", 100, "CONTROLLED_DEFENSIVE", ["u002"]),
      {
        threatensSweepingSide: true,
      },
    );
    const passive = candidate(
      recordWithPressureAndType("mp-passive", 900, "CONTROLLED_DEFENSIVE", ["u999"]),
      {
        threatensSweepingSide: false,
      },
    );
    // Deliberately scrambled input order -> comparator alone decides.
    expect(sweepingAllocationOrder(passive, threatening)).toBeGreaterThan(0);
    expect(
      [passive, threatening].sort(sweepingAllocationOrder).map((c) => c.record.minePressureId),
    ).toEqual(["mp-threat", "mp-passive"]);
  });

  it("highest strike risk sorts before lower risk (same threat/pressure)", () => {
    const a = candidate(recordWithPressureAndType("mp-a", 500, "CONTACT"), {
      strikeRiskPriority: 10,
    });
    const b = candidate(recordWithPressureAndType("mp-b", 500, "CONTACT"), {
      strikeRiskPriority: 9_000,
    });
    expect([a, b].sort(sweepingAllocationOrder).map((c) => c.record.minePressureId)).toEqual([
      "mp-b",
      "mp-a",
    ]);
  });

  it("highest pressure sorts before lower pressure (same threat/risk/type)", () => {
    const low = candidate(recordWithPressureAndType("mp-low", 100, "CONTACT"), {
      strikeRiskPriority: 1,
    });
    const high = candidate(recordWithPressureAndType("mp-high", 999_999, "CONTACT"), {
      strikeRiskPriority: 1,
    });
    expect([low, high].sort(sweepingAllocationOrder).map((c) => c.record.minePressureId)).toEqual([
      "mp-high",
      "mp-low",
    ]);
  });

  it("mine-type identifier breaks risk/pressure ties ascendingly (codepoint order)", () => {
    const contact = candidate(recordWithPressureAndType("mp-z", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    const magnetic = candidate(recordWithPressureAndType("mp-a", 500, "MAGNETIC"), {
      strikeRiskPriority: 0,
    });
    expect(
      [magnetic, contact].sort(sweepingAllocationOrder).map((c) => c.record.mineTypeId),
    ).toEqual(["CONTACT", "MAGNETIC"]);
  });

  it("ids sort by codepoint, NEVER localeCompare (the no-locale determinism contract)", () => {
    // Mixed-case and non-ASCII id pairs would reorder under ICU collation on
    // some locales/OS (e.g. 'a' < 'A' is not guaranteed across locales). The
    // authoritative order MUST be plain UTF-16 codepoint order, so we pin it.
    const upperA = candidate(recordWithPressureAndType("mp-A", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    const lowerA = candidate(recordWithPressureAndType("mp-a", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    // 'A' (65) < 'a' (97) in codepoint order, regardless of host locale.
    expect(
      [lowerA, upperA].sort(sweepingAllocationOrder).map((c) => c.record.minePressureId),
    ).toEqual(["mp-A", "mp-a"]);

    const sub = candidate(recordWithPressureAndType("mp-å", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    const ascii = candidate(recordWithPressureAndType("mp-a", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    // 'a' (97) < 'å' (229) in codepoint order; a locale collator could disagree.
    expect([sub, ascii].sort(sweepingAllocationOrder).map((c) => c.record.minePressureId)).toEqual([
      "mp-a",
      "mp-å",
    ]);
  });

  it("mine-pressure identifier is the final tiebreaker (ascending)", () => {
    const idB = candidate(recordWithPressureAndType("mp-b", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    const idA = candidate(recordWithPressureAndType("mp-a", 500, "CONTACT"), {
      strikeRiskPriority: 0,
    });
    expect([idB, idA].sort(sweepingAllocationOrder).map((c) => c.record.minePressureId)).toEqual([
      "mp-a",
      "mp-b",
    ]);
  });
});

// ---- AC-10 allocation budget ----

describe("AC-10: allocateSweeping — exact §10 formulas and shared-budget allocation", () => {
  const opts = {
    sweepingBelligerentId: "u002",
    hasMatchingSweepCapability: () => true, // full capability for every type
  };

  it("typeAdjustedSweeping = floor(regional × resistance / 10_000); swept = min(pressure, typeAdjusted); pressureAfter exact", () => {
    // regional 100_000, CONTACT resistance 10_000 -> typeAdjusted 100_000;
    // pressure 40_000 -> swept 40_000, pressureAfter 0.
    const record = recordWithPressureAndType("mp-1", 40_000, "CONTACT");
    const out = allocateSweeping(SafeInt(100_000), [record], opts);
    expect(out.allocations).toHaveLength(1);
    const alloc = out.allocations[0]!;
    expect(alloc.typeAdjustedSweeping).toBe(SafeInt(100_000));
    expect(alloc.sweptPressure).toBe(SafeInt(40_000));
    expect(alloc.pressureAfter).toBe(SafeInt(0));
    expect(alloc.pressureReducedCode).toBe(MINE_PRESSURE_REDUCED);
    expect(out.leftoverUnusedValue).toBe(SafeInt(60_000));
  });

  it("sweptPressure is clamped to the current pressure (never below zero)", () => {
    // regional smaller than pressure: typeAdjusted 30_000 < 40_000 pressure
    const record = recordWithPressureAndType("mp-1", 40_000, "CONTACT");
    const out = allocateSweeping(SafeInt(30_000), [record], opts);
    expect(out.allocations[0]!.typeAdjustedSweeping).toBe(SafeInt(30_000));
    expect(out.allocations[0]!.sweptPressure).toBe(SafeInt(30_000));
    expect(out.allocations[0]!.pressureAfter).toBe(SafeInt(10_000));
    expect(out.leftoverUnusedValue).toBe(SafeInt(0));
  });

  it("0 typeAdjusted (regional exhausted) sweeps nothing and does NOT emit MINE_PRESSURE_REDUCED", () => {
    const record = recordWithPressureAndType("mp-1", 40_000, "CONTACT");
    const out = allocateSweeping(SafeInt(0), [record], opts);
    expect(out.allocations[0]!.sweptPressure).toBe(SafeInt(0));
    expect(out.allocations[0]!.pressureAfter).toBe(SafeInt(40_000));
    expect(out.allocations[0]!.pressureReducedCode).toBeNull();
  });

  it("magnetic resistance 7_500 without capability vs 10_000 with capability", () => {
    const record = recordWithPressureAndType("mp-mag", 100_000, "MAGNETIC");
    const without = allocateSweeping(SafeInt(100_000), [record], {
      sweepingBelligerentId: "u002",
      hasMatchingSweepCapability: () => false,
    });
    expect(without.allocations[0]!.typeAdjustedSweeping).toBe(SafeInt(75_000));
    const with_cap = allocateSweeping(SafeInt(100_000), [record], opts);
    expect(with_cap.allocations[0]!.typeAdjustedSweeping).toBe(SafeInt(100_000));
  });

  it("the shared budget is consumed sequentially: unused value passes to the NEXT record; one allocation is never double-applied", () => {
    // regional 100_000. The §10 risk accessor forces mp-a (pressure 20_000) to
    // sort FIRST despite its lower pressure: typeAdjusted 100_000 -> swept 20_000,
    // leaving 80_000. mp-b then receives ONLY the remaining type-adjusted budget
    // 80_000, never the full regional 100_000 on both records (one allocation is
    // never double-applied).
    const a = recordWithPressureAndType("mp-a", 20_000, "CONTACT");
    const b = recordWithPressureAndType("mp-b", 90_000, "CONTACT");
    const out = allocateSweeping(SafeInt(100_000), [a, b], {
      ...opts,
      recordRiskPriority: (r) => (r.minePressureId === "mp-a" ? 100 : 1),
    });
    expect(out.allocations[0]!.recordId).toBe("mp-a");
    expect(out.allocations[0]!.typeAdjustedSweeping).toBe(SafeInt(100_000));
    expect(out.allocations[0]!.sweptPressure).toBe(SafeInt(20_000));
    expect(out.allocations[0]!.pressureAfter).toBe(SafeInt(0));
    expect(out.allocations[0]!.unreducedAllocation).toBe(SafeInt(80_000));
    expect(out.allocations[1]!.recordId).toBe("mp-b");
    expect(out.allocations[1]!.typeAdjustedSweeping).toBe(SafeInt(80_000));
    expect(out.allocations[1]!.sweptPressure).toBe(SafeInt(80_000));
    expect(out.allocations[1]!.pressureAfter).toBe(SafeInt(10_000));
    // The sum of swept across records can never exceed the regional value.
    const totalSwept = out.allocations.reduce(
      (acc, x) => SafeInt.add(acc, x.sweptPressure),
      SafeInt.ZERO,
    );
    expect(totalSwept).toBe(SafeInt(100_000));
    expect(out.leftoverUnusedValue).toBe(SafeInt(0));
  });

  it("unreducedAllocation carries the unabsorbed type-adjusted portion onward", () => {
    // regional 100_000, mp-a pressure 20_000 processed first (via risk accessor):
    // typeAdjusted 100_000, swept 20_000, unreduced = 80_000 which then reaches
    // the next record as its reduced typeAdjusted budget.
    const a = recordWithPressureAndType("mp-a", 20_000, "CONTACT");
    const b = recordWithPressureAndType("mp-b", 90_000, "CONTACT");
    const out = allocateSweeping(SafeInt(100_000), [a, b], {
      ...opts,
      recordRiskPriority: (r) => (r.minePressureId === "mp-a" ? 100 : 1),
    });
    expect(out.allocations[0]!.unreducedAllocation).toBe(SafeInt(80_000));
    expect(out.allocations[1]!.typeAdjustedSweeping).toBe(SafeInt(80_000));
  });

  it("depleted budget leaves later records swept to nothing, zero reduction code", () => {
    // mp-b (pressure 100_000) sorts first on the pressure key and exhausts the
    // regional 100_000; mp-a (pressure 80_000) then receives a depleted budget
    // (typeAdjusted 0) -> swept 0, no MINE_PRESSURE_REDUCED.
    const a = recordWithPressureAndType("mp-a", 80_000, "CONTACT");
    const b = recordWithPressureAndType("mp-b", 100_000, "CONTACT");
    const out = allocateSweeping(SafeInt(100_000), [a, b], opts);
    expect(out.allocations[0]!.recordId).toBe("mp-b");
    expect(out.allocations[0]!.sweptPressure).toBe(SafeInt(100_000));
    expect(out.allocations[0]!.pressureReducedCode).toBe(MINE_PRESSURE_REDUCED);
    expect(out.allocations[1]!.recordId).toBe("mp-a");
    expect(out.allocations[1]!.typeAdjustedSweeping).toBe(SafeInt(0));
    expect(out.allocations[1]!.sweptPressure).toBe(SafeInt(0));
    expect(out.allocations[1]!.pressureAfter).toBe(SafeInt(80_000));
    expect(out.allocations[1]!.pressureReducedCode).toBeNull();
    expect(out.leftoverUnusedValue).toBe(SafeInt(0));
  });

  it("a cleared-at-zero record stays in the output array (no deletion here)", () => {
    const a = recordWithPressureAndType("mp-a", 20_000, "CONTACT");
    const b = recordWithPressureAndType("mp-b", 900_000, "CONTACT");
    const out = allocateSweeping(SafeInt(1_000_000), [a, b], opts);
    expect(out.allocations).toHaveLength(2); // array length unchanged -> not deleted
    expect(out.allocations[0]!.pressureAfter).toBe(SafeInt(0));
    expect(out.allocations[1]!.pressureAfter).toBe(SafeInt(0));
  });

  it("allocation is order-independent of the input array: the §10 comparator decides", () => {
    const a = recordWithPressureAndType("mp-a", 20_000, "CONTACT");
    const b = recordWithPressureAndType("mp-b", 90_000, "CONTACT");
    const forward = allocateSweeping(SafeInt(100_000), [a, b], opts);
    const reversed = allocateSweeping(SafeInt(100_000), [b, a], opts);
    expect(reversed.allocations.map((x) => x.recordId)).toEqual(
      forward.allocations.map((x) => x.recordId),
    );
    expect(reversed).toEqual(forward);
  });

  it("threatening controlled-defensive records are swept FIRST in allocation (strike risk falls back to default highest)", () => {
    const threatening = validRecord({
      minePressureId: "mp-cd",
      mineTypeId: "CONTROLLED_DEFENSIVE",
      pressure: SafeInt(5_000),
      // targets include the sweeping side u002 -> threatens it
    });
    const heavy = recordWithPressureAndType("mp-heavy", 500_000, "CONTACT");
    const out = allocateSweeping(SafeInt(60_000), [heavy, threatening], opts);
    expect(out.allocations[0]!.recordId).toBe("mp-cd");
    expect(out.allocations[1]!.recordId).toBe("mp-heavy");
    // Threatening record with 5_000 pressure swept fully first; heavy contact
    // then receives the remaining 55_000 of type-adjusted value.
    expect(out.allocations[0]!.sweptPressure).toBe(SafeInt(5_000));
    expect(out.allocations[1]!.typeAdjustedSweeping).toBe(SafeInt(55_000));
  });

  it("recordRiskPriority accessor wires higher risk earlier (seam for INC-5)", () => {
    const low = recordWithPressureAndType("mp-low-risk", 500_000, "CONTACT");
    const high = recordWithPressureAndType("mp-high-risk", 100_000, "CONTACT");
    const out = allocateSweeping(SafeInt(50_000), [low, high], {
      ...opts,
      recordRiskPriority: (r) => (r.minePressureId === "mp-high-risk" ? 10 : 1),
    });
    expect(out.allocations[0]!.recordId).toBe("mp-high-risk");
    expect(DEFAULT_STRIKE_RISK_PRIORITY).toBe(Number.MAX_SAFE_INTEGER);
  });
});

// ---- AC-10 applySweptPressure ----

describe("AC-10: applySweptPressure — exact reduction, month, hash; no deletion", () => {
  it("reduces pressure by exactly sweptPressure, sets lastSweptMonth, recomputes the hash", () => {
    const before = validRecord();
    const after = applySweptPressure(before, SafeInt(150_000), SafeInt(40));
    expect(after.pressure).toBe(SafeInt(250_000));
    expect(after.lastSweptMonth).toBe(SafeInt(40));
    expect(after.recordHash).not.toBe(before.recordHash);
    expect(after.recordHash).toMatch(/^[0-9a-f]{64}$/);
    const again = applySweptPressure(before, SafeInt(150_000), SafeInt(40));
    expect(again.recordHash).toBe(after.recordHash); // deterministic
  });

  it("a zero-pressureAfter (cleared boundary) record is returned, NOT deleted — INC-7 owns clearance", () => {
    const before = validRecord({ pressure: SafeInt(5_000) });
    const after = applySweptPressure(before, SafeInt(5_000), SafeInt(40));
    expect(after.pressure).toBe(SafeInt(0));
    expect(after.lastSweptMonth).toBe(SafeInt(40));
    expect(after.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("preserves every non-swept field and never reduces below zero", () => {
    const before = validRecord({
      lastSweptMonth: SafeInt(41),
      pressure: SafeInt(100_000),
    });
    const after = applySweptPressure(before, SafeInt(30_000), SafeInt(42));
    expect(after.pressure).toBe(SafeInt(70_000));
    expect(after.freshnessBp).toBe(before.freshnessBp);
    expect(after.areaId).toBe(before.areaId);
    expect(after.targetBelligerents).toEqual(before.targetBelligerents);
  });

  it("rejects a negative or over-pressure sweptPressure with INVALID_MINE_PRESSURE_STATE", () => {
    const before = validRecord();
    for (const bad of [SafeInt(-1), SafeInt(400_001)]) {
      let err: BluewaveError | undefined;
      try {
        applySweptPressure(before, bad, SafeInt(40));
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(INVALID_MINE_PRESSURE_STATE);
    }
  });
});

// ---- helper sanity: comparator follows Array#sort contract ----

describe("AC-10 determinism: comparators never depend on incidental order", () => {
  it("sweepingContributionOrder is a strict total order on shipId", () => {
    const a = { shipId: "ship-a", effectiveSweepingValue: SafeInt(1) };
    const b = { shipId: "ship-b", effectiveSweepingValue: SafeInt(2) };
    expect(sweepingContributionOrder(a, b)).toBeLessThan(0);
    expect(sweepingContributionOrder(b, a)).toBeGreaterThan(0);
    expect(sweepingContributionOrder(a, a)).toBe(0);
  });

  it("aggregation surfaces ineligible ships even when every ship is ineligible (regional value 0)", () => {
    const ships = [
      regionalShip({
        shipId: "hms-broken-001",
        eligibility: eligibleShip({ shipId: "hms-broken-001", readiness: "IN_RESERVE" }),
      }),
      regionalShip({
        shipId: "hms-broken-002",
        eligibility: eligibleShip({
          shipId: "hms-broken-002",
          mission: "TRADE_PROTECTION",
          sweepingAuthorization: false,
        }),
      }),
    ];
    const result = computeRegionalSweepingValue(ships);
    expect(result.regionalSweepingValue).toBe(SafeInt(0));
    expect(result.over).toHaveLength(0);
    expect(result.ineligible).toHaveLength(2);
  });
});
