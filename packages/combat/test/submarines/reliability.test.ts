// AC-5 (INC-2): Design-34 §7 reliability. Integer range 0..100 and the shipped
// operational multiplier table (0..19:4_000, 20..39:6_000, 40..59:8_000,
// 60..79:10_000, 80..94:11_000, 95..100:12_000 basis points). A reliability
// score below 20 prohibits offensive deployment and permits only repair
// transfer, training, or emergency defense -> SUBMARINE_RELIABILITY_INSUFFICIENT.
// Out-of-§7-range lookups fail closed with SUBMARINE_STATE_INVARIANT_FAILED
// (the module's ambient fail-closed carrier — the §7 integer-range contract,
// not an INC-2 owning boundary). Also proves AC-21's submarine_reliability_v1
// contract + validate guard (INC-2 ships the §7 contract).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  SUBMARINE_RELIABILITY_INSUFFICIENT,
  SUBMARINE_STATE_INVARIANT_FAILED,
  SUBMARINE_RELIABILITY_MIN,
  SUBMARINE_RELIABILITY_MAX,
  SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR,
  SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP,
  submarineReliabilityPolicyId,
  SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
  validateSubmarineReliabilityContract,
  reliabilityOperationalMultiplierBp,
  reliabilityOffensiveDeploymentVerdict,
  SUBMARINE_RELIABILITY_LOW_OPERATIONS,
  SUBMARINE_OPERATION_CLASSES,
  type SubmarineReliabilityVerdict,
} from "../../src/submarines/index.js";

describe("AC-5: §7 exact multiplier table — all six bands + boundaries", () => {
  it("band 0..19 -> 4_000 at both edges", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(0))).toBe(SafeInt(4_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(19))).toBe(SafeInt(4_000));
  });

  it("band 20..39 -> 6_000 at both edges", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(20))).toBe(SafeInt(6_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(39))).toBe(SafeInt(6_000));
  });

  it("band 40..59 -> 8_000 at both edges", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(40))).toBe(SafeInt(8_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(59))).toBe(SafeInt(8_000));
  });

  it("band 60..79 -> 10_000 at both edges", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(60))).toBe(SafeInt(10_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(79))).toBe(SafeInt(10_000));
  });

  it("band 80..94 -> 11_000 at both edges", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(80))).toBe(SafeInt(11_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(94))).toBe(SafeInt(11_000));
  });

  it("band 95..100 -> 12_000 at both edges", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(95))).toBe(SafeInt(12_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(100))).toBe(SafeInt(12_000));
  });

  it("spot-checks a mid-band value in every band", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(10))).toBe(SafeInt(4_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(30))).toBe(SafeInt(6_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(50))).toBe(SafeInt(8_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(70))).toBe(SafeInt(10_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(90))).toBe(SafeInt(11_000));
    expect(reliabilityOperationalMultiplierBp(SafeInt(98))).toBe(SafeInt(12_000));
  });
});

describe("AC-5: §7 multiplier table is the contiguous six-band cover of [0, 100]", () => {
  it("ships six bands with the exact shipped values", () => {
    const table = SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP;
    expect(table).toHaveLength(6);
    expect(table.map((b) => b.multiplierBp)).toEqual([4_000, 6_000, 8_000, 10_000, 11_000, 12_000]);
    expect(table[0]!.min).toBe(0);
    expect(table[5]!.max).toBe(100);
  });

  it("bands are contiguous with no gaps or overlaps and cover every integer 0..100", () => {
    const table = SUBMARINE_RELIABILITY_OPERATIONAL_MULTIPLIER_TABLE_BP;
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i]!.min).toBe(table[i - 1]!.max + 1);
    }
    for (let r = SUBMARINE_RELIABILITY_MIN; r <= SUBMARINE_RELIABILITY_MAX; r += 1) {
      expect(() => reliabilityOperationalMultiplierBp(SafeInt(r))).not.toThrow();
    }
    expect(SUBMARINE_RELIABILITY_MIN).toBe(0);
    expect(SUBMARINE_RELIABILITY_MAX).toBe(100);
  });
});

