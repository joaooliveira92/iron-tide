// AC-7 (INC-3): DESIGN-35 §7 sweeping base values — exact shipped integers
// (150/100/80/100/60/50/120) keyed by the closed §7 equipment/type-key set;
// every equipment definition identifies EXACTLY one base value; a ship
// NAME/class description never grants a value; fail-closed lookup for unknown
// keys; `mine_sweeping_v1` contract + fail-closed validate guard.
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  baseSweepingValueById,
  baseSweepingValueFor,
  MINESWEEPING_SHIP_INELIGIBLE,
  mineSweepingPolicyId,
  SHIPPED_MINE_SWEEPING_BASE_VALUES,
  SHIPPED_MINE_SWEEPING_CONTRACT,
  SWEEPING_BASE_VALUE_KEYS,
  type SweepingBaseValueKey,
  validateMineSweepingContract,
} from "../../src/mines/index.js";

describe("AC-7: exact §7 base sweeping values by equipment/type key", () => {
  it("dedicated fleet minesweeper 150, dedicated coastal minesweeper 100", () => {
    expect(baseSweepingValueFor("DEDICATED_FLEET_MINESWEEPER")).toBe(150);
    expect(baseSweepingValueFor("DEDICATED_COASTAL_MINESWEEPER")).toBe(100);
  });

  it("DD 80, KE 100, CL 60, AMC 50, converted TR 120", () => {
    expect(baseSweepingValueFor("DD_WITH_MINE_SWEEPING_EQUIPMENT")).toBe(80);
    expect(baseSweepingValueFor("KE_WITH_MINE_SWEEPING_EQUIPMENT")).toBe(100);
    expect(baseSweepingValueFor("CL_WITH_MINE_SWEEPING_EQUIPMENT")).toBe(60);
    expect(baseSweepingValueFor("AMC_WITH_MINE_SWEEPING_EQUIPMENT")).toBe(50);
    expect(baseSweepingValueFor("CONVERTED_TR_MINESWEEPER")).toBe(120);
  });

  it("every equipment key maps to exactly one base value (7 keys, 7 integers)", () => {
    expect(SWEEPING_BASE_VALUE_KEYS.length).toBe(7);
    const table = SHIPPED_MINE_SWEEPING_BASE_VALUES;
    for (const key of SWEEPING_BASE_VALUE_KEYS) {
      const v = table[key];
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
    const values = SWEEPING_BASE_VALUE_KEYS.map((k: SweepingBaseValueKey) => table[k]);
    expect(new Set(values).size).toBe(new Set([150, 100, 80, 60, 50, 120]).size); // KE == coastal 100 is legal (§7), set must be the 6 literals
    expect([...new Set(values)].sort((a, b) => a - b)).toEqual([50, 60, 80, 100, 120, 150]);
  });
});

describe("AC-7: fail-closed lookup — a ship NAME never grants sweeping value", () => {
  it("baseSweepingValueById resolves every shipped key", () => {
    expect(baseSweepingValueById("DEDICATED_FLEET_MINESWEEPER")).toBe(150);
    expect(baseSweepingValueById("CONVERTED_TR_MINESWEEPER")).toBe(120);
  });

  it("a ship name/class description fails with MINESWEEPING_SHIP_INELIGIBLE (never a value)", () => {
    for (const nonKey of ["HMS_VICTORIA", "Town_class_cruiser", "bismarck", "DD", ""]) {
      let err: BluewaveError | undefined;
      try {
        baseSweepingValueById(nonKey);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err).toBeDefined();
      expect(err!.message).toBe(MINESWEEPING_SHIP_INELIGIBLE);
    }
  });

  it("the §6 'other explicitly eligible' category has NO shipped base value this increment", () => {
    let err: BluewaveError | undefined;
    try {
      baseSweepingValueById("OTHER_EXPLICITLY_ELIGIBLE");
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(MINESWEEPING_SHIP_INELIGIBLE);
  });
});

describe("AC-24: mine_sweeping_v1 contract + validate guard (fail closed)", () => {
  it("ships the *_v1 policy id and the exact §7 table", () => {
    expect(mineSweepingPolicyId).toBe("mine_sweeping_v1");
    expect(SHIPPED_MINE_SWEEPING_CONTRACT.policyId).toBe("mine_sweeping_v1");
    expect(validateMineSweepingContract(SHIPPED_MINE_SWEEPING_CONTRACT)).toBeUndefined();
  });

  it("fails closed on a tampered base value", () => {
    expect(() =>
      validateMineSweepingContract({
        ...SHIPPED_MINE_SWEEPING_CONTRACT,
        baseValues: {
          ...SHIPPED_MINE_SWEEPING_CONTRACT.baseValues,
          DEDICATED_FLEET_MINESWEEPER: 149,
        },
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a tampered key set", () => {
    expect(() =>
      validateMineSweepingContract({
        ...SHIPPED_MINE_SWEEPING_CONTRACT,
        keys: [...SWEEPING_BASE_VALUE_KEYS, "HMS_VICTORIA"] as never,
      }),
    ).toThrow(BluewaveError);
  });

  it("fails closed on a null/missing/policy-id-mismatched contract", () => {
    expect(() => validateMineSweepingContract(null)).toThrow(BluewaveError);
    expect(() => validateMineSweepingContract(undefined)).toThrow(BluewaveError);
    expect(() =>
      validateMineSweepingContract({ ...SHIPPED_MINE_SWEEPING_CONTRACT, policyId: "x" }),
    ).toThrow(BluewaveError);
  });
});
