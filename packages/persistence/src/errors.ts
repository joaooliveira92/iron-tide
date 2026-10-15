// PERSISTENCE_* error vocabulary for the save boundary.
//
// The `PERSISTENCE_*` diagnostic codes survive the Zod -> Effect Schema
// migration as in-process `Data.TaggedError`s (MIG-WIRE-1): each code has a
// tagged class whose `_tag` IS the code, so a later wave can recover on it with
// `Effect.catchTag("PERSISTENCE_CORRUPT_SAVE", ...)` — without this package or
// `@bluewave/diagnostics` importing the runtime. `Data.TaggedError` (not
// `Schema.TaggedError`) is deliberate: these errors are raised and handled
// in-process and never cross a wire/serialization boundary.
//
// The `DiagnosticCollector` contract is deliberately retained (adoption ticket
// 06): the tagged errors *add* an error vocabulary, they do not replace the
// collector-based public surface. `toDiagnostic()` projects a tagged error onto
// exactly the `Diagnostic` the collector already accepted, so collector output
// stays byte-identical while the same failure has a typed, `yield*`-able form.

import type { Diagnostic, DiagnosticCode, Severity } from "@bluewave/diagnostics";
import { Data } from "effect";

export const CORRUPT_SAVE_CODE = "PERSISTENCE_CORRUPT_SAVE" as DiagnosticCode;
export const MISSING_SAVE_CODE = "PERSISTENCE_MISSING_SAVE" as DiagnosticCode;
export const CANCELLED_CODE = "PERSISTENCE_CANCELLED" as DiagnosticCode;
export const UNSIGNED_SAVE_CODE = "PERSISTENCE_UNSIGNED_SAVE" as DiagnosticCode;
export const COMPATIBILITY_MISMATCH_CODE = "PERSISTENCE_COMPATIBILITY_MISMATCH" as DiagnosticCode;

/** Fields every PERSISTENCE_* tagged error carries. */
export interface PersistenceErrorFields {
  readonly message: string;
  readonly stage?: string;
  readonly remediation?: string;
}

function projectDiagnostic(
  code: DiagnosticCode,
  error: PersistenceErrorFields,
  severity: Severity,
): Diagnostic {
  return {
    code,
    severity,
    stage: error.stage ?? "unknown",
    message: error.message,
    sourceLocation: undefined,
    entityId: undefined,
    relatedLocations: undefined,
    remediation: error.remediation,
  };
}

export class PersistenceCorruptSaveError extends Data.TaggedError(
  "PERSISTENCE_CORRUPT_SAVE",
)<PersistenceErrorFields> {
  readonly code: DiagnosticCode = CORRUPT_SAVE_CODE;
  toDiagnostic(severity: Severity = "error"): Diagnostic {
    return projectDiagnostic(this.code, this, severity);
  }
}

export class PersistenceMissingSaveError extends Data.TaggedError(
  "PERSISTENCE_MISSING_SAVE",
)<PersistenceErrorFields> {
  readonly code: DiagnosticCode = MISSING_SAVE_CODE;
  toDiagnostic(severity: Severity = "error"): Diagnostic {
    return projectDiagnostic(this.code, this, severity);
  }
}

export class PersistenceCancelledError extends Data.TaggedError(
  "PERSISTENCE_CANCELLED",
)<PersistenceErrorFields> {
  readonly code: DiagnosticCode = CANCELLED_CODE;
  toDiagnostic(severity: Severity = "error"): Diagnostic {
    return projectDiagnostic(this.code, this, severity);
  }
}

export class PersistenceUnsignedSaveError extends Data.TaggedError(
  "PERSISTENCE_UNSIGNED_SAVE",
)<PersistenceErrorFields> {
  readonly code: DiagnosticCode = UNSIGNED_SAVE_CODE;
  toDiagnostic(severity: Severity = "warning"): Diagnostic {
    return projectDiagnostic(this.code, this, severity);
  }
}

export class PersistenceCompatibilityMismatchError extends Data.TaggedError(
  "PERSISTENCE_COMPATIBILITY_MISMATCH",
)<PersistenceErrorFields> {
  readonly code: DiagnosticCode = COMPATIBILITY_MISMATCH_CODE;
  toDiagnostic(severity: Severity = "error"): Diagnostic {
    return projectDiagnostic(this.code, this, severity);
  }
}

/** Every PERSISTENCE_* tagged error — the error channel of the save boundary. */
export type PersistenceError =
  | PersistenceCorruptSaveError
  | PersistenceMissingSaveError
  | PersistenceCancelledError
  | PersistenceUnsignedSaveError
  | PersistenceCompatibilityMismatchError;
