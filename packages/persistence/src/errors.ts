import type { Diagnostic, DiagnosticCode, Severity } from "@bluewave/diagnostics";
import { Data } from "effect";

export const CORRUPT_SAVE_CODE = "PERSISTENCE_CORRUPT_SAVE" as DiagnosticCode;
export const MISSING_SAVE_CODE = "PERSISTENCE_MISSING_SAVE" as DiagnosticCode;
export const LEGACY_SAVE_CODE = "PERSISTENCE_LEGACY_SAVE" as DiagnosticCode;
export const COMPATIBILITY_MISMATCH_CODE = "PERSISTENCE_COMPATIBILITY_MISMATCH" as DiagnosticCode;
export const IO_CODE = "PERSISTENCE_IO" as DiagnosticCode;

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

export class PersistenceLegacySaveError extends Data.TaggedError(
  "PERSISTENCE_LEGACY_SAVE",
)<PersistenceErrorFields> {
  readonly code: DiagnosticCode = LEGACY_SAVE_CODE;
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

export class PersistenceIoError extends Data.TaggedError("PERSISTENCE_IO")<PersistenceErrorFields> {
  readonly code: DiagnosticCode = IO_CODE;
  toDiagnostic(severity: Severity = "error"): Diagnostic {
    return projectDiagnostic(this.code, this, severity);
  }
}

export class PersistenceInvalidOptionError extends Data.TaggedError(
  "PERSISTENCE_INVALID_OPTION",
)<PersistenceErrorFields> {}

export type PersistenceError =
  | PersistenceCorruptSaveError
  | PersistenceMissingSaveError
  | PersistenceCompatibilityMismatchError;
