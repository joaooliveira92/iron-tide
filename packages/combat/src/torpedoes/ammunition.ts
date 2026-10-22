import { BluewaveError } from "@bluewave/contracts";
import { EMPTY_TUBE } from "./constants.js";
import { compiledTorpedoOf, type CompiledTorpedoRegistry } from "./registry.js";
import {
  TORPEDO_AMMUNITION_UNAVAILABLE,
  TORPEDO_MODEL_INCOMPATIBLE,
  TORPEDO_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";
import {
  NO_RELOAD_IN_PROGRESS,
  type TorpedoLauncherState,
  type TorpedoReloadState,
  withTorpedoLauncherStateHash,
} from "./state.js";

export interface TorpedoTubeConsumptionAccount {
  tubeIndex: number;
  modelId: string;
  after: typeof EMPTY_TUBE;
}

export interface TorpedoConsumeResult {
  state: TorpedoLauncherState;
  accounts: readonly TorpedoTubeConsumptionAccount[];
}

function invariant(s: TorpedoLauncherState, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function consumeForLaunch(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
): TorpedoConsumeResult {
  if (!Array.isArray(tubeIndexes) || tubeIndexes.length === 0)
    invariant(state, "tubeIndexes", tubeIndexes, "a launch must fire at least one tube");
  if (new Set(tubeIndexes).size !== tubeIndexes.length)
    invariant(
      state,
      "tubeIndexes",
      tubeIndexes,
      "each tube may be fired at most once per launch (duplicate indexes)",
    );

  const accounts: TorpedoTubeConsumptionAccount[] = [];
  for (const tubeIndex of tubeIndexes) {
    if (!Number.isInteger(tubeIndex) || tubeIndex < 0 || tubeIndex >= state.tubeCount)
      invariant(state, `tubeIndex`, tubeIndex, `tube index must be within [0, tubeCount)`);
    const loaded = state.loadedPerTube[tubeIndex];
    if (loaded === EMPTY_TUBE || typeof loaded !== "string" || loaded.length === 0) {
      throw new BluewaveError(TORPEDO_AMMUNITION_UNAVAILABLE, {
        code: TORPEDO_AMMUNITION_UNAVAILABLE,
        reason: "cannot fire a tube with no loaded torpedo to consume",
        tubeIndex,
      });
    }
    accounts.push({ tubeIndex, modelId: loaded, after: EMPTY_TUBE });
  }

  const loadedPerTube = [...state.loadedPerTube];
  for (const account of accounts) {
    loadedPerTube[account.tubeIndex] = EMPTY_TUBE;
  }

  const next = withTorpedoLauncherStateHash({
    ...state,
    loadedPerTube,
  });
  return { state: next, accounts };
}

export function reserveForReload(
  state: TorpedoLauncherState,
  opts: {
    tubeIndex: number;
    modelId: string;
    torpedoes: CompiledTorpedoRegistry;
    compatible: boolean;
    requiredReloadTimeMs: number;
    progressMs?: number;
  },
): { state: TorpedoLauncherState; account: { modelId: string; before: number; after: number } } {
  const { tubeIndex, modelId, compatible, requiredReloadTimeMs } = opts;
  const progressMs = opts.progressMs ?? 0;

  if (!Number.isInteger(tubeIndex) || tubeIndex < 0 || tubeIndex >= state.tubeCount)
    invariant(state, "tubeIndex", tubeIndex, "reload tube index must be within [0, tubeCount)");
  if (typeof modelId !== "string" || modelId.length === 0)
    invariant(state, "modelId", modelId, "reload model id must be a non-empty string");
  if (!Number.isInteger(requiredReloadTimeMs) || requiredReloadTimeMs <= 0)
    invariant(
      state,
      "requiredReloadTimeMs",
      requiredReloadTimeMs,
      "required reload time must be a positive integer ms",
    );
  if (!Number.isInteger(progressMs) || progressMs < 0 || progressMs > requiredReloadTimeMs)
    invariant(
      state,
      "progressMs",
      progressMs,
      "reload progress must be an integer within [0, requiredReloadTimeMs]",
    );

  compiledTorpedoOf(opts.torpedoes, modelId);

  if (state.loadedPerTube[tubeIndex] !== EMPTY_TUBE)
    invariant(
      state,
      "loadedPerTube",
      state.loadedPerTube[tubeIndex],
      "reload into a loaded tube would exceed tube capacity (over-capacity)",
    );
  if (typeof state.reloadState !== "object" || state.reloadState === null)
    invariant(state, "reloadState", state.reloadState, "reloadState must be a record");
  if (state.reloadState.status !== "NO_RELOAD_IN_PROGRESS")
    invariant(
      state,
      "reloadState",
      state.reloadState,
      "a reload is already in progress — no double reservation",
    );

  if (!compatible) {
    throw new BluewaveError(TORPEDO_MODEL_INCOMPATIBLE, {
      code: TORPEDO_MODEL_INCOMPATIBLE,
      reason: "refusing to load an incompatible torpedo model into this launcher",
      modelId,
      tubeIndex,
    });
  }

  const beforeRaw = state.reserveAmmunition[modelId];
  if (beforeRaw === undefined || !Number.isInteger(beforeRaw) || beforeRaw < 1) {
    throw new BluewaveError(TORPEDO_AMMUNITION_UNAVAILABLE, {
      code: TORPEDO_AMMUNITION_UNAVAILABLE,
      reason: "no compatible reserve torpedo of this model is available for reload",
      modelId,
      available: beforeRaw ?? 0,
      tubeIndex,
    });
  }
  const before: number = beforeRaw;

  const reserveAmmunition = { ...state.reserveAmmunition };
  reserveAmmunition[modelId] = before - 1;

  const reloadState: TorpedoReloadState = {
    status: "RELOAD_IN_PROGRESS",
    tubeIndex,
    modelId,
    requiredReloadTimeMs,
    progressMs,
  };

  const next = withTorpedoLauncherStateHash({ ...state, reserveAmmunition, reloadState });
  return { state: next, account: { modelId, before, after: before - 1 } };
}

export function completeTorpedoReload(state: TorpedoLauncherState): TorpedoLauncherState {
  if (typeof state.reloadState !== "object" || state.reloadState === null)
    invariant(state, "reloadState", state.reloadState, "reloadState must be a record");
  if (state.reloadState.status !== "RELOAD_IN_PROGRESS")
    invariant(state, "reloadState", state.reloadState, "no reload is in progress to complete");
  const r = state.reloadState;
  if (r.progressMs < r.requiredReloadTimeMs)
    invariant(
      state,
      "reloadState.progressMs",
      r.progressMs,
      "reload is not yet complete (progressMs < requiredReloadTimeMs)",
    );

  const loadedPerTube = [...state.loadedPerTube];
  loadedPerTube[r.tubeIndex] = r.modelId;

  return withTorpedoLauncherStateHash({
    ...state,
    loadedPerTube,
    reloadState: NO_RELOAD_IN_PROGRESS,
  });
}
