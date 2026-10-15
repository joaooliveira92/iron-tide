// AC-8 (INC-3): DESIGN-35 §8 dual ASW/mine equipment — the exact five shipped
// modes of dual_asw_mine_equipment_v1, the fail-closed contract guard, and the
// §8 mode resolution (locked mission/equipment command selected BEFORE
// resolution; dual-purpose-declared missing mode defaults to balanced ONLY;
// single-purpose equipment sweeps full without balanced default; never full
// ASW + full sweeping simultaneously; other missing configurations throw
// DUAL_EQUIPMENT_MODE_MISSING).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  dualAswMineEquipmentPolicyId,
  DUAL_EQUIPMENT_MODE_MISSING,
  DUAL_ASW_MINE_EQUIPMENT_MODES,
  effectiveEquipmentModeMultiplierBp,
  resolveDualEquipmentMode,
  SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
  SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS,
  type DualAswMineEquipmentMode,
  validateDualAswMineEquipmentContract,
} from "../../src/mines/index.js";

function expectMissing(fn: () => unknown): BluewaveError {
  let err: BluewaveError | undefined;
  try {
    fn();
  } catch (e) {
    err = e as BluewaveError;
  }
  expect(err).toBeDefined();
  expect(err!.message).toBe(DUAL_EQUIPMENT_MODE_MISSING);
  return err!;
}

describe("AC-8: exact five-mode §8 table (dual_asw_mine_equipment_v1)", () => {
  it("ships the *_v1 policy id and the two-vector mode multipliers", () => {
    expect(dualAswMineEquipmentPolicyId).toBe("dual_asw_mine_equipment_v1");
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT.policyId).toBe("dual_asw_mine_equipment_v1");
  });

  it("dedicated ASW: ASW 10_000, sweeping 0", () => {
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS.DEDICATED_ASW).toEqual({
      aswMultiplierBp: 10_000,
      sweepMultiplierBp: 0,
    });
  });

  it("dedicated sweeping: ASW 0, sweeping 10_000", () => {
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS.DEDICATED_SWEEPING).toEqual({
      aswMultiplierBp: 0,
      sweepMultiplierBp: 10_000,
    });
  });

  it("balanced dual: 7_500 / 7_500", () => {
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS.BALANCED_DUAL).toEqual({
      aswMultiplierBp: 7_500,
      sweepMultiplierBp: 7_500,
    });
  });

  it("ASW-priority dual: 9_000 / 5_000; sweeping-priority dual: 5_000 / 9_000", () => {
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS.ASW_PRIORITY_DUAL).toEqual({
      aswMultiplierBp: 9_000,
      sweepMultiplierBp: 5_000,
    });
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS.SWEEPING_PRIORITY_DUAL).toEqual({
      aswMultiplierBp: 5_000,
      sweepMultiplierBp: 9_000,
    });
  });

  it("no shipped mode grants full ASW AND full sweeping simultaneously", () => {
    for (const mode of DUAL_ASW_MINE_EQUIPMENT_MODES) {
      const m = SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS[mode];
      const bothFull = m.aswMultiplierBp === 10_000 && m.sweepMultiplierBp === 10_000;
      expect(bothFull).toBe(false);
    }
    expect(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT.neverFullAswAndFullSweeping).toBe(true);
  });

  it("validates the shipped contract without throwing; fails closed on tampering", () => {
    expect(() =>
      validateDualAswMineEquipmentContract(SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT),
    ).not.toThrow();

    // a tampered pair (balanced -> 10_000/10_000 full-both) must fail closed
    expect(() =>
      validateDualAswMineEquipmentContract({
        ...SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
        multipliers: {
          ...SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT.multipliers,
          BALANCED_DUAL: { aswMultiplierBp: 10_000, sweepMultiplierBp: 10_000 },
        },
      }),
    ).toThrow(BluewaveError);

    // tampered mode set
    expect(() =>
      validateDualAswMineEquipmentContract({
        ...SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
        modes: [...DUAL_ASW_MINE_EQUIPMENT_MODES, "BOGUS"] as never,
      }),
    ).toThrow(BluewaveError);

    // tampered marker
    expect(() =>
      validateDualAswMineEquipmentContract({
        ...SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT,
        neverFullAswAndFullSweeping: false,
      }),
    ).toThrow(BluewaveError);

    // null/missing
    expect(() => validateDualAswMineEquipmentContract(null)).toThrow(BluewaveError);
  });
});

