//packages/combat/src/torpedoes/salvo.ts
// DESIGN-40 §11 salvo policy (INC-3): a DETERMINISTIC recommendation over the
// nine §11 factors with authored constants — never random. The recommended
// salvo SIZE is
//   clamp(TORPEDO_SALVO_MIN_TUBES,
//         floor(scoreBp / TORPEDO_SALVO_BP_PER_TUBE),
//         maxTubes)
// where scoreBp is the sum of the base-tubes term, the withdrawal modifier, and
// seven floored weighted factor terms (each floor(bpInput * weightBp / 10_000)).
//
// Authored factor directions (documented BALANCE TARGET, constants.ts):
//   targetCombatValue        +  high-value target -> guarantee the kill
//   targetSize               +  larger hull -> more hits needed to sink
//   rangePressure            +  longer range -> dispersion demands more tubes
//   solutionQualityDeficit   +  poor (but legal) solution -> compensate
//   ammoScarcity             -  few torpedoes left -> conserve (smaller salvo)
//   friendlyCoveragePressure +  no friendly launchers -> this ship must cover
//   overkill                 -  estimated overkill -> fewer tubes
//   missionObjective         base tubes (ATTACK 2 / DEFENSE 1 / AREA_DENIAL 4 /
//                             BREAKTHROUGH 3)
//   withdrawalState          WITHDRAWING adds a parting-salvo tube
//
// The salvo also VALIDATES an explicit tube selection (exact tube identifiers,
// unique, integer, within [0, tubeCount), never more tubes than the launcher
// physically has -> TORPEDO_STATE_INVARIANT_FAILED on structural violation) and
// enforces the launcher arc for every selected tube's launch bearing
// (TORPEDO_LAUNCH_ARC_INVALID). Ammunition reservation is the INC-1 atomic
// consumeForLaunch, exposed here as reserveSalvoTorpedoes (all-or-nothing: a
// salvo that includes an EMPTY tube consumes NOTHING).
import { BluewaveError } from "@bluewave/contracts";
import {
  EMPTY_TUBE,
  TORPEDO_MISSION_OBJECTIVES,
  TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE,
  TORPEDO_SALVO_BASE_TUBES,
  TORPEDO_SALVO_BP_PER_TUBE,
  TORPEDO_SALVO_FACTOR_WEIGHTS_BP,
  TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE,
  TORPEDO_SALVO_MIN_TUBES,
  TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE,
  TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES,
  TORPEDO_SOLUTION_FINAL_MAX_BP,
  TORPEDO_WITHDRAWAL_STATES,
  type TorpedoMissionObjective,
  type TorpedoWithdrawalState,
} from "./constants.js";
import { consumeForLaunch, type TorpedoConsumeResult } from "./ammunition.js";
import { TORPEDO_LAUNCH_ARC_INVALID, TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import type { TorpedoLauncherState } from "./state.js";

// The nine §11 factors, decoupled from launcher state so the policy is purely
// a function of the tactical situation. All numeric fields are integers.
export interface TorpedoSalvoPolicyInputs {
  missionObjective: TorpedoMissionObjective;
  withdrawalState: TorpedoWithdrawalState;
  targetCombatValueBp: number; // [0, 10_000] — combat value of the target
  targetSizeBp: number; // [0, 10_000] — target size/displacement class
  targetEstimatedRangeM: number; // integer metres (range-pressure band lookup)
  solutionQualityBp: number; // [0, 10_000] — §10 solution quality (deficit term)
  remainingTotalAmmunition: number; // integer count >= 0 — loaded + reserve torpedoes
  friendlyLauncherCount: number; // integer count >= 0 — friendly launchers in range
  overkillEstimateBp: number; // [0, 10_000] — estimated overkill (0 = none)
}

export interface TorpedoSalvoPolicyResult {
  recommendedSize: number; // integer tubes, clamped to [1, maxTubes]
  scoreBp: number; // the exact integer basis-point score before the clamp
  band: {
    rangePressureBp: number;
    ammoScarcityBp: number;
    friendlyCoveragePressureBp: number;
  };
}

function invariant(value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    reason,
    value,
  });
}

// Lookup helpers over the authored band tables (first band whose bound matches;
// the final band covers Number.MAX_SAFE_INTEGER so the fallback is unreachable,
// but it still fails closed instead of returning a silent value).
function lastBand<T>(table: readonly T[]): T {
  const last = table[table.length - 1];
  if (last === undefined) invariant(undefined, "a salvo band table must not be empty");
  return last;
}

function rangePressureBp(rangeM: number): number {
  for (const band of TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE) {
    if (rangeM <= band.maxRangeM) return band.pressureBp;
  }
  return lastBand(TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE).pressureBp;
}

function ammoScarcityBp(remaining: number): number {
  for (const band of TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE) {
    if (remaining >= band.minAmmo) return band.scarcityBp;
  }
  return lastBand(TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE).scarcityBp;
}

