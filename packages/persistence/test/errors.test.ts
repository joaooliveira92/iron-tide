import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  CANCELLED_CODE,
  COMPATIBILITY_MISMATCH_CODE,
  CORRUPT_SAVE_CODE,
  MISSING_SAVE_CODE,
  PersistenceCancelledError,
  PersistenceCompatibilityMismatchError,
  PersistenceCorruptSaveError,
  PersistenceMissingSaveError,
  PersistenceLegacySaveError,
  LEGACY_SAVE_CODE,
} from "../src/errors.js";

describe("PERSISTENCE_* tagged errors (MIG-WIRE-1)", () => {
  it("carries each code as both its _tag and its code field", () => {
    const cases = [
      [
        new PersistenceCorruptSaveError({ message: "m" }),
        CORRUPT_SAVE_CODE,
        "PERSISTENCE_CORRUPT_SAVE",
      ],
      [
        new PersistenceMissingSaveError({ message: "m" }),
        MISSING_SAVE_CODE,
        "PERSISTENCE_MISSING_SAVE",
      ],
      [new PersistenceCancelledError({ message: "m" }), CANCELLED_CODE, "PERSISTENCE_CANCELLED"],
      [
        new PersistenceLegacySaveError({ message: "m" }),
        LEGACY_SAVE_CODE,
        "PERSISTENCE_LEGACY_SAVE",
      ],
      [
        new PersistenceCompatibilityMismatchError({ message: "m" }),
        COMPATIBILITY_MISMATCH_CODE,
        "PERSISTENCE_COMPATIBILITY_MISMATCH",
      ],
    ] as const;

    for (const [error, code, tag] of cases) {
      expect(error._tag).toBe(tag);
      expect(error.code).toBe(code);
      expect(error).toBeInstanceOf(Error);
    }
  });

  it("projects error-severity diagnostics byte-identically to DiagnosticCollector.addError", () => {
    const viaCollector = new DiagnosticCollector();
    viaCollector.addError(CORRUPT_SAVE_CODE, "boom", {
      stage: "persistence.load",
      remediation: "fix it",
    });

    const viaError = new DiagnosticCollector();
    viaError.add(
      new PersistenceCorruptSaveError({
        message: "boom",
        stage: "persistence.load",
        remediation: "fix it",
      }).toDiagnostic(),
    );

    expect(viaError.toJSON()).toBe(viaCollector.toJSON());
    expect(viaError.toHuman()).toBe(viaCollector.toHuman());
  });

  it("projects the legacy-save warning exactly like DiagnosticCollector.addWarning", () => {
    const viaCollector = new DiagnosticCollector();
    viaCollector.addWarning(LEGACY_SAVE_CODE, "legacy save", { stage: "persistence.load" });

    const viaError = new DiagnosticCollector();
    viaError.add(
      new PersistenceLegacySaveError({
        message: "legacy save",
        stage: "persistence.load",
      }).toDiagnostic(),
    );

    expect(viaError.toJSON()).toBe(viaCollector.toJSON());
    expect(viaError.hasErrors).toBe(false);
    expect(viaError.warnings).toHaveLength(1);
  });

  it("defaults stage to unknown, matching the collector", () => {
    expect(new PersistenceMissingSaveError({ message: "m" }).toDiagnostic()).toEqual({
      code: MISSING_SAVE_CODE,
      severity: "error",
      stage: "unknown",
      message: "m",
      sourceLocation: undefined,
      entityId: undefined,
      relatedLocations: undefined,
      remediation: undefined,
    });
  });
});
