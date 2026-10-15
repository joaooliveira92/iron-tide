import type { BridgeResult } from "../../../../shared/bridge-contract.js";

/**
 * The engine's stable reason code, followed by its diagnostics when it gave any.
 * The sandbox surfaces a rejection and a transport error with the same shape, so
 * both funnel through here.
 */
export function describeSandboxFailure(result: {
  readonly reason: string;
  readonly diagnostics: readonly string[];
}): string {
  return result.diagnostics.length > 0
    ? `${result.reason} — ${result.diagnostics.join(" ")}`
    : result.reason;
}

/**
 * Fold one sandbox transport result into a state transition. A success adopts
 * the value; a rejection and a transport error both become the same failure
 * text. Keeps the three-outcome envelope out of every command handler.
 */
export function foldSandboxResult<State, Value>(
  result: BridgeResult<Value>,
  folds: {
    readonly success: (state: State, value: Value) => State;
    readonly failure: (state: State, error: string) => State;
  },
): (state: State) => State {
  return (state) => {
    if (result.outcome === "success") return folds.success(state, result.value);
    return folds.failure(state, describeSandboxFailure(result));
  };
}
