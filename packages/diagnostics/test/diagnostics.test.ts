import { describe, it, expect } from "vite-plus/test";
import { DiagnosticCollector, DiagnosticError, type DiagnosticCode } from "../src/index.js";

describe("DiagnosticCollector", () => {
  it("starts empty", () => {
    const c = new DiagnosticCollector();
    expect(c.all).toHaveLength(0);
    expect(c.hasErrors).toBe(false);
  });

  it("collects errors", () => {
    const c = new DiagnosticCollector();
    c.addError("TEST-ERR", "Something went wrong", { stage: "test" });
    expect(c.all).toHaveLength(1);
    expect(c.hasErrors).toBe(true);
    expect(c.errors).toHaveLength(1);
    expect(c.warnings).toHaveLength(0);
  });

  it("collects warnings", () => {
    const c = new DiagnosticCollector();
    c.addWarning("TEST-WARN", "Be careful", { stage: "test" });
    expect(c.all).toHaveLength(1);
    expect(c.hasErrors).toBe(false);
    expect(c.warnings).toHaveLength(1);
  });

  it("collects info", () => {
    const c = new DiagnosticCollector();
    c.addInfo("TEST-INFO", "FYI", { stage: "test" });
    expect(c.all).toHaveLength(1);
  });

  it("generates human-readable output", () => {
    const c = new DiagnosticCollector();
    c.addError("TEST-ERR", "failure", {
      stage: "check",
      sourceLocation: { path: "file.json", line: 5 },
    });
    const output = c.toHuman();
    expect(output).toContain("TEST-ERR");
    expect(output).toContain("file.json:5");
  });

  it("generates JSON output", () => {
    const c = new DiagnosticCollector();
    c.addError("TEST-ERR", "failure", { stage: "check" });
    const json = c.toJSON();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].code).toBe("TEST-ERR");
  });

  it("clears diagnostics", () => {
    const c = new DiagnosticCollector();
    c.addError("TEST-ERR", "failure", { stage: "test" });
    c.clear();
    expect(c.all).toHaveLength(0);
  });
});

describe("DiagnosticError", () => {
  it("is a tagged, yieldable Error carrying the diagnostic fields", () => {
    const error = new DiagnosticError({
      code: "TEST-ERR" as DiagnosticCode,
      message: "Something went wrong",
      stage: "test",
    });
    expect(error._tag).toBe("DiagnosticError");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("TEST-ERR");
    expect(error.message).toBe("Something went wrong");
    expect(error.stage).toBe("test");
  });

  it("projects onto a Diagnostic with error severity and default stage", () => {
    const error = new DiagnosticError({
      code: "TEST-ERR" as DiagnosticCode,
      message: "failure",
      sourceLocation: { path: "file.json", line: 5 },
      entityId: "ship-1",
      remediation: "fix it",
    });
    expect(error.toDiagnostic()).toEqual({
      code: "TEST-ERR",
      severity: "error",
      stage: "unknown",
      message: "failure",
      sourceLocation: { path: "file.json", line: 5 },
      entityId: "ship-1",
      relatedLocations: undefined,
      remediation: "fix it",
    });
  });

  it("collects identically to addError for the same input (facade parity)", () => {
    const direct = new DiagnosticCollector();
    direct.addError("TEST-ERR", "failure", {
      stage: "check",
      sourceLocation: { path: "file.json", line: 5 },
      entityId: "ship-1",
      remediation: "fix it",
    });

    const viaError = new DiagnosticCollector();
    viaError.add(
      new DiagnosticError({
        code: "TEST-ERR" as DiagnosticCode,
        message: "failure",
        stage: "check",
        sourceLocation: { path: "file.json", line: 5 },
        entityId: "ship-1",
        remediation: "fix it",
      }).toDiagnostic(),
    );

    expect(viaError.toJSON()).toBe(direct.toJSON());
    expect(viaError.toHuman()).toBe(direct.toHuman());
  });
});