function friendlyCoveragePressureBp(count: number): number {
  for (const band of TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE) {
    if (count <= band.maxCount) return band.pressureBp;
  }
  return lastBand(TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE).pressureBp;
}

// Pure INTEGER floor of a weighted basis-point term: floor(valueBp * weightBp /
// 10_000). Both operands are bounded (valueBp in [0, 10_000], weightBp <= 1_500,
// so the product <= 1.5e7 — an exact double well below 2^53) and non-negative.
// Written as integer math — (P - P % 10_000) / 10_000 — so no float rounding of
// the division can ever nudge the floor across an integer boundary.
function weighted(weightBp: number, valueBp: number): number {
  const product = weightBp * valueBp; // exact integer double (bounded reduction)
  return (product - (product % 10_000)) / 10_000; // integer division, exact
}

// Fail-closed policy-input guard (mirrors assertEligibilityInputs in
// eligibility.ts): every numeric policy input must be an integer in its
// authored range and the enums must be canonical members — a deserialized
// garbage objective must never index the base-tube table into NaN.
function assertSalvoPolicyInputs(policy: TorpedoSalvoPolicyInputs): void {
  if (!(TORPEDO_MISSION_OBJECTIVES as readonly string[]).includes(policy.missionObjective))
    invariant(policy.missionObjective, "missionObjective must be a canonical §11 objective");
  if (!(TORPEDO_WITHDRAWAL_STATES as readonly string[]).includes(policy.withdrawalState))
    invariant(policy.withdrawalState, "withdrawalState must be a canonical §11 withdrawal state");
  const bpFields: { key: string; value: number }[] = [
    { key: "targetCombatValueBp", value: policy.targetCombatValueBp },
    { key: "targetSizeBp", value: policy.targetSizeBp },
    { key: "solutionQualityBp", value: policy.solutionQualityBp },
    { key: "overkillEstimateBp", value: policy.overkillEstimateBp },
  ];
  for (const { key, value } of bpFields) {
    if (!Number.isInteger(value) || value < 0 || value > TORPEDO_SOLUTION_FINAL_MAX_BP)
      invariant(
        value,
        `${key} must be an integer basis point within [0, ${TORPEDO_SOLUTION_FINAL_MAX_BP}]`,
      );
  }
  if (!Number.isInteger(policy.targetEstimatedRangeM) || policy.targetEstimatedRangeM < 0)
    invariant(
      policy.targetEstimatedRangeM,
      "targetEstimatedRangeM must be a non-negative integer metres",
    );
  if (!Number.isInteger(policy.remainingTotalAmmunition) || policy.remainingTotalAmmunition < 0)
    invariant(
      policy.remainingTotalAmmunition,
      "remainingTotalAmmunition must be a non-negative integer count",
    );
  if (!Number.isInteger(policy.friendlyLauncherCount) || policy.friendlyLauncherCount < 0)
    invariant(
      policy.friendlyLauncherCount,
      "friendlyLauncherCount must be a non-negative integer count",
    );
}

// AC-11: the deterministic salvo-size recommendation. The caller supplies
// maxTubes = min(launcher tubeCount, loaded tubes) so the policy never
// recommends a salvo the launcher cannot physically fire.
export function recommendSalvoSize(
  policy: TorpedoSalvoPolicyInputs,
  maxTubes: number,
): TorpedoSalvoPolicyResult {
  if (!Number.isInteger(maxTubes) || maxTubes < 1)
    invariant(maxTubes, "maxTubes must be a positive integer");
  assertSalvoPolicyInputs(policy);

  const rangeBp = rangePressureBp(policy.targetEstimatedRangeM);
  const scarcityBp = ammoScarcityBp(policy.remainingTotalAmmunition);
  const coverageBp = friendlyCoveragePressureBp(policy.friendlyLauncherCount);

  const baseTerm = TORPEDO_SALVO_BASE_TUBES[policy.missionObjective] * TORPEDO_SALVO_BP_PER_TUBE;
  const withdrawalTerm =
    TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES[policy.withdrawalState] * TORPEDO_SALVO_BP_PER_TUBE;
  const combatTerm = weighted(
    TORPEDO_SALVO_FACTOR_WEIGHTS_BP.targetCombatValue,
    policy.targetCombatValueBp,
  );
  const sizeTerm = weighted(TORPEDO_SALVO_FACTOR_WEIGHTS_BP.targetSize, policy.targetSizeBp);
  const rangeTerm = weighted(TORPEDO_SALVO_FACTOR_WEIGHTS_BP.rangePressure, rangeBp);
  const qualityDeficitTerm = weighted(
    TORPEDO_SALVO_FACTOR_WEIGHTS_BP.solutionQualityDeficit,
    10_000 - policy.solutionQualityBp,
  );
  const scarcityTerm = -weighted(TORPEDO_SALVO_FACTOR_WEIGHTS_BP.ammoScarcity, scarcityBp);
  const coverageTerm = weighted(
    TORPEDO_SALVO_FACTOR_WEIGHTS_BP.friendlyCoveragePressure,
    coverageBp,
  );
  const overkillTerm = -weighted(
    TORPEDO_SALVO_FACTOR_WEIGHTS_BP.overkill,
    policy.overkillEstimateBp,
  );

  const scoreBp =
    baseTerm +
    withdrawalTerm +
    combatTerm +
    sizeTerm +
    rangeTerm +
    qualityDeficitTerm +
    scarcityTerm +
    coverageTerm +
    overkillTerm;

  const recommendedSize = Math.min(
    maxTubes,
    Math.max(TORPEDO_SALVO_MIN_TUBES, Math.floor(scoreBp / TORPEDO_SALVO_BP_PER_TUBE)),
  );

  return {
    recommendedSize,
    scoreBp,
    band: {
      rangePressureBp: rangeBp,
      ammoScarcityBp: scarcityBp,
      friendlyCoveragePressureBp: coverageBp,
    },
  };
}

