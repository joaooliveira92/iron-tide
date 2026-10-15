import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  CommandError,
  CommandRegistry,
  computeSettlement,
  createCommandRecord,
  ScopedIdempotencyStore,
  validateSettlementPolicy,
} from "../src/index.js";
import type { CommandBody, CommandEnvelope, CommandTypeDefinition } from "../src/index.js";

function isCommandError(value: unknown): value is CommandError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "CommandError"
  );
}

function capture(fn: () => unknown): CommandError {
  try {
    fn();
  } catch (error) {
    if (isCommandError(error)) return error;
    throw error;
  }
  throw new Error("expected a CommandError");
}

function makeDefinition(): CommandTypeDefinition {
  return {
    commandTypeId: "budget_project",
    commandSchemaVersion: "0.1.0",
    allowedIssuerClasses: ["PLAYER"],
    targetAggregateType: "nation",
    submissionPhaseId: "submission",
    authorizationPolicyId: "auth",
    validationPolicyId: "validation",
    reservationPolicyId: "reservation",
    lockPhaseId: "lock",
    irreversiblePhaseId: "irreversible",
    resolutionPhaseId: "resolution",
    cancellationPolicyId: "UNTIL_LOCK",
    settlementPolicyId: "settlement",
    resultSchemaId: "result",
    reasonCodeNamespace: "CORE",
    idempotencyScope: "campaign",
    owningDesignContractId: "design",
    handlerImplementationId: "handler",
    handlerVersion: "1",
    testVectorIds: [],
    contentHash: "hash",
  };
}

function makeRecord(commandId = "cmd-1") {
  const envelope: CommandEnvelope<CommandBody> = {
    commandId,
    version: "0.1.0",
    expectedSnapshotHash: "snapshot-hash",
    idempotencyKey: "idem-1",
    timestamp: "2024-01-01T00:00:00Z",
    body: { type: "budget_project", nationId: "GBR", projectId: "project-1", budget: SafeInt(1) },
  };
  return createCommandRecord(
    envelope,
    makeDefinition(),
    "campaign",
    "1880-01",
    "PLAYER",
    "GBR",
    "GBR",
    "submission",
    0,
    "snapshot-hash",
  );
}

describe("CommandError", () => {
  it("settlement invariant failures are tagged with the verbatim message", () => {
    const error = capture(() => computeSettlement(1.5, 0, 0, 0));
    expect(error._tag).toBe("CommandError");
    expect(error.message).toBe("INCOMPLETE_COMMAND_SETTLEMENT_POLICY: amounts must be integers");
    expect(error.code).toBeUndefined();
  });

  it("settlement policy failures preserve the reason code and message", () => {
    const error = capture(() => validateSettlementPolicy({}));
    expect(error._tag).toBe("CommandError");
    expect(error.code).toBe("INCOMPLETE_COMMAND_SETTLEMENT_POLICY");
    expect(error.message).toBe(
      "INCOMPLETE_COMMAND_SETTLEMENT_POLICY: missing branch postLockPreIrreversibleCancellation",
    );
  });

  it("registry failures preserve the reason code and message", () => {
    const error = capture(() => new CommandRegistry().assertIssuerParity("missing", "PLAYER"));
    expect(error._tag).toBe("CommandError");
    expect(error.code).toBe("INVALID_COMMAND_TYPE_DEFINITION");
    expect(error.message).toBe("INVALID_COMMAND_TYPE_DEFINITION");
  });

  it("lifecycle idempotency conflicts preserve the reason code and message", () => {
    const store = new ScopedIdempotencyStore();
    const definition = makeDefinition();
    store.set(definition, makeRecord("cmd-1"));
    const error = capture(() => store.set(definition, makeRecord("cmd-2")));
    expect(error._tag).toBe("CommandError");
    expect(error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(error.message).toBe("Idempotency key idem-1 already used by cmd-1");
  });
});
