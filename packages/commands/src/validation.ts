import type { CampaignSnapshot } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCode } from "@bluewave/diagnostics";
import type { CommandBody, CommandEnvelope } from "./envelope.js";
import { CommandError } from "./errors.js";
import type {
  CommandOutcome,
  CommandRecord,
  CommandTypeDefinition,
  CommandValidationRecord,
  LifecycleStepResult,
} from "./types.js";

export type PredicateResult = { predicateId: string; passed: boolean; reasonCode?: string };

export function rejectValidation(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
  code: string,
  message: string,
): LifecycleStepResult {
  const snapshotHash = sha256Hex(canonicalSerialize(snapshot));
  const outcome: CommandOutcome = {
    type: "rejected",
    commandId: envelope.commandId,
    snapshotHash,
    diagnostic: { code: code as DiagnosticCode, severity: "error", stage: "validate", message },
  };
  return { ok: false, outcome };
}

export function createValidationRecord(
  command: CommandRecord,
  policyId: string,
  policyVersion: string,
  inputSnapshotHash: string,
  predicateResults: PredicateResult[],
  failurePriority: Record<string, number> | undefined,
): CommandValidationRecord {
  const failed = predicateResults.filter((r) => !r.passed);
  let primaryReasonCode = "COMMAND_COMPLETED";
  let diagnosticReasonCodes: string[] = [];
  if (failed.length > 0) {
    diagnosticReasonCodes = failed.map((f) => f.reasonCode ?? "UNKNOWN").sort();
    let best: PredicateResult | undefined;
    let bestPriority = Infinity;
    for (const f of failed) {
      const prio = failurePriority?.[f.reasonCode ?? ""] ?? 999;
      if (
        prio < bestPriority ||
        (prio === bestPriority && (f.reasonCode ?? "") < (best?.reasonCode ?? "ZZZ"))
      ) {
        best = f;
        bestPriority = prio;
      }
    }
    primaryReasonCode = best?.reasonCode ?? diagnosticReasonCodes[0]!;
  }
  const rec: CommandValidationRecord = {
    commandId: command.commandId,
    validationPolicyId: policyId,
    validationPolicyVersion: policyVersion,
    inputSnapshotHash,
    orderedPredicateResults: [...predicateResults].sort((a, b) =>
      a.predicateId.localeCompare(b.predicateId),
    ),
    canonicalPayloadHash: command.canonicalPayloadHash,
    validationResult: failed.length === 0 ? "PASSED" : "FAILED",
    primaryReasonCode,
    diagnosticReasonCodes,
    validationRecordHash: "",
  };
  return { ...rec, validationRecordHash: sha256Hex(canonicalSerialize(rec)) };
}

export function pureValidate(
  command: CommandRecord,
  definition: CommandTypeDefinition,
  snapshot: unknown,
  snapshotHash: string,
  predicates: Array<(cmd: CommandRecord, snap: unknown) => PredicateResult>,
): CommandValidationRecord {
  const before = sha256Hex(canonicalSerialize(snapshot));
  const results = predicates.map((p) => p(command, snapshot));
  const after = sha256Hex(canonicalSerialize(snapshot));
  if (before !== after)
    throw new CommandError({
      code: "DIRECT_COMMAND_STATE_MUTATION_PROHIBITED",
      message: "DIRECT_COMMAND_STATE_MUTATION_PROHIBITED: validation mutated snapshot",
    });
  return createValidationRecord(
    command,
    definition.validationPolicyId,
    definition.commandSchemaVersion,
    snapshotHash,
    results,
    definition.validationFailurePriority,
  );
}
