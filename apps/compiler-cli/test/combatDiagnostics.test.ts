import { describe, it, expect } from "vite-plus/test";
import { CombatInvariantError } from "@bluewave/combat/core";
import { BluewaveError } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { reportBluewaveError, runCombatOperation } from "../src/combatDiagnostics.js";

describe("reportBluewaveError", () => {
  it("reports the error's message as both code and message, and folds context into remediation", () => {
    const collector = new DiagnosticCollector();
    const error = new BluewaveError("GUNNERY_ACCURACY_FACTOR_MISSING", { factor: "range" });
    reportBluewaveError(error, collector, "gunnery:resolve-shot");
    expect(collector.errors).toHaveLength(1);
    const [diagnostic] = collector.errors;
    expect(diagnostic.code).toBe("GUNNERY_ACCURACY_FACTOR_MISSING");
    expect(diagnostic.message).toBe("GUNNERY_ACCURACY_FACTOR_MISSING");
    expect(diagnostic.stage).toBe("gunnery:resolve-shot");
    expect(diagnostic.remediation).toBe(JSON.stringify({ factor: "range" }));
  });

  it("omits remediation when the error carries no context", () => {
    const collector = new DiagnosticCollector();
    const error = new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {});
    reportBluewaveError(error, collector, "battle:advance-minute");
    expect(collector.errors[0].remediation).toBeUndefined();
  });
});

describe("runCombatOperation", () => {
  it("returns the value on success without touching the collector", () => {
    const collector = new DiagnosticCollector();
    const result = runCombatOperation(() => 42, collector, "battle:generate");
    expect(result).toEqual({ outcome: "success", value: 42 });
    expect(collector.hasErrors).toBe(false);
  });

  it("reports a BluewaveError as a validation-error outcome", () => {
    const collector = new DiagnosticCollector();
    const result = runCombatOperation(
      () => {
        throw new BluewaveError("GUNNERY_AMMUNITION_UNAVAILABLE", { batteryId: "b1" });
      },
      collector,
      "gunnery:resolve-shot",
    );
    expect(result).toEqual({ outcome: "validation-error" });
    expect(collector.errors).toHaveLength(1);
    expect(collector.errors[0].code).toBe("GUNNERY_AMMUNITION_UNAVAILABLE");
  });

  it("reports a non-BluewaveError as an internal-error outcome", () => {
    const collector = new DiagnosticCollector();
    const result = runCombatOperation(
      () => {
        throw new Error("unexpected engine bug");
      },
      collector,
      "battle:advance-minute",
    );
    expect(result).toEqual({ outcome: "internal-error" });
    expect(collector.errors).toHaveLength(1);
    expect(collector.errors[0].code).toBe("INTERNAL_ERROR");
    expect(collector.errors[0].message).toBe("unexpected engine bug");
  });

  it("routes a tagged CombatInvariantError to internal-error (it is not a BluewaveError)", () => {
    const collector = new DiagnosticCollector();
    const result = runCombatOperation(
      () => {
        throw new CombatInvariantError({
          message: "AIR_COMBAT_RECORD_INTEGRITY_FAILURE",
          code: "AIR_COMBAT_RECORD_INTEGRITY_FAILURE",
        });
      },
      collector,
      "battle:resolve-shot",
    );
    expect(result).toEqual({ outcome: "internal-error" });
    expect(collector.errors).toHaveLength(1);
    expect(collector.errors[0].code).toBe("INTERNAL_ERROR");
    expect(collector.errors[0].message).toBe("AIR_COMBAT_RECORD_INTEGRITY_FAILURE");
  });

  it("reports a thrown non-Error value as an internal-error outcome", () => {
    const collector = new DiagnosticCollector();
    const result = runCombatOperation(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "not an Error instance";
      },
      collector,
      "battle:advance-minute",
    );
    expect(result).toEqual({ outcome: "internal-error" });
    expect(collector.errors[0].message).toBe("not an Error instance");
  });
});