describe("AC-5: out-of-§7-range lookups fail closed (never silently pass)", () => {
  it("rejects reliability below 0 and above 100", () => {
    for (const bad of [-1, 101, 1_000]) {
      let err: BluewaveError | undefined;
      try {
        reliabilityOperationalMultiplierBp(SafeInt(bad));
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
    }
  });

  it("rejects a non-integer reliability", () => {
    let err: BluewaveError | undefined;
    try {
      reliabilityOperationalMultiplierBp(12.5 as SafeInt);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(SUBMARINE_STATE_INVARIANT_FAILED);
  });
});

describe("AC-5: reliability below 20 prohibits offensive deployment", () => {
  it("fails closed with SUBMARINE_RELIABILITY_INSUFFICIENT for every value in 0..19", () => {
    for (let r = 0; r < SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR; r += 1) {
      const verdict = reliabilityOffensiveDeploymentVerdict(SafeInt(r));
      expect(verdict.offensiveDeploymentPermitted).toBe(false);
      if (!verdict.offensiveDeploymentPermitted) {
        expect(verdict.reasonCode).toBe(SUBMARINE_RELIABILITY_INSUFFICIENT);
        expect(verdict.message).toContain("prohibits offensive deployment");
      }
    }
  });

  it("reports that only repair transfer / training / emergency defense are permitted", () => {
    const verdict = reliabilityOffensiveDeploymentVerdict(SafeInt(5));
    expect(verdict.offensiveDeploymentPermitted).toBe(false);
    if (!verdict.offensiveDeploymentPermitted) {
      expect(verdict.permittedOperationsOnly).toEqual([
        "REPAIR_TRANSFER",
        "TRAINING",
        "EMERGENCY_DEFENSE",
      ]);
      // the shipped low-reliability operation list equals the §7 closed set
      expect([...SUBMARINE_RELIABILITY_LOW_OPERATIONS]).toEqual([
        "REPAIR_TRANSFER",
        "TRAINING",
        "EMERGENCY_DEFENSE",
      ]);
    }
  });

  it("exposes the §7 low-reliability operation classes as a closed subset of the surface", () => {
    expect([...SUBMARINE_OPERATION_CLASSES]).toEqual([
      "OFFENSIVE_DEPLOYMENT",
      "REPAIR_TRANSFER",
      "TRAINING",
      "EMERGENCY_DEFENSE",
    ]);
    for (const op of SUBMARINE_RELIABILITY_LOW_OPERATIONS) {
      expect(SUBMARINE_OPERATION_CLASSES).toContain(op);
      expect(op).not.toBe("OFFENSIVE_DEPLOYMENT");
    }
  });
});

describe("AC-5: at or above 20 offensive deployment is permitted", () => {
  it("permits offensive deployment at 20, midrange, and 100", () => {
    for (const r of [20, 50, 79, 95, 100]) {
      const verdict: SubmarineReliabilityVerdict = reliabilityOffensiveDeploymentVerdict(
        SafeInt(r),
      );
      expect(verdict.offensiveDeploymentPermitted).toBe(true);
      if (verdict.offensiveDeploymentPermitted) expect(verdict.reasonCode).toBe(null);
    }
    expect(SUBMARINE_RELIABILITY_OFFENSIVE_DEPLOYMENT_FLOOR).toBe(20);
  });

  it("the multiplier still returns 4_000 for the 0..19 band (table vs deployment floor are separate surfaces)", () => {
    expect(reliabilityOperationalMultiplierBp(SafeInt(19))).toBe(SafeInt(4_000));
    expect(reliabilityOffensiveDeploymentVerdict(SafeInt(19)).offensiveDeploymentPermitted).toBe(
      false,
    );
    expect(reliabilityOperationalMultiplierBp(SafeInt(20))).toBe(SafeInt(6_000));
    expect(reliabilityOffensiveDeploymentVerdict(SafeInt(20)).offensiveDeploymentPermitted).toBe(
      true,
    );
  });
});

describe("AC-21: submarine_reliability_v1 contract + guard (fail closed)", () => {
  it("ships the *_v1 policy id and validates the shipped contract", () => {
    expect(submarineReliabilityPolicyId).toBe("submarine_reliability_v1");
    expect(SHIPPED_SUBMARINE_RELIABILITY_CONTRACT.policyId).toBe("submarine_reliability_v1");
    expect(() =>
      validateSubmarineReliabilityContract(SHIPPED_SUBMARINE_RELIABILITY_CONTRACT),
    ).not.toThrow();
  });

  it("wires the exact §7 range, floor, and six-band table", () => {
    const c = SHIPPED_SUBMARINE_RELIABILITY_CONTRACT;
    expect(c.reliabilityRangeMin).toBe(0);
    expect(c.reliabilityRangeMax).toBe(100);
    expect(c.offensiveDeploymentFloor).toBe(20);
    expect(c.multiplierTableBp.map((b) => b.multiplierBp)).toEqual([
      4_000, 6_000, 8_000, 10_000, 11_000, 12_000,
    ]);
    expect(c.multiplierTableBp).toHaveLength(6);
  });

  it("fails closed on a tampered §7 table band", () => {
    expect(() =>
      validateSubmarineReliabilityContract({
        ...SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
        multiplierTableBp: [
          { min: 0, max: 19, multiplierBp: 4_001 },
          { min: 20, max: 39, multiplierBp: 6_000 },
          { min: 40, max: 59, multiplierBp: 8_000 },
          { min: 60, max: 79, multiplierBp: 10_000 },
          { min: 80, max: 94, multiplierBp: 11_000 },
          { min: 95, max: 100, multiplierBp: 12_000 },
        ],
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateSubmarineReliabilityContract({
        ...SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
        multiplierTableBp: [{ min: 0, max: 19, multiplierBp: 4_000 }],
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered range or offensive-deployment floor", () => {
    expect(() =>
      validateSubmarineReliabilityContract({
        ...SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
        offensiveDeploymentFloor: 15,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateSubmarineReliabilityContract({
        ...SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
        reliabilityRangeMax: 99,
      }),
    ).toThrow(BluewaveError);
    expect(() =>
      validateSubmarineReliabilityContract({
        ...SHIPPED_SUBMARINE_RELIABILITY_CONTRACT,
        policyId: "submarine_reliability_v2",
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on null/missing contract", () => {
    expect(() => validateSubmarineReliabilityContract(null)).toThrow(BluewaveError);
    expect(() => validateSubmarineReliabilityContract(undefined)).toThrow(BluewaveError);
  });
});
