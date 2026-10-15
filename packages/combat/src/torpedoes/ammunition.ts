// DESIGN-40 §3 local ammunition mechanics: every launch consumes exactly one
// loaded torpedo per fired tube; a reload reserves + consumes one compatible
// reserve torpedo and the required reload time. The module NEVER creates
// ammunition, substitutes an incompatible model, or exceeds physical tube and
// magazine capacity — every transition is atomic (all-or-nothing) and returns an
// immutable state with a freshly computed authoritative hash. Failure uses
// TORPEDO_AMMUNITION_UNAVAILABLE or TORPEDO_MODEL_INCOMPATIBLE (structural
// over-capacity / invalid-state attempts fail with TORPEDO_STATE_INVARIANT_FAILED).
// Pure/deterministic: no ambient I/O/clock/random.
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

// Per-tube consumption account: the tube's loaded model before the launch and
// the EMPTY marker after (exactly one torpedo consumed per fired tube).
export interface TorpedoTubeConsumptionAccount {
  tubeIndex: number;
  modelId: string; // the loaded model consumed by this tube
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

// AC-3: consume exactly one loaded torpedo per fired tube, atomically. All
// tubes are validated (integer tube index in range, tube loaded) BEFORE any
// consumption: a launch that includes an EMPTY tube fails entirely with
// TORPEDO_AMMUNITION_UNAVAILABLE and consumes nothing (never partial). The
// reserve is never touched; per-tube totals strictly decrease.
export function consumeForLaunch(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
): TorpedoConsumeResult {
  if (!Array.isArray(tubeIndexes) || tubeIndexes.length === 0)
    invariant(state, "tubeIndexes", tubeIndexes, "a launch must fire at least one tube");
  // F4: a tube may be fired at most once per launch — duplicate indexes would
  // double-count the same torpedo (atomic: nothing is consumed on rejection).
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
      // Failure consumes NO torpedo and yields one explicit reason code.
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

// Reserve + consume one compatible reserve torpedo for a reload of `tubeIndex`.
// Preconditions (fail-closed, in order):
//   - tubeIndex within [0, tubeCount)                -> TORPEDO_STATE_INVARIANT_FAILED
//   - modelId is a shipped catalog model (F5: never trust a caller-supplied
//     compatibility flag for an unknown model)       -> INVALID_TORPEDO_MODEL_DEFINITION
//   - the tube is EMPTY (no over-capacity reload)    -> TORPEDO_STATE_INVARIANT_FAILED
//   - no reload already in progress for the launcher -> TORPEDO_STATE_INVARIANT_FAILED
//   - the model is compatible with the launcher      -> TORPEDO_MODEL_INCOMPATIBLE
//   - at least one compatible reserve is available   -> TORPEDO_AMMUNITION_UNAVAILABLE
// `compatible` is the caller-supplied §4 compatibility verdict; the ammunition
// module never substitutes a model — only the exact `modelId` is reserved and
// later loaded by completeTorpedoReload. The tube stays EMPTY until the reload
// completes; the reload record carries the required reload time.
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

  // F5: the modelId must exist in the battle's compiled-torpedo registry — a
  // caller-supplied `compatible: true` must never open a consumption path for
  // an unknown model (fail-closed with INVALID_TORPEDO_MODEL_DEFINITION).
  compiledTorpedoOf(opts.torpedoes, modelId);

  if (state.loadedPerTube[tubeIndex] !== EMPTY_TUBE)
    invariant(
      state,
      "loadedPerTube",
      state.loadedPerTube[tubeIndex],
      "reload into a loaded tube would exceed tube capacity (over-capacity)",
    );
  // NF-1: a missing reloadState must fail closed — never dereference .status on
  // null/undefined (same guard style as state.ts F3; a raw TypeError would leak).
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

// Complete an in-progress reload once progressMs >= requiredReloadTimeMs: the
// tube is filled with EXACTLY the reserved modelId (no creation, no
// substitution) and the reload state resets. Not-yet-complete or absent reloads
// fail with TORPEDO_STATE_INVARIANT_FAILED.
export function completeTorpedoReload(state: TorpedoLauncherState): TorpedoLauncherState {
  // NF-1: a missing reloadState must fail closed — never dereference .status on
  // null/undefined (same guard style as state.ts F3).
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
