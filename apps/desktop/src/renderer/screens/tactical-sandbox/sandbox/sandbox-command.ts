import type { BridgeResult } from "../../../../shared/bridge-contract.js";

export function describeSandboxFailure(result: {
  readonly reason: string;
  readonly diagnostics: readonly string[];
}): string {
  return result.diagnostics.length > 0
    ? `${result.reason} — ${result.diagnostics.join(" ")}`
    : result.reason;
}

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
