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

export interface TorpedoSalvoPolicyInputs {
  missionObjective: TorpedoMissionObjective;
  withdrawalState: TorpedoWithdrawalState;
  targetCombatValueBp: number;
  targetSizeBp: number;
  targetEstimatedRangeM: number;
  solutionQualityBp: number;
  remainingTotalAmmunition: number;
  friendlyLauncherCount: number;
  overkillEstimateBp: number;
}

export interface TorpedoSalvoPolicyResult {
  recommendedSize: number;
  scoreBp: number;
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

function weighted(weightBp: number, valueBp: number): number {
  const product = weightBp * valueBp;
  return (product - (product % 10_000)) / 10_000;
}

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

export function reserveSalvoTorpedoes(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
): TorpedoConsumeResult {
  validateSalvoTubeSelection(tubeIndexes, state.tubeCount);
  return consumeForLaunch(state, tubeIndexes);
}
