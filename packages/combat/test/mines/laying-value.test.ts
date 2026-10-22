import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  computeEffectiveLayingValue,
  consumeMineInventory,
  crewMultiplierBp,
  damageMultiplierBp,
  MINE_INVENTORY_INSUFFICIENT,
  MINE_LAYING_DENOMINATOR,
  MINE_LAYING_MULTIPLIERS_CONTRACT,
  MINE_LAYING_SOURCE_INELIGIBLE,
  mineLayingMultipliersPolicyId,
  missionMultiplierBp,
  readinessMultiplierBp,
  supplyMultiplierBp,
  technologyMultiplierBp,
  type MineLayingMultipliers,
} from "@bluewave/combat/mines";

function multipliers(overrides: Partial<MineLayingMultipliers> = {}): MineLayingMultipliers {
  return {
    technologyMultiplierBp: 10_000,
    crewMultiplierBp: 10_000,
    readinessMultiplierBp: 10_000,
    damageMultiplierBp: 10_000,
    supplyMultiplierBp: 10_000,
    missionMultiplierBp: 10_000,
    ...overrides,
  };
}

describe("AC-4: exact §4 formula — one exact product, one FLOOR", () => {
  it("all-neutral multipliers collapse to the base value", () => {
    const res = computeEffectiveLayingValue(100, multipliers());
    expect(res.effectiveLayingValue).toBe(SafeInt(100));
    expect(res.rounding.mode).toBe("floor");
    expect(res.rounding.denominator).toBe(MINE_LAYING_DENOMINATOR.toString());
  });

  it("floors a fractional exact rational exactly once (21.09375 -> 21)", () => {
    const res = computeEffectiveLayingValue(100, {
      technologyMultiplierBp: 7_500,
      crewMultiplierBp: 7_500,
      readinessMultiplierBp: 7_500,
      damageMultiplierBp: 5_000,
      supplyMultiplierBp: 10_000,
      missionMultiplierBp: 10_000,
    });
    expect(res.effectiveLayingValue).toBe(SafeInt(21));
    expect(res.rounding.numerator).toBe("21093750000000000000000000");
  });

  it("crew 12_000 × readiness 11_000 yields exact 132 (100 × 1.1 × 1.2)", () => {
    const res = computeEffectiveLayingValue(
      100,
      multipliers({ crewMultiplierBp: 12_000, readinessMultiplierBp: 11_000 }),
    );
    expect(res.effectiveLayingValue).toBe(SafeInt(132));
  });

  it("a base value of 1 stays 1 under neutral multipliers (lower edge)", () => {
    const res = computeEffectiveLayingValue(1, multipliers());
    expect(res.effectiveLayingValue).toBe(SafeInt(1));
  });

  it("a zero multiplier (unsupported source) makes the whole value 0", () => {
    const res = computeEffectiveLayingValue(100, multipliers({ technologyMultiplierBp: 0 }));
    expect(res.effectiveLayingValue).toBe(SafeInt(0));
  });

  it("never per-factor rounding: 100 × 7_500×7_500/10_000^2 = 56.25 -> 56", () => {
    const res = computeEffectiveLayingValue(
      100,
      multipliers({ crewMultiplierBp: 7_500, readinessMultiplierBp: 7_500 }),
    );
    expect(res.effectiveLayingValue).toBe(SafeInt(56));
  });

  it("fails a non-integer or non-positive baseLayingValue (never silent)", () => {
    for (const bad of [0, -5, 12.5]) {
      let err: BluewaveError | undefined;
      try {
        computeEffectiveLayingValue(bad, multipliers());
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err!.message).toBe(MINE_LAYING_SOURCE_INELIGIBLE);
    }
  });

  it("fails a missing / non-integer / negative multiplier factor (never a silent 10_000)", () => {
    const cases: Array<Partial<MineLayingMultipliers>> = [
      { technologyMultiplierBp: undefined as never },
      { crewMultiplierBp: 9_000.5 },
      { damageMultiplierBp: -1 as never },
    ];
    for (const bad of cases) {
      let err: BluewaveError | undefined;
      try {
        computeEffectiveLayingValue(100, multipliers(bad));
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err!.message).toBe(MINE_LAYING_SOURCE_INELIGIBLE);
    }
  });
});

