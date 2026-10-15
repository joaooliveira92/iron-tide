// packages/commands/test/error-consumers.test.ts
// Regression tests for the migrated CommandError throws: a real consumer that
// catches the throw and reads `error.code` / `error.message` must observe
// exactly what it did before the plain-`Error` → `Data.TaggedError` conversion
// (MIG-WIRE-3, MIG-RUNTIME-1). These drive the public command APIs only.

import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  CommandError,
  CommandRegistry,
  computeSettlement,
  createCommandRecord,
  transitionRecord,
  validateSettlementPolicy,
} from "../src/index.js";
import type { CommandBody, CommandEnvelope, CommandTypeDefinition } from "../src/index.js";

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

describe("CommandError consumer paths (ticket 24 regression)", () => {
  it("an invalid status transition is caught by its stable code", () => {
    const record = makeRecord();
    expect(record.status).toBe("SUBMITTED");

    let caught: unknown;
    try {
      transitionRecord(
        record,
        "COMPLETED",
        "submission",
        "GBR",
        "COMPLETED",
        "0".repeat(64),
        "1910-01-01T00:00:00.000Z",
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    const tagged = caught as CommandError;
    expect(tagged.code).toBe("INVALID_COMMAND_STATUS_TRANSITION");
    expect(tagged.message).toBe("INVALID_COMMAND_STATUS_TRANSITION: SUBMITTED -> COMPLETED");
  });

  it("a settlement policy rejection is caught by its stable code", () => {
    let caught: unknown;
    try {
      validateSettlementPolicy({});
    } catch (error) {
      caught = error;
    }

    const tagged = caught as CommandError;
    expect(tagged.code).toBe("INCOMPLETE_COMMAND_SETTLEMENT_POLICY");
    expect(tagged.message).toBe(
      "INCOMPLETE_COMMAND_SETTLEMENT_POLICY: missing branch postLockPreIrreversibleCancellation",
    );
  });

  it("a settlement invariant rejection reaches the caller as its verbatim message", () => {
    let caught: unknown;
    try {
      computeSettlement(1.5, 0, 0, 0);
    } catch (error) {
      caught = error;
    }

    const tagged = caught as CommandError;
    expect(tagged.message).toBe("INCOMPLETE_COMMAND_SETTLEMENT_POLICY: amounts must be integers");
    expect(tagged.code).toBeUndefined();
  });

  it("a registry issuer-parity rejection is caught by its stable code", () => {
    let caught: unknown;
    try {
      new CommandRegistry().assertIssuerParity("missing", "PLAYER");
    } catch (error) {
      caught = error;
    }

    expect((caught as CommandError).code).toBe("INVALID_COMMAND_TYPE_DEFINITION");
  });
});
