import { BluewaveError } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { DUAL_EQUIPMENT_MODE_MISSING } from "./reasonCodes.js";

export const dualAswMineEquipmentPolicyId = "dual_asw_mine_equipment_v1" as const;

export const DUAL_ASW_MINE_EQUIPMENT_MODES = [
  "DEDICATED_ASW",
  "DEDICATED_SWEEPING",
  "BALANCED_DUAL",
  "ASW_PRIORITY_DUAL",
  "SWEEPING_PRIORITY_DUAL",
] as const;
export type DualAswMineEquipmentMode = (typeof DUAL_ASW_MINE_EQUIPMENT_MODES)[number];

export interface DualAswMineEquipmentMultiplier {
  aswMultiplierBp: number;
  sweepMultiplierBp: number;
}

export const SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS: Readonly<
  Record<DualAswMineEquipmentMode, DualAswMineEquipmentMultiplier>
> = {
  DEDICATED_ASW: { aswMultiplierBp: 10_000, sweepMultiplierBp: 0 },
  DEDICATED_SWEEPING: { aswMultiplierBp: 0, sweepMultiplierBp: 10_000 },
  BALANCED_DUAL: { aswMultiplierBp: 7_500, sweepMultiplierBp: 7_500 },
  ASW_PRIORITY_DUAL: { aswMultiplierBp: 9_000, sweepMultiplierBp: 5_000 },
  SWEEPING_PRIORITY_DUAL: { aswMultiplierBp: 5_000, sweepMultiplierBp: 9_000 },
};

export interface DualAswMineEquipmentContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  modes: readonly DualAswMineEquipmentMode[];
  multipliers: Record<DualAswMineEquipmentMode, DualAswMineEquipmentMultiplier>;
  neverFullAswAndFullSweeping: boolean;
}

export const SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT: DualAswMineEquipmentContract = {
  policyId: dualAswMineEquipmentPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  modes: DUAL_ASW_MINE_EQUIPMENT_MODES,
  multipliers: SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS,
  neverFullAswAndFullSweeping: true,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(DUAL_EQUIPMENT_MODE_MISSING, {
    code: DUAL_EQUIPMENT_MODE_MISSING,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateDualAswMineEquipmentContract(
  c: Partial<DualAswMineEquipmentContract> | null | undefined,
): asserts c is DualAswMineEquipmentContract {
  if (!c) throwMismatch(c, "dual_asw_mine_equipment_v1 missing contract");
  if (c.policyId !== dualAswMineEquipmentPolicyId)
    throwMismatch(c, "dual_asw_mine_equipment_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    throwMismatch(c, "dual_asw_mine_equipment_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "dual_asw_mine_equipment_v1 basis-point scale");
  if (!c.modes || !arrayEquals(c.modes, DUAL_ASW_MINE_EQUIPMENT_MODES))
    throwMismatch(c, "dual_asw_mine_equipment_v1 five-mode closed set");
  if (!c.multipliers || typeof c.multipliers !== "object")
    throwMismatch(c, "dual_asw_mine_equipment_v1 multiplier table missing");
  for (const mode of DUAL_ASW_MINE_EQUIPMENT_MODES) {
    const shipped = SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS[mode];
    const seen = c.multipliers[mode];
    if (
      !seen ||
      seen.aswMultiplierBp !== shipped.aswMultiplierBp ||
      seen.sweepMultiplierBp !== shipped.sweepMultiplierBp
    )
      throwMismatch(c, `dual_asw_mine_equipment_v1 §8 exact multiplier pair for mode ${mode}`);
    if (
      seen.aswMultiplierBp === MINE_BASIS_POINTS_PER_UNIT &&
      seen.sweepMultiplierBp === MINE_BASIS_POINTS_PER_UNIT
    )
      throwMismatch(
        c,
        `dual_asw_mine_equipment_v1 prohibits full ASW + full sweeping simultaneously (mode ${mode})`,
      );
  }
  if (c.neverFullAswAndFullSweeping !== true)
    throwMismatch(c, "dual_asw_mine_equipment_v1 no-full-both invariant flag");
}

export interface ResolvedDualAswMode {
  equipmentIsDualPurpose: boolean;
  mode: DualAswMineEquipmentMode;
  aswMultiplierBp: number;
  sweepMultiplierBp: number;
}

function equipmentModeMismatch(
  equipmentIsDualPurpose: boolean,
  mode: DualAswMineEquipmentMode | null | undefined,
  reason: string,
): never {
  throw new BluewaveError(DUAL_EQUIPMENT_MODE_MISSING, {
    code: DUAL_EQUIPMENT_MODE_MISSING,
    equipmentIsDualPurpose,
    lockedMode: mode,
    reason,
  });
}

export function resolveDualEquipmentMode(
  equipmentIsDualPurpose: boolean,
  lockedMissionOrEquipmentCommand: string | null | undefined,
): ResolvedDualAswMode {
  const locked = lockedMissionOrEquipmentCommand ?? null;
  if (!equipmentIsDualPurpose) {
    if (locked !== null)
      equipmentModeMismatch(
        equipmentIsDualPurpose,
        locked as DualAswMineEquipmentMode,
        "single-purpose equipment must not declare a dual-equipment mode (§8 missing configuration) — it sweeps full and ignores ASW",
      );
    return {
      equipmentIsDualPurpose: false,
      mode: "DEDICATED_SWEEPING",
      aswMultiplierBp: 0,
      sweepMultiplierBp: 10_000,
    };
  }
  if (locked === null) {
    const balanced = SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS.BALANCED_DUAL;
    return {
      equipmentIsDualPurpose: true,
      mode: "BALANCED_DUAL",
      aswMultiplierBp: balanced.aswMultiplierBp,
      sweepMultiplierBp: balanced.sweepMultiplierBp,
    };
  }
  const pair = SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS[locked as DualAswMineEquipmentMode];
  if (!pair)
    equipmentModeMismatch(
      equipmentIsDualPurpose,
      locked as DualAswMineEquipmentMode,
      "unknown ASW/mine-equipment mode — not one of the five shipped §8 modes",
    );
  return {
    equipmentIsDualPurpose: true,
    mode: locked as DualAswMineEquipmentMode,
    aswMultiplierBp: pair.aswMultiplierBp,
    sweepMultiplierBp: pair.sweepMultiplierBp,
  };
}

export function effectiveEquipmentModeMultiplierBp(mode: ResolvedDualAswMode): number {
  return mode.sweepMultiplierBp;
}
