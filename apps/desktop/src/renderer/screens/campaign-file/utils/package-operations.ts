import type { BridgeResult } from "../../../../shared/bridge-contract.js";
import type {
  RecoverCampaignResponse,
  ReplayCampaignResponse,
  VerifyCampaignResponse,
} from "../../../../shared/continuity-contract.js";
import type { OperationKind, OperationResult } from "../types.js";

const OPERATION_LABELS: Readonly<Record<OperationKind, string>> = {
  verify: "Verifying package…",
  replay: "Replaying campaign…",
  recover: "Recovering package…",
};

export function operationPendingLabel(kind: OperationKind): string {
  return OPERATION_LABELS[kind];
}

export function verificationResultFromBridge(
  result: BridgeResult<VerifyCampaignResponse>,
): OperationResult {
  if (result.outcome === "success") return { kind: "verify", response: result.value };
  return operationError("Verification failed", result);
}

export function replayResultFromBridge(
  result: BridgeResult<ReplayCampaignResponse>,
): OperationResult {
  if (result.outcome === "success") return { kind: "replay", response: result.value };
  return operationError("Replay failed", result);
}

export function recoveryResultFromBridge(
  result: BridgeResult<RecoverCampaignResponse>,
): OperationResult {
  if (result.outcome === "success") return { kind: "recover", response: result.value };
  return operationError("Recovery failed", result);
}

function operationError(
  label: string,
  result: Exclude<BridgeResult<never>, { outcome: "success" }>,
): OperationResult {
  const diagnostics = result.diagnostics.length > 0 ? ` — ${result.diagnostics.join("; ")}` : "";
  return {
    kind: "error",
    message: `${label}: ${result.reason}${diagnostics}`,
  };
}