describe("AC-4: shipped generic multiplier table (mine_laying_multipliers_v1)", () => {
  it("ships the *_v1 policy id and exact DESIGN-35 §4 integers", () => {
    expect(mineLayingMultipliersPolicyId).toBe("mine_laying_multipliers_v1");
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.policyId).toBe("mine_laying_multipliers_v1");
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.technologyFullBp).toBe(10_000);
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.technologyPartialEarlyBp).toBe(7_500);
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.technologyUnsupportedBp).toBe(0);
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.damageDegradedBp).toBe(5_000);
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.supplyIneligibleBp).toBe(0);
    expect(MINE_LAYING_MULTIPLIERS_CONTRACT.missionIneligibleBp).toBe(0);
  });

  it("technology multiplier: full 10_000 / partial-early 7_500 / unsupported 0", () => {
    expect(technologyMultiplierBp("FULL")).toBe(10_000);
    expect(technologyMultiplierBp("PARTIAL_EARLY")).toBe(7_500);
    expect(technologyMultiplierBp("UNSUPPORTED")).toBe(0);
  });

  it("crew multiplier bands: 0..39 7_500, 40..59 10_000, 60..79 11_000, 80..100 12_000", () => {
    expect(crewMultiplierBp(0)).toBe(7_500);
    expect(crewMultiplierBp(39)).toBe(7_500);
    expect(crewMultiplierBp(40)).toBe(10_000);
    expect(crewMultiplierBp(59)).toBe(10_000);
    expect(crewMultiplierBp(60)).toBe(11_000);
    expect(crewMultiplierBp(79)).toBe(11_000);
    expect(crewMultiplierBp(80)).toBe(12_000);
    expect(crewMultiplierBp(100)).toBe(12_000);
  });

  it("crew multiplier fails out-of-range or non-integer quality", () => {
    for (const bad of [-1, 101, 55.5]) {
      let err: BluewaveError | undefined;
      try {
        crewMultiplierBp(bad);
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err!.message).toBe(MINE_LAYING_SOURCE_INELIGIBLE);
    }
  });

  it("readiness multiplier: below 40 ineligible; 40..59 7_500, 60..79 10_000, 80..100 11_000", () => {
    expect(() => readinessMultiplierBp(39)).toThrow(BluewaveError);
    expect(readinessMultiplierBp(40)).toBe(7_500);
    expect(readinessMultiplierBp(59)).toBe(7_500);
    expect(readinessMultiplierBp(60)).toBe(10_000);
    expect(readinessMultiplierBp(79)).toBe(10_000);
    expect(readinessMultiplierBp(80)).toBe(11_000);
    expect(readinessMultiplierBp(100)).toBe(11_000);
  });

  it("readiness below 40 fails with MINE_LAYING_SOURCE_INELIGIBLE (never silent)", () => {
    let err: BluewaveError | undefined;
    try {
      readinessMultiplierBp(0);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err!.message).toBe(MINE_LAYING_SOURCE_INELIGIBLE);
    expect(err!.context.field).toBe("readiness");
  });

  it("damage multiplier: OPERATIONAL 10_000, DEGRADED 5_000, INOPERATIVE 0", () => {
    expect(damageMultiplierBp("OPERATIONAL")).toBe(10_000);
    expect(damageMultiplierBp("DEGRADED")).toBe(5_000);
    expect(damageMultiplierBp("INOPERATIVE")).toBe(0);
  });

  it("supply/mission multipliers: eligible 10_000, unsupported or fuel-ineligible 0", () => {
    expect(supplyMultiplierBp(true)).toBe(10_000);
    expect(supplyMultiplierBp(false)).toBe(0);
    expect(missionMultiplierBp(true)).toBe(10_000);
    expect(missionMultiplierBp(false)).toBe(0);
  });
});

describe("AC-4: inventory consumption", () => {
  it("consumes exactly the declared quantity", () => {
    const out = consumeMineInventory(SafeInt(400), SafeInt(120));
    expect(out.consumedQuantity).toBe(SafeInt(120));
    expect(out.inventoryAfter).toBe(SafeInt(280));
  });

  it("leaves zero inventory after an exact full draw", () => {
    const out = consumeMineInventory(SafeInt(120), SafeInt(120));
    expect(out.inventoryAfter).toBe(SafeInt(0));
    expect(out.consumedQuantity).toBe(SafeInt(120));
  });

  it("insufficient inventory fails with MINE_INVENTORY_INSUFFICIENT", () => {
    let err: BluewaveError | undefined;
    try {
      consumeMineInventory(SafeInt(50), SafeInt(120));
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err!.message).toBe(MINE_INVENTORY_INSUFFICIENT);
  });

  it("a non-positive declared quantity fails with MINE_INVENTORY_INSUFFICIENT", () => {
    for (const bad of [0, -5]) {
      let err: BluewaveError | undefined;
      try {
        consumeMineInventory(SafeInt(400), SafeInt(bad));
      } catch (e) {
        err = e as BluewaveError;
      }
      expect(err!.message).toBe(MINE_INVENTORY_INSUFFICIENT);
    }
  });
});
