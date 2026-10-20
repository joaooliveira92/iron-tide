// Ticket 30 (audit rescope) — the foundation `throw`s in snapshotClone
// and financial-ledger are `PhaseEngineError` (a runtime-free
// `Data.TaggedError`) instead of plain `Error` / `Object.assign(Error, {code})`.
// These tests prove the tagged error carries the verbatim `message` and the
// preserved `code`, so in-process callers that match on either are unaffected
// (MIG-RUNTIME-1, MIG-DET-1). Each case drives a public API (`cloneSnapshot`,
// `FinancialLedger.append`) with a typed fixture; no `as any` casts.

import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { FinancialLedger, PhaseEngineError } from "../src/index.js";
import { cloneSnapshot } from "../src/snapshotClone.js";
import { makeBattleSnapshot } from "./battle-fixtures.js";

function isPhaseEngineError(value: unknown): value is PhaseEngineError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "PhaseEngineError"
  );
}

function capture(fn: () => unknown): PhaseEngineError {
  try {
    fn();
  } catch (error) {
    if (isPhaseEngineError(error)) return error;
    throw error;
  }
  throw new Error("expected a PhaseEngineError");
}

describe("PhaseEngineError", () => {
  it("is a tagged, in-process Error subclass", () => {
    const error = new PhaseEngineError({ message: "boom" });
    expect(error).toBeInstanceOf(Error);
    expect(error._tag).toBe("PhaseEngineError");
    expect(error.message).toBe("boom");
    expect(error.code).toBeUndefined();
  });

  it("carries an explicit code when one is supplied", () => {
    const error = new PhaseEngineError({
      message: "INVALID_COMMAND_STATUS_TRANSITION: COMPLETED -> SUBMITTED",
      code: "INVALID_COMMAND_STATUS_TRANSITION",
    });
    expect(error.code).toBe("INVALID_COMMAND_STATUS_TRANSITION");
    expect(error.message).toBe("INVALID_COMMAND_STATUS_TRANSITION: COMPLETED -> SUBMITTED");
  });

  it("snapshotClone: non-null snapshot failure is tagged with the verbatim message", () => {
    // @ts-expect-error deliberately pass null to prove the runtime non-null guard.
    const error = capture(() => cloneSnapshot(null));
    expect(error._tag).toBe("PhaseEngineError");
    expect(error.message).toBe("cloneSnapshot: snapshot must be a non-null object");
    expect(error.code).toBeUndefined();
  });

  it("snapshotClone: a circular reference is tagged with the verbatim message", () => {
    const snapshot = makeBattleSnapshot();
    const shells: Record<string, unknown> = {};
    shells["self"] = shells;
    const circular = { ...snapshot, politics: { ...snapshot.politics, shells } };
    const error = capture(() => cloneSnapshot(circular));
    expect(error._tag).toBe("PhaseEngineError");
    expect(error.message).toBe("cloneValue: circular reference detected");
    expect(error.code).toBeUndefined();
  });

  it("financial-ledger: unbalanced transaction failure is tagged with the verbatim message", () => {
    const error = capture(() =>
      new FinancialLedger().append({
        campaignMonth: "1880-01",
        phaseId: "command_collection_resolution",
        nationId: "GBR",
        categoryId: "SETTLEMENT",
        debit: SafeInt(3),
        credit: SafeInt(4),
        previousBalance: SafeInt(0),
        newBalance: SafeInt(0),
        reason: "test",
      }),
    );
    expect(error._tag).toBe("PhaseEngineError");
    expect(error.message).toBe("Unbalanced ledger transaction: debit 3 != credit 4");
    expect(error.code).toBeUndefined();
  });
});
