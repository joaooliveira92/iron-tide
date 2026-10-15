//packages/combat/src/mines/dual-equipment.ts
// DESIGN-35 §8 dual ASW/mine equipment (INC-3). Equipment configured for
// simultaneous ASW and mine sweeping MUST use `dual_asw_mine_equipment_v1`
// (SHIPPED_DUAL_ASW_MINE_EQUIPMENT_CONTRACT + validate guard, fail-closed like
// INC-1's mine_type_definitions_v1 guard). The five shipped modes carry exact
// §8 multiplier pairs { aswMultiplierBp, sweepMultiplierBp }:
//   dedicated ASW           10_000 /     0
//   dedicated sweeping          0 / 10_000
//   balanced dual           7_500 / 7_500
//   ASW-priority dual       9_000 / 5_000
//   sweeping-priority dual  5_000 / 9_000
//
// Mode MUST be selected by a locked mission or equipment command BEFORE
// resolution (§8). Resolution rules (narrow ticket-04 reading of §8 "Missing
// mode MUST default to the explicit shipped balanced dual mode ONLY when the
// installed equipment is declared dual-purpose. Other missing configurations
// MUST fail with DUAL_EQUIPMENT_MODE_MISSING"):
//   - equipment NOT declared dual-purpose -> single-purpose (sweeping only):
//     full sweeping 10_000, ASW ignored 0 — NEVER defaulted to balanced. A
//     declared mode on single-purpose equipment is a missing configuration and
//     fails with DUAL_EQUIPMENT_MODE_MISSING;
//   - equipment declared dual-purpose WITH a locked mode -> that mode's exact
//     multiplier pair (an unknown mode fails DUAL_EQUIPMENT_MODE_MISSING);
//   - equipment declared dual-purpose WITHOUT a locked mode -> balanced dual
//     (7_500/7_500) ONLY.
//
// A ship MUST NEVER receive full ASW and full sweeping simultaneously (§8): no
// shipped mode has both multipliers at 10_000 and no resolution path can
// produce that pair — proven structurally by the contract guard so future
// drift fails closed at validation time.
// Pure/deterministic: no I/O/clock/random; fixed integer constants only.
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
  /** ASW capability multiplier in basis points (integer 0..10_000). */
  aswMultiplierBp: number;
  /** Mine-sweeping capability multiplier in basis points (integer 0..10_000). */
  sweepMultiplierBp: number;
}

// Exact §8 shipped five-mode table. Every mode identifies exactly its shipped
// multiplier pair — never invented or inferred.
export const SHIPPED_DUAL_ASW_MINE_EQUIPMENT_MULTIPLIERS: Readonly<
  Record<DualAswMineEquipmentMode, DualAswMineEquipmentMultiplier>
> = {
  DEDICATED_ASW: { aswMultiplierBp: 10_000, sweepMultiplierBp: 0 }, // §8 literal
  DEDICATED_SWEEPING: { aswMultiplierBp: 0, sweepMultiplierBp: 10_000 }, // §8 literal
  BALANCED_DUAL: { aswMultiplierBp: 7_500, sweepMultiplierBp: 7_500 }, // §8 literal
  ASW_PRIORITY_DUAL: { aswMultiplierBp: 9_000, sweepMultiplierBp: 5_000 }, // §8 literal
  SWEEPING_PRIORITY_DUAL: { aswMultiplierBp: 5_000, sweepMultiplierBp: 9_000 }, // §8 literal
};

export interface DualAswMineEquipmentContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  modes: readonly DualAswMineEquipmentMode[];
  // Serialized body: per-mode exact multiplier pairs.
  multipliers: Record<DualAswMineEquipmentMode, DualAswMineEquipmentMultiplier>;
  // §8 "never full ASW and full sweeping simultaneously" invariant, shipped as
  // part of the contract so the fail-closed guard can prove it structurally.
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

// AC-8: fail-closed guard over the §8 five-mode table. A tampered/partial/
// unknown mode set or multiplier pair never passes; the "no full ASW + full
// sweeping" invariant is proven from the shipped numbers themselves so any
// future drift fails here instead of at resolution time.
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
    // §8 hard invariant per mode: both at 10_000 would grant full ASW AND full
    // sweeping simultaneously — structurally impossible in the shipped table.
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

// ---- §8 mode resolution ----

export interface ResolvedDualAswMode {
  /** true when the installed equipment is declared dual-purpose (§8). */
  equipmentIsDualPurpose: boolean;
  /** The resolved mode identity (DEDICATED_SWEEPING for the single-purpose sweeping-only profile; BALANCED_DUAL for the no-lock dual-purpose default). */
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

// AC-8: resolve §8 mode BEFORE the effective-value product. Rules per the
// narrow ticket-04 reading documented at the top of this module:
//   - single-purpose equipment -> DEDICATED_SWEEPING numbers (sweep 10_000,
//     ASW 0). A locked mode on single-purpose equipment is a missing config.
//   - dual-purpose equipment + locked mode -> that exact mode pair.
//   - dual-purpose equipment + no locked mode -> BALANCED_DUAL (7_500/7_500)
//     ONLY. No other implicit default ever occurs.
// lockedMissionOrEquipmentCommand is a plain string (not just the typed union)
// so an unknown/deserialized mode fails closed with DUAL_EQUIPMENT_MODE_MISSING
// instead of being silently accepted or cast.
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
    // Missing mode on dual-purpose-declared equipment: the explicit shipped
    // balanced mode ONLY (ticket 04 narrow reading).
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

// AC-8: the sweeping-mode multiplier of a resolved §8 mode — the sweep
// component used as equipmentModeMultiplierBp in the §9 product. For
// single-purpose sweeping equipment this is full 10_000 (the resolved record
// above always carries it); a dual mode yields its shipped sweep multiplier.
export function effectiveEquipmentModeMultiplierBp(mode: ResolvedDualAswMode): number {
  return mode.sweepMultiplierBp;
}