describe("AC-8: mode resolution — never dual-equipment default on single purpose", () => {
  it("single-purpose equipment sweeps FULL (ASW 0, sweeping 10_000) with no mode", () => {
    const r = resolveDualEquipmentMode(false, undefined);
    expect(r.equipmentIsDualPurpose).toBe(false);
    expect(r.mode).toBe("DEDICATED_SWEEPING"); // full sweep, ASW ignored
    expect(r.aswMultiplierBp).toBe(0);
    expect(r.sweepMultiplierBp).toBe(10_000);
  });

  it("single-purpose equipment NEVER defaults to balanced", () => {
    const r = resolveDualEquipmentMode(false, null);
    expect(r.sweepMultiplierBp).toBe(10_000);
    expect(r.aswMultiplierBp).toBe(0);
    expect(r.sweepMultiplierBp).not.toBe(7_500);
  });

  it("single-purpose equipment claiming a mode -> DUAL_EQUIPMENT_MODE_MISSING", () => {
    expectMissing(() => resolveDualEquipmentMode(false, "ASW_PRIORITY_DUAL"));
  });
});

describe("AC-8: dual-purpose mode resolution", () => {
  it("a locked mode is honored exactly", () => {
    const cases: Array<[DualAswMineEquipmentMode, number, number]> = [
      ["DEDICATED_ASW", 10_000, 0],
      ["DEDICATED_SWEEPING", 0, 10_000],
      ["BALANCED_DUAL", 7_500, 7_500],
      ["ASW_PRIORITY_DUAL", 9_000, 5_000],
      ["SWEEPING_PRIORITY_DUAL", 5_000, 9_000],
    ];
    for (const [mode, asw, sweep] of cases) {
      const r = resolveDualEquipmentMode(true, mode);
      expect(r.equipmentIsDualPurpose).toBe(true);
      expect(r.mode).toBe(mode);
      expect(r.aswMultiplierBp).toBe(asw);
      expect(r.sweepMultiplierBp).toBe(sweep);
    }
  });

  it("missing mode on dual-purpose-declared equipment defaults to balanced ONLY", () => {
    for (const locked of [undefined, null]) {
      const r = resolveDualEquipmentMode(true, locked);
      expect(r.mode).toBe("BALANCED_DUAL");
      expect(r.aswMultiplierBp).toBe(7_500);
      expect(r.sweepMultiplierBp).toBe(7_500);
    }
  });

  it("an unknown mode -> DUAL_EQUIPMENT_MODE_MISSING", () => {
    expectMissing(() => resolveDualEquipmentMode(true, "SWEEP_AND_ASW_BOTH" as never));
  });
});

describe("AC-8: effectiveEquipmentModeMultiplierBp (sweeping purpose)", () => {
  it("returns the swept-mode multiplier of the resolved mode", () => {
    expect(effectiveEquipmentModeMultiplierBp(resolveDualEquipmentMode(false, undefined))).toBe(
      10_000,
    );
    expect(
      effectiveEquipmentModeMultiplierBp(resolveDualEquipmentMode(true, "BALANCED_DUAL")),
    ).toBe(7_500);
    expect(
      effectiveEquipmentModeMultiplierBp(resolveDualEquipmentMode(true, "DEDICATED_ASW")),
    ).toBe(0);
    expect(
      effectiveEquipmentModeMultiplierBp(resolveDualEquipmentMode(true, "ASW_PRIORITY_DUAL")),
    ).toBe(5_000);
  });
});