// AC-11: validate an explicit salvo tube selection — exact tube identifiers,
// unique, integers within [0, tubeCount), and never more than the physical tube
// count. A structural violation fails closed with TORPEDO_STATE_INVARIANT_FAILED
// (the same guard consumeForLaunch applies; a command-layer salvo may not
// invent tubes).
export function validateSalvoTubeSelection(
  tubeIndexes: readonly number[],
  tubeCount: number,
): void {
  if (!Array.isArray(tubeIndexes) || tubeIndexes.length === 0)
    invariant(tubeIndexes, "a salvo must select at least one tube");
  if (!Number.isInteger(tubeCount) || tubeCount < 1)
    invariant(tubeCount, "tubeCount must be a positive integer");
  if (tubeIndexes.length > tubeCount)
    invariant(tubeIndexes, "a salvo cannot exceed the launcher's physical tube count");
  for (const idx of tubeIndexes) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= tubeCount)
      invariant(tubeIndexes, `each tube index must be an integer within [0, ${tubeCount})`);
  }
  if (new Set(tubeIndexes).size !== tubeIndexes.length)
    invariant(tubeIndexes, "each tube may be fired at most once per salvo (duplicate indexes)");
}

// AC-11: every selected tube's launch bearing must lie within the launcher
// training limits (the §2 state models the arc at launcher level; per-tube
// bearing offsets are not modeled — recorded seam). A selected tube outside the
// arc fails with TORPEDO_LAUNCH_ARC_INVALID (never a silent skip).
export function assertSalvoTubesWithinArc(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
  targetRelativeBearingMdeg: number,
): void {
  validateSalvoTubeSelection(tubeIndexes, state.tubeCount);
  if (
    targetRelativeBearingMdeg < state.trainingLimitsMdeg.min ||
    targetRelativeBearingMdeg > state.trainingLimitsMdeg.max
  ) {
    throw new BluewaveError(TORPEDO_LAUNCH_ARC_INVALID, {
      code: TORPEDO_LAUNCH_ARC_INVALID,
      reason: "the launch bearing is outside the launcher training limits",
      targetRelativeBearingMdeg,
      trainingLimitsMdeg: state.trainingLimitsMdeg,
    });
  }
}

// AC-11: deterministic tube selection for a recommended/requested salvo size —
// the canonical §12 ascending-tube-identifier order over LOADED tubes (an EMPTY
// tube cannot fire). Returns exactly min(size, loadedCount) tube identifiers.
export function selectSalvoTubes(state: TorpedoLauncherState, size: number): readonly number[] {
  if (!Number.isInteger(size) || size < 1) invariant(size, "salvo size must be a positive integer");
  const loaded: number[] = [];
  for (let idx = 0; idx < state.tubeCount; idx++) {
    const loadedModel = state.loadedPerTube[idx];
    if (loadedModel !== EMPTY_TUBE && typeof loadedModel === "string" && loadedModel.length > 0) {
      loaded.push(idx);
    }
  }
  return loaded.slice(0, Math.min(size, loaded.length));
}

// AC-11: ATOMIC ammunition reservation for a salvo — the INC-1 consumeForLaunch
// (all-or-nothing: a salvo including an EMPTY or invalid tube consumes NOTHING
// and throws TORPEDO_AMMUNITION_UNAVAILABLE / TORPEDO_STATE_INVARIANT_FAILED).
// This is the stable salvo-layer name INC-7 calls; the underlying atomicity is
// proven by the ammunition tests + the salvo integration test.
export function reserveSalvoTorpedoes(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
): TorpedoConsumeResult {
  validateSalvoTubeSelection(tubeIndexes, state.tubeCount);
  return consumeForLaunch(state, tubeIndexes);
}
